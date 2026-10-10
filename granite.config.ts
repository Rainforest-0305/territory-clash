/**
 * granite.config.ts — Apps In Toss `.ait` 빌드 정본 (트랙 D / 땅따먹기)
 *
 * ============================================================================
 * 이 파일이 어떤 빌드 전략을 타는지 (중요 — 오해 금지)
 * ============================================================================
 * @apps-in-toss/cli 의 buildArtifact() 는 전략을 소스 문자열로 고른다.
 *   node_modules/@apps-in-toss/cli/dist/index.js  WebBuildStrategy.match():
 *     return graniteConfigSource.includes('@apps-in-toss/web-framework');
 * 즉 이 파일에 '@apps-in-toss/web-framework' 문자열이 있으면 **Web 전략**,
 * 없으면 RN(Granite) 전략이다. 아래 import 문자열을 바꾸면 전략이 통째로
 * 바뀌므로 절대 건드리지 마라.
 *
 * Web 전략이 실제로 하는 일 (CLI 소스 실측):
 *   1) `web.commands.build` (= vite build) 를 실행해서 outdir 에 웹 산출물 생성
 *   2) outdir/* 를 전부 outdir/web/ 으로 이동 (index.html 필수, 없으면 빌드 실패)
 *   3) @apps-in-toss/web-framework 가 제공하는 **선빌드 WebView 호스트 번들**
 *      (prebuilt/prod/{ios,android}/{rn84,rn72}) 에 babel 로 이 config 값을
 *      상수 주입 → bundle.{ios,android}.{0_84_0,0_72_6}.js 4종 생성
 *   4) 4종 번들 + outdir/web/** 전부를 zip 해서 `.ait` 로 포장
 *
 * ★ 따라서 "게임 코드"는 4종 플랫폼 번들 안에 있는 게 아니라 `.ait` 안의
 *   `web/assets/*.js` 에 있다. 검증할 때 이 둘을 헷갈리지 마라.
 *   - 4종 번들에서 확인할 것: appName / webViewType / navigationBar / brand 주입값
 *   - web/assets/*.js 에서 확인할 것: SDK 4종 호출 코드
 *
 * ============================================================================
 * appName — 반드시 토스 콘솔 등록 앱 ID 와 일치해야 한다
 * ============================================================================
 * 불일치하면 업로드는 되지만 서버 컴파일에서 BUILD_FAILED 로 떨어진다.
 * (MIRI 실사고: "콘솔에 등록된 앱 ID와 granite.config.ts의 appName이
 *  일치하지 않아요")
 * ▶ 현재 값 'territoryclash' 는 **콘솔 미등록 잠정값**이다.
 *   President/Partner 가 콘솔에 앱을 만든 뒤 실제 appName 으로 교체할 것.
 *   교체하면 **반드시 재빌드**해야 한다(값이 번들에 인라인되므로).
 */
import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'territoryclash',


  /**
   * web.commands
   *   dev   — `ait dev` 가 띄우는 로컬 개발 서버 명령
   *   build — `ait build` 가 .ait 만들기 전에 실행하는 명령
   * port 는 dev 서버 포트. vite.config.ts 의 server.port 와 반드시 같아야 한다.
   */
  web: {
    host: 'localhost',
    port: 5173,
    /**
     * ★ --mode toss 를 절대 지우지 마라.
     *   vite.config.ts 의 tc-toss-web-shim 플러그인이 이 모드일 때만 비활성화된다.
     *   즉 이 플래그가 있어야 미니앱 빌드가 **진짜 토스 SDK**(src/toss/**)를 쓴다.
     *   빼면 게임 필수 SDK 4종이 통째로 shim(no-op)으로 바뀌어
     *   식별키·Storage·SafeArea·네비바가 전부 죽고 심사에서 반려된다.
     *   웹/스토어 빌드(`npm run build:web`)는 반대로 모드 없이 돌려 광고 SDK 를 뺀다.
     */
    commands: {
      dev: 'vite --port 5173 --mode toss',
      build: 'vite build --mode toss',
    },
  },

  /**
   * outdir — vite 의 build.outDir 와 같아야 한다.
   *   CLI 는 결과물을 outdir/web/ 으로 옮긴다. index.html 이 없으면 에러.
   *
   * ★★ 치명적 함정 — 반드시 `npm run build` 로 빌드하라 (= clean + ait build)
   *   WebBuildStrategy.ensurePrepared() 는 이렇게 시작한다(cli 실측):
   *       const files = await fs.readdir(webDistDir);
   *       if (files.includes('index.html')) { ...; this.prepared = true; return config; }
   *   즉 `dist/web/index.html` 이 이미 있으면 **vite 빌드를 통째로 건너뛴다.**
   *   그런데 직전 `ait build` 가 바로 그 파일을 남긴다. 따라서 게임 코드를
   *   고치고 `npx ait build` 만 다시 치면 **옛날 게임이 담긴 .ait 가 조용히
   *   나온다**(에러도 경고도 없다). 트랙 C 조사 함정 #9.
   *   → package.json 의 "build" 가 clean 을 먼저 돌게 박아뒀다. 우회하지 마라.
   */
  outdir: 'dist',

  brand: {
    displayName: '땅따먹기',
    primaryColor: '#3A7BFF',
    /**
     * ★ 반드시 "토스 콘솔에 등록한 아이콘과 동일한 publicUrl" 이어야 한다.
     *   다른 URL(예: 자체 CDN, PWA 아이콘)을 쓰면 반려된다.
     *   실제 반려 사유 원문(turnon 이력):
     *   "granite.config.ts에 콘솔에 등록한 아이콘과 동일한 아이콘을 등록해야 해요"
     * 2026-08-05 교체 완료. 콘솔 미니앱 60605 의 iconUri 와 **동일한 주소**다
     * (store/toss/icon_600.png 600x600 업로드분, sha256 95647af0f058cf0d).
     * 이 값을 바꾸면 콘솔 아이콘도 같이 바꾸고 재빌드해야 한다.
     */
    icon: 'https://static.toss.im/appsintoss/63105/6d528477-975c-49ef-80cc-23d8724cfd80.png',
  },

  /**
   * permissions — 이 게임이 쓰는 네이티브 권한.
   *   영역점령 게임은 clipboard/geolocation/contacts/photos/camera/microphone 중
   *   어느 것도 쓰지 않는다. Storage(네이티브 저장소)와 사용자 식별키는
   *   이 permissions 배열이 아니라 별도 브릿지 경로다. 따라서 빈 배열이 정답.
   *   광고(TossAds/AdMob)나 IAP 를 붙이게 되면 그때 재검토.
   */
  permissions: [],

  /**
   * webViewProps — ★ 게임 필수 설정
   *
   *   type: 'game'
   *     CLI 가 `config.webViewProps?.type === 'game'` 로 isGame 을 판정하고,
   *     그 값이 .ait 아티팩트 메타에 들어간다
   *     (cli/dist/index.js WebBuildStrategy.getArtifactOptions).
   *     또 web-config 의 babelBuild 가 `Ait.webViewType` 자리에 이 문자열을
   *     상수로 박아넣는다. 게임인데 이 값이 없으면 게임 프레임으로 안 뜬다.
   *
   *   나머지 값은 "게임 캔버스가 스크롤/바운스/당겨서새로고침에 먹히지 않도록"
   *   전부 끄는 조합이다. 캔버스 드래그로 방향을 조작하는 게임이라
   *   이걸 안 끄면 조작 중에 화면이 튀거나 새로고침이 걸린다.
   */
  webViewProps: {
    type: 'game',
    bounces: false,
    pullToRefreshEnabled: false,
    overScrollMode: 'never',
    allowsInlineMediaPlayback: true,
    mediaPlaybackRequiresUserAction: false,
    allowsBackForwardNavigationGestures: false,
  },

  /**
   * navigationBar — 게임 필수 SDK 4종 중 "내비게이션 바" 항목의 선언부.
   *
   *   빌드타임 고정값이다(런타임 API 없음). web-config 의 babelBuild 가
   *   JSON.stringify 해서 `Ait.navigationBar` 자리에 통째로 주입한다.
   *
   *   withBackButton: true
   *     미니앱 자체 나가기 수단. 게임은 시스템 백 제스처를 끄는 경우가 많아
   *     (위 allowsBackForwardNavigationGestures:false) 이 버튼이 유일한
   *     탈출구가 된다. false 로 두면 반려 위험.
   *     실제 뒤로가기 눌림은 런타임에서 graniteEvent 'backEvent' 로 받는다
   *     → src/toss/navigationBar.ts 참고. 게임 중이면 "정말 나갈까요?"를
   *     띄우고, 아니면 closeView() 로 종료한다.
   *
   *   withHomeButton: false
   *     홈 버튼까지 두면 상단이 복잡해지고, 게임 내 홈(메인메뉴)과 의미가
   *     겹쳐 사용자가 헷갈린다. 게임 내 홈은 게임 UI 로 제공한다.
   *
   *   withTitle: false
   *     게임 화면 안에 자체 HUD/타이틀이 있어 제목이 두 번 나오는 것 방지.
   *
   *   transparentBackground: true
   *     게임 배경(다크)이 상단까지 끊김 없이 이어지게 한다.
   *
   *   theme: 'dark'
   *     뒤로가기 아이콘 색을 결정한다(light = #191F28 어두운 아이콘,
   *     dark = #FFFFFF 흰 아이콘 — @apps-in-toss/framework 실측).
   *     이 게임은 다크 배경 고정(#0B1020)이므로 흰 아이콘이어야 보인다.
   *     WCAG 대비: #FFFFFF on #0B1020 ≈ 18.6:1 PASS /
   *               #191F28 on #0B1020 ≈ 1.13:1 FAIL.
   *     ★ 아트 디렉션이 라이트 배경으로 바뀌면 이 값도 같이 뒤집어야 한다.
   */
  navigationBar: {
    withBackButton: true,
    withHomeButton: false,
    withTitle: false,
    transparentBackground: true,
    theme: 'dark',
  },
});
