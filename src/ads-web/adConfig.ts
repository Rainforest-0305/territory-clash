/**
 * 웹/스토어 채널용 광고 지면 ID 플레이스홀더.
 * 실제 값이 아니라 「이건 웹 빌드에서 쓰이지 않는다」가 문자열 자체로 드러나는
 * 값을 넣는다(빈 문자열보다 디버그 로그에 찍혔을 때 원인 파악이 빠르다).
 * ★진짜 ID 는 웹 빌드 어디에도 존재하지 않는다 — check-ad-leak.py 가 이걸 검증한다.
 */
import type * as RealConfig from '../ads/adConfig';

export const AD_GROUP_ID: typeof RealConfig.AD_GROUP_ID = 'unused-in-web-build';
export const TOP_AD_GROUP_ID: typeof RealConfig.TOP_AD_GROUP_ID = 'unused-in-web-build';
export const BOTTOM_AD_GROUP_ID: typeof RealConfig.BOTTOM_AD_GROUP_ID = 'unused-in-web-build';
/**
 * ★리워드(부활) 지면. 값이 무엇이든 웹 빌드에서는 쓰이지 않는다 —
 *   rewardedAd.ts 가 ID 보다 «먼저» GoogleAdMob.isSupported() 를 보고,
 *   웹 스텁(src/ads-web/tossAdsSdk.ts)은 그것을 항상 false 로 고정한다.
 */
export const REVIVE_AD_GROUP_ID: typeof RealConfig.REVIVE_AD_GROUP_ID = 'unused-in-web-build';
