/**
 * 공개 인덱스에서 export 되지 않는 브릿지들을 직접 만든다.
 *
 * ── 왜 직접 만드는가 (실측 근거) ────────────────────────────────────────────
 * @apps-in-toss/web-framework 는 `export * from '@apps-in-toss/web-bridge'`
 * 뿐인데, web-bridge@2.10.8 의 dist/index.js 최종 export 목록은 아래가 전부다:
 *   GoogleAdMob, IAP, SafeAreaInsets, Storage, TossAds, appsInTossEvent,
 *   createAsyncBridge, createConstantBridge, createEventBridge, env,
 *   fetchAlbumPhotos, fetchContacts, getAppsInTossGlobals, getClipboardText,
 *   getCurrentLocation, getDeclaredAgeRange, getSafeAreaInsets, getServerTime,
 *   graniteEvent, isMinVersionSupported, loadFullScreenAd, openCamera, partner,
 *   requestNotificationAgreement, requestReview, setClipboardText,
 *   showFullScreenAd, startUpdateLocation, tdsEvent
 *
 * 즉 **getUserKeyForGame / getAnonymousKey / closeView 는 빠져 있다.**
 * 구현 자체는 존재한다 — dist/bridge.js 에
 *   export var getUserKeyForGame = createAsyncBridge("getUserKeyForGame");
 * 로 들어 있지만 package.json exports 에 서브패스가 없어 deep import 가 막힌다.
 *
 * 그래서 공개 API 인 createAsyncBridge 로 동일한 브릿지를 우리가 만든다.
 * createAsyncBridge(method) 는 method 문자열을 그대로 네이티브에 postMessage
 * 하는 얇은 래퍼일 뿐이라(bridge-core/dist/index.js 실측), SDK 가 만든 것과
 * 런타임 동작이 100% 동일하다. 해킹이 아니라 SDK 가 공식 노출한 확장점이다.
 *
 * ※ import 는 @apps-in-toss/bridge-core 에서 한다.
 *    web-bridge 의 .d.ts 는 createAsyncBridge 를 타입 export 하지 않아서
 *    (런타임 export 목록과 .d.ts export 목록이 어긋나 있다 — 업스트림 불일치)
 *    web-framework 경유로 import 하면 TS 에러가 난다. bridge-core 는 같은
 *    싱글톤 모듈이고 타입도 온전하다.
 */
import { createAsyncBridge } from '@apps-in-toss/bridge-core';

export interface AnonymousKeySuccess {
  type: 'HASH';
  hash: string;
}

/**
 * 게임 필수 SDK ①-a — 사용자 식별키 (레거시 이름)
 *
 * 반환:
 *   { type:'HASH', hash } — 성공
 *   'INVALID_CATEGORY'    — 콘솔에서 앱 카테고리가 '게임'이 아님
 *   'ERROR'               — 알 수 없는 오류
 *   undefined             — 토스 앱 버전이 최소 지원 버전 미만
 *
 * 'INVALID_CATEGORY' 가 뜨면 코드 문제가 아니라 **콘솔 설정 문제**다.
 * granite.config.ts 의 webViewProps.type='game' 과 별개로, 토스 콘솔에서
 * 앱 카테고리를 게임으로 등록해야 이 API 가 열린다.
 */
export const getUserKeyForGame = createAsyncBridge<
  [],
  AnonymousKeySuccess | 'INVALID_CATEGORY' | 'ERROR' | undefined
>('getUserKeyForGame');

/**
 * 게임 필수 SDK ①-b — 사용자 식별키 (신규 이름, 권장)
 *
 * ★★ 웹 경로와 RN 경로에서 동작이 다르다. 이게 중요하다 (실측):
 *
 *   [RN 경로] native-modules/src/.../getAnonymousKey.ts:94
 *       export async function getAnonymousKey() {
 *         ... safePostMessage('getUserKeyForGame', {})   ← 네이티브 메시지는 구 이름
 *       }
 *       getUserKeyForGame() 은 getAnonymousKey() 를 부르는 단순 별칭이다.
 *       → 즉 RN 에서는 어느 쪽을 부르든 네이티브로는 'getUserKeyForGame' 이 간다.
 *
 *   [웹 경로] web-bridge@2.10.8 dist/bridge.js — **별칭 관계가 아니다**
 *       export var getAnonymousKey   = createAsyncBridge("getAnonymousKey");
 *       export var getUserKeyForGame = createAsyncBridge("getUserKeyForGame");
 *       두 개가 **서로 다른 네이티브 메서드 이름**으로 나간다.
 *
 * 그래서 웹 경로에서 getAnonymousKey 만 쓰는 것은 위험하다. 네이티브 핸들러
 * 레지스트리에 'getAnonymousKey' 가 없으면(= RN 구현이 여전히
 * 'getUserKeyForGame' 으로만 보내는 것으로 미루어 충분히 가능한 시나리오)
 * createAsyncBridge 의 Promise 는 resolve 도 reject 도 못 받고 **영원히
 * pending** 이다(브릿지 코어에 타임아웃 없음 — 실측). 부팅 경로에서 await
 * 하면 무한 로딩 = 흰 화면이다.
 *
 * → identity.ts 는 (1) 신규 이름 먼저, (2) 타임아웃 3초, (3) 실패 시 레거시
 *   이름으로 폴백 순서로 두 채널을 모두 시도한다. 어느 쪽이 살아 있든 뚫린다.
 *   [확인: 두 브릿지의 메서드명이 다르다는 사실] / [추정: 네이티브가 신규
 *   이름을 아는지 여부 — 실기기 검증 필요]
 */
export const getAnonymousKey = createAsyncBridge<[], AnonymousKeySuccess | 'ERROR' | undefined>(
  'getAnonymousKey'
);

/** 미니앱 종료 (뒤로가기 처리에서 사용) */
export const closeView = createAsyncBridge<[], void>('closeView');

/**
 * 햅틱 — 영역 점령/꼬리 끊김 순간 피드백용. 게임 손맛에 직결되므로 미리 뚫어둔다.
 * 타입 목록은 web-bridge/dist/generateHapticFeedback.d.ts 실측값 그대로다.
 */
export type HapticFeedbackType =
  | 'tickWeak'
  | 'tap'
  | 'tickMedium'
  | 'softMedium'
  | 'basicWeak'
  | 'basicMedium'
  | 'success'
  | 'error'
  | 'wiggle'
  | 'confetti';

export const generateHapticFeedback = createAsyncBridge<[{ type: HapticFeedbackType }], void>(
  'generateHapticFeedback'
);

/**
 * 화면 꺼짐 방지 — 플레이 중 화면이 잠기면 게임이 끊긴다.
 * 파라미터 키는 `enabled` 다(`isAwake` 아님 — d.ts 실측).
 * 앱 전체에 영향을 주므로 게임을 벗어날 때 반드시 false 로 되돌려야 한다.
 */
export const setScreenAwakeMode = createAsyncBridge<[{ enabled: boolean }], { enabled: boolean }>(
  'setScreenAwakeMode'
);

/* ===========================================================================
   프로모션(토스 포인트) 지급 — ★2026-08-26 신설
   ---------------------------------------------------------------------------
   ★ 왜 여기서 createAsyncBridge 로 «직접» 만드는가 (getUserKeyForGame 과 같은 이유)
     web-bridge@2.10.8 의 `dist/index.js` 재수출 배럴에 이 둘이 «없다»(실측:
     `grep -o "grantPromotionReward" dist/index.js` → 0건). 그런데 정의는
     분명히 존재한다 — `dist/bridge.js` 실측:
       grantPromotionReward       =createAsyncBridge("grantPromotionReward")
       grantPromotionRewardForGame=createAsyncBridge("grantPromotionRewardForGame")
     그리고 타입 선언도 `dist/grantPromotionReward.d.ts` / `...ForGame.d.ts` 로
     각각 존재한다. ⇒ 「배럴에서만 빠진 것」이지 「없는 것」이 아니다.
     ★「0건은 부재의 증거가 아니다」 — index.js 만 grep 하고 「미지원」이라고
       결론냈으면 프로모션을 통째로 포기할 뻔했다.

   ★ 파라미터가 «중첩»이다. 공식 개발자센터 문서의 `Promotion.grantReward(
     { promotionCode, amount })` 와 «다르다» — 웹 브릿지는 한 겹 더 감싼다:
       grantPromotionReward({ params: { promotionCode, amount } })
     d.ts 실측이 우선이다. 평평하게 넘기면 네이티브가 코드를 못 읽는다.

   ★ 반환값 4갈래 (d.ts 원문)
       { key }                      지급 성공. key = 리워드 키
       { errorCode, message }       지급 실패(4100/4104/4105/4108/4109/4110/
                                    4112/4113/4114/40000)
       'ERROR'                      알 수 없는 오류
       undefined                    토스 앱 버전이 최소 지원(5.232.0) 미만
     ⇒ ★`isSupported()` 는 «이 브릿지들에 없다». 그건 web-framework 가 공개
       export 하는 함수(showFullScreenAd 등)에만 붙는 장식이고, 우리가
       createAsyncBridge 로 만든 것에는 붙지 않는다(bridge-core 실측).
       ⇒ 미지원 판정은 **`undefined` 반환**으로 «동등하게» 한다. d.ts 가
         명시한 공식 신호다. 없는 메서드를 부르지 않는다.

   ⛔ 이 브릿지는 네이티브가 응답을 안 주면 «영원히 pending» 이다(bridge-core에
      타임아웃 없음). 반드시 env.ts 의 safeBridge 로 감싸서 불러라.
      promotion.ts 가 그렇게 하고 있다. 여기를 직접 부르지 마라.
   =========================================================================== */

/** 프로모션 지급 성공 응답 */
export interface GrantPromotionSuccess {
  key: string;
}
/** 프로모션 지급 실패 응답(비즈니스 에러) */
export interface GrantPromotionFailure {
  errorCode: string;
  message: string;
}
export type GrantPromotionResult =
  | GrantPromotionSuccess
  | GrantPromotionFailure
  | 'ERROR'
  | undefined;

export interface GrantPromotionParams {
  params: { promotionCode: string; amount: number };
}

/** 현행 API. 게임/비게임 공통. */
export const grantPromotionReward = createAsyncBridge<
  [GrantPromotionParams],
  GrantPromotionResult
>('grantPromotionReward');

/**
 * 레거시 API — d.ts 에 `@deprecated` 가 붙어 있다. 게임 카테고리 전용이고
 * 게임이 아닌 미니앱에서 부르면 errorCode '40000' 이 온다.
 * ★ 신규(grantPromotionReward)가 «네이티브에 없을» 경우를 대비한 폴백으로만 쓴다.
 *   identity.ts 가 getAnonymousKey → getUserKeyForGame 으로 폴백하는 것과 같은 구조다
 *   (웹 경로에서 두 브릿지는 «서로 다른 네이티브 메서드명»으로 나간다 — bridge.js 실측).
 */
export const grantPromotionRewardForGame = createAsyncBridge<
  [GrantPromotionParams],
  GrantPromotionResult
>('grantPromotionRewardForGame');
