/**
 * 후처리 레이어 — WebGL 블룸 + 화면 후처리 (2026-08-30 그래픽 고도화).
 *
 * 네온 스레드 파일럿(neon-post.js)의 기법을 이 게임에 맞게 옮긴 것이다. 차이 두 가지:
 *   1) 밝기 문턱(bright-pass)이 «없다». 이 게임은 원래부터 «무엇이 빛나는가»를
 *      명시적으로 그린다(render.ts 의 bloomCv = 림·트레일·머리·파티클). 그 버퍼를
 *      «emissive» 텍스처로 받아 그대로 블러한다 → 영토 내부가 하얗게 타지 않고,
 *      풀해상도 씬을 한 번 더 읽는 패스(bright-pass)가 통째로 빠진다.
 *   2) 비네트·그레인·채도하강·막판 테두리 펄스를 합성 셰이더 «안»에서 한다.
 *      캔버스에서 풀스크린 패스 3~4개가 들던 것이 유니폼 4개가 됐다(비용 0).
 *
 * 게임 로직은 이 파일을 모른다. 렌더러는 begin() 이 돌려주는 2D 컨텍스트에 세계를
 * 그리고 end() 에 emissive 캔버스를 넘긴다. WebGL 이 없거나 컨텍스트를 잃으면
 * init() 이 false → 렌더러는 예전 경로(캔버스 블룸 + 캔버스 후처리)로 그린다.
 *
 * ── 픽셀 예산 (네온 2차 교훈: iPhone DPR3 에서 풀해상도 업로드가 프레임을 먹었다) ──
 * scene 캔버스 DPR 은 화면 DPR 이 아니라 «예산»으로 정한다: w×h×min(dpr,2)² > 1.0M px 면 1.5, 아니면 2.
 * ★이 값은 (w,h,dpr) 만의 함수다 — 품질 단계가 바뀌어도 «캔버스 크기는 플레이 중 절대 바뀌지 않는다»
 *   (네온 -22 실기기 「장애물이 계속 깜빡거려」 사후분석: 단계 전환마다 scene/GL 캔버스 크기가 바뀌며
 *   재할당·재업로드·보간 변화가 «깜빡임»으로 보였다). 단계는 «블러 체인»만 바꾼다.
 *
 * ── 동적 품질 3단계 + 히스테리시스 (2026-08-30 규칙) ──
 *   q0 = 1/4 타이트 + 1/8 와이드 (6패스) / q1 = 1/4 만 (3패스) / q2 = 1/8 만 (4패스)
 *   판정 창 30프레임: 19ms 초과 ≥5/30 → 강등 후보. 단, 어느 단계든 «최소 체류 8초» 전엔 전환하지 않는다.
 *   회복(승격): 창에서 19ms 초과 ≤1 인 «깨끗한» 시간이 15초 연속 쌓여야 한 단계 올린다. 세션당 승격 ≤2회.
 *   모든 전환은 400ms 크로스페이드(합성 계수 lerp — 페이드 중엔 양쪽 단계의 «원래» 버퍼를 둘 다 계산해
 *   섞으므로 페이드 끝에서 튀지 않는다). 즉 화면이 «확» 바뀌는 순간이 없다.
 *   최후 보험(불가역): q2 에서 8초 이상 머문 뒤에도 33ms 초과가 90프레임 중 25% 를 넘으면 블룸 패스를
 *   «끈다». 씬 업로드 + 합성 1패스는 그대로 — 캔버스 크기·경로가 안 바뀌고(규칙 3), 캔버스 블룸
 *   폴백보다 빠르다(실측: CPU 8× 폴백 43fps < GL 46fps). 세션 안에서 다시 켜지지 않는다.
 *   전환 기록(qlog: [프레임, 단계, 사유, 세션 경과 ms])은 ?diag=1 로 읽는다.
 */

const VS = 'attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}';
/* 프래그먼트 정밀도 highp(지원 시). 네온 3차 실측: iOS(Apple GPU) mediump=fp16 이라 텍셀 좌표가 양자화돼
   얇은 선 샘플이 위치마다 흔들렸다. 이 게임의 영역 경계선(2~4텍셀)·꼬리선이 정확히 그 조건이다. */
const PREC = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
/* 분리형 가우시안 5탭(=9텍셀). flip=1 이면 캔버스 업로드 방향(위가 0행)을 GL 방향으로 뒤집어 읽는다.
   체인의 «첫» 패스만 flip 을 쓴다 — 그 뒤 버퍼는 전부 GL 방향이다. */
const FS_BLUR =
  PREC +
  'varying vec2 v;uniform sampler2D s;uniform vec2 d;uniform float flip;' +
  'void main(){vec2 u=mix(v,vec2(v.x,1.-v.y),flip);vec3 c=texture2D(s,u).rgb*.2270270270;' +
  'c+=(texture2D(s,u+d*1.3846153846).rgb+texture2D(s,u-d*1.3846153846).rgb)*.3162162162;' +
  'c+=(texture2D(s,u+d*3.2307692308).rgb+texture2D(s,u-d*3.2307692308).rgb)*.0702702703;gl_FragColor=vec4(c,1.);}';
/* 2x2 다운샘플 (1/4 → 1/8) */
/* ★문턱 없음 — 순수 2×2 평균(선형). 문턱이 있었다면 «다운샘플 전 텍셀 각각»에 걸어야 한다(네온 -22 깜빡임 원인). */
const FS_DOWN =
  PREC +
  'varying vec2 v;uniform sampler2D s;uniform vec2 px;' +
  'void main(){vec3 c=(texture2D(s,v+px*vec2(-.5,-.5)).rgb+texture2D(s,v+px*vec2(.5,-.5)).rgb+texture2D(s,v+px*vec2(-.5,.5)).rgb+texture2D(s,v+px*vec2(.5,.5)).rgb)*.25;gl_FragColor=vec4(c,1.);}';
/* 합성: 씬 + 블룸 2겹 가산 → 비네트 → 막판 테두리 틴트 → 채도하강. -24: 그레인 «없음» — 매 프레임 재시드되는
   기기 픽셀 단위 잡음이 President iPhone 에서 「픽셀 단위로 짜글짜글」로 보였다. 평평한 면은 평평하게. */
const FS_COMP =
  PREC +
  'varying vec2 v;uniform sampler2D s;uniform sampler2D b1;uniform sampler2D b2;' +
  'uniform float k1;uniform float k2;uniform float vig;uniform float urgent;uniform float desat;' +
  'void main(){vec2 u=vec2(v.x,1.-v.y);vec3 c=texture2D(s,u).rgb+texture2D(b1,v).rgb*k1+texture2D(b2,v).rgb*k2;' +
  'float dd=distance(v,vec2(.5));float vg=smoothstep(.38,.92,dd*1.25);' +
  'c*=1.-vig*vg;' +
  'c+=vec3(1.,.14,.28)*urgent*vg*vg;' +
  'float l=dot(c,vec3(.2126,.7152,.0722));c=mix(c,vec3(l),desat);' +
  /* soft-knee (0.8 부터 완만히 1.0 으로, C1 연속) — 하드 클립 min(c,1) 은 밝은 림이 겹치는 곳에서 «면»으로 터진다 */
  'vec3 k=step(vec3(.8),c);c=mix(c,.8+.2*(1.-exp(-(c-.8)*5.)),k);' +
  'gl_FragColor=vec4(clamp(c,0.,1.),1.);}';

interface Prog {
  p: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}
interface Fbo {
  f: WebGLFramebuffer;
  t: WebGLTexture;
  w: number;
  h: number;
}

/** -23: iOS(WebKit) scene DPR 상한. 3 = 기기 DPR 그대로(iPhone). 성능 여유 없으면 2. */
/** -23 3단: Android scene DPR 시작 상한(2) · 저가 기기 폴백(1.5) · 폴백 기록 키 · 프로브 임계(p95 ms) */
const ANDROID_SDPR_START = 2;
const ANDROID_SDPR_FALLBACK = 1.5;
const ANDROID_SDPR_KEY = 'tc_gfx_android_sdpr';
const ANDROID_PROBE_P95_MS = 20;
// -24: iOS scene DPR 2 (3 은 -22 대비 픽셀 4배 → 「렉이 좀 심해졌고」). HUD 층(이름표·팝업)은 기기 DPR 3 그대로.
const IOS_SCENE_DPR_CAP = 2;

export interface PostParams {
  /** 채도하강 0..1 (사망/실패) */
  desat: number;
  /** 막판 테두리 틴트 0..1 */
  urgent: number;
}

/** 최소 체류(어떤 단계든 이 시간 전엔 전환 없음) */
const MIN_DWELL_MS = 8000;
/** 회복(승격)에 필요한 연속 «깨끗한» 시간 */
const RECOVER_MS = 15000;
/** -24: 첫 승격(q1 시작 → q0)은 iOS 에서 3초 깨끗하면 — 보수적으로 시작하되 빨리 올린다. Android 는 프로브(1~4초)와 겹치지 않게 15초 유지. */
const FIRST_RECOVER_MS = 3000;
/** 세션당 승격 상한 */
const MAX_PROMOS = 2;
/** 전환 크로스페이드 */
const FADE_MS = 400;

export class PostFx {
  supported = false;
  on = false;
  lost = false;
  /** 최후 보험이 발동했는가(세션 내 1회, 불가역) — 블룸 패스 off, GL 합성은 유지 */
  autoOff = false;
  /** 동적 품질 0 양호 / 1 주의 / 2 위험 */
  q = 0;
  adaptive = true;
  /** 최후 보험 사용 여부. ?autooff=0 이면 끈다(계측용). */
  auto = true;
  frames = 0;
  qChanges = 0;
  /** [프레임, 단계(3=블룸 off), 사유, 세션 경과 ms] */
  readonly qlog: Array<[number, number, string, number]> = [];
  /** 세션(아레나) 경과 ms — 플레이 중 프레임만 누적 */
  tierMs = 0;
  /** Android UA (기본 단계 q1) */
  android = false;
  /** Android scene DPR 상한(2 시작, 프로브 실패 기록이 있으면 1.5) */
  androidCap = ANDROID_SDPR_START;
  private probeLast = 0;
  private probeStart = 0;
  private probeDone = false;
  private probeT: number[] = [];
  probeP95 = 0;
  /** 깜빡임 프로브(diag 전용): end() 마다 a1 FBO 를 읽어 블룸 에너지를 기록한다. readPixels 는 동기 스톨 — 계측에만 쓴다. */
  probe = false;
  readonly energyLog: number[][] = [];
  private probeBuf: Uint8Array | null = null;
  /** 마지막 단계 전환 뒤 경과 ms(최소 체류 판정) */
  private sinceChange = 0;
  /** 연속 «깨끗한» 시간 ms(회복 판정) */
  private cleanMs = 0;
  /** 이번 세션 승격 횟수 */
  promos = 0;
  /** 크로스페이드: 이전 단계(-1 = 없음) → 현재 단계, fadeT 0..FADE_MS */
  private fadeFrom = -1;
  private fadeT = 0;
  /** 페이드 중인가(계측용) */
  get fading(): boolean {
    return this.fadeFrom >= 0;
  }
  /** 이번 프레임 scene 캔버스 DPR */
  sdpr = 1;
  /** scene 텍스처가 NEAREST 인가(1:1 일 때만 true — 계측용) */
  sceneNearest = false;
  tight = 0.45;
  wide = 0.15;

  readonly scene: HTMLCanvasElement;
  private sctx: CanvasRenderingContext2D | null = null;
  readonly glc: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private prog: { blur?: Prog; down?: Prog; comp?: Prog } = {};
  private fbo: { a1?: Fbo; b1?: Fbo; a2?: Fbo; b2?: Fbo } = {};
  private sceneTex: WebGLTexture | null = null;
  private emisTex: WebGLTexture | null = null;
  private W = 0;
  private H = 0;
  private EW = 0;
  private EH = 0;
  private sceneUploaded = false;
  private emisUploaded = false;
  private win = new Float32Array(90);
  private wi = 0;
  private wn = 0;
  private qw = 0;
  private qbad = 0;
  private qwMs = 0;

  constructor() {
    this.scene = document.createElement('canvas');
    this.glc = document.createElement('canvas');
  }

  /**
   * @param host  GL 캔버스를 붙일 부모(#app). 게임 캔버스 «위», 비네트 오버레이·HUD «아래».
   */
  init(host: HTMLElement): boolean {
    try {
      if (typeof window === 'undefined' || !('WebGLRenderingContext' in window)) return false;
      if (/[?&]bloom=off\b/.test(location.search)) return false;
      if (/[?&]autooff=0\b/.test(location.search)) this.auto = false;
      /* 안드로이드(Chromium 웹뷰·저가 GPU)는 «q1 에서 시작»한다 — iOS 와 반대로 보수적. 15초 깨끗하면 q0 으로
         올라간다(세션당 ≤2회). ?tier=0|1|2 로 강제(계측용). 실기기 판정 2026-08-30: 라이브부터 안드로이드 프레임 저하. */
      if (/[?&]adapt=0\b/.test(location.search)) {
        this.adaptive = false;
        this.auto = false;
        console.info('[post] adaptive tiers + fuse disabled by ?adapt=0');
      }
      const tierQ = /[?&]tier=([012])\b/.exec(location.search);
      this.android = /Android/i.test(navigator.userAgent);
      if (this.android) {
        try {
          if (localStorage.getItem(ANDROID_SDPR_KEY) === String(ANDROID_SDPR_FALLBACK)) this.androidCap = ANDROID_SDPR_FALLBACK;
        } catch (_) {}
        console.info('[post] android scene dpr cap', this.androidCap);
      }
      this.publishGfxDiag();
      if (tierQ) this.q = +tierQ[1]!;
      else this.q = 1; // -24: 모든 플랫폼 q1 로 시작(보수적). iOS 는 3초 깨끗하면 q0, Android 는 15초.
      if (this.q) console.info('[post] initial tier q' + this.q + (tierQ ? ' (forced)' : this.android ? ' (android)' : ' (conservative start)'));
      const glc = this.glc;
      glc.id = 'tc-gl';
      glc.setAttribute('aria-hidden', 'true');
      glc.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:0;visibility:hidden';
      const attrs: WebGLContextAttributes = {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
      };
      const gl = (glc.getContext('webgl', attrs) ||
        glc.getContext('experimental-webgl', attrs)) as WebGLRenderingContext | null;
      if (!gl) return false;
      this.gl = gl;
      this.setupGL();
      this.sctx = this.scene.getContext('2d', { alpha: false });
      if (!this.sctx) return false;
      host.appendChild(glc);
      glc.addEventListener(
        'webglcontextlost',
        (e) => {
          e.preventDefault();
          this.lost = true;
          this.on = false;
          glc.style.visibility = 'hidden';
        },
        false
      );
      glc.addEventListener(
        'webglcontextrestored',
        () => {
          try {
            this.prog = {};
            this.fbo = {};
            this.sceneTex = null;
            this.emisTex = null;
            this.W = 0;
            this.EW = 0;
            this.setupGL();
            this.lost = false;
            this.on = !this.autoOff;
          } catch {
            this.lost = true;
          }
        },
        false
      );
      this.supported = true;
      this.on = true;
      return true;
    } catch (e) {
      console.warn('[post] disabled:', e instanceof Error ? e.message : e);
      this.supported = false;
      this.on = false;
      return false;
    }
  }

  private setupGL(): void {
    const gl = this.gl!;
    this.prog.blur = this.link(FS_BLUR);
    this.prog.down = this.link(FS_DOWN);
    this.prog.comp = this.link(FS_COMP);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  }

  private compile(type: number, src: string): WebGLShader {
    const gl = this.gl!;
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error('shader: ' + gl.getShaderInfoLog(sh));
    }
    return sh;
  }

  private link(fs: string): Prog {
    const gl = this.gl!;
    const p = gl.createProgram()!;
    gl.attachShader(p, this.compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, this.compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'a');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('link: ' + gl.getProgramInfoLog(p));
    }
    const u: Record<string, WebGLUniformLocation | null> = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) {
      const inf = gl.getActiveUniform(p, i)!;
      u[inf.name] = gl.getUniformLocation(p, inf.name);
    }
    return { p, u };
  }

  private makeTex(w: number, h: number): WebGLTexture {
    const gl = this.gl!;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (w) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  }

  private makeFbo(w: number, h: number): Fbo {
    const gl = this.gl!;
    const t = this.makeTex(w, h);
    const f = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) throw new Error('fbo incomplete');
    return { f, t, w, h };
  }

  private delFbo(o?: Fbo): void {
    if (!o) return;
    this.gl!.deleteFramebuffer(o.f);
    this.gl!.deleteTexture(o.t);
  }

  private alloc(W: number, H: number): void {
    const gl = this.gl!;
    const w1 = Math.max(1, Math.ceil(W / 4));
    const h1 = Math.max(1, Math.ceil(H / 4));
    const w2 = Math.max(1, Math.ceil(W / 8));
    const h2 = Math.max(1, Math.ceil(H / 8));
    this.delFbo(this.fbo.a1);
    this.delFbo(this.fbo.b1);
    this.delFbo(this.fbo.a2);
    this.delFbo(this.fbo.b2);
    this.fbo.a1 = this.makeFbo(w1, h1);
    this.fbo.b1 = this.makeFbo(w1, h1);
    this.fbo.a2 = this.makeFbo(w2, h2);
    this.fbo.b2 = this.makeFbo(w2, h2);
    if (this.sceneTex) gl.deleteTexture(this.sceneTex);
    this.sceneTex = this.makeTex(0, 0);
    // 씬은 1:1 정확 복사(GL 캔버스 = scene 크기) — LINEAR 는 반텍셀 위상에서 흐려진다(네온 3차 규격).
    // -24 규칙: «정확히 1:1» 일 때만 NEAREST. 비율이 다르면 NEAREST 는 프레임마다 경계가 흔들린다 → LINEAR.
    const oneToOne = this.scene.width === this.glc.width && this.scene.height === this.glc.height;
    const filt = oneToOne ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
    this.sceneNearest = oneToOne;
    this.sceneUploaded = false;
    this.W = W;
    this.H = H;
  }

  private pass(pr: Prog, target: Fbo | null, bind: (u: Prog['u']) => void): void {
    const gl = this.gl!;
    gl.useProgram(pr.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : null);
    gl.viewport(0, 0, target ? target.w : this.W, target ? target.h : this.H);
    bind(pr.u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private tex(unit: number, t: WebGLTexture | null): void {
    const gl = this.gl!;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
  }

  /** scene DPR(픽셀 예산). (w,h,dpr) 만의 함수 — 품질 단계와 «무관»하다(플레이 중 캔버스 크기 불변). */
  budgetDpr(_w: number, _h: number, dpr: number): number {
    /* -23: iOS(WebKit) 는 2.0 고정 — 1.5 는 DPR3 화면에서 2배 업스케일이라 «전체가 뿌옇다»(President 실기기).
       Android 만 픽셀예산(1.0M px 초과 시 1.5). ?sdpr= 로 강제(계측용). */
    const forced = /[?&]sdpr=([0-9.]+)\b/.exec(location.search);
    if (forced) return Math.min(dpr, +forced[1]!);
    // -23 2단: iOS 는 기기 DPR 그대로(상한 IOS_SCENE_DPR_CAP). 선명도 1순위(President). 다운샘플은 블룸 내부 버퍼에서만.
    if (!this.android) return Math.min(dpr, IOS_SCENE_DPR_CAP);
    // -23 3단: Android 는 상한 2 로 시작, 첫 프로브(p95 > 20ms) 실패 시 다음 런부터 1.5 (픽셀예산 고정 1.5 폐기)
    return Math.min(dpr, this.androidCap);
  }

  /** Android 런 시작 프로브: 워밍업 1초 제외 후 3초 프레임타임 p95 > 임계면 다음 런 폴백 기록. begin() 마다 호출. */
  private probeFrame(): void {
    const now = performance.now();
    if (this.probeLast) {
      if (!this.probeStart) this.probeStart = now;
      const el = now - this.probeStart;
      const dt = now - this.probeLast;
      if (el > 1000 && dt < 250) this.probeT.push(dt);
      if (el > 4000) {
        this.probeDone = true;
        const s = this.probeT.slice().sort((a, b) => a - b);
        this.probeP95 = s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]! : 0;
        const fb = s.length >= 60 && this.probeP95 > ANDROID_PROBE_P95_MS && this.androidCap > ANDROID_SDPR_FALLBACK;
        if (fb) {
          try { localStorage.setItem(ANDROID_SDPR_KEY, String(ANDROID_SDPR_FALLBACK)); } catch (_) {}
        }
        console.info('[post] android probe p95', this.probeP95.toFixed(1), 'ms n=' + s.length, fb ? '-> next run 1.5' : 'ok');
        this.publishGfxDiag();
      }
    }
    this.probeLast = now;
  }

  /** 계측용 전역(하네스가 읽는다). 게임 로직 무관. */
  private publishGfxDiag(): void {
    let fallback = false;
    try { fallback = localStorage.getItem(ANDROID_SDPR_KEY) === String(ANDROID_SDPR_FALLBACK); } catch (_) {}
    (window as unknown as { __tcgfx?: unknown }).__tcgfx = {
      android: this.android, sdprCap: this.android ? this.androidCap : IOS_SCENE_DPR_CAP, sdpr: this.sdpr, sceneNearest: this.sceneNearest, q: this.q,
      probeP95: this.probeP95, probeN: this.probeT.length, probeDone: this.probeDone, fallback,
    };
  }

  /** 프레임 시작: 세계를 그릴 2D 컨텍스트(블룸 켜짐) 또는 null(꺼짐 → 게임 캔버스 직접). */
  begin(w: number, h: number, dpr: number): CanvasRenderingContext2D | null {
    if (!this.supported || !this.on || this.lost || !this.sctx) return null;
    const sd = this.budgetDpr(w, h, dpr);
    if (this.sdpr !== sd) { this.sdpr = sd; this.publishGfxDiag(); } else this.sdpr = sd;
    if (this.android && !this.probeDone) this.probeFrame();
    const W = Math.max(1, Math.round(w * sd));
    const H = Math.max(1, Math.round(h * sd));
    if (this.scene.width !== W || this.scene.height !== H) {
      this.scene.width = W;
      this.scene.height = H;
    }
    if (this.glc.width !== W || this.glc.height !== H) {
      this.glc.width = W;
      this.glc.height = H;
    }
    if (this.W !== W || this.H !== H) {
      this.alloc(W, H);
      this.publishGfxDiag(); // sceneNearest 는 alloc 뒤에야 확정된다
    }
    if (this.glc.style.visibility !== 'visible') this.glc.style.visibility = 'visible';
    this.sctx.setTransform(sd, 0, 0, sd, 0, 0);
    return this.sctx;
  }

  /**
   * 프레임 끝: 씬·emissive 업로드 → 블러 → 합성.
   * @param emissive  1/4 해상도 RGBA 캔버스(투명 배경, lighter 로 그린 발광원). 씬 크기의 정확히 1/4 이 아니어도 된다.
   */
  end(emissive: HTMLCanvasElement, p: PostParams): void {
    if (!this.supported || !this.on || this.lost) return;
    const gl = this.gl!;
    // 1) 씬 업로드 (불투명)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    this.tex(0, this.sceneTex);
    if (!this.sceneUploaded) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.scene);
      this.sceneUploaded = true;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.scene);
    }
    // 2) emissive 업로드 (프리멀티플라이 — 가산 합성에 바로 쓴다). 블룸 off 가 확정되면(페이드 끝) 건너뛴다.
    if (!this.emisTex) this.emisTex = this.makeTex(0, 0);
    if (!this.autoOff || this.fadeFrom >= 0) {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      this.tex(0, this.emisTex);
      if (!this.emisUploaded || this.EW !== emissive.width || this.EH !== emissive.height) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, emissive);
        this.emisUploaded = true;
        this.EW = emissive.width;
        this.EH = emissive.height;
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, emissive);
      }
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    }

    const { a1, b1, a2, b2 } = this.fbo as Required<typeof this.fbo>;
    const blur = this.prog.blur!;
    const down = this.prog.down!;
    const comp = this.prog.comp!;
    const emis = this.emisTex;
    const compose = (t1: WebGLTexture, t2: WebGLTexture, k1: number, k2: number) => {
      this.pass(comp, null, (u) => {
        this.tex(0, this.sceneTex);
        this.tex(1, t1);
        this.tex(2, t2);
        gl.uniform1i(u.s!, 0);
        gl.uniform1i(u.b1!, 1);
        gl.uniform1i(u.b2!, 2);
        gl.uniform1f(u.k1!, k1);
        gl.uniform1f(u.k2!, k2);
        gl.uniform1f(u.vig!, 0.25);
        gl.uniform1f(u.urgent!, p.urgent);
        gl.uniform1f(u.desat!, p.desat);
      });
    };
    /* 체인 조각 — 각 단계의 «원래» 버퍼. 페이드 중엔 두 단계의 조각을 «둘 다» 만들어 계수만 섞는다. */
    const chainA1 = () => {
      // 1/4 타이트: emis → b1 → a1
      this.pass(blur, b1, (u) => {
        this.tex(0, emis);
        gl.uniform1i(u.s!, 0);
        gl.uniform2f(u.d!, 1 / a1.w, 0);
        gl.uniform1f(u.flip!, 1);
      });
      this.pass(blur, a1, (u) => {
        this.tex(0, b1.t);
        gl.uniform1i(u.s!, 0);
        gl.uniform2f(u.d!, 0, 1 / a1.h);
        gl.uniform1f(u.flip!, 0);
      });
    };
    const chainA2fromA1 = () => {
      // 1/8 와이드(q0): a1 → a2 → b2 → a2
      this.pass(down, a2, (u) => {
        this.tex(0, a1.t);
        gl.uniform1i(u.s!, 0);
        gl.uniform2f(u.px!, 1 / a1.w, 1 / a1.h);
      });
      this.pass(blur, b2, (u) => {
        this.tex(0, a2.t);
        gl.uniform1i(u.s!, 0);
        gl.uniform2f(u.d!, 1 / a2.w, 0);
        gl.uniform1f(u.flip!, 0);
      });
      this.pass(blur, a2, (u) => {
        this.tex(0, b2.t);
        gl.uniform1i(u.s!, 0);
        gl.uniform2f(u.d!, 0, 1 / a2.h);
        gl.uniform1f(u.flip!, 0);
      });
    };
    const chainA2fromEmis = () => {
      // 1/8 만(q2): emis → a2(다운) → b2 → a2. down 은 flip 을 모른다 → 첫 블러에서 뒤집는다.
      this.pass(down, a2, (u) => {
        this.tex(0, emis);
        gl.uniform1i(u.s!, 0);
        gl.uniform2f(u.px!, 1 / a1.w, 1 / a1.h);
      });
      this.pass(blur, b2, (u) => {
        this.tex(0, a2.t);
        gl.uniform1i(u.s!, 0);
        gl.uniform2f(u.d!, 1 / a2.w, 0);
        gl.uniform1f(u.flip!, 1);
      });
      this.pass(blur, a2, (u) => {
        this.tex(0, b2.t);
        gl.uniform1i(u.s!, 0);
        gl.uniform2f(u.d!, 0, 1 / a2.h);
        gl.uniform1f(u.flip!, 0);
      });
    };
    /* 단계별 합성 계수 (a1 계수, a2 계수). 3 = 블룸 off. */
    const K = (t: number): [number, number] =>
      t === 0
        ? [this.tight, this.wide]
        : t === 1
          ? [this.tight + this.wide * 0.35, 0]
          : t === 2
            ? [0, this.tight * 0.7 + this.wide]
            : [0, 0];

    const cur = this.autoOff ? 3 : this.q;
    if (this.fadeFrom >= 0) {
      // ── 크로스페이드: from → cur. 두 단계가 쓰는 조각을 전부 «원래 방식»으로 만들고 계수만 섞는다.
      const from = this.fadeFrom;
      const f = Math.min(1, this.fadeT / FADE_MS);
      const e = f * f * (3 - 2 * f);
      const ka = K(from);
      const kb = K(cur);
      const k1 = ka[0] + (kb[0] - ka[0]) * e;
      const k2 = ka[1] + (kb[1] - ka[1]) * e;
      const pair = from + cur; // 0↔1 = 1, 1↔2 = 3, 2↔3 = 5
      if (pair === 1) {
        chainA1();
        chainA2fromA1();
        compose(a1.t, a2.t, k1, k2);
      } else if (pair === 3) {
        chainA1();
        chainA2fromEmis();
        compose(a1.t, a2.t, k1, k2);
      } else {
        chainA2fromEmis();
        compose(a2.t, a2.t, 0, k2);
      }
      if (f >= 1) this.fadeFrom = -1;
    } else if (cur === 0) {
      chainA1();
      chainA2fromA1();
      compose(a1.t, a2.t, this.tight, this.wide);
    } else if (cur === 1) {
      chainA1();
      compose(a1.t, a1.t, this.tight + this.wide * 0.35, 0);
    } else if (cur === 2) {
      chainA2fromEmis();
      compose(a2.t, a2.t, 0, this.tight * 0.7 + this.wide);
    } else {
      // 블룸 off(최후 보험): 씬 + 비네트·틴트·채도·그레인만. 블러 패스 0.
      compose(a2.t, a2.t, 0, 0);
    }
    if (this.probe) this.readEnergy();
    this.frames++;
  }

  /** a1(1/4 해상도 타이트 블러) 전체 휘도 합 — 페이드/단계에 따라 a1 이 안 쓰이면 a2 를 읽는다. */
  private readEnergy(): void {
    const gl = this.gl!;
    const cur = this.autoOff ? 3 : this.q;
    const useA1 = cur === 0 || cur === 1 || this.fadeFrom === 0 || this.fadeFrom === 1;
    const f = useA1 ? this.fbo.a1! : this.fbo.a2!;
    const n = f.w * f.h * 4;
    if (!this.probeBuf || this.probeBuf.length !== n) this.probeBuf = new Uint8Array(n);
    gl.bindFramebuffer(gl.FRAMEBUFFER, f.f);
    gl.readPixels(0, 0, f.w, f.h, gl.RGBA, gl.UNSIGNED_BYTE, this.probeBuf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    let e = 0;
    const b = this.probeBuf;
    for (let i = 0; i < n; i += 4) e += b[i]! * 0.2126 + b[i + 1]! * 0.7152 + b[i + 2]! * 0.0722;
    if (this.energyLog.length < 20000) this.energyLog.push([Math.round(this.tierMs), Math.round(e), useA1 ? 1 : 2, cur, this.fadeFrom]);
  }

  /** 끄기만 가능(컨텍스트 손실 등). 최후 보험(autoOff)은 이 메서드로도 «되돌리지 않는다» — 불가역. */
  setEnabled(v: boolean): void {
    if (!this.supported) return;
    this.on = !!v && !this.lost;
    this.glc.style.visibility = this.on ? 'visible' : 'hidden';
  }

  /** 메뉴/스플래시에서는 GL 캔버스를 감춘다(게임 캔버스의 스플래시가 보여야 한다). */
  setVisible(v: boolean): void {
    if (!this.supported) return;
    const want = v && this.on ? 'visible' : 'hidden';
    if (this.glc.style.visibility !== want) this.glc.style.visibility = want;
  }

  private setQ(nq: number, why: string): void {
    nq = nq < 0 ? 0 : nq > 2 ? 2 : nq;
    if (nq === this.q) return;
    const from = this.autoOff ? 3 : this.q;
    this.q = nq;
    this.qChanges++;
    this.sinceChange = 0;
    this.cleanMs = 0;
    this.fadeFrom = from;
    this.fadeT = 0;
    if (this.qlog.length < 64) this.qlog.push([this.frames, nq, why, Math.round(this.tierMs)]);
    console.info('[post] quality -> q' + nq + ' (' + why + ') @' + Math.round(this.tierMs) + 'ms');
  }

  /** 페이드 진행 — 매 프레임(일시정지·메뉴 포함) 시간을 먹인다. 렌더러가 draw() 에서 부른다. */
  tick(ms: number): void {
    if (this.fadeFrom >= 0) this.fadeT += ms;
  }

  /**
   * 60fps 감시. 플레이 중 프레임 간격(ms)을 매 프레임 넣어준다. 판정은 렌더에만 영향 — 게임 로직·판정과 무관.
   * 규칙(2026-08-30): 최소 체류 8s · 회복 15s 연속 깨끗 · 세션당 승격 ≤2 · 전환은 400ms 페이드 · 보험은 불가역.
   */
  sample(ms: number): void {
    if (!this.on) return;
    this.tierMs += ms;
    this.sinceChange += ms;
    if (this.adaptive && !this.autoOff) {
      this.qw++;
      this.qwMs += ms;
      if (ms > 19) this.qbad++;
      if (this.qw >= 30) {
        if (this.qbad <= 1) this.cleanMs += this.qwMs;
        else this.cleanMs = 0;
        if (this.qbad >= 5) {
          if (this.q < 2 && this.sinceChange >= MIN_DWELL_MS) this.setQ(this.q + 1, 'bad ' + this.qbad + '/30');
        } else if (
          this.cleanMs >= this.recoverMs() &&
          this.q > 0 &&
          this.promos < MAX_PROMOS &&
          this.sinceChange >= this.recoverMs()
        ) {
          this.promos++;
          this.setQ(this.q - 1, 'clean ' + Math.round(this.cleanMs / 1000) + 's #' + this.promos);
        }
        this.qw = 0;
        this.qbad = 0;
        this.qwMs = 0;
      }
    }
    if (!this.auto || this.autoOff || (this.adaptive && this.q < 2)) return;
    this.win[this.wi] = ms;
    this.wi = (this.wi + 1) % 90;
    if (this.wn < 90) this.wn++;
    if (this.wn < 90 || this.sinceChange < MIN_DWELL_MS) return;
    /* 33ms(= 2프레임) 초과가 90프레임 중 25% — q2 에서 8초 이상 버틴 뒤에만. 발동하면 세션 내 불가역. */
    let bad = 0;
    for (let i = 0; i < 90; i++) if (this.win[i]! > 33) bad++;
    if (bad > 22) {
      this.autoOff = true;
      this.fadeFrom = 2;
      this.fadeT = 0;
      this.sinceChange = 0;
      this.wn = 0;
      if (this.qlog.length < 64) this.qlog.push([this.frames, 3, 'off ' + bad + '/90', Math.round(this.tierMs)]);
      console.info('[post] bloom passes off, irreversible (' + bad + '/90 frames > 33ms) @' + Math.round(this.tierMs) + 'ms');
    }
  }

  /** 승격에 필요한 연속 깨끗한 시간 — 첫 승격(iOS)만 3초, 그 뒤·Android 는 15초 */
  private recoverMs(): number {
    return !this.android && this.qChanges === 0 ? FIRST_RECOVER_MS : RECOVER_MS;
  }

  /** 새 아레나: 창·세션 카운터 리셋. 단계(q)와 보험(autoOff)은 «유지» — 판 시작마다 화면이 튀지 않게. */
  resetWindow(): void {
    this.wn = 0;
    this.wi = 0;
    this.qw = 0;
    this.qbad = 0;
    this.qwMs = 0;
    this.cleanMs = 0;
    this.tierMs = 0;
    this.sinceChange = 0;
    this.promos = 0;
  }
}
