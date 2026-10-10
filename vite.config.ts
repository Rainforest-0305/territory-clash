import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const TOSS_BARREL = '/src/toss/index.ts';
const WEB_SHIM = fileURLToPath(new URL('./src/toss-web/index.ts', import.meta.url));

/**
 * 🚨2026-08-22 긴급 추가 — 광고 SDK 배럴은 따로 있었다.
 * `src/ads/adSdk.ts`·`src/ads/bannerAd.ts` 가 `@apps-in-toss/web-framework` 를
 * «직접» import 해서(TOSS_BARREL 경유가 아님) 아래 shim 이 못 잡고 있었다.
 * [실측] 웹 빌드(모드 없음)에 loadFullScreenAd/showFullScreenAd/tossAdEventLog/
 * static.toss.im/광고 ID 리터럴 3개가 그대로 들어가 있었다
 * (channel_shim_kit/check-ad-leak.py 로 발견 — 이전 「web 번들 0건」 확인은
 * grep -c 를 minified 단일 줄 파일에 써서 매치 수를 못 본 방법론 결함이었다).
 * 지금은 adSdk.ts/bannerAd.ts 가 `./tossAdsSdk` 를 거친다(그 파일 주석 참고).
 */
const ADS_BARREL = '/src/ads/tossAdsSdk.ts';
const ADS_WEB_SHIM = fileURLToPath(new URL('./src/ads-web/tossAdsSdk.ts', import.meta.url));

/**
 * 광고 지면 ID 리터럴 배럴 — SDK 함수 호출을 없애도 `const AD_GROUP_ID='ait.v2.
 * live.…'` 문자열 자체는 남는다(호출 안 해도 상수 선언은 번들에 들어간다).
 * check-ad-leak.py 가 리터럴 포맷(ait.v2.live.[0-9a-f]{16})으로 잡아내서
 * 이것도 별도 배럴로 뺐다(adConfig.ts 참고).
 */
const AD_CONFIG_BARREL = '/src/ads/adConfig.ts';
const AD_CONFIG_WEB_SHIM = fileURLToPath(new URL('./src/ads-web/adConfig.ts', import.meta.url));

/** 배럴 경로 → 웹 빌드용 대체 파일. 새 SDK 경계면이 생기면 여기 한 줄만 추가한다. */
const SHIM_PAIRS: Array<{ barrel: string; shimPath: string; selfRefGuardDir: string }> = [
  { barrel: TOSS_BARREL, shimPath: WEB_SHIM, selfRefGuardDir: '/src/toss-web/' },
  { barrel: ADS_BARREL, shimPath: ADS_WEB_SHIM, selfRefGuardDir: '/src/ads-web/' },
  { barrel: AD_CONFIG_BARREL, shimPath: AD_CONFIG_WEB_SHIM, selfRefGuardDir: '/src/ads-web/' },
];

/**
 * 웹 빌드에서 토스 SDK(+광고 SDK) 를 통째로 들어낸다.
 *
 * ── 왜 필요한가 ─────────────────────────────────────────────────────────────
 * `src/toss/bridge.ts` 등이 `@apps-in-toss/web-framework` 배럴을 import 하는데,
 * 이 배럴은 트리셰이킹이 되지 않아 **토스 광고 SDK 가 웹 번들에 통째로**
 * 딸려 들어온다(원격 스크립트 로더 static.toss.im/ads/... + EVENT_TRACKING /
 * RESULT_TRACKING 트래킹 fetch). 게임은 이 코드를 한 줄도 호출하지 않는다.
 * 그러나 MSIX 패키지 안의 원격 스크립트 로더는 스토어 심사 리스크이고,
 * "광고·트래킹 없음" 신고와 패키지 내용이 모순된다.
 *
 * ── 왜 배럴만 갈아끼우면 되는가 ─────────────────────────────────────────────
 * SHIM_PAIRS 에 등록된 배럴(`src/toss/index.ts`, `src/ads/tossAdsSdk.ts`) «말고»
 * 직접 `@apps-in-toss/web-framework`·`@apps-in-toss/bridge-core` 를 import 하는
 * 곳이 없어야 한다(2026-08-22 전수 재확인: `grep -rn "^import.*@apps-in-toss"
 * src` 로 두 배럴 파일 자신 + 위 재확인 이후 정리된 adSdk.ts/bannerAd.ts 뿐임을
 * 확인). 그래서 배럴만 shim 으로 돌리면 서브트리 전체가 모듈 그래프에서 빠진다.
 * ⚠️새 SDK 호출을 추가할 때는 반드시 해당 배럴을 거쳐라 — 직접 import 하면
 *   이번과 같은 누출이 «조용히» 재발한다. 재발 방지책은 check-ad-leak.py
 *   (channel_shim_kit/, check:all 에 걸려 있다) 가 빌드 후 자동으로 잡는다.
 *
 * ── 미니앱은 절대 이 경로를 타지 않는다 ─────────────────────────────────────
 *   vite build              → shim  (웹 / 마이크로소프트 스토어)
 *   vite build --mode toss  → 원본  (`ait build` 가 이 모드로 부른다)
 * granite.config.ts 의 web.commands 가 --mode toss 를 넘긴다. 그 플래그를
 * 지우면 미니앱에서 토스 SDK 4종이 통째로 사라져 심사 반려된다.
 */
function tossWebShim(): Plugin {
  return {
    name: 'tc-toss-web-shim',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer) return null;
      const importerNorm = importer.replace(/\\/g, '/');
      // shim 자신이 타입 재수출을 위해 원본 배럴을 참조한다 — 자기참조 방지.
      if (SHIM_PAIRS.some((p) => importerNorm.includes(p.selfRefGuardDir))) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved) return null;
      const resolvedNorm = resolved.id.replace(/\\/g, '/');
      const hit = SHIM_PAIRS.find((p) => resolvedNorm.endsWith(p.barrel));
      return hit ? hit.shimPath : null;
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: mode === 'toss' ? [] : [tossWebShim()],

  /**
   * base: './'  ← 반드시 상대경로.
   *   .ait 안의 웹 산출물은 `web/` 하위에 통째로 zip 되고, 토스 앱이
   *   file:// 또는 임의 origin 아래에서 index.html 을 연다. 절대경로('/')로
   *   두면 자산 404 가 나면서 흰 화면만 뜬다.
   *   Capacitor(플레이스토어 경로)도 동일하게 상대경로를 요구한다.
   */
  base: './',

  build: {
    // granite.config.ts 의 outdir 과 반드시 동일해야 한다.
    outDir: 'dist',
    emptyOutDir: true,
    /**
     * target es2019
     *   .ait 는 RN 0.72.6 런타임(구형 안드로이드 WebView / 구형 iOS WKWebView)
     *   에서도 떠야 한다. 최신 문법(optional chaining 이후 세대)을 그대로
     *   내보내면 구형 WebView 에서 SyntaxError 로 흰 화면이 된다.
     */
    target: 'es2019',
    /**
     * ★★ 2026-08-22 긴급 정정 — true → false. [실측] 웹 번들 소스맵이 단독으로
     *   원본 TypeScript 전문을 sourcesContent 로 통째로 담아 내보냈다(preflight_ait.py 실측:
     *   web/ 소스맵 1개가 sourcesContent 433,652자, .ait 전체 용량의 70.3%를 차지함).
     *   조직 내부 표지(트랙·Partner·Chief·레인 등) 가 주석에 섞여 있어 유출 위험이고, 모바일
     *   미니앱은 이 용량을 그대로 다운로드하므로 첫 실행 체감에도 직접 영향을 준다.
     * ⚠️ RN 래퍼 번들(bundle.{ios,android}.{0_72_6,0_84_0}.js.map, .ait 안에 4개 더
     *   들어간다)은 이 설정과 무관하다 — 그건 vite 가 안 만든다. 출처를 찾았다(실측):
     *     파일: node_modules/@apps-in-toss/web-config/dist/index.js
     *     함수: babelBuild()
     *     그 함수 안에 sourceMaps: true 라는 값이 있는데, 이건 우리 프로젝트 코드가
     *     아니라 SDK 자체에 하드코딩되어 있다. 즉 우리 프로젝트 어디에도 이걸 끌
     *   설정 스위치가 없다 — 다음 빌드 때는 .ait 패키징 직후 후처리(그 4개 .map
     *   파일 제거 + 대응하는 .js 안의 sourceMappingURL 줄 제거)로 내려야 한다.
     *   이번 빌드에는 적용 안 함(검수 중인 150595 재빌드 금지 규율 준수 —
     *   소스만 고치고 다음 빌드에 반영한다).
     */
    sourcemap: false,
    /**
     * modulepreload 폴리필 제거.
     *   폴리필은 <link rel=modulepreload> 를 모르는 브라우저를 위해 런타임에서
     *   fetch(link.href) 를 부른다. 그런데 이 프로젝트는 manualChunks:undefined +
     *   cssCodeSplit:false 라 **청크가 하나**이고 동적 import 도 없어서 폴리필이
     *   할 일이 전혀 없다.
     *   그럼에도 남겨두면 번들 안에 fetch( 호출이 하나 남는데, 스토어 심사에서
     *   패키지를 뜯어보는 쪽에는 "네트워크 전송 코드"로 읽힌다.
     *   실제로 하는 일이 없는 코드 때문에 개인정보 신고 내용을 해명할 이유가 없다.
     */
    modulePreload: { polyfill: false },
    // 게임 코드는 한 덩어리로 두는 게 초기 로딩에 유리하다(청크 왕복 제거).
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },

  server: {
    // granite.config.ts 의 web.port 와 반드시 동일해야 한다.
    port: 5173,
    host: 'localhost',
  },
}));
