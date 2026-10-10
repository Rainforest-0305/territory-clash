/**
 * ############################################################################
 * ##  전면광고 게이트 v2 — 땅따먹기 (Territory Clash)                       ##
 * ############################################################################
 *
 * 설계 정본: ADGATE_V2_SPEC.md (Partner 승인 2026-08-14)
 * President 지시: 「2판마다 · 첫 판 제외 · 전면형」
 *
 * ── ★게임 코드 무접촉 원칙 ─────────────────────────────────────────────────
 * `src/game/**` 은 «한 글자도» 고치지 않는다. 이 게이트는 전부
 *   (a) DOM 관측(MutationObserver)  (b) 캡처 단계 클릭 가로채기 + 재발화
 * 로만 게임에 붙는다. 게임 규칙·맵·봇·기록·저장 키에 «절대» 손대지 않는다.
 *
 * ── 이 게임의 구조 (실측) ───────────────────────────────────────────────────
 * 땅따먹기는 래핑한 game.js 가 아니라 우리가 만든 TypeScript 게임이다.
 *   startSession()  index.ts:365  ← 「판 시작」. 호출처 «정확히 2곳»
 *                     · index.ts:212  결과화면 「다시하기」 (onRestart)
 *                     · index.ts:297  메뉴 「시작」      (menu.onStart)
 *                   ★ 둘 다 항상 `new World(...)` 다 — «이어하기가 없다».
 *                     (피고지고에서 setScreen("play") 2곳 중 1곳이 이어하기라
 *                      매판 광고가 됐던 함정이 여기엔 «구조적으로» 없다)
 *   endSession()    index.ts:403  ← 「판 완주」. 호출처 «정확히 1곳»
 *                     · index.ts:515  `if (w.phase==='over' && !resultShown)`
 *                   → hud.showResult() → `.tc-result` 에 class `show` 부착
 *                   ★ `.tc-result` 의 `show` 부착은 전 파일에서 hud.ts:567
 *                     «한 곳»뿐이다 → 판당 정확히 1회 (grep 실측)
 *
 * ── 판이 끝나는 경로 «전수» (실측) ─────────────────────────────────────────
 * World.finish() 호출처 6곳 — 전부 phase='over' 로 수렴한다:
 *   sim.ts:362  시간 만료 (timeLeft<=0)          ← 주 경로(1·3·5분)
 *   sim.ts:304  부활 수락했으나 빈 자리 없음
 *   sim.ts:321  부활 «거절» 버튼
 *   sim.ts:354  부활 제안 5초 무응답 타임아웃
 *   sim.ts:730  완전 봉쇄 + 부활 이미 사용
 *   sim.ts:742  리스폰 실패(centroid 없음)
 * phase 변경은 오직 World.update() 안에서 일어나고, update() 는 paused 일 때
 * 호출되지 않는다 → 「일시정지 중에 판이 끝나서 결과화면을 건너뛰는」 경로는
 * 존재하지 «않는다». 즉 판이 'over' 에 닿으면 결과화면은 «항상» 뜬다.
 *
 * 결과화면을 «안 거치는» 유일한 종료 = 판 도중 앱 자체가 죽는 것:
 *   · 일시정지 → 뒤로가기 → 종료확인 모달 → 「나가기」 → closeView()
 *   · 백그라운드에서 OS 가 앱을 회수
 * → 이건 메모리 상태로는 못 잡는다. 그래서 `pend`(진행 중인 판)를 «영속»해
 *   다음 부팅 때 소급 확정한다. §D4 참고.
 *
 * ── ★계수와 노출의 분리 ────────────────────────────────────────────────────
 *   계수: ① 결과화면 등장(판 완주)  ② 판 시작 시 «직전 판» 소급 확정
 *         ③ 부팅 시 «지난 세션의 미확정 판» 소급 확정
 *         → 전부 finalizeRun() 한 곳으로 들어간다. ★멱등
 *   노출: ① 결과화면 «이탈» 시(다시하기·모드변경 버튼)
 *         ② 판 «시작 직전»(광고가 끝난 뒤에야 startSession 이 실행된다)
 *         ⛔ 결과화면 «등장» 직후 금지 — 기록·점수를 가린다
 *         ⛔ 플레이 «중» 절대 금지
 */
import { storage } from '../toss'; // ★ 2026-08-22: '../toss/storage' 직접 import가 shim을 우회하고 있었다(배럴만 가로채는 구조). 배럴 경유로 수정.
import { adSdk, type ShowEvent } from './adSdk';
import { trackAdRequestFail, trackAdGuardBlocked, type AdGuardReason } from '../analytics/track';
import { kstDateKey, nowMs } from '../lib/daykey'; // ★2026-09-12 정책 가드 — 「하루」의 정본은 이 파일 하나다
import { AD_GROUP_ID } from './adConfig'; // ★2026-08-22: ID 리터럴도 배럴로(check-ad-leak.py 가 웹 빌드에서 리터럴을 검출함)

// ═══════════════════════════════════════════════════════════════════════════
// 상수 — President 가 바꾸라 하면 «여기만» 고친다(AD_GROUP_ID는 adConfig.ts로 이동)
// ═══════════════════════════════════════════════════════════════════════════

/** 「2판마다」 = President 지시. 첫 판은 제외된다(plays 1 → 1%2!==0). */
const AD_EVERY = 2;

/** ★D2 — load 콜백 무응답 상한. 이게 «먼저» 있어야 D1 재시도가 산다. */
const PRELOAD_TIMEOUT_MS = 5_000;

/**
 * ★D1 — 백오프. 인덱스 = 지금까지의 실패 횟수.
 *
 * ★★[미검증] 이 수열은 Partner 가 정한 «임의값»이다. 업계 수치·SDK 문서 근거 «없음».
 *   실사용 데이터가 쌓이면 재검토할 것. 근거를 물으면 «없다»가 정답이다.
 *   (Partner 원문 그대로 옮긴다 — 「내가 지어낸 숫자다. 업계 관행도, 토스 SDK 문서도
 *    확인하지 않았다」. 나중에 이 값을 «검증된 것»으로 오해하지 마라.)
 */
const PRELOAD_BACKOFF_MS = [5_000, 15_000, 45_000, 120_000, 300_000, 300_000];

/**
 * ★D1 — 실패 상한. 이걸 넘으면 이 «세션» 동안 더 시도하지 않는다.
 * ★★[미검증] 위와 «같은 출처»의 임의값(6). 근거 없음. 실데이터로 재검토할 것.
 */
const MAX_PRELOAD_FAILS = 6;

/**
 * ★DF-4 ①  광고가 «열리지 않을» 때만의 상한.
 *   show/impression 이 오면 «해제»된다 — 광고가 실제로 열렸다는 뜻이므로.
 */
const SHOW_OPEN_TIMEOUT_MS = 7_000;

/**
 * ★DF-4 ②  광고가 열린 «뒤»의 안전망. 사실상 발동하지 않는다.
 *   ⛔ 단일 5초 타임아웃으로 합치지 «마라» — 광고를 5초 넘게 보면
 *      게임이 광고 «뒤에서» 시작돼 버린다(4종에서 확정된 결함).
 */
const SHOW_HARD_CAP_MS = 180_000;

/**
 * ★최소 자격 ① — «같은 세션»에서 판을 확정할 때의 최소 시간.
 *
 * [실측] _adgate_verify/minplay.ts — 게임 sim 을 «원본 그대로» 헤드리스 실행.
 *   표본: 3모드 × 3정책(방치/자살돌진/자살후부활거절) × 2난이도 × 15시드 = 270판
 *   1분  모드: 전 조합 «항상» 61.12초 (조기 종료가 표본 안에서 0건)
 *   3분  모드: 최단 53.48초 (자살 돌진 후 부활 즉시 거절, seed 11)
 *   5분  모드: 최단 68.37초
 *
 * ★★최단 한 판 = «31.78 ~ 59.88초» (12회 실측 «밴드») ─────────────────────
 *   ⛔「53.48초」를 «점 값»으로 읽지 마라. 그건 «한 번의 표본»일 뿐이다.
 *   왜 흔들리나: bots.ts 가 Math.random() 을 «6곳»에서 쓴다 → 한 판 길이가
 *   «비결정적»이다. 같은 스크립트를 다시 돌리면 매번 다른 값이 나온다.
 *   [실측] 독립 관측 2건이 «서로 달랐다»: 53.48초 / 35.75초(minplay.log 직독).
 *          12회 재실측 밴드 = 31.78 ~ 59.88초.
 *   ⇒ 정확한 표현은 「하한이 «약 31.8초»이고 «변동한다»」다.
 *   (정정 근거: _NEXT_BUILD_MUST_FIX.md — Partner 지시 2026-08-14)
 *
 * ★정직성: 위 값은 «표본 밴드»지 «증명된 하한»이 아니다.
 *   [실측] 270판 표본에서 밴드 아래로 내려간 판은 «없었다».
 *   [추정] 더 빠른 종료 경로가 «없다»는 것 — 봇 행동은 확률적이라 전수가 아니다.
 *   ⛔따라서 「최소 53초 보장」이라고 쓰면 «과장»이다. 「표본 내 밴드」가 정확한 표현이다.
 *   ★그리고 어떤 시간 임계값도 «자동화 방어가 아니다» — 사람 연타만 막는다.
 *
 * 그래도 5초를 두는 이유는 어뷰징 방어가 «아니라», 클릭이 두 번 들어가는 등
 * 「판 시작 신호가 헛발화」했을 때 0초짜리 유령 판이 세어지는 걸 막기 위해서다.
 * 실제 판(밴드 최솟값 31.78초)은 이 조건에 «절대» 걸리지 않는다 — 1/6 여유다.
 * ⛔상수값 5000 도 판정 논리도 «건드리지 않았다». 고친 것은 «수치 표현»뿐이다.
 * ⛔ 게임 내부 지역변수에 접근하지 «않는다» — 우리가 찍은 타임스탬프만 쓴다.
 */
const MIN_PLAY_MS = 5_000;

/**
 * ★최소 자격 ② — «세션을 넘어» 복구된 판(앱이 판 도중 죽은 경우)의 최소 시간.
 *   벽시계로 재면 며칠 뒤 재실행에서도 「오래 했다」로 통과해 버린다.
 *   그래서 시간을 «나중에» 재지 않고, 판이 살아 있는 동안 이 시간을 넘기면
 *   그 시점에 `ok=1` 을 «영속»해 둔다. 부팅 때는 그 표식만 본다.
 * ★MIN_PLAY_MS 와 «따로» 둔다 — 한쪽만 고쳐도 다른 쪽이 안 바뀌게.
 */
const MIN_PLAY_MS_RESUMED = 15_000;

/**
 * 영속 키. ⛔ 게임의 KEYS(storage.ts)에 «추가하지 않는다» —
 * 거긴 게임 세이브 전용이라 의미가 섞이면 안 된다. 네임스페이스만 맞춘다.
 */
const STORE_KEY = 'tc:ads.v2';

/* ═══════════════════════════════════════════════════════════════════════════
 * ★★전면형 «정책 가드» — 2026-09-12 신설 (Codex 리뷰 P1-1)
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔이 코드에는 원래 «없었다». 있던 것은 AD_EVERY(2판마다)·MIN_PLAY_MS 뿐이고
 *   「세션 시작 60초 이내 0회 · 하루 3회 · 10분 간격」은 한 줄도 없었다.
 *   [Codex 실측] 6초짜리 완료 판정을 8회 넣자 «시작 후 12·24·36·48초에 표시 4회» —
 *   세 가지를 «모두» 위반한다.
 *
 * 왜 넣나: 정책 위반으로 지면이 제한되면 노출이 «0» 이 된다. 노출이 [추정] 30~50%
 *   줄어드는 것보다 그쪽 손실이 크다(Partner 결정, 스모 바운스·뱀 키우기와 같은 기준).
 * ★AD_EVERY·MIN_PLAY_MS 는 그대로 둔다. 이 가드는 그 위에 얹히고 «둘 중 엄격한 쪽»이 이긴다.
 * ★되돌리기: 세 상수를 0 으로 두면 각 가드가 꺼진다(0 = 무제한). 코드를 지울 필요가 없다.
 */
/** 세션 시작 후 이 시간 안에는 전면형을 띄우지 않는다. 0 = 끔. */
const MIN_SESSION_AGE_MS = 60_000;
/** 직전 «표시»로부터 이 간격을 두어야 다시 띄운다. 0 = 끔. */
const MIN_GAP_MS = 600_000;
/** 하루(KST) 표시 상한. 0 = 무제한. */
const DAILY_SHOW_CAP = 3;

/** 이 세션이 시작된 시각. 앱을 껐다 켜면 60초가 다시 흐른다(정책 의도 그대로). */
const sessionStartedAt = Date.now();
/** 검사기 전용 — 세션 나이를 앞으로 미는 오프셋. 운영에서는 0 이다. */
let sessionAgeOffset = 0;

export type AdGuardWhy = 'ok' | 'session_start' | 'interval' | 'daily_cap';
export interface AdGuardResult {
  ok: boolean;
  why: AdGuardWhy;
  sessionAgeMs: number;
  /** 직전 표시 이후 경과(ms). 이력이 없으면 -1. */
  sinceLastMs: number;
  shownToday: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 상태
// ═══════════════════════════════════════════════════════════════════════════

/** 진행 중인 판. 메모리 쪽은 «멱등성 판정»에만 쓴다. */
interface Pending {
  /** 판 시작 시각(epoch ms) */
  at: number;
  /** MIN_PLAY_MS_RESUMED 를 넘겨 「진짜 한 판」으로 인정된 표식 */
  ok: 0 | 1;
}

interface Counter {
  plays: number;
  /**
   * ★D3 — «boolean» 이다(0|1). 정수 카운터로 만들면 빚이 쌓여
   *   매판 광고가 터진다. 절대 숫자로 누적하지 마라.
   */
  debt: 0 | 1;
  pend: Pending | null;
  /** ★2026-09-12 정책 가드 — 마지막 «표시» 시각(epoch ms). 0 = 이력 없음. «순수 추가»라 옛 기록과 호환된다. */
  lastShownAt: number;
  /** shownToday 가 세고 있는 날(KST 'YYYY-MM-DD'). */
  shownDay: string;
  /** 그날 표시 수. */
  shownToday: number;
}

const EMPTY_COUNTER: Counter = { plays: 0, debt: 0, pend: null, lastShownAt: 0, shownDay: '', shownToday: 0 };

let counter: Counter = { ...EMPTY_COUNTER };

/** 오늘(KST) 표시 수. 날짜가 바뀌었으면 0 — 저장된 수를 «날짜와 함께» 읽는다. */
function shownTodayCount(): number {
  return counter.shownDay === kstDateKey(nowMs()) ? counter.shownToday : 0;
}

/**
 * 지금 전면형을 띄워도 «정책상» 되는가. 순수 판정 — 부작용이 없다(그래서 대조하기 쉽다).
 * ⛔요청(load)도 이 판정을 통과할 때만 나간다. 못 띄우는데 미리 받아두면 요청만 늘고
 *   노출은 안 늘어 광고 시청률(노출/요청)이 떨어진다.
 */
export function adGuards(now: number = Date.now()): AdGuardResult {
  const sessionAgeMs = now - sessionStartedAt + sessionAgeOffset;
  const sinceLastRaw = counter.lastShownAt ? now - counter.lastShownAt : Number.POSITIVE_INFINITY;
  const base = {
    sessionAgeMs,
    sinceLastMs: counter.lastShownAt ? sinceLastRaw : -1,
    shownToday: shownTodayCount(),
  };
  if (MIN_SESSION_AGE_MS > 0 && sessionAgeMs < MIN_SESSION_AGE_MS) return { ok: false, why: 'session_start', ...base };
  if (MIN_GAP_MS > 0 && sinceLastRaw < MIN_GAP_MS) return { ok: false, why: 'interval', ...base };
  if (DAILY_SHOW_CAP > 0 && base.shownToday >= DAILY_SHOW_CAP) return { ok: false, why: 'daily_cap', ...base };
  return { ok: true, why: 'ok', ...base };
}

/** 광고가 «실제로 유저에게 도달»한 순간 1회. 가드 원장의 유일한 갱신 지점이다. */
function noteShown(): void {
  const today = kstDateKey(nowMs());
  counter.shownToday = (counter.shownDay === today ? counter.shownToday : 0) + 1;
  counter.shownDay = today;
  counter.lastShownAt = Date.now();
}

/**
 * 지금 화면이 가려져 있는가(Codex 리뷰 P1-2).
 * ⛔숨김 상태에서 광고를 «요청»하면 그 요청은 노출로 이어질 수 없다 — 요청만 늘고 시청률이 떨어진다.
 */
function isHidden(): boolean {
  try {
    return typeof document !== 'undefined' && document.visibilityState === 'hidden';
  } catch {
    return false;
  }
}

/** 검사기 전용 — 세션 나이를 앞으로 민다(운영 코드는 부르지 않는다). */
export function __advanceGuardClockForTest(ms: number): void {
  sessionAgeOffset += ms;
}
/** 검사기 전용 — 가드 상태 스냅샷. */
export function __adGuardSnapshot(): AdGuardResult & { consts: { sessionMs: number; gapMs: number; dailyCap: number } } {
  return { ...adGuards(), consts: { sessionMs: MIN_SESSION_AGE_MS, gapMs: MIN_GAP_MS, dailyCap: DAILY_SHOW_CAP } };
}

/** ★규율 2 — 하이드레이트는 «비동기»다. 모든 카운터 변경은 이 뒤에 줄 세운다. */
let hydrateP: Promise<void> | null = null;
/** 카운터 변경 직렬화 큐. 하이드레이트 완료 전 발생한 변경도 «유실되지 않는다». */
let tail: Promise<void> = Promise.resolve();

/** 메모리 전용 — 재진입 시 두 번 세지 않기 위한 동기 가드 */
let runPending: Pending | null = null;
let okTimer: ReturnType<typeof setTimeout> | null = null;

// 로드 상태
let adReady = false;
let loading = false;
let loadFails = 0;
let loadTimer: ReturnType<typeof setTimeout> | null = null;
/** ★loadFullScreenAd 의 반환값 = 구독 «해지» 함수. 재시도 전 반드시 부른다. */
let unsubLoad: (() => void) | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

let installed = false;

// ═══════════════════════════════════════════════════════════════════════════
// 영속
// ═══════════════════════════════════════════════════════════════════════════

function sanitize(v: unknown): Counter {
  const o = (v ?? {}) as Partial<Counter>;
  const plays = Number.isFinite(o.plays) && (o.plays as number) >= 0 ? Math.floor(o.plays as number) : 0;
  const debt = o.debt === 1 ? 1 : 0;
  let pend: Pending | null = null;
  const p = o.pend as Partial<Pending> | null | undefined;
  if (p && Number.isFinite(p.at)) pend = { at: p.at as number, ok: p.ok === 1 ? 1 : 0 };
  const lastShownAt = Number.isFinite(o.lastShownAt) && (o.lastShownAt as number) > 0
    ? Math.floor(o.lastShownAt as number) : 0;
  const shownDay = typeof o.shownDay === 'string' ? o.shownDay : '';
  const shownToday = Number.isFinite(o.shownToday) && (o.shownToday as number) >= 0
    ? Math.min(999, Math.floor(o.shownToday as number)) : 0;
  return { plays, debt, pend, lastShownAt, shownDay, shownToday };
}

/** 절대 throw 하지 않는다. 저장 실패로 게임이 죽으면 안 된다. */
function persist(): void {
  const snap: Counter = {
    plays: counter.plays, debt: counter.debt, pend: counter.pend,
    lastShownAt: counter.lastShownAt, shownDay: counter.shownDay, shownToday: counter.shownToday,
  };
  void storage.setItem(STORE_KEY, JSON.stringify(snap)).catch(() => {});
}

/**
 * ★D4 — 네이티브 Storage 미러에서 복원한다(storage.ts 가 토스 안/밖을 알아서 가른다).
 * ★절대 throw 하지 않는다. 실패하면 {0,0,null} 로 시작한다.
 * ★부팅 즉시 광고를 띄우지 «않는다» — 빚이 있어도 다음 «합법 노출 지점»에서만.
 */
async function hydrate(): Promise<void> {
  let loaded: Counter = { ...EMPTY_COUNTER };
  try {
    const raw = await storage.getItem(STORE_KEY);
    if (raw != null) loaded = sanitize(JSON.parse(raw));
  } catch {
    /* 손상된 값 — 기본값으로 간다 */
  }

  // 하이드레이트 «전»에 이미 센 판이 있으면 그걸 «더한다»(덮어쓰기 금지).
  const before = counter.plays;
  const debtBefore = counter.debt;
  counter = {
    plays: loaded.plays + before,
    debt: (loaded.debt || debtBefore) as 0 | 1,
    pend: counter.pend ?? loaded.pend,
    /* ★가드 원장도 «덮어쓰지 않고 더 엄격한 쪽»을 남긴다 — 하이드레이트 전에 이미 표시된 광고가
     *   있었다면(이론상 부팅 직후라 드물다) 그 기록이 저장값보다 최신이다. */
    lastShownAt: Math.max(loaded.lastShownAt, counter.lastShownAt),
    shownDay: counter.shownDay || loaded.shownDay,
    shownToday: Math.max(loaded.shownToday, counter.shownToday),
  };

  // ★지난 세션에서 «판 도중 앱이 죽은» 경우 — 그 판을 소급 확정한다.
  //   ok 표식이 있는 판만 센다(벽시계로 재면 며칠 뒤 실행도 통과해 버린다).
  const stale = loaded.pend;
  if (stale && runPending == null) {
    counter.pend = null;
    if (stale.ok === 1) creditPlay('resumed');
  }
  persist();
}

/** 하이드레이트 뒤로 줄 세운다. 완료 전 호출돼도 순서대로, «유실 없이» 실행된다. */
function enqueue(fn: () => void): void {
  const base = hydrateP ?? Promise.resolve();
  tail = tail.then(() => base).then(fn, fn);
}

// ═══════════════════════════════════════════════════════════════════════════
// 계수 — ★멱등성이 생명
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ★plays 를 증가시키는 «유일한» 함수. grep 로 증명 가능해야 한다.
 *   (adGate.ts 안에서 `counter.plays +=` 는 여기 한 줄뿐이다)
 */
function creditPlay(reason: string): void {
  counter.plays += 1;
  if (counter.plays % AD_EVERY === 0) counter.debt = 1;
  console.log(`[adgate] play #${counter.plays} (${reason}) debt=${counter.debt}`);
}

/**
 * ★한 판을 «정확히 한 번» 확정한다. 어디서 몇 번 불려도 안전하다.
 *
 * 멱등성의 뼈대:
 *   1) runPending 이 null 이면 «즉시 반환» — 이미 확정된 판이다
 *   2) 증가 «전»에 runPending 을 비운다 — 재진입·중첩 호출에도 1회
 *   3) 실제 증가는 creditPlay() 한 곳뿐 (§enqueue 로 직렬화)
 */
function finalizeRun(reason: string): void {
  const r = runPending;
  if (!r) return; // ★★멱등성의 핵심
  runPending = null; // ★먼저 비운다
  if (okTimer != null) {
    clearTimeout(okTimer);
    okTimer = null;
  }
  const qualified = r.ok === 1 || Date.now() - r.at >= MIN_PLAY_MS;
  enqueue(() => {
    counter.pend = null;
    if (qualified) creditPlay(reason);
    else console.log('[adgate] run discarded (too short)');
    persist();
  });
}

/** 판이 시작됐다. 직전 판을 소급 확정하고, 이번 판을 진행 중으로 표시한다. */
function armRun(): void {
  finalizeRun('start-retro'); // ① 직전 판 소급 확정 (멱등)
  const p: Pending = { at: Date.now(), ok: 0 };
  runPending = p;
  enqueue(() => {
    counter.pend = { at: p.at, ok: 0 };
    persist();
  });
  // ★판이 살아 있는 동안 「진짜 한 판」 표식을 «영속»해 둔다.
  //   그래야 앱이 판 도중 죽어도 다음 부팅에서 이 판을 셀 수 있다.
  if (okTimer != null) clearTimeout(okTimer);
  okTimer = setTimeout(() => {
    okTimer = null;
    if (runPending !== p) return;
    p.ok = 1;
    enqueue(() => {
      if (counter.pend && counter.pend.at === p.at) {
        counter.pend.ok = 1;
        persist();
      }
    });
  }, MIN_PLAY_MS_RESUMED);
}

// ═══════════════════════════════════════════════════════════════════════════
// 로드 — ★D1 재시도 + ★D2 타임아웃
// ═══════════════════════════════════════════════════════════════════════════

function clearLoadTimer(): void {
  if (loadTimer != null) {
    clearTimeout(loadTimer);
    loadTimer = null;
  }
}

/** ★재시도 전 반드시 이전 구독을 해지한다 — 안 하면 구독이 중첩된다. */
function dropSubscription(): void {
  const u = unsubLoad;
  unsubLoad = null;
  if (u) {
    try {
      u();
    } catch {
      /* noop */
    }
  }
}

/**
 * ★계측(2026-08-22 추가) — reason 은 카운팅/타이머 로직에 «전혀» 관여하지
 *   않는다. track() 호출 한 줄만 얹는 것이고, 그 자리에서 어떤 경로로 왔는지
 *   (타임아웃 vs SDK onError vs 동기 throw) 구분해 표준 스키마로 남긴다.
 */
function onLoadFailed(reason: 'timeout' | 'onError'): void {
  clearLoadTimer();
  dropSubscription();
  adReady = false;
  loading = false;
  loadFails += 1;
  console.log(`[adgate] preload failed (${loadFails}/${MAX_PRELOAD_FAILS})`);
  trackAdRequestFail('interstitial', reason);
}

/** ★계측 — 「미지원」은 세션당 한 번만 남긴다(requestPreload 가 유저 행동마다 preload()
 *   를 다시 부르므로, 매번 남기면 로그가 과다해진다. 상태 자체는 세션 내내 안 바뀐다). */
let unsupportedTracked = false;

function preload(): void {
  // ★D2 가 loading 을 반드시 풀어 주기 때문에 이 가드가 영구 고착되지 않는다.
  if (adReady || loading) return;
  if (loadFails >= MAX_PRELOAD_FAILS) return;
  /* ★P1-2 (2026-09-12) — 화면이 가려져 있으면 요청하지 않는다.
   *   [Codex 실측] visibilityState='hidden' 에서 설치하자 로드 호출 1회가 나갔다.
   *   숨김 중 요청은 노출로 이어질 수 없다 = 시청률만 깎는다. 다시 보일 때 유저 행동이 재시도를 부른다. */
  if (isHidden()) {
    console.log('[adgate] preload skipped (hidden)');
    return;
  }
  /* ★P1-1 (2026-09-12) — 정책상 «지금 띄울 수 없으면» 받지도 않는다. */
  {
    const g = adGuards();
    if (!g.ok) {
      console.log(`[adgate] preload skipped (guard:${g.why})`);
      return;
    }
  }
  if (!safeIsSupported()) {
    if (!unsupportedTracked) {
      unsupportedTracked = true;
      trackAdRequestFail('interstitial', 'unsupported');
    }
    return;
  }

  // 같은 판 안에서 연달아 불릴 때의 하한선 — 백오프.
  loading = true;
  clearLoadTimer();
  dropSubscription();

  loadTimer = setTimeout(() => {
    // ★D2 — SDK 가 콜백을 «아예 안 주는» 경우. loading 이 영구 true 로 굳어
    //   재시도조차 막히던 결함을 여기서 푼다.
    console.log('[adgate] preload timeout');
    onLoadFailed('timeout');
  }, PRELOAD_TIMEOUT_MS);

  try {
    unsubLoad = adSdk.load({
      options: { adGroupId: AD_GROUP_ID },
      onEvent: (e) => {
        if (e?.type !== 'loaded') return;
        clearLoadTimer();
        adReady = true;
        loading = false;
        loadFails = 0;
        console.log('[adgate] ad loaded');
      },
      onError: () => onLoadFailed('onError'),
    });
  } catch {
    onLoadFailed('onError');
  }
}

/**
 * ★재시도 트리거는 «타이머가 아니라 유저 행동»이다(판 종료·광고 스킵 직후).
 *   앱이 놀 때 배터리를 안 먹고, 판 하나가 최소 53초라 연타가 구조적으로 불가능하다.
 *   백오프는 「같은 판 안에서 연달아 불릴 때」의 하한선으로만 쓴다.
 * ⛔ 실패 카운터를 영속하지 «않는다» — 영구 소진돼 다음 세션에 아예 안 뜬다.
 */
function requestPreload(): void {
  if (adReady || loading) return;
  if (loadFails === 0) {
    preload();
    return;
  }
  if (loadFails >= MAX_PRELOAD_FAILS) return;
  if (retryTimer != null) return;
  const wait = PRELOAD_BACKOFF_MS[Math.min(loadFails - 1, PRELOAD_BACKOFF_MS.length - 1)]!;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    /* ★P1-2 — 예약해 둔 재시도가 «실행되는 순간»에도 가시성을 다시 본다.
     *   예약 시점엔 보였어도 그 사이 숨겨졌을 수 있다(preload() 안 검사와 중복이지만,
     *   여기서 막아야 로그·상태가 깔끔하고 검사 지점이 분명해진다). */
    if (isHidden()) {
      console.log('[adgate] retry skipped (hidden)');
      return;
    }
    preload();
  }, wait);
}

/**
 * ★P1-2 — 숨김으로 «전환»되는 순간 예약된 재시도와 진행 중인 구독을 정리한다.
 *   남겨 두면 백그라운드에서 타이머가 깨어나 요청이 나간다.
 *   ⛔다시 보일 때 자동으로 요청하지 «않는다» — 재시도 트리거는 여전히 «유저 행동»이다.
 */
function onVisibilityChange(): void {
  if (!isHidden()) return;
  if (retryTimer != null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (loading) {
    // 진행 중이던 로드는 구독을 끊고 상태를 되돌린다(다음 유저 행동에서 새로 받는다).
    clearLoadTimer();
    dropSubscription();
    loading = false;
  }
  console.log('[adgate] hidden — pending ad requests cancelled');
}

function safeIsSupported(): boolean {
  try {
    return adSdk.isSupported();
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 노출 — ★D3: 스킵해도 「빚」을 소비하지 않는다
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 광고를 실제로 띄운다. done() 은 «반드시 정확히 한 번» 불린다.
 * ★DF-4 — 타임아웃을 «2개»로 나눈다.
 *   SHOW_OPEN_TIMEOUT_MS : 광고가 «열리지 않을» 때만. show/impression 오면 해제
 *   SHOW_HARD_CAP_MS     : 열린 뒤의 안전망
 */
function show(done: () => void): void {
  let finished = false;
  let openTimer: ReturnType<typeof setTimeout> | null = null;
  let capTimer: ReturnType<typeof setTimeout> | null = null;
  let unsub: (() => void) | null = null;

  const finish = (why: string): void => {
    if (finished) return; // ★정확히 한 번
    finished = true;
    if (openTimer != null) clearTimeout(openTimer);
    if (capTimer != null) clearTimeout(capTimer);
    openTimer = null;
    capTimer = null;
    const u = unsub;
    unsub = null;
    if (u) {
      try {
        u();
      } catch {
        /* noop */
      }
    }
    adReady = false;
    console.log(`[adgate] show finished (${why})`);
    /**
     * ★계측 — why 를 표준 사유로 매핑한다. 'dismissed'(정상 시청 후 닫음)와
     *   'hard-cap'(열린 뒤 3분 안전망 — 광고 자체는 이미 열렸다)은 «실패»가
     *   아니므로 여기서 제외한다.
     */
    if (why === 'open-timeout') trackAdRequestFail('interstitial', 'timeout');
    else if (why === 'error' || why === 'throw') trackAdRequestFail('interstitial', 'onError');
    else if (why === 'failedToShow') trackAdRequestFail('interstitial', 'noFill');
    // 광고가 끝난 «직후» 다음 것을 미리 받아 둔다 (유저 행동 트리거).
    requestPreload();
    done();
  };

  openTimer = setTimeout(() => finish('open-timeout'), SHOW_OPEN_TIMEOUT_MS);
  capTimer = setTimeout(() => finish('hard-cap'), SHOW_HARD_CAP_MS);

  try {
    unsub = adSdk.show({
      options: { adGroupId: AD_GROUP_ID },
      onEvent: (e: ShowEvent) => {
        // ★광고가 «열렸다»는 증거가 오면 open 타임아웃만 해제한다.
        //   여기서 hard cap 까지 풀면 안 된다 — 안전망이 사라진다.
        if (e?.type === 'show' || e?.type === 'impression') {
          if (openTimer != null) {
            clearTimeout(openTimer);
            openTimer = null;
          }
          return;
        }
        if (e?.type === 'dismissed' || e?.type === 'failedToShow') finish(e.type);
      },
      onError: () => finish('error'),
    });
  } catch {
    finish('throw');
  }
}

/**
 * ★리워드 부활을 쓴 판이면 이번 «한 번»의 노출 지점을 건너뛴다 (2026-09-05).
 *
 * 왜: 리워드 광고를 보고 부활 → 판 종료 → 결과화면 이탈에서 전면광고가 뜨면
 *     한 판에 전면광고가 «연속 2편»이 된다. 광고 정책상 위험하고, 보상형 광고를
 *     본 유저에게 곧바로 강제 광고를 물리는 것은 체감으로도 최악이다.
 *
 * ★빚(debt)은 «소비하지 않는다» — 판 계수(creditPlay)도 그대로다. 빚은 남아
 *   다음 노출 지점(메뉴 시작·다음 판 결과 이탈)에서 정상적으로 소비된다.
 *   즉 광고 «총량»이 줄지 않고 «순간의 연타»만 흩어진다.
 *   (이 동작은 D3 「준비 안 됨」 경로와 정확히 같은 모양이다)
 */
let suppressOnce = false;

/**
 * game/index.ts 가 리워드 획득 «직후» 부른다. 다음 노출 지점 «한 곳»에서만
 * 효력이 있고 그 자리에서 소진된다(판이 바뀌어도 남아 있지 않는다).
 */
export function suppressNextInterstitial(): void {
  suppressOnce = true;
  console.log('[adgate] next interstitial suppressed (rewarded revive)');
}

/**
 * 합법 노출 지점에서만 호출한다. done() 은 «반드시 정확히 한 번» 불린다.
 * ★D3 — 준비가 안 됐으면 «빚을 소비하지 않는다». 다음 지점에서 다시 시도한다.
 */
function maybeShowAd(done: () => void): void {
  if (suppressOnce) {
    suppressOnce = false;
    console.log(`[adgate] interstitial skipped (rewarded-revive) debt=${counter.debt}`);
    return done();
  }
  if (!counter.debt) return done();
  /* ★P1-1 정책 가드 — 세션 60초·10분 간격·하루 3회. AD_EVERY 와 «둘 중 엄격한 쪽»이 이긴다.
   *   ⛔여기서 막을 때 빚(debt)은 «소비하지 않는다» — D3 「준비 안 됨」 경로와 정확히 같은 모양이다.
   *     리듬이 미뤄질 뿐 총량이 줄지 않는다. */
  {
    const g = adGuards();
    if (!g.ok) {
      console.log(`[adgate] interstitial blocked (guard:${g.why}) debt kept`);
      trackAdGuardBlocked('interstitial', g.why as AdGuardReason, {
        session_age_s: Math.round(g.sessionAgeMs / 1000),
        since_last_s: g.sinceLastMs < 0 ? -1 : Math.round(g.sinceLastMs / 1000),
        shown_today: g.shownToday,
      });
      return done();
    }
  }
  if (!adReady) {
    console.log('[adgate] debt kept (ad not ready)');
    // ★계측 — 노출 지점에 도달했는데 준비된 광고가 없다(=noFill 상태). 빚은
    //   그대로 들고 다음 지점으로 넘어간다(카운팅 로직 무접촉, track() 한 줄만 추가).
    trackAdRequestFail('interstitial', 'noFill');
    requestPreload(); // 유저 행동 트리거 재시도
    return done();
  }
  counter.debt = 0;
  noteShown(); // ★가드 원장은 «표시할 때» 갱신한다(요청·로드로는 안 센다)
  persist();
  loadFails = 0; // 표시 성공 → 백오프 리셋
  show(done);
}

// ═══════════════════════════════════════════════════════════════════════════
// DOM 배선 — ★게임 코드 무접촉
// ═══════════════════════════════════════════════════════════════════════════

/** 재발화한 클릭을 다시 가로채지 않기 위한 토큰. */
let refiring: EventTarget | null = null;

/**
 * 판 시작/결과이탈 버튼을 «캡처 단계»에서 가로챈다.
 *
 * ★왜 캡처 + 재발화인가
 *   게임의 리스너는 버튼에 «직접» 달려 있다(hud.ts:568-569, menu.ts:110).
 *   캡처 단계는 그보다 «먼저» 돈다. 여기서 멈춰 광고를 띄우고, 광고가 «끝난 뒤»
 *   같은 클릭을 다시 쏘면 startSession() 이 광고 «후»에 실행된다.
 *   ⛔ 단순 관측만 하면 광고가 뜨는 동안 게임이 «광고 뒤에서» 시작된다.
 *
 * ★동적 생성 대응
 *   결과화면 버튼은 showResult() 가 «매번 새로» 만든다(hud.ts:557-563).
 *   그래서 getElementById 나 버튼 직접 바인딩은 통하지 «않는다».
 *   document 에 «위임»해서 closest() 로 판정한다.
 */
function onCaptureClick(e: MouseEvent): void {
  const target = e.target as HTMLElement | null;
  if (!target || typeof target.closest !== 'function') return;
  if (refiring === e.target) return; // 재발화분은 통과시킨다

  const inResult = target.closest('.tc-result');
  const inMenu = target.closest('.tc-menu');
  const btn = target.closest('button');
  if (!btn) return;

  // ── 판 시작: 메뉴 「시작」 / 결과화면 「다시하기」 ──────────────────────
  const isMenuStart = !!inMenu && btn.classList.contains('tc-cta');
  const isRestart = !!inResult && btn.classList.contains('tc-cta');
  // ── 결과화면 이탈(판 시작 아님): 「모드 변경」 ────────────────────────
  const isChangeMode = !!inResult && btn.classList.contains('tc-ghost');

  if (!isMenuStart && !isRestart && !isChangeMode) return;

  // 결과화면에 있었다면 이 시점에 «직전 판»은 이미 확정돼 있다(결과화면 등장 훅).
  // 없더라도 armRun() 이 소급 확정하므로 어느 쪽이든 정확히 1회다.
  e.preventDefault();
  e.stopImmediatePropagation();

  maybeShowAd(() => {
    if (isMenuStart || isRestart) armRun();
    /**
     * ★★DF-5 — 재발화는 «반드시 비동기»여야 한다.
     *
     * maybeShowAd 는 빚이 없거나 광고가 미준비면 done() 을 «동기»로 부른다.
     * 그 상태에서 btn.click() 을 여기서 «그대로» 부르면, 지금 처리 중인 클릭이
     * 「click in progress」인 동안 같은 요소의 click() 을 다시 부르는 꼴이 된다.
     * HTMLElement.click() 은 그 플래그가 서 있으면 «아무 일도 하지 않고 반환»한다
     * (HTML 표준). 즉 ★유저의 클릭이 조용히 «사라지고» 버튼이 죽은 것처럼 보인다.
     *
     * ⚠ 이 결함은 「잘 될 때는 안 보이고 «실패 경로에서만» 터진다」 — 실사용 최악이다.
     *   (스모 레인 실측: 이 결함이 «검사기까지 무디게» 만들어 양성대조가 루프를
     *    재현조차 못 했다. 고친 뒤에야 show 128회 루프가 드러났다)
     *
     * setTimeout(...,0) 으로 현재 디스패치를 «빠져나온 뒤» 쏜다.
     * ⛔동기 호출로 되돌리지 마라. 광고가 뜨는 경로에서는 어차피 비동기라
     *   「테스트에서 잘 되던데」로 판단하면 실패 경로에서만 터진다.
     */
    setTimeout(() => {
      refiring = btn;
      try {
        btn.click();
      } finally {
        refiring = null;
      }
    }, 0);
  });
}

/**
 * 결과화면 «등장» 관측 = 판 완주 확정.
 * `.tc-result` 에 class `show` 가 붙는 지점은 hud.ts:567 «한 곳»뿐이다(grep 실측).
 * ⛔ 여기서 광고를 띄우지 «않는다» — 기록·점수를 가린다.
 */
function watchResult(): () => void {
  let wasShown = false;
  /**
   * ★성능: 관측 콜백은 «게임 루프 중»에도 불린다. 실측으로 확인한 매 프레임
   *   변경원: hud.ts:426 `elCenter.className = 'tc-center show'` — className 대입은
   *   값이 같아도 «항상» 속성을 다시 써서 카운트다운(1.1초) 동안 프레임마다 발화한다.
   *   그래서 콜백 안에서 querySelector 를 «절대» 반복하지 않는다 —
   *   `.tc-result` 를 한 번 찾으면 캐시하고, 찾은 뒤에는 «그 요소만» 관측한다.
   */
  let el: Element | null = null;

  const read = (): void => {
    const now = !!el && el.classList.contains('show');
    if (now && !wasShown) {
      finalizeRun('result-shown');
      requestPreload(); // 유저 행동 트리거: 판이 끝났으니 다음 광고를 받아 둔다
    }
    wasShown = now;
  };

  // ② 확정 관측자 — `.tc-result` 를 찾은 «뒤»에는 그 요소의 class 만 본다(가장 좁다).
  const target = new MutationObserver(read);

  // ① 탐색 관측자 — Hud 는 installAdGate «뒤»에 생성되므로 처음엔 요소가 없다.
  //    요소가 나타나면 ②로 넘기고 ①은 «즉시 끊는다».
  const finder = new MutationObserver(() => {
    if (el) return;
    el = document.querySelector('.tc-result');
    if (!el) return;
    finder.disconnect();
    target.observe(el, { attributes: true, attributeFilter: ['class'] });
    read();
  });

  el = document.querySelector('.tc-result');
  if (el) {
    target.observe(el, { attributes: true, attributeFilter: ['class'] });
    read();
  } else {
    finder.observe(document.body, { subtree: true, childList: true });
  }

  return () => {
    finder.disconnect();
    target.disconnect();
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 공개 API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 부팅 경로에서 «게임 시작 전»에 부른다.
 * ★절대 throw 하지 않는다.
 * ★isSupported 로 «게이트 전체»를 죽이지 않는다 — 판 계수는 항상 돌아야 한다.
 *   isSupported 는 «로드/표시»에만 걸린다(preload / maybeShowAd).
 */
export function installAdGate(): () => void {
  if (installed) return () => {};
  installed = true;

  hydrateP = hydrate().catch(() => {});

  const stopWatch = watchResult();
  document.addEventListener('click', onCaptureClick, true);
  document.addEventListener('visibilitychange', onVisibilityChange); // ★P1-2

  // 첫 광고를 미리 받아 둔다. 실패해도 유저 행동(판 종료)마다 재시도된다.
  // ⛔숨김 상태·정책 가드 차단 중에는 preload() 안에서 스스로 걸러진다(P1-1·P1-2).
  requestPreload();

  // ★검사기 창구 — 가드 «판정»을 밖에서 볼 수 있게 연다(verify_ad_guards.py 대조쌍).
  //   열지 않으면 검사기는 「요청이 안 나갔다」만 볼 수 있다. 그건 가드가 막은 것인지
  //   SDK 미지원·로드 실패로 애초에 안 나간 것인지 «구분하지 못한다» — 가드가 죽어도 통과한다.
  //   그래서 판정(why)과 «상수»까지 같이 내보내고, 검사기가 상수가 기준값인지도 본다.
  // ⛔운영 로직은 이 창구를 부르지 않는다. 지우면 대조쌍이 죽으므로 함께 지워라.
  //   노출 위험: Advance 는 세션 나이만 민다. 토스 웹뷰에는 콘솔이 없고, 최악의 경우에도
  //   그 기기 «자기» 광고 간격이 빨라질 뿐 타인·서버·정산에 영향이 없다(스모 -24 와 같은 판단).
  try {
    const w = window as unknown as Record<string, unknown>;
    w.__tcAdGuard = (): unknown => __adGuardSnapshot();
    w.__tcAdGuardAdvance = (ms: number): void => __advanceGuardClockForTest(ms);
    w.__tcRequestPreload = (): void => requestPreload();
    w.__tcAdCounters = (): unknown => __counterSnapshot();
  } catch {
    /* 진단 창구는 실패해도 게이트를 막지 않는다 */
  }

  console.log('[adgate] installed');
  return () => {
    stopWatch();
    document.removeEventListener('click', onCaptureClick, true);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    if (okTimer != null) clearTimeout(okTimer);
    if (retryTimer != null) clearTimeout(retryTimer);
    clearLoadTimer();
    dropSubscription();
    installed = false;
  };
}

/** 하이드레이트 완료를 기다린다(검증 하니스용 — 운영 경로는 기다릴 필요가 없다). */
export function adGateReady(): Promise<void> {
  return (hydrateP ?? Promise.resolve()).then(() => tail);
}

/** 검증 하니스가 카운터를 확인할 때만 쓴다. 운영 로직은 이걸 쓰지 않는다. */
export function __counterSnapshot(): Counter {
  return {
    plays: counter.plays, debt: counter.debt, pend: counter.pend,
    lastShownAt: counter.lastShownAt, shownDay: counter.shownDay, shownToday: counter.shownToday,
  };
}
