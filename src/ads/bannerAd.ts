/**
 * 배너광고 SDK 얇은 경계면.
 *
 * ── 왜 이 파일이 따로 있는가 ────────────────────────────────────────────────
 * adSdk.ts(전면광고 경계면)와 «같은 이유·같은 구조»다. 운영 지면으로 로컬에서
 * 실제 광고를 요청하는 것은 계정 중단 사유라, 자리 검증 하니스가 이 모듈
 * «하나»만 스텁으로 갈아끼울 수 있어야 한다.
 * (menuBanners.ts 안에 테스트 주입 훅을 두지 «않는다» — 운영 코드에 테스트
 *  배선이 섞이면 그게 다음 사고의 씨앗이 된다. adSdk.ts 와 동일한 방침.)
 *
 * ── SDK 실측 시그니처 ───────────────────────────────────────────────────────
 *   node_modules/@apps-in-toss/web-bridge/dist/index.js:1455 initialize
 *                                                     :1580 attachBanner
 *   TossAds.initialize({ callbacks:{ onInitialized, onInitializationFailed } }) => void
 *     ★비동기다. static.toss.im 에서 ads-space-kit 스크립트를 «받아온 뒤»
 *       window.TossAdsSpaceKit 에 노출한다. 15초 타임아웃.
 *   TossAds.attachBanner(adGroupId, target, options) => { destroy(): void }
 *     ★initialize 가 «끝나기 전»에 부르면 내부에서
 *       "[toss-ad] Call initialize() before attaching an ad." 로 던지고
 *       onAdFailedToRender 로 되돌려준다. 그래서 반드시 onInitialized 뒤에 붙인다.
 *   TossAds.*.isSupported() 전부 보유 (fetchTossAd.isSupported 로 위임)
 *
 * ★ 절대 throw 하지 않는다. SDK 가 없는 환경(브라우저·APK·MS Store)에서도
 *   게임은 그대로 돌아야 한다. adSdk.ts 와 같은 계약이다.
 */
import { TossAds } from './tossAdsSdk'; // ★ 2026-08-22: barrel 직접 import 수정(shim 우회 정정) — tossAdsSdk.ts 주석 참고

export interface BannerCallbacks {
  /** 광고가 실제로 그려졌다. ★자리를 «펴는» 신호는 이것 하나뿐이다. */
  onAdRendered?: () => void;
  /** 채울 광고가 없다 / 그리기 실패. ★자리를 «접는» 신호. */
  onAdEmpty?: (reason: string) => void;
}

export interface BannerHandle {
  destroy(): void;
}

export interface BannerSdk {
  isSupported(): boolean;
  /** 준비되면 콜백. 실패해도 콜백을 부르지 «않는다»(자리는 접힌 채로 둔다). */
  ready(onReady: () => void, onFail: (err: unknown) => void): void;
  attach(adGroupId: string, target: HTMLElement, cb: BannerCallbacks): BannerHandle;
}

const NOOP_HANDLE: BannerHandle = { destroy() {} };

export const bannerSdk: BannerSdk = {
  isSupported(): boolean {
    try {
      return (
        typeof TossAds?.initialize?.isSupported === 'function' &&
        TossAds.initialize.isSupported() &&
        typeof TossAds?.attachBanner?.isSupported === 'function' &&
        TossAds.attachBanner.isSupported()
      );
    } catch {
      return false;
    }
  },

  ready(onReady, onFail): void {
    try {
      TossAds.initialize({
        callbacks: {
          onInitialized: () => {
            try {
              onReady();
            } catch (err) {
              console.warn('[bannerAd] onReady threw', err);
            }
          },
          onInitializationFailed: (err: unknown) => onFail(err),
        },
      });
    } catch (err) {
      onFail(err);
    }
  },

  attach(adGroupId, target, cb): BannerHandle {
    try {
      const res = TossAds.attachBanner(adGroupId, target, {
        // 게임 UI 가 다크 고정(#0B1020)이다. granite.config.ts 의
        // navigationBar.theme 과 같은 근거로 dark 를 준다.
        theme: 'dark',
        // 카드형 = 좌우 10px 여백 + radius 16px. 시작화면 시트(radius 22px)와
        // 같은 결이라 «얹은 것»처럼 보인다. expanded(기본값)는 풀블리드다.
        variant: 'card',
        callbacks: {
          onAdRendered: () => cb.onAdRendered?.(),
          onNoFill: () => cb.onAdEmpty?.('noFill'),
          onAdFailedToRender: (p: { error?: { message?: string } }) =>
            cb.onAdEmpty?.(p?.error?.message ?? 'failedToRender'),
        },
      });
      return res ?? NOOP_HANDLE;
    } catch (err) {
      console.warn('[bannerAd] attach failed', err);
      cb.onAdEmpty?.('attachThrew');
      return NOOP_HANDLE;
    }
  },
};
