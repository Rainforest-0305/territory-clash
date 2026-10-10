/**
 * 웹/스토어 채널용 광고 SDK no-op 스텁.
 * `src/toss-web/index.ts` 와 같은 원칙: 타입은 진짜 모듈에서 그대로 붙여서
 * (`typeof RealAds.X`) 원본 시그니처가 바뀌면 이 파일이 컴파일 에러로 터지게
 * 한다. `import type` 이라 런타임에는 완전히 제거되며 SDK 가 안 딸려온다.
 *
 * ★isSupported() 를 전부 false 로 고정한다 — adSdk.ts/bannerAd.ts 의
 *   isSupported() 판정이 여기서 이미 false 로 막히므로, load()/show()/
 *   attachBanner() 는 웹 빌드에서 «호출되는 코드 경로 자체가 없다»
 *   (adGate.ts/menuBanners.ts 가 매 시도 전에 isSupported 를 먼저 본다).
 */
import type * as RealAds from '../ads/tossAdsSdk';

const unsupported = () => false;

export const loadFullScreenAd: typeof RealAds.loadFullScreenAd = Object.assign(
  (() => () => {}) as unknown as typeof RealAds.loadFullScreenAd,
  { isSupported: unsupported }
);

export const showFullScreenAd: typeof RealAds.showFullScreenAd = Object.assign(
  (() => () => {}) as unknown as typeof RealAds.showFullScreenAd,
  { isSupported: unsupported }
);

/**
 * ★리워드 광고(두 번째 부활)의 웹 스텁. isSupported() 를 false 로 고정하면
 *   rewardedAd.ts 의 reviveAdAvailable() 가 false 를 돌려주고, 게임은 애초에
 *   「광고 보고 부활」 제안을 «만들지도 않는다». load/show 는 호출 경로가 없다.
 */
export const GoogleAdMob: typeof RealAds.GoogleAdMob = {
  loadAppsInTossAdMob: Object.assign(
    (() => () => {}) as unknown as typeof RealAds.GoogleAdMob.loadAppsInTossAdMob,
    { isSupported: unsupported }
  ),
  showAppsInTossAdMob: Object.assign(
    (() => () => {}) as unknown as typeof RealAds.GoogleAdMob.showAppsInTossAdMob,
    { isSupported: unsupported }
  ),
} as typeof RealAds.GoogleAdMob;

export const TossAds: typeof RealAds.TossAds = {
  initialize: Object.assign((() => {}) as unknown as typeof RealAds.TossAds.initialize, {
    isSupported: unsupported,
  }),
  attach: Object.assign(
    (() => ({ destroy() {} })) as unknown as typeof RealAds.TossAds.attach,
    { isSupported: unsupported }
  ),
  attachBanner: Object.assign(
    (() => ({ destroy() {} })) as unknown as typeof RealAds.TossAds.attachBanner,
    { isSupported: unsupported }
  ),
  destroy: Object.assign((() => {}) as unknown as typeof RealAds.TossAds.destroy, {
    isSupported: unsupported,
  }),
  destroyAll: Object.assign((() => {}) as unknown as typeof RealAds.TossAds.destroyAll, {
    isSupported: unsupported,
  }),
} as typeof RealAds.TossAds;
