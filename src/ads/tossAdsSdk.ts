/**
 * ############################################################################
 * ##  광고 SDK 배럴 — 웹/스토어 채널 shim 의 두 번째 스위치점 (2026-08-22)   ##
 * ############################################################################
 *
 * 🚨★긴급 정정: `src/ads/adSdk.ts`·`src/ads/bannerAd.ts` 가 지금까지
 *   `@apps-in-toss/web-framework` 를 «직접» import 하고 있었다(barrel-bypass).
 *   `src/toss/index.ts` ↔ `src/toss-web/index.ts` shim 은 «그 배럴 하나만»
 *   가로채므로, ads 모듈의 직접 import 는 shim 을 «완전히 우회»한다.
 *
 * [실측 2026-08-22] `vite build`(모드 없음, 웹/MS Store 채널) 산출물에
 *   `loadFullScreenAd`·`showFullScreenAd`·`tossAdEventLog`·`static.toss.im`·
 *   광고 지면 ID 리터럴 3개(`ait.v2.live.*`) 전부 «그대로» 들어 있었다.
 *   (channel_shim_kit/check-ad-leak.py 로 발견 — 이전의 「web 번들 0건」 확인은
 *   `grep -c`(라인 카운트)를 minified «단일 줄» 파일에 쓴 방법론 결함이었다.
 *   `-c` 는 매치 «라인 수»를 세는데 미니파이 산출물은 1줄이라 항상 0/1만
 *   나온다 — 몇 번 매치됐는지는 절대 안 보인다. `grep -o | wc -l` 을 썼어야
 *   했다. `check:all` 에 거는 `check-ad-leak.py` 는 파일 전체 스캔이라 이
 *   함정에 안 걸린다.)
 *
 * ── 해법 ────────────────────────────────────────────────────────────────────
 * `src/toss/index.ts` 와 완전히 같은 패턴 — 광고 SDK 전용 배럴을 하나 더 둔다.
 *   · 이 파일(`src/ads/tossAdsSdk.ts`)  = 진짜 SDK(토스 빌드가 씀)
 *   · `src/ads-web/tossAdsSdk.ts`      = 웹 빌드용 no-op 스텁
 *   · `vite.config.ts` 가 `/src/ads/tossAdsSdk.ts` 로 끝나는 import 를
 *     웹 빌드에서 후자로 되돌린다(토스 배럴 스위치와 완전히 같은 코드 형태).
 * `adSdk.ts`/`bannerAd.ts` 는 이제 `@apps-in-toss/web-framework` 를 직접
 * import 하지 «않고» 이 파일을 거친다 — 그 두 파일의 나머지 로직(운영 코드,
 * ADGATE_V2_SPEC 계약)은 «한 글자도» 안 건드렸다.
 */
export {
  loadFullScreenAd,
  showFullScreenAd,
  TossAds,
  /**
   * ★2026-09-05 추가 — 리워드형(보상형) 광고. 두 번째 부활에만 쓴다.
   *   전면광고(loadFullScreenAd/showFullScreenAd)와 «다른 함수»다.
   *   반드시 이 배럴을 거쳐라 — 직접 import 하면 웹 shim 을 우회해
   *   2026-08-22 와 같은 누출이 «조용히» 재발한다(이 파일 상단 주석 참고).
   */
  GoogleAdMob,
} from '@apps-in-toss/web-framework';
