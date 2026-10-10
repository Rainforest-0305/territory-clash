/**
 * 광고 지면 ID 정본 — 토스 콘솔 실측값. 이 파일 하나만 게이트/배너 양쪽이 참조한다.
 *
 * 🚨2026-08-22 — 왜 ID 상수까지 배럴로 뺐는가:
 * `src/ads/tossAdsSdk.ts` shim 으로 SDK «함수 호출»(loadFullScreenAd 등)은
 * 웹 빌드에서 사라졌지만, ID 문자열 리터럴은 adGate.ts/menuBanners.ts 안에
 * `const AD_GROUP_ID = '...'` 로 그대로 남아 있었다(호출은 안 해도 상수 선언
 * 자체는 여전히 번들에 들어간다). check-ad-leak.py 가 이걸 "ait.v2.live.*"
 * 정규식으로 잡아낸다 — 기능상 무해(웹 빌드에서 이 값을 쓰는 SDK 호출 자체가
 * no-op 이라 네트워크로 안 나감)하지만, "광고 없음" 신고와 소스에 광고 ID가
 * 박혀있는 게 모순으로 보일 수 있어 문자열 자체도 걷어낸다.
 *
 * ── 이식 규칙 ────────────────────────────────────────────────────────────────
 * 새 지면을 추가하면 **여기에만** 상수를 추가하고, `src/ads-web/adConfig.ts`
 * 에도 짝을 이루는 플레이스홀더를 같이 추가해라(타입이 강제한다 —
 * `typeof RealConfig` 라 하나라도 빠지면 컴파일 에러).
 */
export const AD_GROUP_ID: string = 'ait.v2.live.XXXXXXXXXXXXXXXX'; // 전면광고(interstitial) — 명시적 string 타입(리터럴 타입이면 웹 스텁이 같은 값만 허용함)
export const TOP_AD_GROUP_ID: string = 'ait.v2.live.XXXXXXXXXXXXXXXX'; // 시작화면 상단 배너
export const BOTTOM_AD_GROUP_ID: string = 'ait.v2.live.XXXXXXXXXXXXXXXX'; // 시작화면 하단 배너
/**
 * 두 번째 부활(리워드형) 지면 — ★2026-09-05 신설, 콘솔 지면 «생성 대기 중».
 *
 * ⚠️빈 문자열인 동안에는 «광고 부활 제안 자체가 뜨지 않는다»
 *   (src/ads/rewardedAd.ts 의 reviveAdAvailable() 가 여기서 먼저 막는다).
 *   즉 지금 이 파일 상태로 빌드하면 부활 동작은 라이브와 «완전히 동일»하다
 *   — 무료 1회뿐이고, 두 번째 제안은 존재하지 않는다.
 *   빈 ID 로 SDK 를 부르는 일은 «절대» 없다(계정 정지 사유).
 *
 * ★삽입 위치는 여기 한 줄뿐이다. 콘솔에서 리워드 지면을 만들면 발급된
 *   'ait.v2.live.<16 hex>' 를 아래 빈 따옴표 안에 넣고 재빌드하면 끝이다
 *   (src/ads-web/adConfig.ts 는 손댈 필요 없다 — 웹 스텁은 값과 무관하다).
 */
export const REVIVE_AD_GROUP_ID: string = 'ait.v2.live.XXXXXXXXXXXXXXXX';
