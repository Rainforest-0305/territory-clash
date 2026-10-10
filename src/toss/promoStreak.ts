/**
 * 프로모션 리워드 ② — 「3일 연속 플레이하기」 → 50원 (★2026-09-01 신설)
 *
 *   promotionCode : __PROMOTION_CODE__   (콘솔 미션명 「3일 연속 플레이하기」)
 *   지급          : 50원 «고정». 게임 카테고리는 변동금액이 허용되지 않는다.
 *   예산          : 3,000원 (= 60건). 소진되면 토스가 4112 로 닫는다.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ⛔★이 파일은 기존 프로모션 ①(promotion.ts, 「3판 플레이 완료」 100원,
 *    코드 __PROMOTION_CODE__)을 **한 글자도 건드리지 않는다.**
 *    그쪽은 «지금 가장 잘 도는» 프로모션이다(2026-08-31 실적: 클릭 18 → 전환 13,
 *    1,300원 지급). 회귀시키면 최대 수익원을 죽이는 것이다.
 *    ⇒ 저장키·DOM 속성·in-flight 락·모듈 전부 «따로» 둔다. 공유하는 것은
 *      bridge.ts 의 순수 브릿지 함수와 env.ts 의 safeBridge 뿐이다(읽기 전용 의존).
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── ★저장 규율 — 「코드 무관 단일 키」 사고를 반복하지 않는다 ────────────────
 *   미리(mirialert)에서 실제로 터진 사고: 지급 기록을 `miri.promo.*.v1` 처럼
 *   «프로모션 코드와 무관한» 키/레코드로 남겼더니, 프로모션을 교체했을 때 옛
 *   프로모션을 받은 기기가 새 프로모션을 «영원히» 못 받았다.
 *   ⇒ 이 파일의 레코드는 `code` 를 «반드시» 품고, `grantedFor()` 가
 *     **지금 코드와 같을 때만** 'already' 로 닫는다.
 *   ⇒ ⛔옛 키(`tc:promo.v1`)는 삭제·개명·마이그레이션 «하지 않는다». 그대로 둔다.
 *     이 파일은 새 키 `tc:promo.streak3.v1` 을 «추가»만 한다.
 *
 * ── ★「연속」의 경계 — 어떻게 판정했는가 (보고서에 그대로 실린다) ────────────
 *   ① 날짜 단위 = **KST(UTC+9) 고정 오프셋의 달력일**. `lib/daykey.ts` 의
 *      `kstDateKey()` 하나만 쓴다. 기기 «타임존»을 읽지 않으므로 비행기·해외·
 *      타임존 변경으로 하루가 늘거나 줄지 않는다. 자정(KST 00:00)에 날이 바뀐다.
 *   ② 시각 소스 = `daykey.ts` 의 `nowMs()`. 토스 «안»에서는 부팅 때
 *      `initDailyClashClock()` 이 `getServerTime()` 스큐를 재서 시각 소스를
 *      갈아끼운다 — 즉 **토스 안에서는 서버 시각이 우선**이다. 이 프로모션은
 *      토스 안에서만 지급되므로(밖은 'unsupported') 이게 1차 방어다.
 *   ③ 연속 판정 = 마지막으로 «센» 날과 오늘의 `dayDiff` 가 **정확히 1**일 때만
 *      streak+1. 0 이면 오늘 이미 센 날(무변화), 2 이상이면 끊긴 것이라 1로
 *      리셋한다. ⛔출석(dailyClash.ts)의 «그레이스 하루» 규칙을 쓰지 «않는다» —
 *      저건 「출석 보상」 규칙이고 이건 「3일 «연속»」이라 의미가 다르다.
 *   ④ ★시각 조작 최소 방어 2겹 (서버 시각을 못 받은 경우까지 커버):
 *      ㄱ) **역행 차단** — 지금까지 본 «가장 큰» 날짜키를 `maxDay` 로 남긴다.
 *          오늘 키가 그보다 작으면(=시계를 되돌렸다) 그 판은 스트릭에 «세지
 *          않는다». 앞으로 돌려서 하루를 벌었으면 되돌아올 수 없다 — 계속
 *          앞당긴 채로 살아야 하므로 공짜가 아니다.
 *      ㄴ) **세션 중 시계 점프 차단** — 부팅 시점의 `performance.now()`(단조)와
 *          벽시계를 함께 기억해 두고, 둘의 경과가 `SESSION_DRIFT_TOL_MS`(10분)
 *          이상 어긋나면 그 세션에서는 새 날을 «세지 않는다». 「한 자리에서
 *          날짜만 세 번 바꿔 3일 연속을 만드는」 가장 흔한 조작이 여기서 걸린다.
 *      ⇒ 그 이상(서버 검증·기기 지문)은 하지 않는다. 서버가 없는 구조에서
 *        ★최종 방어선은 여전히 «콘솔 예산 3,000원»이다. 숨기지 않는다.
 *   ⑤ 「플레이」의 정의 = 기존 프로모션 ①과 «같은 지점», 즉 `save.plays` 가
 *      증가하는 그 자리(game/index.ts 의 결과 확정 지점)다. 새 카운터를 만들지
 *      않았다. 판을 «끝까지 마친» 것이 1플레이다(승패·등수 무관 — 토스 심사
 *      체크리스트의 「결과·등수 기준 지급」 금지를 피한다).
 *
 * ── ⛔ 프로모션 코드를 «상수»로 두지 않는 이유 (2026-08-11 광고 실사고와 동형) ──
 *   `const CODE = ''` 로 두면 번들러가 `if (!CODE) return;` 을 상수 접기로
 *   판정해 **지급 호출 블록을 통째로 삭제**한다. 그래서 코드는 index.html 의
 *   body data 속성에 두고 여기서 «읽기만» 한다. 번들러는 DOM 값을 접을 수 없다.
 *   ⇒ 속성 이름은 프로모션 ①과 «다르다»: `data-promo3-code` / `data-promo3-amount`.
 *      (①은 `data-promo-code` / `data-promo-amount` — 그대로 둔다)
 *
 * ── TESTONLY 완화 ────────────────────────────────────────────────────────────
 *   프로모션 `isTested` 는 앱이 `TEST_{code}` 로 지급 API 를 «실제로» 호출해야
 *   켜지는데, 3일 연속은 당일에 만족시킬 수 없다. 그래서 body 에
 *   `data-promo3-testonly="1"` 이 있으면 필요 일수를 1로 낮춘다.
 *   ⛔이 속성은 `*_TESTONLY.ait` 에만 넣는다. 검수·정본 빌드에 절대 넣지 마라.
 */
import { storage } from './storage';
import { safeBridge, isInToss } from './env';
import {
  grantPromotionReward,
  grantPromotionRewardForGame,
  type GrantPromotionResult,
} from './bridge';
import { kstDateKey, dayDiff, nowMs, isDateKey } from '../lib/daykey';

/** ★기존 키(`tc:promo.v1`·`tc:progress` 등)와 겹치지 않는 «새» 키. 추가만 한다. */
const STREAK_KEY = 'tc:promo.streak3.v1';

/** 지급 조건 — 연속 며칠. 정본은 3. TESTONLY 빌드에서만 1로 완화된다. */
const REQUIRED_DAYS = 3;

/** 세션 중 벽시계가 단조시계와 이만큼 어긋나면 「조작」으로 보고 새 날을 세지 않는다. */
const SESSION_DRIFT_TOL_MS = 10 * 60 * 1000;

export type StreakOutcome =
  | 'granted' // 실제로 지급됐다
  | 'already' // 이미 받았다(같은 코드 기준, 또는 토스 4113)
  | 'progress' // 오늘을 셌지만 아직 연속 일수가 모자라다
  | 'counted-none' // 오늘은 이미 셌다(또는 조작 방어에 걸려 세지 않았다)
  | 'unconfigured' // 프로모션 코드가 아직 안 꽂혔다
  | 'unsupported' // 토스 밖이거나 앱 버전 미달
  | 'failed'; // 지급 시도했으나 실패(다음 기회에 재시도 가능)

interface StreakRecord {
  /** 마지막으로 «센» 날(KST 날짜키). */
  lastDay?: string;
  /** 지금까지 본 가장 큰 날짜키. 시계 역행 차단용. */
  maxDay?: string;
  /** 연속 일수. */
  streak?: number;
  /** 지급 확정 시각(ms). */
  grantedAt?: number;
  /** 토스가 준 리워드 키. 사고 시 추적용. */
  key?: string;
  /** ★어느 프로모션 코드의 지급인지. 없으면 옛 기록이다 → 새 코드를 막지 않는다. */
  code?: string;
  /** 4113(이미 지급)으로 닫힌 경우 표시. */
  viaAlreadyGranted?: boolean;
  /**
   * ★기준선(baseline) — 「프로모션 개설 «전»에 이미 달성한 사람에게는 지급하지
   *   않는다」(President 지시 2026-09-01). 이 코드가 든 빌드가 이 기기에서 «처음
   *   실행되는 순간»의 프로모션 코드와 KST 날짜를 박아둔다.
   *   ⇒ `baseCode` 가 지금 코드와 다르면(=이 프로모션은 이 기기에서 처음이다)
   *     연속 카운트를 «0 으로 리셋»하고 기준선 당일부터 다시 센다. 이월 없음.
   *   ⇒ ★기준선도 «코드별»이다. 미리의 「코드 무관 단일 키」 사고를 반복하지 않는다.
   */
  baseCode?: string;
  baseDay?: string;
}

/* ── 세션 단조시계 기준점 ──────────────────────────────────────────────────
   ⛔모듈 로드 시점에 «한 번»만 찍는다. performance 가 없는 환경도 있으므로
     전부 try 로 감싸고, 없으면 드리프트 검사를 «건너뛴다»(막지 않는다 —
     방어를 못 한다고 정상 유저를 막으면 그게 더 큰 손해다). */
function perfNow(): number | null {
  try {
    const p = typeof performance !== 'undefined' ? performance : undefined;
    const v = p && typeof p.now === 'function' ? p.now() : NaN;
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}
const BOOT_PERF = perfNow();
/**
 * ⛔★여기서 `nowMs()` 를 쓰면 «안 된다». 실측으로 잡은 함정이다:
 *   부팅 직후 `initDailyClashClock()` 이 토스 서버시각 스큐를 `setTimeSource` 로
 *   주입하는데, 그러면 `nowMs()` 가 그 순간 «스큐만큼» 점프한다. 기준점을
 *   `nowMs()` 로 잡아 두면 그 점프가 그대로 「시계 조작」으로 오검출되고,
 *   ⇒ 기기 시계가 서버와 10분 이상 어긋난 «정상 유저»가 영영 하루도 못 세게 된다.
 *   ⇒ 그래서 드리프트 검사는 «보정되지 않은 기기 시계»(Date.now())로만 한다.
 *     이 검사가 잡으려는 것은 「세션 중 기기 시계를 손으로 돌리는 것」이지
 *     「서버와의 오차」가 아니다.
 */
const BOOT_WALL = Date.now();

/** 이 세션에서 «기기» 벽시계가 단조시계 대비 얼마나 튀었나(ms). 측정 불가면 0. */
function sessionDriftMs(): number {
  const p = perfNow();
  if (BOOT_PERF === null || p === null) return 0;
  const mono = p - BOOT_PERF;
  const wall = Date.now() - BOOT_WALL;
  const d = Math.abs(wall - mono);
  return Number.isFinite(d) ? d : 0;
}

/* ── 설정(DOM에서 런타임 읽기) ─────────────────────────────────────────────── */

function readConfig(): { code: string; amount: number; requiredDays: number } {
  try {
    const b = document.body;
    const code = (b?.getAttribute('data-promo3-code') || '').trim();
    const amount = Number.parseInt(b?.getAttribute('data-promo3-amount') || '', 10);
    const testonly = (b?.getAttribute('data-promo3-testonly') || '').trim() === '1';
    return {
      code,
      amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
      requiredDays: testonly ? 1 : REQUIRED_DAYS,
    };
  } catch {
    return { code: '', amount: 0, requiredDays: REQUIRED_DAYS };
  }
}

/* ── 저장 ──────────────────────────────────────────────────────────────────── */

async function loadRecord(): Promise<StreakRecord> {
  try {
    const raw = await storage.getItem(STREAK_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as StreakRecord;
    return o && typeof o === 'object' ? o : {};
  } catch {
    // 저장소 실패·깨진 JSON 은 「아직 아무것도 안 셌다」로 본다.
    // (반대로 「받았다」로 보면 저장소 사고 한 번에 전원이 영영 못 받는다)
    return {};
  }
}

async function saveRecord(rec: StreakRecord): Promise<void> {
  try {
    await storage.setItem(STREAK_KEY, JSON.stringify(rec));
  } catch (e) {
    console.error('[promo3] 스트릭 기록 저장 실패:', e);
  }
}

/**
 * ★지급 기록은 «프로모션 코드별»이다.
 *   grantedAt 이 있어도 `code` 가 지금 코드와 다르면 「안 받았다」로 본다.
 *   - 옛 레코드(code 없음)  → 새 코드를 막지 «않는다»
 *   - 다른 코드의 레코드    → 그 프로모션은 끝났다. 새 코드를 막지 «않는다»
 *   - 코드가 빈 문자열이면  → 어떤 기록도 「받았다」로 보지 않는다
 */
function grantedFor(rec: StreakRecord, code: string): boolean {
  return !!rec.grantedAt && typeof rec.code === 'string' && rec.code !== '' && rec.code === code;
}

/* ── 기준선 ────────────────────────────────────────────────────────────────
   ★President 지시(2026-09-01): 「프로모션 개설 전에 이미 달성한 사람에게는
     지급하지 않는다」. 땅따먹기는 «누적 카운터형»이라 특히 위험하다 —
     이월하면 이미 3일 연속 중인 유저에게 «빌드가 깔리자마자 즉시» 지급된다.
   ⇒ 기준선에서 streak 을 0 으로 리셋하고 lastDay 를 비운다. 그래야 기준선
     당일 플레이가 «1일차»가 되고 지급까지 최소 3일이 걸린다.
   ⇒ ⛔grantedAt/key/code(지급 기록)는 «지우지 않는다». 저건 코드별로 이미
     grantedFor() 가 가른다. 여기서 지우면 4113 왕복이 늘 뿐이다.
   ⇒ maxDay 도 기준선 날짜로 «올린다» — 기준선보다 과거로 시계를 돌려도
     세지지 않는다. */
export function applyBaseline(rec: StreakRecord, code: string, todayKey: string): StreakRecord {
  if (!code || !isDateKey(todayKey)) return rec;
  if (rec.baseCode === code) return rec; // 이미 이 코드의 기준선이 있다
  const next: StreakRecord = { ...rec };
  next.baseCode = code;
  next.baseDay = todayKey;
  next.streak = 0;
  delete next.lastDay; // ★이월 금지 — 기존 연속 기록을 끌어다 쓰지 않는다
  next.maxDay =
    next.maxDay && isDateKey(next.maxDay) && dayDiff(next.maxDay, todayKey) < 0
      ? next.maxDay
      : todayKey;
  return next;
}

/**
 * 부팅 시 «한 번» 부른다(main.ts). 기준선이 없으면 지금 박는다.
 * ★플레이를 기다리지 않는 이유: President 지시의 문구가 「빌드가 그 기기에서
 *   처음 실행되는 순간」이다. 첫 플레이까지 미루면 그 사이 날짜가 바뀌었을 때
 *   기준선이 뒤로 밀린다.
 * ⛔절대 throw 하지 않는다. 부팅 경로다.
 */
export async function initPromoStreakBaseline(): Promise<void> {
  try {
    const { code } = readConfig();
    if (!code) return;
    const rec = await loadRecord();
    if (rec.baseCode === code) return;
    const next = applyBaseline(rec, code, kstDateKey(nowMs()));
    await saveRecord(next);
    console.log(`[promo3] 기준선 설정 code=${code} baseDay=${next.baseDay} (연속 카운트 0부터)`);
  } catch (e) {
    console.warn('[promo3] 기준선 설정 실패 — 첫 플레이 때 다시 시도한다:', e);
  }
}

/* ── 스트릭 갱신(순수 함수 — 테스트/검증에서 그대로 쓴다) ────────────────────
   ⛔여기에 부수효과를 넣지 마라. 저장·브릿지는 호출부(run)가 한다. */
export interface StreakStep {
  next: StreakRecord;
  /** 오늘을 «새로» 셌는가 */
  counted: boolean;
  /** 왜 안 셌는지(진단용) */
  reason?: 'same-day' | 'rollback' | 'drift' | 'bad-daykey';
}

export function stepStreak(
  rec: StreakRecord,
  todayKey: string,
  driftMs: number,
): StreakStep {
  const cur: StreakRecord = { ...rec };

  if (!isDateKey(todayKey)) {
    return { next: cur, counted: false, reason: 'bad-daykey' };
  }

  // ① 오늘 이미 셌다 — 무변화. 하루에 몇 판을 하든 1일이다.
  if (cur.lastDay === todayKey) {
    return { next: cur, counted: false, reason: 'same-day' };
  }

  // ② ★역행 차단 — 지금까지 본 가장 큰 날보다 과거면 세지 않는다.
  //    maxDay 자체는 «갱신하지 않는다»(뒤로 못 내린다).
  if (cur.maxDay && isDateKey(cur.maxDay)) {
    const back = dayDiff(cur.maxDay, todayKey);
    if (Number.isFinite(back) && back < 0) {
      return { next: cur, counted: false, reason: 'rollback' };
    }
  }

  // ③ ★세션 중 시계 점프 차단.
  if (driftMs > SESSION_DRIFT_TOL_MS) {
    return { next: cur, counted: false, reason: 'drift' };
  }

  // ④ 연속 판정. «정확히 1일 차이»일 때만 이어진다.
  const prev = cur.lastDay;
  let streak: number;
  if (!prev || !isDateKey(prev)) {
    streak = 1; // 첫 플레이
  } else {
    const d = dayDiff(prev, todayKey);
    streak = Number.isFinite(d) && d === 1 ? Math.max(1, (cur.streak || 0) + 1) : 1;
  }

  cur.lastDay = todayKey;
  cur.streak = streak;
  cur.maxDay = !cur.maxDay || !isDateKey(cur.maxDay) || dayDiff(cur.maxDay, todayKey) > 0
    ? todayKey
    : cur.maxDay;
  return { next: cur, counted: true };
}

/* ── 브릿지 응답 판별 ──────────────────────────────────────────────────────── */

function isSuccess(r: GrantPromotionResult): r is { key: string } {
  return !!r && r !== 'ERROR' && typeof (r as { key?: unknown }).key === 'string';
}
function isFailure(r: GrantPromotionResult): r is { errorCode: string; message: string } {
  return !!r && r !== 'ERROR' && typeof (r as { errorCode?: unknown }).errorCode === 'string';
}

/* ── 지급 ──────────────────────────────────────────────────────────────────── */

/** ★동시 호출 차단. 프로모션 ①과 «다른» 락이다(서로 막지 않는다). */
let inFlight: Promise<StreakOutcome> | null = null;

/**
 * 한 판을 «끝냈을 때» 부른다. **절대 throw 하지 않고, 게임을 막지 않는다.**
 * 호출부는 `void recordPlayAndClaim()` 로 흘려보내면 된다.
 */
export async function recordPlayAndClaim(): Promise<StreakOutcome> {
  if (inFlight) return inFlight;
  inFlight = run();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

async function run(): Promise<StreakOutcome> {
  try {
    const { code, amount, requiredDays } = readConfig();

    // ① 이미 «이 코드로» 받았는가 — 가장 먼저. 저장도 브릿지도 더 안 탄다.
    const rec = await loadRecord();
    if (grantedFor(rec, code)) return 'already';

    // ② ★스트릭은 «설정과 무관하게» 먼저 굴린다.
    //    코드가 아직 안 꽂혔거나 토스 밖이어도 날짜는 쌓여야 한다. 안 그러면
    //    코드가 꽂힌 날부터 다시 3일을 세게 되고, 그건 유저에게 보이지 않는 손해다.
    const today = kstDateKey(nowMs());
    /* ★기준선 — 부팅 init 이 못 돌았거나(예외) 코드가 바뀐 경우를 여기서 다시 막는다.
       이 한 줄이 「빌드 깔리자마자 즉시 지급」을 차단하는 마지막 문이다. */
    const based = applyBaseline(rec, code, today);
    const step = stepStreak(based, today, sessionDriftMs());
    if (based !== rec && !step.counted) {
      // 기준선만 새로 생기고 오늘은 안 센 경우 — 기준선은 «반드시» 저장한다.
      await saveRecord(based);
    }
    if (step.counted) {
      await saveRecord(step.next);
      console.log(`[promo3] 연속 ${step.next.streak}/${requiredDays}일 (day=${today})`);
    } else if (step.reason && step.reason !== 'same-day') {
      // ★실패를 조용히 삼키지 않는다.
      console.warn(`[promo3] 오늘을 세지 않았다 — 사유=${step.reason} (day=${today})`);
    }

    const streak = step.next.streak || 0;
    if (streak < requiredDays) {
      return step.counted ? 'progress' : 'counted-none';
    }

    // ③ 설정이 꽂혔는가.
    if (!code || amount <= 0) {
      console.warn(
        '[promo3] 프로모션 코드/금액 미설정 — 지급 요청 생략. index.html 의 data-promo3-* 확인',
      );
      return 'unconfigured';
    }

    // ④ 토스 밖(로컬 dev / 플레이스토어 APK)이면 브릿지 자체가 없다.
    if (!isInToss()) return 'unsupported';

    console.log(`[promo3] 조건 달성(${streak}일 연속) — 지급 요청 code=${code} amount=${amount}`);

    // ⑤ 현행 API 먼저. 네이티브가 모르면 undefined/타임아웃 → 레거시 폴백.
    let res = await safeBridge<GrantPromotionResult>(
      'grantPromotionReward',
      () => grantPromotionReward({ params: { promotionCode: code, amount } }),
      undefined,
    );

    if (res === undefined || res === 'ERROR') {
      console.warn('[promo3] grantPromotionReward 미응답/오류 — 레거시(ForGame)로 폴백');
      res = await safeBridge<GrantPromotionResult>(
        'grantPromotionRewardForGame',
        () => grantPromotionRewardForGame({ params: { promotionCode: code, amount } }),
        undefined,
      );
    }

    // ⑥ 판정. ⚠️«성공했다고 가정하지 않는다» — 반드시 «형태»로 가른다.
    if (isSuccess(res)) {
      await saveRecord({ ...step.next, grantedAt: Date.now(), key: res.key, code });
      console.log('[promo3] 지급 성공 key=', res.key);
      return 'granted';
    }

    if (isFailure(res)) {
      console.error(`[promo3] 지급 실패 code=${res.errorCode} msg=${res.message}`);
      if (res.errorCode === '4113') {
        // 이미 지급됨 — 로컬 기록만 유실된 상태다. 코드와 함께 복원하고 닫는다.
        await saveRecord({ ...step.next, grantedAt: Date.now(), viaAlreadyGranted: true, code });
        return 'already';
      }
      if (res.errorCode === '4112') {
        // ★예산 소진 = 최종 방어선이 작동한 것. 정상 동작이다.
        console.warn('[promo3] 프로모션 예산 소진 — 더 지급하지 않는다');
      }
      // 일시적 실패는 기록하지 «않는다» → 다음 판에서 재시도된다.
      return 'failed';
    }

    if (res === undefined) {
      console.warn('[promo3] 토스 앱 버전이 낮아 프로모션 미지원(5.232.0+ 필요) — 건너뛴다');
      return 'unsupported';
    }

    console.error('[promo3] 알 수 없는 오류(ERROR) — 지급되지 않았다');
    return 'failed';
  } catch (e) {
    // ⛔여기까지 온 예외는 전부 흡수한다. 지급이 게임을 멈추면 «게임을 못 한다».
    console.warn('[promo3] 처리 중 예외 — 무시하고 게임을 계속한다:', e);
    return 'failed';
  }
}

/** 현재 연속 일수(읽기 전용). UI 표시용 — 지금은 호출부 없음. */
export async function streakDays(): Promise<number> {
  return (await loadRecord()).streak || 0;
}

/** 이 코드로 이미 받았는지(읽기 전용). */
export async function streakRewarded(): Promise<boolean> {
  return grantedFor(await loadRecord(), readConfig().code);
}
