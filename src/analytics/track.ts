/**
 * ############################################################################
 * ##  계측 표준 — 조직 공통 스키마 (Chief Secretary 확정, 2026-08-22)        ##
 * ############################################################################
 *
 * 이 파일이 5개 게임 공통 원형이다. 다른 게임 레인은 이 파일 구조를 그대로
 * 복제해도 된다(이벤트 이름·log_type 매핑은 바꾸지 마라 — 조직 표준이다).
 *
 * ── 설계 ────────────────────────────────────────────────────────────────────
 *  1) console.log 는 «지우지 않는다». adGate.ts 가 이미 쓰던 개발 확인용
 *     채널이고, eventLog 브릿지가 죽어도(샌드박스·구버전 등) 콘솔에는 남는다.
 *  2) eventLog(SDK, src/toss/eventLog.ts)를 «추가»한다 — 대체가 아니다.
 *     실패해도 절대 throw 하지 않는다(그 파일 자체가 흡수).
 *  3) 결과를 기다리지 않는다(fire-and-forget) — 게임 흐름·프레임을 막지 않는다.
 *
 * ── 개인정보 ─────────────────────────────────────────────────────────────────
 *  ⛔ params 는 열거형(enum 문자열)·정수 카운터만 허용한다.
 *  ⛔ 실명·전화번호·기기 ID·좌표·userKey 원문 절대 금지.
 *     (SDK 가 PII 를 걸러주지 않는다 — 통제 책임은 호출부, 즉 «우리»에게 있다)
 *
 * ── 호출 규율 ────────────────────────────────────────────────────────────────
 *  ⛔ 게임 루프(매 프레임·매 틱)에서 부르지 마라. «상태 전이» 시점에만.
 *     (앱 진입 / 화면 전환 / 판 시작·종료 / 광고 실패 — 세션당 수십 회 이산 이벤트)
 */
import { eventLog, type EventLogType } from '../toss';

/** 이 게임의 태그. 다른 게임 레인은 자기 게임 값으로 바꾼다. */
export const GAME_TAG = 'territory';

export type TrackParams = Record<string, string | number | boolean | null | undefined>;

/**
 * 이벤트 1건 기록. game 태그를 항상 섞어 넣는다(공용 대시보드에서 게임별로
 * 가른다). 결과를 기다리지 않는다 — 호출부가 await 할 필요 없다.
 */
export function track(logName: string, logType: EventLogType, params: TrackParams = {}): void {
  const full: TrackParams = { game: GAME_TAG, ...params };
  console.log(`[track] ${logName} (${logType})`, full);
  void eventLog({ log_name: logName, log_type: logType, params: full as Record<string, EventLogPrimitiveLike> });
}

// eventLog() 의 params 타입(EventLogPrimitive)과 TrackParams 를 안전하게 잇기
// 위한 로컬 별칭 — symbol 은 우리가 안 쓰므로 값 집합이 TrackParams 의 상위다.
type EventLogPrimitiveLike = string | number | boolean | null | undefined;

// ═══════════════════════════════════════════════════════════════════════════
// 표준 이벤트 — 이름을 바꾸지 마라(5개 게임 공통 스키마)
// ═══════════════════════════════════════════════════════════════════════════

/** 앱 진입. main() 최초 진입 시 1회. */
export function trackAppEnter(): void {
  track('app_enter', 'event', {});
}

/**
 * 판(run) 시작. run_no 는 «이 앱 세션 안에서의 순번»이다(1, 2, 3…) —
 * 저장(save.plays, 누적)과는 다른 값이다. 앱을 새로 열면 1부터 다시 센다.
 * 그래서 「2번째 판 시작」은 run_no===2 필터 하나로 뽑힌다(별도 이벤트 불요).
 */
let runCounter = 0;
let runStartedAt = 0;

export function trackRunStart(mode: string): number {
  runCounter += 1;
  runStartedAt = performance.now();
  track('run_start', 'event', { run_no: runCounter, mode });
  return runCounter;
}

/**
 * 판 종료. result 는 ★성공·실패 구분★ — 이 게임은 승패가 아니라 '끝까지
 * 생존했는가'로 가른다(순위는 별도로 원하면 params 에 추가할 수 있으나
 * 표준 스키마엔 없어 여기선 넣지 않는다 — 5종 공통 스키마를 지킨다).
 */
export function trackRunEnd(result: 'success' | 'fail', mode: string): void {
  const durationMs = runStartedAt > 0 ? Math.round(performance.now() - runStartedAt) : 0;
  track('run_end', 'event', { run_no: runCounter, result, mode, duration_ms: durationMs });
}

/** 비플레이 화면 진입(메뉴·설정·언어·일시정지 등). */
export function trackScreenView(screen: string): void {
  track('screen_view', 'screen', { screen });
}

export type AdKind = 'interstitial' | 'reward' | 'banner';
export type AdFailReason = 'unsupported' | 'timeout' | 'onError' | 'noFill';

/** 광고 요청·표시 실패. */
export function trackAdRequestFail(kind: AdKind, reason: AdFailReason): void {
  track('ad_request_fail', 'error', { kind, reason });
}

/** 정책 가드가 «막은» 노출 지점. 실패가 아니라 «의도된 차단»이라 log_type 은 event 다(2026-09-12). */
export type AdGuardReason = 'session_start' | 'interval' | 'daily_cap';
export function trackAdGuardBlocked(
  kind: AdKind,
  reason: AdGuardReason,
  detail: { session_age_s: number; since_last_s: number; shown_today: number }
): void {
  track('ad_guard_blocked', 'event', { kind, reason, ...detail });
}

/** 출석 보상 수령. streakDay = 연속 출석 몇 일차인지(1부터). */
export function trackAttendanceClaim(streakDay: number): void {
  track('attendance_claim', 'event', { streak_day: streakDay });
}
