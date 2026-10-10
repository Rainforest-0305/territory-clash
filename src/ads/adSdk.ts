/**
 * 전면광고 SDK 얇은 경계면.
 *
 * ── 왜 이 파일이 따로 있는가 ────────────────────────────────────────────────
 * 게이트 로직(adGate.ts)을 «실제 광고 요청 없이» 검증하려면 SDK 를 바꿔 끼울 수
 * 있어야 한다. 운영 지면으로 로컬에서 실제 광고를 요청하는 것은 계정 중단
 * 사유다. 그래서 검증 하니스는 이 모듈 «하나»만 스텁으로 갈아끼운다.
 * (adGate.ts 안에 테스트용 주입 훅을 두지 «않는다» — 운영 코드에 테스트 배선이
 *  섞이면 그게 다음 사고의 씨앗이 된다.)
 *
 * ── SDK 실측 시그니처 (@apps-in-toss/types dist/index.d.ts:309-338) ─────────
 *   loadFullScreenAd({ options:{adGroupId}, onEvent, onError }) => () => void
 *     onEvent: { type:'loaded' }
 *   showFullScreenAd({ options:{adGroupId}, onEvent, onError }) => () => void
 *     onEvent: { type:'show'|'impression'|'clicked'|'dismissed'|'failedToShow' }
 *   양쪽 다 .isSupported() 를 가진다.
 *
 * ★ 반환값은 «구독 해지 함수»다. 재시도할 때 이전 해지 함수를 반드시 불러야
 *   구독이 중첩되지 않는다(adGate.ts 가 그렇게 쓴다).
 */
import { loadFullScreenAd, showFullScreenAd } from './tossAdsSdk'; // ★ 2026-08-22: barrel 직접 import 수정(shim 우회 정정) — tossAdsSdk.ts 주석 참고

export type LoadEvent = { type: 'loaded' };
export type ShowEvent = {
  type: 'show' | 'impression' | 'clicked' | 'dismissed' | 'failedToShow';
};

export interface AdSdk {
  isSupported(): boolean;
  load(params: {
    options: { adGroupId: string };
    onEvent: (e: LoadEvent) => void;
    onError: (err: unknown) => void;
  }): () => void;
  show(params: {
    options: { adGroupId: string };
    onEvent: (e: ShowEvent) => void;
    onError: (err: unknown) => void;
  }): () => void;
}

/**
 * ★ isSupported 는 «로드/표시»에만 쓴다. 판 계수를 막는 데 쓰면 안 된다
 *   (ADGATE_V2_SPEC §7 — 「계수는 항상, 광고는 조건부」).
 * ★ 절대 throw 하지 않는다. SDK 가 없는 환경(브라우저·APK)에서도 게임은 돌아야 한다.
 */
export const adSdk: AdSdk = {
  isSupported(): boolean {
    try {
      return (
        typeof loadFullScreenAd?.isSupported === 'function' &&
        loadFullScreenAd.isSupported() &&
        typeof showFullScreenAd?.isSupported === 'function' &&
        showFullScreenAd.isSupported()
      );
    } catch {
      return false;
    }
  },
  load(params): () => void {
    return loadFullScreenAd(params as Parameters<typeof loadFullScreenAd>[0]) ?? (() => {});
  },
  show(params): () => void {
    return showFullScreenAd(params as Parameters<typeof showFullScreenAd>[0]) ?? (() => {});
  },
};
