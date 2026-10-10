/**
 * ############################################################################
 * ##  오늘의 대결(Daily Clash) — 출석 스트릭, B안(콘텐츠형) + C보조(coins 덤) ##
 * ############################################################################
 *
 * President 지시: 「출석 이벤트 같은 거 게임에 다 깔고」. Chief Secretary 승인
 * 설계(2026-08-22): coins/xp 는 sink 가 없다(실측 — 상점/스킨/언락 0건, grep 전수).
 * ⇒ 새 재화를 만들지 않고, «있던 것»(오늘의 맵 개념 = `rng.ts:dailySeed()`,
 *   3개 모드 = `modes.ts`)을 재사용해 «콘텐츠»를 주 보상으로 삼는다.
 *   coins 는 sink 없음을 알고도 «덤»으로만 얹는다(주 보상이 콘텐츠라 정직성
 *   문제가 안 된다 — Chief 승인 근거 그대로).
 *
 * ── ★스트릭 정의: 「오늘의 대결 완료」다. 아무 판이나 X ─────────────────────
 * 접속만으로 스트릭을 올리면 콘텐츠 소비가 안 는다 — 출석 이벤트의 목적과
 * 어긋난다. 그래서 `recordDailyClashCompletion()` 은 «오늘의 대결 세션이
 * 끝났을 때만»(index.ts 가 그 세션인지 표시해서) 부른다. ★「완료」는 «승리»가
 * 아니라 「판이 끝까지 진행됐다」다(phase='over' — 이겨도 져도 도달한다.
 * sim.ts 의 finish() 6개 경로가 전부 여기로 수렴한다). ⇒ 난이도를 올려도
 * 「완료 자체」는 막히지 않는다 — 스트릭 리스크와 체감 난이도 리스크가 분리된다.
 *
 * ── ★모드 로테이션 = «고정». 요일별로 바꾸지 않는다 ─────────────────────────
 * 검토했던 대안: 요일마다 1/3/5분 모드를 돌린다(콘텐츠 다양성↑).
 * ⇒ 기각. 실측 콘솔 데이터(평균 세션 95초)와 5분 모드(300초)는 3배 이상
 *   차이난다. 「5분 요일」이 걸리는 유저는 그날 시간이 없으면 스트릭이
 *   «구조적으로» 끊긴다 — 형평성 문제. 10대가 64%라 등하교·학원 시간대
 *   제약이 특히 크다. ⇒ ★항상 60초(DEFAULT_MODE)로 고정한다. 이미 관측된
 *   평균 세션 길이(95초)에 맞는 유일한 모드다. 콘텐츠 다양성은 맵(날짜별
 *   고정 시드)과 난이도만으로 준다 — 시간 요구량은 절대 흔들지 않는다.
 *
 * ── ★난이도 = 'hard' 고정(수치 근거) ────────────────────────────────────────
 * BOT_LEVEL_DIST(modes.ts): normal 평균 레벨 (2+3+3+4+4)/5=3.2, hard 평균
 * (3+4+4+5+5)/5=4.4 → **+37.5%**. elite 평균은 4.6(거의 hard 와 같음 — 상단
 * 포화 구간이라 추가 상향 의미가 작음, elite 는 스스로 고른 사람만을 위한
 * 최상위 자리로 남겨 둔다). ⇒ hard 는 «이미 자유 플레이에 있는, 이미
 * 밸런스 검증된 기존 단계»를 재사용하는 것이다 — 새 난이도 곡선을 만드는
 * 게 아니다. 사용자가 자유 플레이에서 고른 난이도와 무관하게 «이 세션만»
 * hard 로 고정한다(오늘의 대결이 끝나면 사용자의 평소 설정은 그대로 복귀).
 * ★위에서 설명했듯 완료는 승패와 무관하므로, hard 로 인해 스트릭이 막히는
 *   일은 없다 — 체감 난이도만 살짝 오르고 통과 자체는 항상 된다.
 *
 * ── ★날짜 기준 불일치 — 의도된 것, 버그 아님 ────────────────────────────────
 * 자유 플레이의 맵 시드(`rng.ts:dailySeed()`)는 «기기 로컬 시간대»
 * (`new Date().getFullYear/Month/Date()`)를 쓴다. 반면 이 모듈은 조직
 * 정본 `lib/daykey.ts:kstDateKey()`(UTC+9 고정)를 쓴다 — 두 기준이 «다르다».
 * ⇒ ★의도적으로 고치지 않았다. `dailySeed()`를 바꾸면 그 값에 물려 있는
 *   고스트 리플레이 유효성 판정(save.ts `ghostMode`/index.ts `sessionSeed`)이
 *   깨진다 — 회귀 위험이 오늘의 대결 하나가 얻는 이득보다 크다. 신규
 *   진입점(이 모듈)만 KST 를 쓰고, 기존 자유 플레이는 절대 손대지 않는다.
 *   ⚠️부작용: 자정 근처(특히 기기가 KST 가 아닌 해외 시간대일 때) 「오늘의
 *   맵」과 「오늘의 대결」이 다른 날짜 경계로 갈릴 수 있다 — 다음에 이 코드를
 *   보는 사람은 이걸 «버그»로 오판해 고치려 들 수 있으니 남겨 둔다: 이건
 *   알고 감수한 트레이드오프이지 실수가 아니다.
 */
import { kstDateKey, dayDiff, nowMs, setTimeSource } from '../lib/daykey';
import { fetchServerTime, storage, isInToss } from '../toss';
import { DEFAULT_MODE, type ModeKey, type Difficulty } from './modes';

/** ⛔게임 세이브(KEYS.progress)에 안 섞는다 — adGate.ts(`tc:ads.v2`)와 같은 이유:
 *  여긴 게임 세이브 전용이라 의미가 섞이면 안 된다. 독립 네임스페이스 키. */
const STORE_KEY = 'tc:attendance.v1';

/** 오늘의 대결 고정 스펙. 사용자의 평소 자유 플레이 설정과 무관. */
export const DAILY_CLASH_MODE: ModeKey = DEFAULT_MODE; // '60' — 위 근거 참고
export const DAILY_CLASH_DIFFICULTY: Difficulty = 'hard'; // 위 근거 참고(+37.5% 평균 봇레벨)

/** 7일 순환 코인 보너스. day1(50, 단판 소액 보너스 스케일) → day7(500, 1등 한
 * 판급). endSession() 의 실 지급 스케일(bonus 60~400 + score*0.05)에 맞춘
 * 10배 곡선 — 1일차보다 7일차가 확실히 커야 「돌아올 이유」가 생긴다. */
const REWARD_TABLE = [50, 80, 120, 160, 220, 300, 500] as const;

export interface AttendanceRecord {
  /** 마지막으로 「오늘의 대결」을 완료 처리한 KST 날짜키. 빈 문자열 = 이력 없음 */
  lastDate: string;
  streak: number;
}

const DEFAULT_RECORD: AttendanceRecord = { lastDate: '', streak: 0 };

function sanitize(v: unknown): AttendanceRecord {
  const o = (v ?? {}) as Partial<AttendanceRecord>;
  const lastDate = typeof o.lastDate === 'string' ? o.lastDate : '';
  const streak =
    typeof o.streak === 'number' && Number.isFinite(o.streak) && o.streak >= 0
      ? Math.floor(o.streak)
      : 0;
  return { lastDate, streak };
}

async function loadRecord(): Promise<AttendanceRecord> {
  try {
    const raw = await storage.getItem(STORE_KEY);
    if (raw == null) return { ...DEFAULT_RECORD };
    return sanitize(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_RECORD };
  }
}

/** 절대 throw 하지 않는다 — 저장 실패로 게임이 죽으면 안 된다(조직 공통 규율). */
function persistRecord(rec: AttendanceRecord): void {
  void storage.setItem(STORE_KEY, JSON.stringify(rec)).catch(() => {});
}

/**
 * 부팅 시 1회 호출(main.ts). 토스 서버 시각과의 스큐를 재고 daykey.ts 의
 * 전역 시각 소스를 교체한다 — 기기 시계를 「조금」 앞으로 돌리는 것까지는
 * 못 막지만(비례성 판단, adGate.ts 의 실패 카운터 미영속과 같은 급의 방어
 * 수준), 서버 시각을 아는 한 그걸 우선한다.
 * ★한 번만 부른다(daykey.ts 의 규율 그대로) — 런타임 중 여러 번 바꾸면
 *   날짜가 앞뒤로 튄다.
 */
export async function initDailyClashClock(): Promise<void> {
  if (!isInToss()) return;
  try {
    const serverMs = await fetchServerTime();
    if (typeof serverMs !== 'number') return;
    const skew = serverMs - Date.now();
    setTimeSource(() => Date.now() + skew);
  } catch {
    /* 실패해도 기기 시계로 계속 동작한다(daykey.ts 폴백) */
  }
}

/** cycleDay(1~7) → 보상. 스트릭 자체는 계속 누적되고, 표시만 7일 순환한다. */
export function cycleDayOf(streak: number): number {
  const s = Math.max(1, streak);
  return ((s - 1) % 7) + 1;
}

export function rewardOf(streak: number): number {
  return REWARD_TABLE[cycleDayOf(streak) - 1]!;
}

/**
 * gap(마지막 완료일 → 오늘) 에 따른 다음 스트릭.
 * ★완전 리셋(1일차로 되돌림)은 «어떤 경우에도 없다» — 10대 64%, 세션 95초
 *   짜리 게임에서 하루 놓쳤다고 1일차면 다시 안 온다(Chief 승인 규칙).
 *   gap 1일(연속) → +1 / gap 2일(하루 결석, 그레이스) → 유지 / gap 3일+ →
 *   절반(내림, 최소 1).
 * ⛔시계를 뒤로 돌리면(gap<0) «무시»한다(레코드 변경 없음) — 비례성 판단,
 *   그 이상의 방어(서버 검증 등)는 안 한다.
 */
function nextStreak(rec: AttendanceRecord, todayKey: string): number | null {
  if (rec.lastDate === todayKey) return null; // 오늘 이미 완료 — 변경 없음
  if (!rec.lastDate) return 1; // 첫 완료
  const diff = dayDiff(rec.lastDate, todayKey);
  if (!Number.isFinite(diff) || diff < 0) return null; // 깨진 값·시계 역행 — 무시
  if (diff === 1) return rec.streak + 1;
  if (diff === 2) return rec.streak; // 그레이스 하루
  return Math.max(1, Math.floor(rec.streak / 2));
}

export interface DailyClashInfo {
  todayKey: string;
  streak: number;
  cycleDay: number;
  reward: number;
  completedToday: boolean;
}

/** 읽기 전용 — 메뉴 카드 표시용. 저장을 건드리지 않는다. */
export async function dailyClashInfo(): Promise<DailyClashInfo> {
  const todayKey = kstDateKey(nowMs());
  const rec = await loadRecord();
  const completedToday = rec.lastDate === todayKey;
  // 아직 완료 전이면 "완료하면 될 스트릭"을 미리 보여준다(체감 보상 예고).
  const projected = completedToday ? rec.streak : (nextStreak(rec, todayKey) ?? Math.max(1, rec.streak));
  return {
    todayKey,
    streak: completedToday ? rec.streak : projected,
    cycleDay: cycleDayOf(completedToday ? rec.streak : projected),
    reward: rewardOf(completedToday ? rec.streak : projected),
    completedToday,
  };
}

/**
 * 「오늘의 대결」 세션이 끝났을 때 index.ts 가 호출한다(승패 무관 — 완료 =
 * phase='over' 도달). ★멱등: 오늘 이미 기록됐으면 coins 를 다시 주지
 * 않는다(같은 날 재도전해도 중복 지급 없음).
 * @returns 지급된 코인(0 이면 오늘 이미 완료돼 지급 없음)
 */
export async function recordDailyClashCompletion(): Promise<{
  streak: number;
  cycleDay: number;
  coinsAwarded: number;
}> {
  const todayKey = kstDateKey(nowMs());
  const rec = await loadRecord();
  const next = nextStreak(rec, todayKey);
  if (next == null) {
    // 오늘 이미 완료(또는 시계 역행) — 지급 없이 현재 상태만 반환.
    return { streak: rec.streak, cycleDay: cycleDayOf(rec.streak), coinsAwarded: 0 };
  }
  const updated: AttendanceRecord = { lastDate: todayKey, streak: next };
  persistRecord(updated);
  return { streak: next, cycleDay: cycleDayOf(next), coinsAwarded: rewardOf(next) };
}

/**
 * 오늘의 대결 맵 시드. ★전 세계 유저가 «같은 KST 날짜»엔 «같은 보드»를
 * 받는다(Wordle 류 데일리 퍼즐과 같은 성질) — 자유 플레이의 `sessionSeed()`
 * (판마다 살짝 다름, save.plays 에 물림)와는 완전히 다른 함수·다른 값
 * 공간이라 충돌하지 않는다.
 * djb2 해시 — daykey.ts 와 같은 무의존 원칙을 지키려고 외부 라이브러리
 * 없이 직접 구현한다.
 */
export function dailyClashSeed(dateKey: string): number {
  let h = 5381;
  for (let i = 0; i < dateKey.length; i++) {
    h = ((h << 5) + h + dateKey.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}
