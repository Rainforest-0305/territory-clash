/**
 * 웹 전용 Toss SDK 대체 shim (브라우저 / Microsoft Store / Capacitor APK 용).
 *
 * ── 왜 존재하는가 ───────────────────────────────────────────────────────────
 * `src/toss/*` 는 `@apps-in-toss/web-framework` 배럴을 import 한다. 이 배럴은
 * 트리셰이킹이 되지 않아 **토스 광고 SDK 가 통째로 웹 번들에 딸려 들어간다**:
 *   - 원격 스크립트 로더  https://static.toss.im/ads/sdk/toss-ads-space-kit-*.js
 *   - 광고 트래킹 fetch   EVENT_TRACKING / RESULT_TRACKING / tossAdEventLog
 * 게임은 이 코드를 단 한 줄도 호출하지 않는다(순수 dead code). 그러나
 *   1) MSIX 패키지 안의 원격 스크립트 로더는 스토어 심사 리스크이고,
 *   2) "광고 없음 / 트래킹 없음" 신고 내용과 패키지 내용이 모순되며,
 *   3) 한국 전용 광고망을 9개 언어 글로벌 릴리스에 실을 이유가 없다.
 *
 * ── 어떻게 갈아끼우는가 ─────────────────────────────────────────────────────
 * vite.config.ts 의 `tc-toss-web-shim` 플러그인이 `src/toss/index.ts` 로
 * 해석되는 import 를 이 파일로 되돌린다. 배럴만 갈아끼우면 `src/toss/**`
 * 서브트리 전체가 모듈 그래프에서 빠진다(외부에서 배럴 말고 직접 import 하는
 * 곳이 없음을 확인했다 — game/index.ts · game/save.ts · main.ts · ui/exitConfirm.ts).
 *
 *   vite build              → 이 shim   (웹 / 스토어)
 *   vite build --mode toss  → 진짜 SDK  (`ait build` 가 이 모드로 부른다)
 *
 * ★ 미니앱 빌드는 절대 이 파일을 타지 않는다. 토스 심사 필수 SDK 4종은
 *   `src/toss/**` 원본 그대로 살아 있다.
 *
 * ── 타입 드리프트 방지 ──────────────────────────────────────────────────────
 * 아래 모든 export 는 진짜 모듈의 타입(`typeof RealToss.*`)을 직접 붙여서
 * 선언한다. 원본 시그니처가 바뀌면 이 파일이 **컴파일 에러**로 터진다.
 * `import type` 이라 런타임에는 완전히 제거되며 프레임워크가 딸려오지 않는다.
 */
import type * as RealToss from '../toss';

// ── 환경 판별 ────────────────────────────────────────────────────────────────
/** 웹 빌드에서는 정의상 토스 밖이다. */
export const isInToss: typeof RealToss.isInToss = () => false;

// ── ③ Storage (localStorage 백엔드) ─────────────────────────────────────────
const NS = 'tc:'; // src/toss/storage.ts 와 반드시 동일해야 한다(저장 데이터 호환).

function localGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function localSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota / private mode — 무시 */
  }
}
function localRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

export const storage: typeof RealToss.storage = {
  async getItem(key: string): Promise<string | null> {
    return localGet(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    localSet(key, value);
  },

  async removeItem(key: string): Promise<void> {
    localRemove(key);
  },

  async clearItems(): Promise<void> {
    /* 웹에서는 통째로 비우지 않는다 — 같은 origin 의 다른 데이터를 지울 수 있다. */
  },

  async getJSON<T>(key: string, fallback: T): Promise<T> {
    const raw = await this.getItem(key);
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      console.warn(`[web-shim][storage] corrupt JSON at ${key}, using fallback`);
      return fallback;
    }
  },

  async setJSON(key: string, value: unknown): Promise<void> {
    await this.setItem(key, JSON.stringify(value));
  },
};

/** 저장 키 정본. src/toss/storage.ts 의 KEYS 와 값이 다르면 컴파일 에러가 난다. */
export const KEYS: typeof RealToss.KEYS = {
  bestScore: `${NS}bestScore`,
  progress: `${NS}progress`,
  settings: `${NS}settings`,
  sdkSelfTest: `${NS}sdkSelfTest`,
} as const;

/** 쓰기 병합 저장소 — 원본과 동일 동작(게임 루프에서 반드시 이걸 쓴다). */
export const createCoalescedWriter: typeof RealToss.createCoalescedWriter = (flushMs = 800) => {
  const pending = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function flush(): Promise<void> {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending.size === 0) return;
    const entries = [...pending.entries()];
    pending.clear();
    for (const [k, v] of entries) {
      await storage.setItem(k, v);
    }
  }

  function schedule(): void {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, flushMs);
  }

  return {
    set(key: string, value: unknown): void {
      pending.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      schedule();
    },
    flush,
  };
};

// ── ④ 뒤로가기 스택 ─────────────────────────────────────────────────────────
type BackHandler = Parameters<typeof RealToss.pushBackHandler>[0];

const backHandlers: BackHandler[] = [];

export const pushBackHandler: typeof RealToss.pushBackHandler = (handler) => {
  backHandlers.push(handler);
  return () => {
    const i = backHandlers.indexOf(handler);
    if (i >= 0) backHandlers.splice(i, 1);
  };
};

/** 원본 navigationBar.ts 의 "토스 밖" 분기와 동일하게 popstate 를 뒤로가기로 잇는다. */
function handleBack(): void {
  for (let i = backHandlers.length - 1; i >= 0; i--) {
    try {
      if (backHandlers[i]!() === true) return;
    } catch (err) {
      console.warn('[web-shim][nav] back handler threw:', err);
    }
  }
  // 아무도 소비하지 않았다. 웹에서는 닫을 창이 없으므로 아무 일도 하지 않는다.
}

/** 웹에는 닫을 미니앱이 없다 — 원본도 토스 밖에서는 no-op 이다. */
export const exitMiniApp: typeof RealToss.exitMiniApp = async () => {};

// ── ② Safe Area ─────────────────────────────────────────────────────────────
/**
 * styles.css 의 :root 가 이미 --sat/--sar/--sab/--sal 을 env(safe-area-inset-*)
 * 로 초기화한다. 원본도 토스 밖에서는 아무것도 덮어쓰지 않고 이 폴백에 맡긴다.
 */
export const readInsetPx: typeof RealToss.readInsetPx = () => {
  const cs = getComputedStyle(document.documentElement);
  const num = (name: string) => parseFloat(cs.getPropertyValue(name)) || 0;
  return { top: num('--sat'), right: num('--sar'), bottom: num('--sab'), left: num('--sal') };
};

// ── 햅틱 ────────────────────────────────────────────────────────────────────
/** 웹에는 토스 햅틱 브릿지가 없다. 조용히 삼킨다(진동 API 를 쓰면 권한 프롬프트가 뜬다). */
export const generateHapticFeedback = async (
  _args: Parameters<typeof RealToss.generateHapticFeedback>[0]
): Promise<void> => {};

// ── ① 식별키 (로컬 익명 ID) ─────────────────────────────────────────────────
const LOCAL_ID_KEY = 'tc:localAnonId'; // src/toss/identity.ts 와 동일해야 한다.

let cached: RealToss.Identity | null = null;

function makeLocalId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return `local-${c.randomUUID()}`;
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

async function resolveLocalIdentity(): Promise<RealToss.Identity> {
  const existing = await storage.getItem(LOCAL_ID_KEY);
  if (existing) return { userKey: existing, source: 'local', invalidCategory: false };
  const fresh = makeLocalId();
  await storage.setItem(LOCAL_ID_KEY, fresh);
  return { userKey: fresh, source: 'local', invalidCategory: false };
}

export const currentIdentity: typeof RealToss.currentIdentity = () => cached;

// ── 연령 게이트 ─────────────────────────────────────────────────────────────
/** 웹에는 토스 연령 정보가 없다. 원본도 토스 밖이면 'unsupported-env' 로 통과시킨다. */
export const checkAgeGate: typeof RealToss.checkAgeGate = async (options = {}) => {
  const { enabled = false } = options;
  if (!enabled) return { allowed: true, reason: 'not-required' };
  return { allowed: true, reason: 'unsupported-env' };
};

// ── 부트스트랩 ──────────────────────────────────────────────────────────────
export const initTossSdk: typeof RealToss.initTossSdk = async () => {
  console.log('[web-shim] boot (browser build — Toss SDK not bundled)');

  const onPop = () => handleBack();
  window.addEventListener('popstate', onPop);

  cached = await resolveLocalIdentity();

  // 원본과 같은 위치에 저장 왕복 확인을 남긴다(진단 패널이 이 값을 읽는다).
  const stamp = `${Date.now()}`;
  await storage.setItem(KEYS.sdkSelfTest, stamp);
  const storageOk = (await storage.getItem(KEYS.sdkSelfTest)) === stamp;

  return {
    identity: cached,
    inToss: false,
    selfTest: {
      userKey: 'fallback',
      safeArea: 'fallback',
      storage: storageOk ? 'ok' : 'fallback',
      navigationBar: 'fallback',
    },
    dispose: () => {
      window.removeEventListener('popstate', onPop);
    },
  };
};

// ── 계측(eventLog) ───────────────────────────────────────────────────────────
// 웹/스토어 빌드는 "데이터 수집 없음·네트워크 요청 없음" 을 문구와 실제 모두에서
// 지켜야 한다(store_문안/store_listing_9lang.md, privacy_policy_초안.txt).
// 그래서 네이티브 브릿지를 타지 않고 콘솔에만 남긴다 — 전송은 절대 하지 않는다.
export const eventLog: typeof RealToss.eventLog = async (p) => {
  console.log('[web-shim][eventLog]', p.log_name, p.log_type, p.params);
};

// ── 서버 시각(fetchServerTime) ────────────────────────────────────────
// 웹에는 토스 서버 시각 브릿지가 없다 — 원본도 토스 밖에서는 undefined 를 준다(같은 동작).
export const fetchServerTime: typeof RealToss.fetchServerTime = async () => undefined;


// ── 프로모션 리워드 (★2026-08-26) ───────────────────────────────────────────
/**
 * 웹/MS스토어/Capacitor APK 에는 «프로모션 자체가 없다». 토스 포인트는 토스 앱
 * 안에서만 존재한다. 그래서 여기서는 항상 'unsupported' 로 닫고 끝낸다.
 *
 * ★이 shim 이 «반드시» 필요한 이유(실측):
 *   이 파일 없이 game/index.ts 가 `claimReward` 를 import 하면 웹 빌드가
 *   그대로 터진다 — 실제로 터뜨려 봤다:
 *     `"claimReward" is not exported by "src/toss-web/index.ts"` (rollup)
 *   ⚠️`tsc --noEmit` 은 이걸 «통과»시킨다. tsc 는 `src/toss` 원본을 보지만
 *     웹 번들은 vite alias 로 이 shim 을 쓰기 때문이다. 타입체크만 믿으면
 *     웹 채널이 조용히 깨진 채로 나간다.
 *
 * ★그리고 이게 «옳은» 동작이다: 토스 SDK 서브트리가 웹 번들에서 통째로 빠져야
 *   한다는 이 파일의 존재 이유(원격 광고 로더 배제)를 프로모션도 그대로 따른다.
 *   웹 번들에는 grantPromotionReward 호출이 «0건이어야 정상»이다.
 */
export const claimReward: typeof RealToss.claimReward = async () => 'unsupported';
export const alreadyRewarded: typeof RealToss.alreadyRewarded = async () => false;
// 「10판 플레이하기」(★2026-09-09) — ①과 «같은 이유»로 웹/스토어/APK 에는
// 존재하지 않는다. 웹 번들에 grantPromotionReward 호출이 0건이어야 정상이다.
export const claimReward10: typeof RealToss.claimReward10 = async () => 'unsupported';
export const alreadyRewarded10: typeof RealToss.alreadyRewarded10 = async () => false;
/**
 * ★웹/스토어/APK 에는 프로모션이 «없다». 문턱은 정본과 «같은 10» 을 돌려준다 —
 *   0 을 돌려주면 매 판 claimReward10() 이 불리고(항상 'unsupported' 라 무해하지만)
 *   호출 그래프가 실제와 달라져 검사기가 헛것을 본다.
 * ⛔완화 플래그(data-promo2-testonly)는 «읽지 않는다». 웹 빌드에는 그 개념이 없다.
 */
export const requiredPlays10: typeof RealToss.requiredPlays10 = () => 10;

// ── 프로모션 리워드 ②「3일 연속 플레이」 (★2026-09-01) ──────────────────────
// ①과 같은 이유로 웹/스토어/APK 에는 «존재하지 않는다». 항상 'unsupported'.
// ⚠️이 shim 이 없으면 web 빌드가 rollup 단계에서 그대로 터진다(①에서 실측한 함정).
export const recordPlayAndClaim: typeof RealToss.recordPlayAndClaim = async () => 'unsupported';
export const streakDays: typeof RealToss.streakDays = async () => 0;
export const streakRewarded: typeof RealToss.streakRewarded = async () => false;
// 기준선도 토스 밖에서는 의미가 없다(지급 자체가 없다). 형태만 맞춘다.
export const initPromoStreakBaseline: typeof RealToss.initPromoStreakBaseline = async () => undefined;
export const applyBaseline: typeof RealToss.applyBaseline = (rec) => rec;

// ── 토스 푸시 알림 동의 (★2026-09-10) ───────────────────────────────────────
/**
 * 웹/스토어/APK 에는 토스 알림 동의창이 «없다». availability 는 항상 'unavailable' 이고
 * src/ui/pushOptIn.ts 는 isInToss() 가 false 라 아무것도 그리지 않는다(빈 래퍼 0).
 * ⚠️이 shim 이 없으면 웹 빌드가 rollup 단계에서 터진다(프로모션 ①에서 실측한 함정).
 */
const PUSH_UNAVAILABLE: RealToss.PushState = {
  availability: 'unavailable',
  available: false,
  enabled: false,
  busy: false,
  nudge: false,
  hydrated: true,
  error: '',
  lastEvent: '',
};
export const hydratePushState: typeof RealToss.hydratePushState = async () => undefined;
export const getPushState: typeof RealToss.getPushState = () => PUSH_UNAVAILABLE;
export const subscribePush: typeof RealToss.subscribePush = (listener) => {
  listener(PUSH_UNAVAILABLE);
  return () => {};
};
export const enablePush: typeof RealToss.enablePush = async () => PUSH_UNAVAILABLE;
export const dismissPushNudge: typeof RealToss.dismissPushNudge = () => {};

// ── 「머니 리그」 교차추천 (★2026-09-10) ─────────────────────────────────────
// 토스 밖에는 열 미니앱이 없다. 카드도 그리지 않는다(dueToday 항상 false). openURL 브릿지도 «없다».
export const crossPromoDueToday: typeof RealToss.crossPromoDueToday = async () => false;
export const markCrossPromoShown: typeof RealToss.markCrossPromoShown = async () => undefined;
export const markCrossPromoClicked: typeof RealToss.markCrossPromoClicked = async () => undefined;
export const openCrossPromo: typeof RealToss.openCrossPromo = async () => 'failed';
export const crossPromoRecord: typeof RealToss.crossPromoRecord = async () => ({});

// ── 타입 재수출 (런타임 코드 없음) ──────────────────────────────────────────
export type {
  TossRuntime,
  SdkSelfTest,
  Identity,
  HapticFeedbackType,
  AgeGateResult,
  AgeGateOptions,
  EventLogParams,
  EventLogType,
  PromoOutcome,
  StreakOutcome,
  PushState,
  PushAvailability,
  PushLastEvent,
  CrossPromoOpenOutcome,
  CrossPromoRecord,
} from '../toss';
