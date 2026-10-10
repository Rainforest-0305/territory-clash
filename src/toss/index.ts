/**
 * 앱인토스 SDK 통합 부트스트랩.
 *
 * 게임 필수 SDK 4종(미적용 = 심사 반려)을 여기서 한 번에 켠다.
 *   ① 사용자 식별키 : identity.ts   (getUserKeyForGame / getAnonymousKey)
 *   ② Safe Area     : safeArea.ts   (SafeAreaInsets.get / .subscribe)
 *   ③ 네이티브 Storage: storage.ts   (Storage.getItem/setItem/...)
 *   ④ 내비게이션 바 : navigationBar.ts (graniteEvent back/home + config 선언)
 *
 * ★ 이 함수는 절대 throw 하지 않는다. SDK 하나가 실패해도 게임은 떠야 한다.
 *   (토스 밖 = 로컬 dev / 플레이스토어 APK 에서는 전부 폴백으로 동작)
 */
import { resolveIdentity, type Identity } from './identity';
import { initSafeArea } from './safeArea';
import { initNavigationBar } from './navigationBar';
import { storage, KEYS } from './storage';
import { setScreenAwakeMode } from './bridge';
import { isInToss, safeBridge } from './env';

export interface TossRuntime {
  identity: Identity;
  inToss: boolean;
  /** SDK 4종 self-test 결과 — 디버그 오버레이/심사 확인용 */
  selfTest: SdkSelfTest;
  dispose: () => void;
}

export interface SdkSelfTest {
  userKey: 'ok' | 'fallback' | 'invalid-category';
  safeArea: 'ok' | 'fallback';
  storage: 'ok' | 'fallback';
  navigationBar: 'ok' | 'fallback';
}

export async function initTossSdk(): Promise<TossRuntime> {
  const inToss = isInToss();
  console.log(`[toss-sdk] boot (inToss=${inToss})`);

  // ② Safe Area — 가장 먼저. 레이아웃이 이 값에 의존하므로 첫 페인트 전에 꽂는다.
  const disposeSafeArea = initSafeArea();

  // ④ 내비게이션 바 — 뒤로가기 기본 동작(핸들러 없으면 종료)을 즉시 살린다.
  const disposeNav = initNavigationBar();

  // ① 사용자 식별키
  const identity = await resolveIdentity();

  // ③ 네이티브 Storage 실동작 확인 (write → read → 비교)
  //    "번들에 들어갔다"와 "실제로 동작한다"는 다른 문제라서 부팅 때 한 번 왕복시킨다.
  const stamp = `${Date.now()}`;
  await storage.setItem(KEYS.sdkSelfTest, stamp);
  const readBack = await storage.getItem(KEYS.sdkSelfTest);
  const storageOk = readBack === stamp;
  console.log(`[toss-sdk][storage] round-trip ${storageOk ? 'OK' : 'FAILED'} (wrote=${stamp}, read=${readBack})`);

  // 게임 화면 꺼짐 방지 (토스 안에서만)
  if (inToss) {
    void safeBridge('setScreenAwakeMode', () => setScreenAwakeMode({ enabled: true }), { enabled: false });
  }

  const selfTest: SdkSelfTest = {
    userKey: identity.invalidCategory ? 'invalid-category' : identity.source === 'toss' ? 'ok' : 'fallback',
    safeArea: inToss ? 'ok' : 'fallback',
    storage: storageOk ? 'ok' : 'fallback',
    navigationBar: inToss ? 'ok' : 'fallback',
  };
  console.log('[toss-sdk] self-test =', selfTest);

  return {
    identity,
    inToss,
    selfTest,
    dispose: () => {
      disposeSafeArea();
      disposeNav();
      if (inToss) {
        void safeBridge('setScreenAwakeMode(off)', () => setScreenAwakeMode({ enabled: false }), {
          enabled: false,
        });
      }
    },
  };
}

// 게임 코드가 쓸 것들을 한 곳에서 재수출한다.
export { storage, KEYS, createCoalescedWriter } from './storage';
export { pushBackHandler, exitMiniApp } from './navigationBar';
export { readInsetPx } from './safeArea';
export { currentIdentity } from './identity';
export { generateHapticFeedback, type HapticFeedbackType } from './bridge';
export { isInToss } from './env';
export type { Identity } from './identity';
/**
 * 연령 게이트. 기본 비활성이며 켜는 것은 정책 결정이다(ageGate.ts 주석 참고).
 * 19+ 등재가 확정되면 main.ts 에서 startGame 전에
 *   const gate = await checkAgeGate({ enabled: true, ageGates: [19] });
 * 를 호출하고 gate.allowed 가 false 면 게임 대신 안내 화면을 띄워라.
 */
export { checkAgeGate } from './ageGate';
export type { AgeGateResult, AgeGateOptions } from './ageGate';

/**
 * 계측(★2026-08-22) — eventLog. 게임 코드는 이걸 직접 쓰지 말고
 * `src/analytics/track.ts` 의 표준 헬퍼를 거쳐라(로그 포맷 통일).
 */
export { eventLog, type EventLogParams, type EventLogType } from './eventLog';
/** 서버 시각(출석 스트릭 시계 조작 경량 방어용) */
export { fetchServerTime } from './serverTime';

/**
 * 프로모션 리워드(★2026-08-26). 조건 = 「3판 플레이 완료」 → 100원.
 * ⚠️여기서 «재수출»하는 이유: 게임 코드는 `../toss` 배럴만 import 한다.
 *   promotion.ts 를 직접 import 하게 두면 경로가 흩어진다.
 * ⛔한계(재설치 시 재수령 가능·예산이 유일한 방어선)는 promotion.ts 주석에 있다.
 */
export {
  claimReward,
  claimReward10,
  requiredPlays10,
  alreadyRewarded,
  alreadyRewarded10,
  type PromoOutcome,
} from './promotion';

/**
 * 프로모션 리워드 ②(★2026-09-01). 조건 = 「3일 «연속» 플레이하기」 → 50원.
 * ⛔①(위 promotion.ts)과 «완전히 별개»다 — 저장키·DOM 속성·락이 전부 다르다.
 *   ①은 지금 가장 잘 도는 프로모션이라(08-31 13건 1,300원·전환 72%) 한 글자도
 *   건드리지 않았다.
 */
export {
  recordPlayAndClaim,
  initPromoStreakBaseline,
  applyBaseline,
  streakDays,
  streakRewarded,
  type StreakOutcome,
} from './promoStreak';

/**
 * 토스 푸시 알림 동의(★2026-09-10 · 머니 리그 -32 정본 이식). 콘솔 기능성 정기 발송
 * `__PUSH_TEMPLATE_CODE__`(매일 19:00 KST 「오늘의 대결」)의 동의창을 띄우는 배선.
 * ⛔철회·상태조회 API 가 없어 앱 안에 끄기 스위치는 두지 않는다(pushAgreement.ts 하단 주석).
 * UI 는 src/ui/pushOptIn.ts 가 «밖에서» 붙인다(src/game/** 무접촉).
 */
export {
  hydratePushState,
  subscribePush,
  getPushState,
  enablePush,
  dismissPushNudge,
  type PushState,
  type PushAvailability,
  type PushLastEvent,
} from './pushAgreement';

/**
 * 「머니 리그」 교차추천(★2026-09-10 · 결과 화면 하루 1회 · 2주 실험).
 * openURL 브릿지(공개 배럴 미노출 → createAsyncBridge 직접 선언)·KST 하루 1회 판정·기록.
 * UI 는 src/ui/crossPromo.ts 가 «밖에서» 붙인다.
 */
export {
  crossPromoDueToday,
  markCrossPromoShown,
  markCrossPromoClicked,
  openCrossPromo,
  crossPromoRecord,
  type CrossPromoOpenOutcome,
  type CrossPromoRecord,
} from './crossPromo';

