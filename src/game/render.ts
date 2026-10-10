/**
 * 인게임 렌더 파이프라인 — DESIGN.md §3~§5 (2026-08-30 그래픽 고도화) 구현체.
 *
 * ★ 이 파일이 "품질"의 전부다. 4종 거절 사후분석 결론이 "UI 셸이 아니라
 *   캔버스 렌더(조명·후처리 부재)" 였다. 레이어를 함부로 빼지 마라.
 *
 * ── 2026-08-30 구조 변경 두 가지 (왜) ───────────────────────────────────────
 * (1) 영토 «캐시» — 예전엔 팩션마다 베이스·헤어라인·베벨·림·그림자를 «매 프레임»
 *     다시 칠했다(팩션 6~10 × 패스 5~6 = 프레임당 풀뷰포트급 채움 40~60회). 이
 *     게임은 필레이트 바운드라 그것이 실기기 46~51fps 의 정체였다. 지금은 가시영역
 *     + 여유(6셀)를 «월드 좌표 오프스크린»에 굽고, 매 프레임은 blit 1회다.
 *     굽기는 (a) 소유권이 바뀐 «더티 사각형»만, (b) 카메라가 여유를 벗어나면
 *     «자기복사 + 드러난 띠»만 한다. 전체 재굽기는 크기/배율이 바뀔 때뿐이다.
 * (2) 블룸을 WebGL 후처리(post.ts)로 — 캔버스 filter:blur + 확대 가산(프레임의
 *     15~22%)이 GPU 셰이더 6패스가 됐다. 비네트·그레인·채도하강·막판 테두리도
 *     합성 셰이더 안이라 풀스크린 캔버스 패스가 «0»이다. WebGL 이 없으면 예전
 *     경로(캔버스 블룸 + 캔버스 후처리)가 그대로 살아 있다.
 *
 * ── 아키텍처: 월드 좌표 Path2D (가시영역 컬링) 는 그대로다 ──────────────────
 * 영토 마스크는 여전히 월드 좌표 Path2D(런렝스 사각형)로 만든다. 베벨의 offset-mask
 * 연산(Path2D.addPath(DOMMatrix) + evenodd)도 그대로다. 달라진 건 «어디에 그리느냐»
 * (캐시) 와 «언제 그리느냐»(더티) 뿐이다.
 */
import { ARENA_H, ARENA_W, CELL, COLS, ROWS, type Grid as GridT } from './grid';
import { FACTIONS, PAL, faction, hexa, type Faction } from './palette';
import { mkc } from './textures';
import { rnd } from './rng';
import type { FxEvent, Unit, Vec2 } from './types';
import type { World } from './sim';
import { t } from '../i18n';
import { PostFx } from './post';

export type Quality = 'HIGH' | 'MID' | 'LOW';

/** 캔버스 안 숫자·팝업용 서체 — CSS 의 --font-display 와 같은 스택 */
export const HUD_FONT =
  '"Chakra Petch", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", system-ui, sans-serif';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  s: number;
  rot: number;
  vr: number;
  f: number;
  type: 'spark' | 'shard' | 'dust' | 'ember';
}

interface Ring {
  x: number;
  y: number;
  r: number;
  t: number;
  c: string;
}

interface Pop {
  x: number;
  y: number;
  txt: string;
  t: number;
  c: string;
}

/** 점령 «채워짐» 연출 — 중심에서 퍼지는 발광 + 흰 플래시 */
interface Flash {
  path: Path2D;
  t: number;
  f: number;
  x: number;
  y: number;
  r: number;
  bx: number;
  by: number;
  bw: number;
  bh: number;
}

interface Sprite {
  body: HTMLCanvasElement;
  glow: HTMLCanvasElement;
  /** 스프라이트 한 변(월드 단위) */
  wu: number;
}

const HAS_MATRIX = typeof DOMMatrix !== 'undefined';

/** 배경 재베이크 주기(초). 오로라는 저주파라 0.1초면 육안 감지 불가. */
const BG_REBAKE_S = 0.1;
/** 배경 베이크 해상도 배율. 그라디언트·노이즈뿐이라 절반이면 확대해도 같다. */
const BG_SCALE = 0.5;
/** 비네트/그레인 오버레이(폴백 경로) 베이크 해상도 배율. */
const POST_SCALE = 0.5;
/** 적응형 해상도 단계(폴백 경로 전용 — 후처리가 켜져 있으면 post.ts 가 픽셀 예산을 쥔다). */
const RES_STEPS = [1, 0.85, 0.72, 0.6] as const;
/** 영토 캐시 여유(셀). 플레이어 5.8셀/s 라 여유 6셀 = 약 1초마다 띠 굽기. */
const TC_MARGIN = 6;

/**
 * ── 연출 게이트: «화면 흔들림(카메라 셰이크)» ──────────────────────────────
 * President 관측: 「애들끼리 죽일 때 «진동» 나오는 거 때문에 프레임이 떨어지는 것 같다」
 * → 봇 사건의 셰이크·줌펀치는 기본 «0» 그대로다(?shake=off|soft|full).
 * 2026-08-30: «플레이어 자신의» 점령에만 아주 작은 줌 펀치(1.2%, 0.2초)를 준다 —
 * 「살짝 흔들림」. 봇 사건에는 여전히 없다. ?shake=off 면 이것도 꺼진다.
 */
const SHAKE_SCALE_DEFAULT = 0;
/** 스러스터 3겹 길이·알파(할당 0) */
const THR_LEN = [0.3, 0.65, 1.0] as const;
const THR_ALPHA = [0.85, 0.55, 0.25] as const;
const PLAYER_CLAIM_PUNCH = 0.012;

export class Renderer {
  private g: CanvasRenderingContext2D;
  private vw = 0;
  private vh = 0;
  private dpr = 1;
  /** WebGL 후처리(없으면 null → 캔버스 경로) */
  post: PostFx | null = null;
  private usingPost = false;
  /** 이번 프레임 그리기 대상의 픽셀 크기 */
  private tw = 0;
  private th = 0;
  /** 이번 프레임 «장면 배율»(CSS px → 대상 px) */
  private base = 1;
  /** 연출 이벤트 훅(효과음). 렌더러는 fx 큐를 소비하는 유일한 곳이다. */
  onFx: ((e: FxEvent, w: World) => void) | null = null;

  /** 1/4 해상도 발광(emissive) 버퍼 — 후처리 켜짐: GL 텍스처로 / 꺼짐: 캔버스 블러 */
  private bloomCv: HTMLCanvasElement = mkc(2, 2);
  private bl: CanvasRenderingContext2D;
  private bloomBlurCv: HTMLCanvasElement = mkc(2, 2);
  private bbl: CanvasRenderingContext2D;
  /** 배경 베이크(절반 해상도) + 풀해상도 전개(1:1 blit) */
  private bgCv: HTMLCanvasElement = mkc(2, 2);
  private bgc: CanvasRenderingContext2D;
  private bgAge = 1e9;
  private bgFullCv: HTMLCanvasElement = mkc(2, 2);
  private bgFc: CanvasRenderingContext2D | null = null;
  /** 폴백 경로 정적 오버레이(비네트+그레인) — CSS 합성 레이어 */
  private postCv: HTMLCanvasElement = mkc(2, 2);
  private postc: CanvasRenderingContext2D;
  private postBaked = false;
  /** -24: HUD 층 캔버스(#tc-ov, 기기 DPR 그대로, AA) — 이름표·팝업 텍스트는 scene(블룸·업스케일 대상)에 두지 않는다 */
  private ovCv: HTMLCanvasElement | null = null;
  private ovc: CanvasRenderingContext2D | null = null;
  private ovDirty = false;
  private labels: { cv: HTMLCanvasElement; x: number; y: number; off: number }[] = [];
  /** -24: 스냅된 카메라 사상(세계 원점의 장치 픽셀 위치 · 대상 배율) — worldToScreen 이 같은 사상을 쓴다 */
  private camOx = 0;
  private camOy = 0;
  private camBase = 0;

  // ── 영토 캐시 ────────────────────────────────────────────────────────────
  private tcCv: HTMLCanvasElement = mkc(2, 2);
  private tcc: CanvasRenderingContext2D;
  private teCv: HTMLCanvasElement = mkc(2, 2);
  private tec: CanvasRenderingContext2D;
  private tcValid = false;
  /** 캐시 영역(셀). c1/r1 은 배타. 크기는 고정(RW×RH), 위치만 움직인다. */
  private tcC0 = 0;
  private tcR0 = 0;
  private tcRW = 0;
  private tcRH = 0;
  private tcS = 1;
  private tcRev = -1;
  private tcCols = -1;
  private tcRows = -1;
  private ownerSnap: Int8Array = new Int8Array(0);
  private lastS = 0;
  private terrGrad: (CanvasGradient | null)[] = [];
  /** 캐시 영역 기준 Path2D */
  private terr: Path2D[] = [];
  private bevelHi: (Path2D | null)[] = [];
  private bevelOc: (Path2D | null)[] = [];
  private terrEmpty: boolean[] = [];
  /** 팩션별 셀 bbox [c0,r0,c1,r1) — 더티 사각형과 안 겹치면 그 팩션은 굽지 않는다 */
  private terrCellBox: number[][] = [];
  private outer: (Path2D | null)[] = [];
  private union: Path2D | null = null;
  private tierComm: Path2D | null = null;
  private tierCommOuter: Path2D | null = null;
  private tierLand: Path2D | null = null;
  private pathsRev = -1;
  private pathsC0 = -1;
  private pathsR0 = -1;

  // ── 격자 타일 ────────────────────────────────────────────────────────────
  private gridTile: HTMLCanvasElement = mkc(2, 2);
  private gridPat: CanvasPattern | null = null;
  private gridPatCtx: CanvasRenderingContext2D | null = null;
  private gridPatS = 0;

  // ── 유닛 스프라이트 ──────────────────────────────────────────────────────
  private sprites: (Sprite | null)[] = [];
  private spriteS = 0;
  private labelW = new Map<string, number>();
  /** 봇 이름표 스프라이트(이름당 1회 렌더 — 텍스트는 «변할 때만» 그린다) */
  private labelCv = new Map<string, HTMLCanvasElement>();
  private labelScale = 0;

  // 카메라 (L7)
  cam = { x: ARENA_W / 2, y: ARENA_H / 2, scale: 1, tilt: 0, punch: 0 };
  private shakeAmp = 0;
  private fxScale = SHAKE_SCALE_DEFAULT;
  private shakeOff = false;
  private urgentOn = true;

  private parts: Particle[] = [];
  private rings: Ring[] = [];
  private pops: Pop[] = [];
  private flashes: Flash[] = [];

  // 품질 자동 판정 (§L6 성능 등급)
  quality: Quality = 'HIGH';
  private fpsSamples: number[] = [];
  private qualityLocked = false;
  private t = 0;
  private lastDt = 0;

  /** 발광 버퍼에 그려진 것의 월드 AABB(폴백 합성 범위) */
  private blx0 = Infinity;
  private bly0 = Infinity;
  private blx1 = -Infinity;
  private bly1 = -Infinity;
  private blM: DOMMatrix | null = null;

  private canFilter = false;
  private canSaturation = false;
  /** ?diag=1 단계별 계측(기본 URL 에서는 0 비용 — 분기 하나) */
  private diagOn = false;
  readonly stats = { n: 0, bg: 0, grid: 0, cache: 0, terr: 0, trails: 0, units: 0, parts: 0, post: 0, bakes: 0, bakeMs: 0, shifts: 0, reallocs: 0, maxBake: 0, stageDraws: 0, glFrames: 0, layerLag: 0 };
  /** 마지막 draw() 의 세계 국면 — 폴백 적응해상도를 «플레이 중» 적용하지 않기 위해 */
  private phase = 'none';
  /** 이번 프레임 가시 월드 사각형(+여유) — 유닛·트레일 컬링 */
  private visX0 = -1e9;
  private visY0 = -1e9;
  private visX1 = 1e9;
  private visY1 = 1e9;

  /** #stage 백버퍼 배율(index.ts resize 가 dpr 에 곱한다). resBase 로 DPR 상한 2 를 건다 — 저가 안드로이드 dpr 2.6~3 에서
      스플래시·폴백 캔버스가 화면 픽셀의 1.7~2.3배를 채우지 않게. GL 경로의 scene DPR 은 post.ts 예산(1.5)이 따로 쥔다. */
  resScale = 1;
  private resBase = 1;
  private resStep = 0;
  private resDirty = false;
  private adaptWin = 0;
  private adaptSamples: number[] = [];
  private adaptBad = 0;
  private adaptCool = 0;
  private qualityForced = false;
  private adaptEnabled = true;

  constructor(ctx: CanvasRenderingContext2D) {
    this.g = ctx;
    this.bl = this.bloomCv.getContext('2d')!;
    this.bbl = this.bloomBlurCv.getContext('2d')!;
    this.bgc = this.bgCv.getContext('2d', { alpha: false })!;
    this.postc = this.postCv.getContext('2d')!;
    this.tcc = this.tcCv.getContext('2d')!;
    this.tec = this.teCv.getContext('2d')!;
    try {
      ctx.filter = 'blur(1px)';
      this.canFilter = ctx.filter !== 'none' && ctx.filter !== '';
      ctx.filter = 'none';
    } catch {
      this.canFilter = false;
    }
    try {
      ctx.globalCompositeOperation = 'saturation';
      this.canSaturation = ctx.globalCompositeOperation === 'saturation';
      ctx.globalCompositeOperation = 'source-over';
    } catch {
      this.canSaturation = false;
    }

    const sp = new URLSearchParams(location.search);
    this.diagOn = sp.get('diag') === '1';
    this.partsOff = sp.get('parts') === '0';
    {
      const d = Math.min(window.devicePixelRatio || 1, 3);
      // -23 2단: iOS(WebKit) 는 기기 DPR 그대로 렌더(resBase 1) — 2/d 는 iPhone 에서 «전체 소프트»의 첫 단이었다. Android 만 기존 2/d.
      const isAndroid = /Android/i.test(navigator.userAgent);
      this.resBase = d > 2 && isAndroid ? 2 / d : 1;
      this.resScale = this.resBase;
    }
    const q = sp.get('q');
    if (q === 'HIGH' || q === 'MID' || q === 'LOW') {
      this.quality = q;
      this.qualityLocked = true;
      this.qualityForced = true;
      console.log('[render] quality forced by ?q=', q);
    }
    if (sp.get('adapt') === '0') {
      this.adaptEnabled = false;
      console.log('[render] adaptive scaling disabled by ?adapt=0');
    }
    const sk = sp.get('shake');
    if (sk === 'off') {
      this.fxScale = 0;
      this.shakeOff = true;
    } else if (sk === 'soft') this.fxScale = 0.4;
    else if (sk === 'full') this.fxScale = 1;
    if (sp.get('urgent') === 'off') this.urgentOn = false;
    console.log(
      '[render] kill-fx scale =',
      this.fxScale,
      'player-claim punch =',
      this.shakeOff ? 0 : PLAYER_CLAIM_PUNCH,
      'urgent edge =',
      this.urgentOn ? 'on' : 'off'
    );
  }

  /** WebGL 후처리 부착. 실패하면 캔버스 경로로 남는다(호출측은 신경 쓸 게 없다). */
  attachPost(host: HTMLElement): boolean {
    const p = new PostFx();
    if (p.init(host)) {
      this.post = p;
      // -24: HUD 층 — 이름표·팝업 텍스트를 기기 DPR 그대로 AA 로 그린다(GL 위, HUD DOM 아래). 입력은 통과.
      try {
        const ov = document.createElement('canvas');
        ov.id = 'tc-ov';
        ov.setAttribute('aria-hidden', 'true');
        ov.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:1';
        const oc = ov.getContext('2d');
        if (oc) {
          host.appendChild(ov);
          this.ovCv = ov;
          this.ovc = oc;
        }
      } catch {
        this.ovCv = null;
        this.ovc = null;
      }
      console.log('[render] post-process: WebGL bloom ON' + (this.ovc ? ' + HUD layer' : ''));
      return true;
    }
    console.log('[render] post-process: unavailable -> canvas fallback');
    return false;
  }

  /** 플레이 중 프레임 간격을 후처리 품질 감시에 넘긴다(index.ts 가 매 프레임 호출). */
  samplePlayFrame(ms: number): void {
    this.post?.sample(ms);
  }

  resetForArena(): void {
    this.cam.x = ARENA_W / 2;
    this.cam.y = ARENA_H / 2;
    this.cam.punch = 0;
    this.cam.tilt = 0;
    this.terrGrad = [];
    this.tcValid = false;
    this.pathsRev = -1;
    this.flashes.length = 0;
    this.post?.resetWindow();
  }

  resize(vw: number, vh: number, dpr: number): void {
    this.vw = vw;
    this.vh = vh;
    this.dpr = dpr;
    this.postBaked = false;
    this.tcValid = false;
    this.cam.scale = this.quantScale(Math.min(vw, vh) / (26 * CELL));
    // 대상 크기에 따르는 버퍼는 draw() 에서 실제 대상 크기를 보고 맞춘다.
    this.tw = 0;
    this.th = 0;
  }

  /** 그리기 대상 픽셀 크기에 따라 발광·배경 버퍼를 맞춘다(후처리 품질 단계가 바뀌면 크기가 바뀐다). */
  private ensureTargetBuffers(tw: number, th: number): void {
    if (tw === this.tw && th === this.th) return;
    this.tw = tw;
    this.th = th;
    const bw = Math.max(16, Math.ceil(tw / 4));
    const bh = Math.max(16, Math.ceil(th / 4));
    this.bloomCv.width = bw;
    this.bloomCv.height = bh;
    this.bl = this.bloomCv.getContext('2d')!;
    if (!this.usingPost) {
      this.bloomBlurCv.width = bw;
      this.bloomBlurCv.height = bh;
      this.bbl = this.bloomBlurCv.getContext('2d')!;
    }
    this.bgCv.width = Math.max(2, Math.round(tw * BG_SCALE));
    this.bgCv.height = Math.max(2, Math.round(th * BG_SCALE));
    this.bgc = this.bgCv.getContext('2d', { alpha: false })!;
    this.bgAge = 1e9;
    this.bgFc = null;
    try {
      this.bgFullCv.width = Math.max(2, tw);
      this.bgFullCv.height = Math.max(2, th);
      const bfc = this.bgFullCv.getContext('2d', { alpha: false });
      if (bfc && tw >= 4 && th >= 4) this.bgFc = bfc;
    } catch {
      this.bgFc = null;
    }
    if (!this.bgFc) console.warn('[render] bg full-res buffer unavailable -> per-frame upscale');
    if (!this.usingPost) {
      this.postCv.width = Math.max(2, Math.round(tw * POST_SCALE));
      this.postCv.height = Math.max(2, Math.round(th * POST_SCALE));
      this.postc = this.postCv.getContext('2d')!;
      this.postBaked = false;
    }
  }

  private sampleQuality(dt: number): void {
    if (this.qualityLocked) {
      this.watchSustained(dt);
      return;
    }
    this.fpsSamples.push(1 / Math.max(dt, 1 / 240));
    if (this.t < 3) return;
    this.qualityLocked = true;
    const s = this.fpsSamples.slice(Math.floor(this.fpsSamples.length * 0.3));
    s.sort((a, b) => a - b);
    const p25 = s[Math.floor(s.length * 0.25)] ?? 60;
    const before = this.quality;
    this.quality = p25 >= 52 ? 'HIGH' : p25 >= 38 ? 'MID' : 'LOW';
    if (before !== this.quality) {
      this.postBaked = false;
      this.tcValid = false;
    }
    this.fpsSamples.length = 0;
    console.log('[render] quality tier =', this.quality, 'p25fps=', p25.toFixed(1));
  }

  /** 폴백 경로 전용 적응형 해상도. 후처리가 켜져 있으면 post.ts 의 3단계 예산이 대신한다. */
  private watchSustained(dt: number): void {
    if (!this.adaptEnabled || this.usingPost) return;
    if (this.resStep >= RES_STEPS.length - 1) return;
    this.adaptWin += dt;
    this.adaptSamples.push(dt);
    if (this.adaptWin < 1) return;
    this.adaptWin = 0;
    const a = this.adaptSamples.slice().sort((x, y) => x - y);
    this.adaptSamples.length = 0;
    const p50 = a[a.length >> 1] ?? 0;
    if (this.adaptCool > 0) {
      this.adaptCool--;
      return;
    }
    if (p50 > 1 / 48) {
      this.adaptBad++;
      if (this.adaptBad >= 2) {
        this.adaptBad = 0;
        this.adaptCool = 2;
        this.resStep++;
        this.resScale = RES_STEPS[this.resStep]! * this.resBase;
        this.resDirty = true;
        if (!this.qualityForced) {
          if (this.resStep >= 2 && this.quality === 'HIGH') {
            this.quality = 'MID';
            this.postBaked = false;
            this.tcValid = false;
          } else if (this.resStep >= 3 && this.quality === 'MID') {
            this.quality = 'LOW';
            this.postBaked = false;
            this.tcValid = false;
          }
        }
        console.log('[render] downscale ->', this.resScale, 'quality =', this.quality, 'p50ms =', (p50 * 1000).toFixed(1));
      }
    } else {
      this.adaptBad = 0;
    }
  }

  /**
   * 폴백 경로 적응해상도 적용 요청. ★플레이 중엔 «내주지 않는다»(2026-08-30 규칙 3: DPR/캔버스 크기는
   * 플레이 중 불변 — 네온 -22 깜빡임 사후분석). 결과 화면·메뉴에서 캔버스를 다시 잡는다.
   */
  consumeResDirty(): boolean {
    if (!this.resDirty || this.phase === 'play') return false;
    this.resDirty = false;
    return true;
  }

  private blMark(x0: number, y0: number, x1: number, y1: number): void {
    if (x0 < this.blx0) this.blx0 = x0;
    if (y0 < this.bly0) this.bly0 = y0;
    if (x1 > this.blx1) this.blx1 = x1;
    if (y1 > this.bly1) this.bly1 = y1;
  }

  private partCap(): number {
    if (this.partsOff) return 0;
    // -24: 상한 1400/800 → 900/500 (렉)
    return this.quality === 'HIGH' ? 900 : this.quality === 'MID' ? 500 : 320;
  }
  /** ?parts=0 — 파티클 생성 0(깜빡임 프로브에서 림·트레일·머리 발광만 격리) */
  private partsOff = false;

  /** diag: 카메라 위치(프로브가 «이동 중» 프레임만 고르는 데 쓴다) */
  camPos(): { x: number; y: number; s: number; punch: number } {
    return { x: this.cam.x, y: this.cam.y, s: this.cam.scale, punch: this.cam.punch };
  }

  // ── 좌표 변환 ────────────────────────────────────────────────────────────
  worldToScreen(x: number, y: number): Vec2 {
    const s = this.cam.scale * (1 + this.cam.punch);
    if (this.camBase > 0) {
      // 스냅된 사상 그대로(팝업·이름표가 씬과 같은 픽셀에 앉는다)
      return { x: (this.camOx + x * s * this.camBase) / this.camBase, y: (this.camOy + y * s * this.camBase) / this.camBase };
    }
    return {
      x: this.vw / 2 + (x - this.cam.x) * s,
      y: this.vh / 2 + (y - this.cam.y) * s,
    };
  }

  /** 이번 프레임 씬 배율(후처리 켜짐: scene DPR, 아니면 #stage DPR) */
  private sceneBase(): number {
    const p = this.post;
    return p && p.supported && p.on && !p.lost ? p.budgetDpr(this.vw, this.vh, this.dpr) : this.dpr;
  }

  /** -24: 셀 한 변이 장치 픽셀 «정수»가 되게 카메라 배율을 양자화 — 격자 타일·영토 캐시가 프레임마다 위상이 달라지지 않는다 */
  private quantScale(s: number): number {
    const b = this.sceneBase();
    return Math.max(1, Math.round(CELL * s * b)) / (CELL * b);
  }

  /**
   * -24: 세계 원점의 장치 픽셀 위치를 «정수»로 스냅한다. 분수 오프셋이면 영토 캐시 blit·격자 타일·림 코어(1.6px)가
   * 매 프레임 다른 위상으로 재보간돼 «픽셀 단위 짜글거림»이 된다(President iPhone -23). 카메라 기울임(tilt)도 같은 이유로 0 —
   * 0.6° 회전은 기울임으로는 안 보이고 전 경계의 재보간으로만 보였다. 발광 버퍼(1/4)는 씬과 «같은 사상»을 배율만 바꿔 쓴다.
   */
  private applyCamera(ctx: CanvasRenderingContext2D, base: number): void {
    const s = this.cam.scale * (1 + this.cam.punch);
    const ss = s * base;
    if (base === this.base) {
      let ox = base * (this.vw / 2 - this.cam.x * s);
      let oy = base * (this.vh / 2 - this.cam.y * s);
      if (this.shakeAmp > 0.15) {
        ox += rnd(-1, 1) * this.shakeAmp * base;
        oy += rnd(-1, 1) * this.shakeAmp * base;
      }
      ox = Math.round(ox);
      oy = Math.round(oy);
      this.camOx = ox;
      this.camOy = oy;
      this.camBase = base;
      ctx.setTransform(ss, 0, 0, ss, ox, oy);
      return;
    }
    const k = this.camBase > 0 ? base / this.camBase : 0;
    ctx.setTransform(ss, 0, 0, ss, this.camOx * k, this.camOy * k);
  }

  // ── 메인 ─────────────────────────────────────────────────────────────────
  draw(w: World, dtReal: number): void {
    this.t += dtReal;
    this.lastDt = dtReal;
    this.phase = w.phase;
    this.post?.tick(dtReal * 1000);
    this.sampleQuality(dtReal);
    this.consumeFx(w);
    this.updateCamera(w, dtReal);

    const sc = this.post ? this.post.begin(this.vw, this.vh, this.dpr) : null;
    const wasPost = this.usingPost;
    this.usingPost = !!sc;
    if (wasPost !== this.usingPost) {
      this.tw = 0; // 대상이 바뀌었다 → 버퍼 재정렬
      this.gridPat = null;
      if (this.postEl) this.postEl.style.display = this.usingPost ? 'none' : '';
    }
    const g = sc ?? this.g;
    const base = sc ? this.post!.sdpr : this.dpr;
    this.base = base;
    const tw = sc ? this.post!.scene.width : this.g.canvas.width;
    const th = sc ? this.post!.scene.height : this.g.canvas.height;
    this.ensureTargetBuffers(tw, th);

    this.shakeAmp = w.shake * this.fxScale;

    g.setTransform(base, 0, 0, base, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    const tb = this.diagOn ? performance.now() : 0;
    this.drawBackground(g);
    if (this.diagOn) this.stats.bg += performance.now() - tb;

    const bl = this.bl;
    bl.setTransform(1, 0, 0, 1, 0, 0);
    bl.globalCompositeOperation = 'source-over';
    bl.globalAlpha = 1;
    bl.clearRect(0, 0, this.bloomCv.width, this.bloomCv.height);
    const bscale = base / 4;
    // HUD 층(-24): 후처리 프레임에서만. 기기 DPR 크기, 매 프레임 clear.
    let ov: CanvasRenderingContext2D | null = null;
    if (this.ovCv && this.ovc) {
      if (sc) {
        const OW = Math.max(1, Math.round(this.vw * this.dpr));
        const OH = Math.max(1, Math.round(this.vh * this.dpr));
        if (this.ovCv.width !== OW || this.ovCv.height !== OH) {
          this.ovCv.width = OW;
          this.ovCv.height = OH;
        }
        ov = this.ovc;
        ov.setTransform(1, 0, 0, 1, 0, 0);
        ov.clearRect(0, 0, OW, OH);
        this.ovDirty = true;
      } else if (this.ovDirty) {
        this.ovc.setTransform(1, 0, 0, 1, 0, 0);
        this.ovc.clearRect(0, 0, this.ovCv.width, this.ovCv.height);
        this.ovDirty = false;
      }
    }
    this.labels.length = 0;

    this.blx0 = Infinity;
    this.bly0 = Infinity;
    this.blx1 = -Infinity;
    this.bly1 = -Infinity;

    this.applyCamera(g, base);
    this.applyCamera(bl, bscale);
    try {
      this.blM = bl.getTransform();
    } catch {
      this.blM = null;
    }
    const S = this.cam.scale * (1 + this.cam.punch) * base;
    {
      // 가시 월드 사각형(+3셀: 스러스터·이름표·트레일 두께) — 화면 밖 유닛·트레일은 그리지 않는다
      const sv = this.cam.scale * (1 + this.cam.punch);
      const hw = this.vw / 2 / sv + CELL * 3;
      const hh = this.vh / 2 / sv + CELL * 3;
      const ex = Math.abs(this.cam.tilt) * Math.max(hw, hh);
      this.visX0 = this.cam.x - hw - ex;
      this.visX1 = this.cam.x + hw + ex;
      this.visY0 = this.cam.y - hh - ex;
      this.visY1 = this.cam.y + hh + ex;
    }

    const D = this.diagOn;
    let t0 = D ? performance.now() : 0;
    const st = this.stats;
    const lap = (k: 'bg' | 'grid' | 'cache' | 'terr' | 'trails' | 'units' | 'parts' | 'post') => {
      if (!D) return;
      const t1 = performance.now();
      st[k] += t1 - t0;
      t0 = t1;
    };
    if (D) st.n++;
    this.ensureTerrCache(w.grid, S);
    lap('cache');
    this.drawGrid(g, S);
    lap('grid');
    this.drawTerritory(g, bl, w, S);
    lap('terr');
    this.drawTrails(g, bl, w);
    this.drawAim(g, w);
    lap('trails');
    this.drawUnits(g, bl, w, S);
    lap('units');
    this.drawParticles(g, bl, dtReal);
    this.drawRings(g, dtReal);
    lap('parts');

    g.setTransform(base, 0, 0, base, 0, 0);
    bl.setTransform(1, 0, 0, 1, 0, 0);

    if (sc) {
      if (ov) this.drawOverlay(ov, dtReal);
      else this.drawPops(g, dtReal);
      const urgent = this.urgentLevel(w);
      const fb = D ? this.post!.frames : 0;
      this.post!.end(this.bloomCv, {
        desat: Math.min(0.85, w.desat * 0.7),
        urgent,
      });
      if (D) {
        // 층 간 지연 실측: GL 합성이 «이 draw() 안에서» 끝나지 않은 프레임 수(기대 0)
        st.glFrames++;
        if (this.post!.frames !== fb + 1) st.layerLag++;
      }
    } else {
      // 후처리가 살아 있는데 #stage 에 그린 프레임(같은 오브젝트 두 층 — 기대 0)
      if (D && this.post && this.post.on && !this.post.lost) st.stageDraws++;
      this.compositeBloom(g);
      this.drawPops(g, dtReal);
      this.drawPost(g, w);
    }
    lap('post');
  }

  /** 막판 10초 테두리 틴트 0..~0.17 — 1Hz 숨쉬기(깜빡임 아님), ?urgent=off 로 끈다 */
  private urgentLevel(w: World): number {
    if (!this.urgentOn || w.phase !== 'play' || w.timeLeft > 10) return 0;
    const k = 1 - w.timeLeft / 10;
    return 0.07 + 0.05 * k + 0.05 * (0.5 + 0.5 * Math.sin(this.t * Math.PI * 2));
  }

  // ── L0 배경 ──────────────────────────────────────────────────────────────
  private bakeBackground(): void {
    const c = this.bgc;
    const w = this.bgCv.width;
    const h = this.bgCv.height;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;

    const lg = c.createLinearGradient(0, 0, 0, h);
    lg.addColorStop(0, PAL.void1);
    lg.addColorStop(1, PAL.void0);
    c.fillStyle = lg;
    c.fillRect(0, 0, w, h);

    // 오로라 헤이즈 3겹 (회전 0.008 / -0.005 / 0.011 rad/s)
    const spin = [0.008, -0.005, 0.011];
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const a = this.t * spin[i]! * 10 + i * 2.1;
      const cx = w * (0.5 + Math.cos(a) * 0.26);
      const cy = h * (0.34 + Math.sin(a * 0.8) * 0.18);
      const rad = Math.max(w, h) * (0.4 + 0.08 * Math.sin(this.t * 0.4 + i));
      const rg = c.createRadialGradient(cx, cy, 0, cx, cy, rad);
      rg.addColorStop(0, hexa(PAL.haze[i]!, 0.15));
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rg;
      c.fillRect(0, 0, w, h);
    }
    // 깊이: 바닥 쪽 «심해» 어둠 — 위는 오로라, 아래는 흑요석
    const dg = c.createLinearGradient(0, h * 0.45, 0, h);
    dg.addColorStop(0, 'rgba(0,0,0,0)');
    dg.addColorStop(1, 'rgba(3,4,9,0.55)');
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = dg;
    c.fillRect(0, 0, w, h);
    c.restore();
    // -24: 배경 노이즈 오버레이(.022) 제거 — 「픽셀 단위 짜글짜글」(President iPhone). 평평한 면은 평평하게.
    this.bgAge = 0;
    if (this.bgFc) {
      const f = this.bgFc;
      f.setTransform(1, 0, 0, 1, 0, 0);
      f.globalCompositeOperation = 'copy';
      f.drawImage(this.bgCv, 0, 0, this.bgFullCv.width, this.bgFullCv.height);
    }
  }

  /** 폴백 경로 정적 오버레이(비네트+그레인)를 CSS 합성 레이어로 올린다. 후처리가 켜지면 감춘다. */
  private postEl: HTMLCanvasElement | null = null;
  private postShown = true;

  private mountPostLayer(): void {
    if (this.postEl) return;
    const host = this.g.canvas.parentElement;
    if (!host) return;
    const el = this.postCv;
    el.style.position = 'absolute';
    el.style.left = '0';
    el.style.top = '0';
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '1';
    host.appendChild(el);
    this.postEl = el;
  }

  /** diag: 이번 프레임의 2D 씬 캔버스(지글거림 프로브가 getImageData 로 읽는다) */
  sceneCanvas(): HTMLCanvasElement {
    return this.usingPost && this.post ? this.post.scene : this.g.canvas;
  }

  setPostLayerVisible(v: boolean): void {
    this.post?.setVisible(v);
    if (this.ovCv) {
      const want = v ? '' : 'none';
      if (this.ovCv.style.display !== want) this.ovCv.style.display = want;
    }
    if (!this.postEl || this.postShown === v) return;
    this.postShown = v;
    this.postEl.style.display = v && !this.usingPost ? '' : 'none';
  }

  private drawBackground(g: CanvasRenderingContext2D): void {
    this.bgAge += this.lastDt;
    if (this.bgAge >= BG_REBAKE_S) this.bakeBackground();
    if (this.bgFc) {
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.drawImage(this.bgFullCv, 0, 0);
      g.restore();
      return;
    }
    g.save();
    g.globalCompositeOperation = 'copy';
    g.drawImage(this.bgCv, 0, 0, this.vw, this.vh);
    g.restore();
  }

  // ── L1 격자 (타일 캐시) ──────────────────────────────────────────────────
  private visibleBox(): [number, number, number, number] {
    const s = this.cam.scale * (1 + this.cam.punch);
    const hw = this.vw / 2 / s;
    const hh = this.vh / 2 / s;
    const c0 = Math.max(0, Math.floor((this.cam.x - hw) / CELL) - 2);
    const c1 = Math.min(COLS, Math.ceil((this.cam.x + hw) / CELL) + 2);
    const r0 = Math.max(0, Math.floor((this.cam.y - hh) / CELL) - 2);
    const r1 = Math.min(ROWS, Math.ceil((this.cam.y + hh) / CELL) + 2);
    return [c0, c1, r0, r1];
  }

  /** 8×8셀 타일 1장을 굽는다(minor 8줄 + major 1줄 + 교차점). 배율이 0.3% 넘게 바뀌면 다시 굽는다. */
  private ensureGridTile(g: CanvasRenderingContext2D, S: number): void {
    if (this.gridPat && this.gridPatCtx === g && Math.abs(S / this.gridPatS - 1) < 0.003) return;
    const px = 8 * CELL * S;
    const n = Math.max(8, Math.round(px));
    const c = this.gridTile;
    c.width = n;
    c.height = n;
    const x = c.getContext('2d')!;
    x.clearRect(0, 0, n, n);
    const cell = n / 8;
    x.strokeStyle = PAL.gridMinor;
    x.lineWidth = 1;
    x.beginPath();
    for (let i = 1; i < 8; i++) {
      const p = Math.round(i * cell) + 0.5;
      x.moveTo(p, 0);
      x.lineTo(p, n);
      x.moveTo(0, p);
      x.lineTo(n, p);
    }
    x.stroke();
    x.strokeStyle = PAL.gridMajor;
    x.lineWidth = 1.5;
    x.beginPath();
    x.moveTo(0.75, 0);
    x.lineTo(0.75, n);
    x.moveTo(0, 0.75);
    x.lineTo(n, 0.75);
    x.stroke();
    x.fillStyle = PAL.gridDot;
    x.fillRect(0, 0, 2.4, 2.4);
    this.gridPat = g.createPattern(c, 'repeat');
    this.gridPatCtx = g;
    this.gridPatS = S;
  }

  private drawGrid(g: CanvasRenderingContext2D, S: number): void {
    const [c0, c1, r0, r1] = this.visibleBox();
    const s = this.cam.scale * (1 + this.cam.punch);
    g.fillStyle = PAL.void2;
    g.globalAlpha = 0.25;
    g.fillRect(c0 * CELL, r0 * CELL, (c1 - c0) * CELL, (r1 - r0) * CELL);
    g.globalAlpha = 1;

    this.ensureGridTile(g, S);
    if (this.gridPat) {
      // 패턴은 «사용자 좌표 원점»에 고정된다. 가시영역 첫 major 선(8셀 배수)을 원점으로 잡아
      // 배율 오차가 뷰포트 밖으로 누적되지 않게 한다.
      const m0 = Math.floor(c0 / 8) * 8;
      const n0 = Math.floor(r0 / 8) * 8;
      g.save();
      g.translate(m0 * CELL, n0 * CELL);
      g.scale(1 / S, 1 / S);
      g.fillStyle = this.gridPat;
      g.fillRect(0, 0, (c1 - m0) * CELL * S, (r1 - n0) * CELL * S);
      g.restore();
    }

    g.strokeStyle = PAL.gridEdge;
    g.lineWidth = 3 / s;
    g.strokeRect(0, 0, ARENA_W, ARENA_H);
  }

  // ── L2 영토: 캐시 ────────────────────────────────────────────────────────
  private cachePx(): number {
    return CELL * this.tcS;
  }

  private ensureTerrCache(grid: GridT, S: number): void {
    const [c0, c1, r0, r1] = this.visibleBox();
    // -24: «안정» = 배율이 이전 프레임과 «정확히» 같다(카메라 배율은 목표에 스냅된다). 그때는 0.05% 어긋남에도 다시 굽는다 —
    // 4% 허용은 캐시를 매 프레임 «살짝 다른 배율»로 재보간해 경계를 흐리고 흔들었다.
    const stable = S === this.lastS;
    this.lastS = S;
    const dimsChanged = this.tcCols !== COLS || this.tcRows !== ROWS;
    const scaleOff = Math.abs(S / this.tcS - 1);
    const needRealloc =
      !this.tcValid ||
      dimsChanged ||
      scaleOff > 0.25 ||
      (scaleOff > 0.0005 && stable) ||
      c1 - c0 + 2 > this.tcRW ||
      r1 - r0 + 2 > this.tcRH;
    const inside =
      this.tcValid &&
      c0 >= this.tcC0 &&
      r0 >= this.tcR0 &&
      c1 <= this.tcC0 + this.tcRW &&
      r1 <= this.tcR0 + this.tcRH;

    if (needRealloc) {
      const RW = c1 - c0 + TC_MARGIN * 2;
      const RH = r1 - r0 + TC_MARGIN * 2;
      this.tcS = S;
      this.tcCols = COLS;
      this.tcRows = ROWS;
      this.tcRW = RW;
      this.tcRH = RH;
      this.tcC0 = c0 - TC_MARGIN;
      this.tcR0 = r0 - TC_MARGIN;
      const pw = Math.max(2, Math.ceil(RW * CELL * S));
      const ph = Math.max(2, Math.ceil(RH * CELL * S));
      if (this.tcCv.width !== pw || this.tcCv.height !== ph) {
        this.tcCv.width = pw;
        this.tcCv.height = ph;
        this.tcc = this.tcCv.getContext('2d')!;
      }
      const ew = Math.max(2, Math.ceil(pw / 4));
      const eh = Math.max(2, Math.ceil(ph / 4));
      if (this.teCv.width !== ew || this.teCv.height !== eh) {
        this.teCv.width = ew;
        this.teCv.height = eh;
        this.tec = this.teCv.getContext('2d')!;
      }
      this.pathsRev = -1;
      this.rebuildPaths(grid);
      if (this.diagOn) this.stats.reallocs++;
      this.bakeRect(this.tcC0, this.tcR0, this.tcC0 + RW, this.tcR0 + RH);
      this.snapshot(grid);
      this.tcRev = grid.rev;
      this.tcValid = true;
      return;
    }

    if (!inside) {
      // 카메라가 여유를 벗어났다 → 자기복사로 밀고 드러난 띠만 굽는다.
      const nc0 = Math.round((c0 + c1) / 2 - this.tcRW / 2);
      const nr0 = Math.round((r0 + r1) / 2 - this.tcRH / 2);
      const dc = nc0 - this.tcC0;
      const dr = nr0 - this.tcR0;
      const px = this.cachePx();
      for (const [cv, ctx, k] of [
        [this.tcCv, this.tcc, 1],
        [this.teCv, this.tec, 0.25],
      ] as const) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'copy';
        ctx.drawImage(cv, -dc * px * k, -dr * px * k);
        ctx.restore();
      }
      this.tcC0 = nc0;
      this.tcR0 = nr0;
      if (this.diagOn) this.stats.shifts++;
      this.pathsRev = -1;
      this.rebuildPaths(grid);
      // 드러난 띠: 가로 방향 + 세로 방향(겹치는 모서리는 두 번 칠해도 결과 동일 — clear 후 그리므로)
      if (dc > 0) this.bakeRect(this.tcC0 + this.tcRW - dc, this.tcR0, this.tcC0 + this.tcRW, this.tcR0 + this.tcRH);
      else if (dc < 0) this.bakeRect(this.tcC0, this.tcR0, this.tcC0 - dc, this.tcR0 + this.tcRH);
      if (dr > 0) this.bakeRect(this.tcC0, this.tcR0 + this.tcRH - dr, this.tcC0 + this.tcRW, this.tcR0 + this.tcRH);
      else if (dr < 0) this.bakeRect(this.tcC0, this.tcR0, this.tcC0 + this.tcRW, this.tcR0 - dr);
      // 밀린 사이에 바뀐 소유권이 있으면 아래 더티 검사가 잡는다.
    }

    if (grid.rev !== this.tcRev) {
      this.tcRev = grid.rev;
      const d = this.dirtyBox(grid);
      if (d) {
        this.rebuildPaths(grid);
        this.bakeRect(d[0] - 1, d[1] - 1, d[2] + 1, d[3] + 1);
      }
      this.snapshot(grid);
    }
  }

  private snapshot(grid: GridT): void {
    if (this.ownerSnap.length !== grid.owner.length) this.ownerSnap = new Int8Array(grid.owner.length);
    this.ownerSnap.set(grid.owner);
  }

  /** 스냅샷 대비 바뀐 셀의 bbox(셀, 배타). 캐시 영역 안만 본다. 없으면 null. */
  private dirtyBox(grid: GridT): [number, number, number, number] | null {
    if (this.ownerSnap.length !== grid.owner.length) return [this.tcC0, this.tcR0, this.tcC0 + this.tcRW, this.tcR0 + this.tcRH];
    const c0 = Math.max(0, this.tcC0);
    const c1 = Math.min(COLS, this.tcC0 + this.tcRW);
    const r0 = Math.max(0, this.tcR0);
    const r1 = Math.min(ROWS, this.tcR0 + this.tcRH);
    let x0 = 1e9;
    let y0 = 1e9;
    let x1 = -1;
    let y1 = -1;
    const o = grid.owner;
    const s = this.ownerSnap;
    for (let r = r0; r < r1; r++) {
      const base = r * COLS;
      for (let c = c0; c < c1; c++) {
        const i = base + c;
        if (o[i] !== s[i]) {
          if (c < x0) x0 = c;
          if (c > x1) x1 = c;
          if (r < y0) y0 = r;
          if (r > y1) y1 = r;
        }
      }
    }
    if (x1 < 0) return null;
    return [x0, y0, x1 + 1, y1 + 1];
  }

  /** 캐시 영역 전체의 Path2D 를 만든다(rev·위치가 같으면 생략). */
  private rebuildPaths(grid: GridT): void {
    if (grid.rev === this.pathsRev && this.pathsC0 === this.tcC0 && this.pathsR0 === this.tcR0) return;
    this.pathsRev = grid.rev;
    this.pathsC0 = this.tcC0;
    this.pathsR0 = this.tcR0;
    const c0 = Math.max(0, this.tcC0);
    const c1 = Math.min(COLS, this.tcC0 + this.tcRW);
    const r0 = Math.max(0, this.tcR0);
    const r1 = Math.min(ROWS, this.tcR0 + this.tcRH);

    const n = FACTIONS.length + 2;
    this.terr = [];
    this.terrEmpty = [];
    this.terrCellBox = [];
    for (let i = 0; i < n; i++) {
      this.terr.push(new Path2D());
      this.terrEmpty.push(true);
      this.terrCellBox.push([1e9, 1e9, -1, -1]);
    }
    const ox = c0 * CELL - CELL * 4;
    const oy = r0 * CELL - CELL * 4;
    const ow = (c1 - c0) * CELL + CELL * 8;
    const oh = (r1 - r0) * CELL + CELL * 8;
    const union = new Path2D();
    const comm = new Path2D();
    const land = new Path2D();
    let any = false;
    for (let r = r0; r < r1; r++) {
      let run = -1;
      let cur = -2;
      for (let c = c0; c <= c1; c++) {
        const o = c < c1 ? grid.owner[r * COLS + c]! : -2;
        if (o !== cur) {
          if (cur >= 0 && run >= 0) {
            const p = this.terr[cur];
            if (p) {
              p.rect(run * CELL, r * CELL, (c - run) * CELL, CELL);
              union.rect(run * CELL, r * CELL, (c - run) * CELL, CELL);
              this.terrEmpty[cur] = false;
              any = true;
              const bb = this.terrCellBox[cur]!;
              if (run < bb[0]!) bb[0] = run;
              if (r < bb[1]!) bb[1] = r;
              if (c > bb[2]!) bb[2] = c;
              if (r + 1 > bb[3]!) bb[3] = r + 1;
            }
          }
          run = c;
          cur = o;
        }
      }
      for (let c = c0; c < c1; c++) {
        const i = r * COLS + c;
        const tier = grid.tier[i]!;
        if (tier === 1) comm.rect(c * CELL, r * CELL, CELL, CELL);
        else if (tier === 2) land.rect(c * CELL, r * CELL, CELL, CELL);
      }
    }
    this.union = any ? union : null;
    this.tierComm = comm;
    this.tierLand = land;
    this.tierCommOuter = new Path2D();
    this.tierCommOuter.rect(ox, oy, ow, oh);
    this.tierCommOuter.addPath(comm);

    this.bevelHi = [];
    this.bevelOc = [];
    this.outer = [];
    const b = CELL * 0.2;
    for (let i = 0; i < n; i++) {
      const src = this.terr[i]!;
      if (this.terrEmpty[i]) {
        this.outer.push(null);
        this.bevelHi.push(null);
        this.bevelOc.push(null);
        continue;
      }
      const out = new Path2D();
      out.rect(ox, oy, ow, oh);
      out.addPath(src);
      this.outer.push(out);
      if (!HAS_MATRIX) {
        this.bevelHi.push(null);
        this.bevelOc.push(null);
        continue;
      }
      const hi = new Path2D();
      hi.rect(ox, oy, ow, oh);
      hi.addPath(src, new DOMMatrix().translate(b, b));
      const oc = new Path2D();
      oc.rect(ox, oy, ow, oh);
      oc.addPath(src, new DOMMatrix().translate(-b, -b));
      this.bevelHi.push(hi);
      this.bevelOc.push(oc);
    }
  }

  /**
   * 캐시의 셀 사각형 [cx0,cy0)-(cx1,cy1) 을 지우고 다시 굽는다.
   * 모든 레이어를 «영역 전체 Path2D»로 그리되 이 사각형으로 clip 한다 — 경계에서
   * 베벨·림·그림자가 이어진다(같은 기하를 잘라 그릴 뿐이다).
   */
  private bakeRect(cx0: number, cy0: number, cx1: number, cy1: number): void {
    cx0 = Math.max(cx0, this.tcC0);
    cy0 = Math.max(cy0, this.tcR0);
    cx1 = Math.min(cx1, this.tcC0 + this.tcRW);
    cy1 = Math.min(cy1, this.tcR0 + this.tcRH);
    if (cx1 <= cx0 || cy1 <= cy0) return;
    const tb0 = this.diagOn ? performance.now() : 0;
    // 이 사각형(+1셀: 베벨·림·그림자 번짐)과 겹치는 팩션만 굽는다
    const hit: boolean[] = [];
    for (let i = 0; i < this.terr.length; i++) {
      const bb = this.terrCellBox[i];
      hit.push(!this.terrEmpty[i] && !!bb && bb[0]! <= cx1 + 1 && bb[2]! >= cx0 - 1 && bb[1]! <= cy1 + 1 && bb[3]! >= cy0 - 1);
    }
    const S = this.tcS;
    const wx = cx0 * CELL;
    const wy = cy0 * CELL;
    const ww = (cx1 - cx0) * CELL;
    const wh = (cy1 - cy0) * CELL;
    const ox = this.tcC0 * CELL;
    const oy = this.tcR0 * CELL;

    // 정수 장치 픽셀로 스냅한 clip — 분수 픽셀 경계에서 AA 가 «옛 픽셀 절반 + 새 픽셀 절반»을 섞어
    // 어두운 1px 이음선을 만든다(실측). 정수면 이음선이 없다.
    const px0 = Math.floor((wx - ox) * S);
    const py0 = Math.floor((wy - oy) * S);
    const px1 = Math.ceil((wx + ww - ox) * S);
    const py1 = Math.ceil((wy + wh - oy) * S);
    // ── 색 캐시 ──
    const c = this.tcc;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.beginPath();
    c.rect(px0, py0, px1 - px0, py1 - py0);
    c.clip();
    c.clearRect(px0, py0, px1 - px0, py1 - py0);
    c.setTransform(S, 0, 0, S, -ox * S, -oy * S);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    this.bakeTiers(c);
    if (this.quality !== 'LOW') this.bakeShadow(c, hit);
    const lowQ = this.quality === 'LOW';
    for (let i = 0; i < this.terr.length; i++) {
      if (!hit[i]) continue;
      const path = this.terr[i]!;
      const f = faction(i);
      let lgr = this.terrGrad[i] ?? null;
      if (!lgr) {
        lgr = c.createLinearGradient(0, 0, ARENA_W, ARENA_H);
        lgr.addColorStop(0, f.s0);
        lgr.addColorStop(0.5, f.s1);
        lgr.addColorStop(1, f.s2);
        this.terrGrad[i] = lgr;
      }
      c.globalAlpha = 0.9;
      c.fillStyle = lgr;
      c.fill(path);
      c.globalAlpha = 1;
      // 내부 깊이: 위(광원 방향)는 밝고 아래는 딥 컬러로 가라앉는다
      c.save();
      c.clip(path);
      const dg = c.createLinearGradient(0, 0, 0, ARENA_H);
      dg.addColorStop(0, 'rgba(255,255,255,0.07)');
      dg.addColorStop(0.5, hexa(f.deep, 0.18));
      dg.addColorStop(1, hexa(f.deep, 0.5));
      c.fillStyle = dg;
      c.fillRect(wx, wy, ww, wh);
      // -24: 해치(1px/14px 마이크로 텍스처) 제거 — 카메라 이동 중 재보간돼 «픽셀 단위 짜글거림»이 됐다(President iPhone). 평평한 면은 평평하게.
      c.restore();
      this.bakeBevel(c, path, i);
      this.bakeRim(c, path, i, f.glow, S, lowQ);
    }
    c.restore();

    // ── 발광 캐시(1/4) ──
    const e = this.tec;
    const S4 = S / 4;
    e.save();
    e.setTransform(1, 0, 0, 1, 0, 0);
    e.beginPath();
    e.rect(Math.floor(px0 / 4), Math.floor(py0 / 4), Math.ceil(px1 / 4) - Math.floor(px0 / 4), Math.ceil(py1 / 4) - Math.floor(py0 / 4));
    e.clip();
    e.clearRect(Math.floor(px0 / 4), Math.floor(py0 / 4), Math.ceil(px1 / 4) - Math.floor(px0 / 4), Math.ceil(py1 / 4) - Math.floor(py0 / 4));
    e.setTransform(S4, 0, 0, S4, -ox * S4, -oy * S4);
    e.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.terr.length; i++) {
      if (!hit[i]) continue;
      const path = this.terr[i]!;
      const f = faction(i);
      const outer = this.outer[i];
      e.save();
      if (outer) e.clip(outer, 'evenodd');
      e.globalAlpha = 0.8;
      e.strokeStyle = f.glow;
      e.lineWidth = CELL * 0.55;
      e.stroke(path);
      e.restore();
      // -23: 영역 «내부»는 emissive 에 넣지 않는다 — 큰 면적이 통째로 번져 «빛나는 안개»가 됐다(President 실기기). 림만 빛난다.
    }
    e.restore();
    if (this.diagOn) {
      const ms = performance.now() - tb0;
      this.stats.bakes++;
      this.stats.bakeMs += ms;
      if (ms > this.stats.maxBake) this.stats.maxBake = ms;
    }
  }

  private bakeTiers(g: CanvasRenderingContext2D): void {
    if (this.tierComm) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.05;
      g.fillStyle = PAL.goldA;
      g.fill(this.tierComm);
      if (this.tierCommOuter) {
        g.clip(this.tierCommOuter, 'evenodd');
        g.globalAlpha = 0.3;
        g.strokeStyle = PAL.goldA;
        g.lineWidth = 2.4 / this.tcS;
        g.stroke(this.tierComm);
      }
      g.restore();
    }
    if (this.tierLand) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.22;
      g.fillStyle = PAL.goldA;
      g.fill(this.tierLand);
      g.restore();
    }
  }

  /** 접지 그림자 — 캐시에 굽는다(예전엔 매 프레임 오프스크린이었다). */
  private bakeShadow(g: CanvasRenderingContext2D, hit: boolean[]): void {
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = 7;
    g.shadowOffsetY = 3;
    g.shadowOffsetX = 2;
    g.fillStyle = 'rgba(0,0,0,0.9)';
    for (let i = 0; i < this.terr.length; i++) {
      if (!hit[i]) continue;
      g.fill(this.terr[i]!);
    }
    g.restore();
  }

  private bakeBevel(g: CanvasRenderingContext2D, path: Path2D, i: number): void {
    g.save();
    g.clip(path);
    if (HAS_MATRIX && this.bevelHi[i] && this.bevelOc[i]) {
      g.globalAlpha = 0.32;
      g.fillStyle = '#FFFFFF';
      g.fill(this.bevelHi[i]!, 'evenodd');
      g.globalAlpha = 0.38;
      g.fillStyle = '#000000';
      g.fill(this.bevelOc[i]!, 'evenodd');
    } else {
      const bg = g.createLinearGradient(0, 0, 0, ARENA_H);
      bg.addColorStop(0, 'rgba(255,255,255,0.16)');
      bg.addColorStop(1, 'rgba(0,0,0,0.22)');
      g.fillStyle = bg;
      g.fill(path);
    }
    g.restore();
  }

  /** 외곽 림라이트 = «영토 바깥»으로 클립하고 스트로크(내부 공유 모서리 줄무늬 방지) */
  private bakeRim(g: CanvasRenderingContext2D, path: Path2D, i: number, glow: string, S: number, lowQ: boolean): void {
    const outer = this.outer[i];
    g.save();
    if (outer) g.clip(outer, 'evenodd');
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.9;
    g.strokeStyle = glow;
    g.lineWidth = (lowQ ? 3.6 : 4.8) / S;
    g.stroke(path);
    // 얇은 흰 코어 — 「액체 금속」 가장자리
    g.globalAlpha = 0.55;
    g.strokeStyle = '#FFFFFF';
    g.lineWidth = 1.6 / S;
    g.stroke(path);
    g.restore();
  }

  // ── L2 영토: 매 프레임 ───────────────────────────────────────────────────
  private drawTerritory(g: CanvasRenderingContext2D, bl: CanvasRenderingContext2D, w: World, s: number): void {
    if (this.tcValid) {
      const x = this.tcC0 * CELL;
      const y = this.tcR0 * CELL;
      const wu = this.tcCv.width / this.tcS;
      const hu = this.tcCv.height / this.tcS;
      g.drawImage(this.tcCv, x, y, wu, hu);
      bl.save();
      bl.globalCompositeOperation = 'lighter';
      bl.drawImage(this.teCv, x, y, wu, hu);
      bl.restore();
      this.blMark(x, y, x + wu, y + hu);
    }
    if (this.quality === 'HIGH') this.terrEnamel(g);
    this.terrPending(g, w.grid, s / this.base);
    this.terrLandmarks(g, bl, w.grid, s / this.base);
    this.terrFlashes(g, bl);
  }

  /** 에나멜 시트 — 영토 마스크 안에서만, 4.5s 주기 좌상→우하(HIGH 전용, clip 1회 + fill 1회) */
  private terrEnamel(g: CanvasRenderingContext2D): void {
    if (!this.union) return;
    const sp = (this.t / 4.5) % 1;
    const bw = Math.hypot(ARENA_W, ARENA_H) * 0.22;
    const px0 = -bw + sp * (ARENA_W + bw * 2);
    const gg = g.createLinearGradient(px0 - bw, 0, px0 + bw, ARENA_H);
    gg.addColorStop(0, 'rgba(255,255,255,0)');
    gg.addColorStop(0.5, 'rgba(255,255,255,0.075)');
    gg.addColorStop(1, 'rgba(255,255,255,0)');
    const [c0, c1, r0, r1] = this.visibleBox();
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.clip(this.union);
    g.fillStyle = gg;
    g.fillRect(c0 * CELL, r0 * CELL, (c1 - c0) * CELL, (r1 - r0) * CELL);
    g.restore();
  }

  private terrPending(g: CanvasRenderingContext2D, grid: GridT, s: number): void {
    const pend = grid.pendingRegistration;
    if (!pend.length) return;
    const [c0, c1, r0, r1] = this.visibleBox();
    g.save();
    for (const i of pend) {
      const c = i % COLS;
      const r = (i / COLS) | 0;
      if (c < c0 || c >= c1 || r < r0 || r >= r1) continue;
      const k = 1 - grid.reg[i]! / 3;
      g.globalAlpha = 0.4 + 0.25 * Math.sin(this.t * 9);
      g.fillStyle = '#05060B';
      g.fillRect(c * CELL, r * CELL, CELL, CELL);
      g.globalAlpha = 0.95;
      g.strokeStyle = PAL.goldA;
      g.lineWidth = 1.6 / s;
      g.beginPath();
      g.arc((c + 0.5) * CELL, (r + 0.5) * CELL, CELL * 0.32, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }

  private terrLandmarks(g: CanvasRenderingContext2D, bl: CanvasRenderingContext2D, grid: GridT, s: number): void {
    const [c0, c1, r0, r1] = this.visibleBox();
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const lm of grid.landmarks) {
      const c = lm % COLS;
      const r = (lm / COLS) | 0;
      if (c < c0 - 4 || c > c1 + 4 || r < r0 - 4 || r > r1 + 4) continue;
      const x = (c + 0.5) * CELL;
      const y = (r + 0.5) * CELL;
      const o = grid.owner[lm]!;
      const col = o >= 0 ? faction(o).glow : PAL.goldA;
      g.strokeStyle = hexa(col, 0.75);
      g.lineWidth = 2 / s;
      for (let k = 0; k < 2; k++) {
        const rot = this.t * (k === 0 ? 1.1 : -0.8) + k * 1.7;
        g.beginPath();
        g.arc(x, y, CELL * (1.5 + k * 0.45), rot, rot + Math.PI * 1.25);
        g.stroke();
      }
      g.fillStyle = hexa(col, 0.9);
      g.beginPath();
      g.arc(x, y, CELL * 0.26, 0, 7);
      g.fill();
      bl.save();
      bl.globalCompositeOperation = 'lighter';
      bl.fillStyle = hexa(col, 0.5);
      bl.beginPath();
      bl.arc(x, y, CELL * 0.9, 0, 7);
      bl.fill();
      bl.restore();
    }
    g.restore();
  }

  /**
   * 점령 «채워짐» — 중심에서 퍼지는 팩션 발광(0.55s easeOutCubic) + 흰 플래시 감쇠.
   * ⚠ fl.t 를 반드시 진행시켜야 한다. 안 그러면 영구히 남는다.
   */
  private terrFlashes(g: CanvasRenderingContext2D, _bl: CanvasRenderingContext2D): void {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const fl = this.flashes[i]!;
      fl.t += this.lastDt;
      const k = fl.t / 0.6;
      if (k >= 1) {
        this.flashes.splice(i, 1);
        continue;
      }
      const e = 1 - Math.pow(1 - k, 3);
      const f = faction(fl.f);
      const rr = Math.max(CELL, fl.r * e);
      g.save();
      g.clip(fl.path);
      g.globalCompositeOperation = 'lighter';
      const rg = g.createRadialGradient(fl.x, fl.y, rr * 0.55, fl.x, fl.y, rr);
      rg.addColorStop(0, hexa(f.glow, 0.85 * (1 - k * 0.7)));
      rg.addColorStop(0.7, hexa(f.glow, 0.5 * (1 - k)));
      rg.addColorStop(1, hexa(f.glow, 0));
      g.fillStyle = rg;
      g.fillRect(fl.bx, fl.by, fl.bw, fl.bh);
      g.fillStyle = `rgba(255,255,255,${(0.5 * (1 - k) * (1 - k)).toFixed(3)})`;
      g.fillRect(fl.bx, fl.by, fl.bw, fl.bh);
      g.restore();
      // -23 2단: 점령 플래시도 emissive 에 «채움»을 넣지 않는다(영역 채움은 블룸에서 완전 제외 — President). 씬 쪽 플래시만 남는다.
    }
  }

  // ── L3 트레일 ────────────────────────────────────────────────────────────
  private drawTrails(g: CanvasRenderingContext2D, bl: CanvasRenderingContext2D, w: World): void {
    const s = this.cam.scale * (1 + this.cam.punch);
    for (const u of w.units) {
      if (!u.alive || u.respawn > 0 || u.pts.length < 2) continue;
      const pts = u.pts;
      let x0 = u.x;
      let y0 = u.y;
      let x1 = u.x;
      let y1 = u.y;
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i]!;
        if (q.x < x0) x0 = q.x;
        if (q.x > x1) x1 = q.x;
        if (q.y < y0) y0 = q.y;
        if (q.y > y1) y1 = q.y;
      }
      if (x1 < this.visX0 || x0 > this.visX1 || y1 < this.visY0 || y0 > this.visY1) continue;
      const f = faction(u.id);
      const trace = (ctx: CanvasRenderingContext2D) => {
        ctx.beginPath();
        ctx.moveTo(pts[0]!.x, pts[0]!.y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
        ctx.lineTo(u.x, u.y);
      };

      // 1) 발광(블룸) — 빛나는 리본
      bl.save();
      bl.lineCap = 'round';
      bl.lineJoin = 'round';
      trace(bl);
      bl.lineWidth = CELL * 1.3;
      bl.strokeStyle = hexa(f.glow, 0.32);
      bl.stroke();
      bl.restore();
      const pad = CELL * 1.1;
      this.blMark(x0 - pad, y0 - pad, x1 + pad, y1 + pad);

      g.save();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      // 2) 미드(팩션색)
      trace(g);
      g.lineWidth = CELL * 0.9;
      g.strokeStyle = hexa(f.s0, 0.6);
      g.stroke();
      // 3) 코어(흰 백열)
      trace(g);
      g.lineWidth = CELL * 0.4;
      g.strokeStyle = 'rgba(255,255,255,0.92)';
      g.stroke();
      // 4) 에너지 펄스 — 머리 쪽으로 흐른다
      g.setLineDash([CELL * 0.9, CELL * 4.5]);
      g.lineDashOffset = -(this.t * 260) % (CELL * 5.4);
      g.lineWidth = CELL * 0.55;
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      trace(g);
      g.stroke();
      g.setLineDash([]);
      // 꼬리 취약점: 가장 오래된 20% 는 danger 점선
      const nTail = Math.max(2, Math.floor(pts.length * 0.2));
      g.beginPath();
      g.moveTo(pts[0]!.x, pts[0]!.y);
      for (let i = 1; i < nTail; i++) g.lineTo(pts[i]!.x, pts[i]!.y);
      g.setLineDash([3 / s, 5 / s]);
      g.lineWidth = 1.6 / s;
      g.strokeStyle = hexa(PAL.danger, 0.85);
      g.stroke();
      g.setLineDash([]);
      g.restore();

      if (this.parts.length < this.partCap() && Math.random() < 0.5) {
        this.parts.push({
          x: u.x,
          y: u.y,
          vx: rnd(-40, 40),
          vy: rnd(-40, 40),
          life: 0,
          max: 0.32,
          s: 2,
          rot: 0,
          vr: 0,
          f: u.id,
          type: 'spark',
        });
      }
    }
  }

  private drawAim(g: CanvasRenderingContext2D, w: World): void {
    const p = w.player;
    const b = p.bounce;
    if (!b || b.phase !== 'aim' || b.auto) return;
    const s = this.cam.scale * (1 + this.cam.punch);
    const path = shotPreview(p.x, p.y, b.aimAngle, b.aimPower * CELL);
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.setLineDash([CELL * 0.6, CELL * 0.6]);
    g.lineDashOffset = -(this.t * 90) % (CELL * 1.2);
    g.lineWidth = 2.2 / s;
    g.strokeStyle = hexa(faction(p.id).glow, 0.9);
    g.beginPath();
    g.moveTo(path[0]!.x, path[0]!.y);
    for (let i = 1; i < path.length; i++) g.lineTo(path[i]!.x, path[i]!.y);
    g.stroke();
    g.setLineDash([]);
    const end = path[path.length - 1]!;
    g.strokeStyle = hexa('#FFFFFF', 0.85);
    g.lineWidth = 1.8 / s;
    g.beginPath();
    g.arc(end.x, end.y, CELL * 0.9, 0, 7);
    g.stroke();
    if (b.land.length) {
      g.setLineDash([CELL * 0.35, CELL * 0.5]);
      g.strokeStyle = hexa(faction(p.id).s0, 0.55);
      g.lineWidth = 1.4 / s;
      g.beginPath();
      g.moveTo(b.origin.x, b.origin.y);
      for (const l of b.land) g.lineTo(l.x, l.y);
      g.lineTo(end.x, end.y);
      g.closePath();
      g.stroke();
      g.setLineDash([]);
    }
    g.restore();
  }

  // ── L4 아바타 (스프라이트 캐시) ──────────────────────────────────────────
  private ensureSprites(S: number): void {
    if (this.sprites.length && Math.abs(S / this.spriteS - 1) < 0.08) return;
    this.spriteS = S;
    this.sprites = [];
    for (let i = 0; i < FACTIONS.length; i++) this.sprites.push(this.makeSprite(faction(i), S));
  }

  /** 스키프 몸체 + 접지 그림자를 1장, 머리 광(라디얼)을 1장 굽는다. */
  private makeSprite(f: Faction, S: number): Sprite {
    const C = CELL * 1.45;
    const wu = C * 2.2;
    const px = Math.max(8, Math.ceil(wu * S));
    const body = mkc(px, px);
    const g = body.getContext('2d')!;
    g.setTransform(S, 0, 0, S, px / 2, px / 2);
    const hull = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      ctx.moveTo(0.55 * C, 0);
      ctx.quadraticCurveTo(0.42 * C, 0.3 * C, 0.05 * C, 0.34 * C);
      ctx.lineTo(-0.42 * C, 0.28 * C);
      ctx.quadraticCurveTo(-0.55 * C, 0, -0.42 * C, -0.28 * C);
      ctx.lineTo(0.05 * C, -0.34 * C);
      ctx.quadraticCurveTo(0.42 * C, -0.3 * C, 0.55 * C, 0);
      ctx.closePath();
    };
    // 1) 접지 그림자(캐시라서 shadowBlur 가 매 프레임 비용이 아니다)
    g.save();
    g.translate(0.06 * C, 0.11 * C);
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 6 * S;
    g.fillStyle = 'rgba(0,0,0,0.55)';
    hull(g);
    g.fill();
    g.restore();
    // 2) 선체 그라디언트 315°(좌상단 광원)
    const lg = g.createLinearGradient(-0.4 * C, -0.4 * C, 0.4 * C, 0.4 * C);
    lg.addColorStop(0, f.s0);
    lg.addColorStop(0.55, f.s1);
    lg.addColorStop(1, f.s2);
    g.fillStyle = lg;
    hull(g);
    g.fill();
    // 3) 하부 오클루전 + 앞쪽 하이라이트
    g.save();
    hull(g);
    g.clip();
    g.fillStyle = hexa(f.deep, 0.6);
    g.fillRect(-C, 0.04 * C, 2 * C, C);
    const hg = g.createLinearGradient(-0.3 * C, -0.34 * C, 0.1 * C, 0.1 * C);
    hg.addColorStop(0, 'rgba(255,255,255,0.42)');
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hg;
    g.fillRect(-C, -C, 2 * C, 2 * C);
    // 4) 바이저(눈) — 앞을 보는 밝은 슬릿 + 동공점
    g.fillStyle = 'rgba(8,10,20,0.9)';
    g.beginPath();
    g.ellipse(0.18 * C, -0.02 * C, 0.24 * C, 0.13 * C, 0, 0, 7);
    g.fill();
    g.fillStyle = f.glow;
    g.beginPath();
    g.ellipse(0.2 * C, -0.03 * C, 0.17 * C, 0.075 * C, 0, 0, 7);
    g.fill();
    g.fillStyle = '#FFFFFF';
    g.beginPath();
    g.ellipse(0.27 * C, -0.05 * C, 0.06 * C, 0.04 * C, 0, 0, 7);
    g.fill();
    g.restore();
    // 5) 스펙큘러(캐노피 하이라이트) + 림
    g.globalAlpha = 0.5;
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(-0.06 * C, -0.16 * C, 0.2 * C, 0.055 * C, -0.15, 0, 7);
    g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(255,255,255,0.62)';
    g.lineWidth = 1.8 / S;
    hull(g);
    g.stroke();

    // 머리 광
    const R = CELL * 1.35;
    const gpx = Math.max(8, Math.ceil(R * 2 * S));
    const glow = mkc(gpx, gpx);
    const gg = glow.getContext('2d')!;
    const rg = gg.createRadialGradient(gpx / 2, gpx / 2, 0, gpx / 2, gpx / 2, gpx / 2);
    rg.addColorStop(0, 'rgba(255,255,255,0.9)');
    rg.addColorStop(0.28, hexa(f.s0, 0.8));
    rg.addColorStop(0.62, hexa(f.glow, 0.3));
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    gg.fillStyle = rg;
    gg.fillRect(0, 0, gpx, gpx);
    return { body, glow, wu };
  }

  private drawUnits(g: CanvasRenderingContext2D, bl: CanvasRenderingContext2D, w: World, S: number): void {
    this.ensureSprites(S);
    for (const u of w.units) {
      if (!u.alive || u.respawn > 0) continue;
      if (u.x < this.visX0 || u.x > this.visX1 || u.y < this.visY0 || u.y > this.visY1) continue;
      this.drawSkiff(g, bl, u, w);
    }
  }

  private drawSkiff(g: CanvasRenderingContext2D, bl: CanvasRenderingContext2D, u: Unit, w: World): void {
    const C = CELL * 1.45;
    const f = faction(u.id);
    const isPlayer = u.id === w.playerId;
    const blink = u.invuln > 0 ? 0.35 + 0.45 * Math.abs(Math.sin(this.t * 14)) : 1;
    const sp = this.sprites[((u.id % FACTIONS.length) + FACTIONS.length) % FACTIONS.length];

    // 상태 링
    g.save();
    if (u.outside) {
      const k = Math.sin(this.t * 8.4) * 0.5 + 0.5;
      g.strokeStyle = hexa(PAL.danger, 0.35 + k * 0.4);
      g.lineWidth = 1.8 / this.cam.scale;
      g.beginPath();
      g.arc(u.x, u.y, C * (0.62 + k * 0.16), 0, 7);
      g.stroke();
    } else {
      g.strokeStyle = hexa(f.glow, 0.25);
      g.lineWidth = 1.3 / this.cam.scale;
      g.beginPath();
      g.arc(u.x, u.y, C * 0.62, 0, 7);
      g.stroke();
    }
    g.restore();

    // 머리 광(스프라이트)
    if (sp) {
      const R = CELL * 1.35;
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.8 * blink;
      g.drawImage(sp.glow, u.x - R, u.y - R, R * 2, R * 2);
      g.restore();
    }

    g.save();
    g.globalAlpha = blink;
    g.translate(u.x, u.y);
    g.rotate(u.heading);
    g.rotate((u.roll * Math.PI) / 180);

    // 스러스터 3겹
    const len = (0.5 + u.speedView * 1.1) * C * (1 + Math.sin(this.t * 30) * 0.12);
    g.globalCompositeOperation = 'lighter';
    for (let i = 2; i >= 0; i--) {
      const L = len * THR_LEN[i]!;
      g.globalAlpha = THR_ALPHA[i]! * blink;
      g.fillStyle = i === 0 ? '#FFFFFF' : i === 1 ? f.s0 : f.glow;
      g.beginPath();
      g.ellipse(-0.55 * C - L / 2, 0, Math.max(0.01, L / 2), C * (0.18 - i * 0.03), 0, 0, 7);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = blink;
    // 속도 스쿼시: 빠를수록 진행축으로 늘고 두께가 준다
    const sq = Math.min(0.14, u.speedView * 0.09);
    g.scale(1 + sq, 1 - sq * 0.8);
    if (sp) {
      g.drawImage(sp.body, -sp.wu / 2, -sp.wu / 2, sp.wu, sp.wu);
    }
    g.restore();

    bl.save();
    bl.globalCompositeOperation = 'lighter';
    bl.globalAlpha = 0.55;
    bl.fillStyle = f.glow;
    bl.beginPath();
    bl.arc(u.x, u.y, C * 0.55, 0, 7);
    bl.fill();
    bl.restore();
    this.blMark(u.x - C * 0.6, u.y - C * 0.6, u.x + C * 0.6, u.y + C * 0.6);

    if (!isPlayer) {
      // 이름표: 스프라이트 캐시(대상 픽셀 배율 base 로 1회 렌더) → 매 프레임 drawImage 1회. fillText 는 이름당 1회.
      const s = this.cam.scale;
      const key = (u.kind === 'ghost' ? 'g:' : 'n:') + u.name;
      // -24: 후처리 프레임이면 HUD 층(기기 DPR)에 1:1 로 — scene 배율(2)로 굽고 3 으로 늘리지 않는다
      const lk = this.usingPost && this.ovc ? this.dpr : this.base;
      let cv = this.labelCv.get(key);
      if (!cv || this.labelScale !== lk) {
        if (this.labelScale !== lk) {
          this.labelCv.clear();
          this.labelScale = lk;
        }
        const k = lk;
        const mc = mkc(2, 2);
        const m = mc.getContext('2d')!;
        m.font = '700 11px ' + HUD_FONT;
        const tw = Math.ceil(m.measureText(u.name).width + 12);
        mc.width = Math.ceil((tw + 4) * k);
        mc.height = Math.ceil(20 * k);
        const c2 = mc.getContext('2d')!;
        c2.setTransform(k, 0, 0, k, 0, 0);
        c2.font = '700 11px ' + HUD_FONT;
        c2.textAlign = 'center';
        c2.textBaseline = 'alphabetic';
        c2.fillStyle = 'rgba(5,6,11,0.6)';
        roundRect(c2, 2, 2, tw, 16, 8);
        c2.fill();
        c2.fillStyle = u.kind === 'ghost' ? PAL.ink1 : PAL.ink0;
        c2.fillText(u.name, 2 + tw / 2, 14);
        cv = mc;
        this.labelCv.set(key, cv);
        this.labelW.set(u.name, tw);
      }
      if (this.usingPost && this.ovc) {
        this.labels.push({ cv, x: u.x, y: u.y, off: C * 1.15 });
        return;
      }
      const k = lk;
      const lw = cv.width / k;
      const lh = cv.height / k;
      g.save();
      g.scale(1 / s, 1 / s);
      g.drawImage(cv, Math.round(u.x * s - lw / 2), Math.round(u.y * s - C * s * 1.15 - 15), lw, lh);
      g.restore();
    }
  }

  // ── L5 파티클 ────────────────────────────────────────────────────────────
  private drawParticles(g: CanvasRenderingContext2D, bl: CanvasRenderingContext2D, dt: number): void {
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    // emissive 는 루프 내내 lighter — 파티클마다 save/restore 하지 않는다(안드로이드 드로우콜 계수 절감)
    bl.globalCompositeOperation = 'lighter';
    bl.globalAlpha = 1;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i]!;
      q.life += dt;
      if (q.life >= q.max) {
        this.parts.splice(i, 1);
        continue;
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (q.type === 'ember') q.vy += 160 * dt;
      q.vx *= 0.93;
      q.vy *= 0.93;
      q.rot += q.vr * dt;
      const a = 1 - q.life / q.max;
      const f = faction(q.f);
      if (q.type === 'shard') {
        g.save();
        g.globalAlpha = a;
        g.translate(q.x, q.y);
        if (q.rot) g.rotate(q.rot);
        g.fillStyle = f.s0;
        g.fillRect(-q.s / 2, -q.s / 2, q.s, q.s);
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.fillRect(-q.s / 2, -q.s / 2, q.s, q.s * 0.35);
        g.restore();
      } else {
        // 스파크·불씨: 속도 방향 스트릭(빛의 꼬리)
        const sp = Math.hypot(q.vx, q.vy);
        const L = Math.min(CELL * 1.2, sp * 0.04) + 0.5;
        g.globalAlpha = a;
        g.strokeStyle = q.type === 'ember' ? f.glow : '#FFFFFF';
        g.lineWidth = q.s * 0.6;
        g.beginPath();
        g.moveTo(q.x, q.y);
        g.lineTo(q.x - (q.vx / (sp + 1e-6)) * L, q.y - (q.vy / (sp + 1e-6)) * L);
        g.stroke();
      }
      if (q.type !== 'dust') {
        bl.globalAlpha = a * 0.6;
        bl.fillStyle = f.glow;
        bl.fillRect(q.x - q.s, q.y - q.s, q.s * 2, q.s * 2);
        this.blMark(q.x - q.s, q.y - q.s, q.x + q.s, q.y + q.s);
      }
    }
    bl.globalAlpha = 1;
    bl.globalCompositeOperation = 'source-over';
    g.restore();
  }

  private drawRings(g: CanvasRenderingContext2D, dt: number): void {
    const s = this.cam.scale;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]!;
      r.t += dt;
      const k = r.t / 0.34;
      if (k >= 1) {
        this.rings.splice(i, 1);
        continue;
      }
      const e = 1 - Math.pow(1 - k, 3);
      g.strokeStyle = hexa(r.c, (1 - k) * 0.9);
      g.lineWidth = (4 * (1 - k) + 0.5) / s;
      g.beginPath();
      g.arc(r.x, r.y, r.r * e, 0, 7);
      g.stroke();
    }
    g.restore();
  }

  /** -24: HUD 층 — 이름표(정수 장치 픽셀 1:1 blit) + 팝업(기기 DPR 벡터 텍스트) */
  private drawOverlay(o: CanvasRenderingContext2D, dt: number): void {
    const k = this.dpr;
    const s = this.cam.scale * (1 + this.cam.punch);
    o.setTransform(1, 0, 0, 1, 0, 0);
    for (const l of this.labels) {
      const p = this.worldToScreen(l.x, l.y);
      o.drawImage(l.cv, Math.round(p.x * k - l.cv.width / 2), Math.round((p.y - l.off * s - 15) * k));
    }
    o.setTransform(k, 0, 0, k, 0, 0);
    this.drawPops(o, dt);
  }

  private drawPops(g: CanvasRenderingContext2D, dt: number): void {
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const q = this.pops[i]!;
      q.t += dt;
      if (q.t > 0.62) {
        this.pops.splice(i, 1);
        continue;
      }
      const k = q.t / 0.62;
      const e = 1 - Math.pow(1 - Math.min(1, k * 3), 3);
      const p = this.worldToScreen(q.x, q.y);
      g.save();
      g.globalAlpha = Math.min(1, (1 - k) * 2.2);
      g.translate(p.x, p.y - 40 * e);
      const sc = 1.4 - 0.4 * e;
      g.scale(sc, sc);
      g.font = '700 20px ' + HUD_FONT;
      g.textAlign = 'center';
      g.lineWidth = 3;
      g.strokeStyle = '#05060B';
      g.strokeText(q.txt, 0, 0);
      g.fillStyle = q.c;
      g.fillText(q.txt, 0, 0);
      g.restore();
    }
  }

  // ── L6 후처리 (폴백 경로: WebGL 없음) ────────────────────────────────────
  private compositeBloom(g: CanvasRenderingContext2D): void {
    const bw = this.bloomBlurCv.width;
    const bh = this.bloomBlurCv.height;
    const b = this.bbl;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalCompositeOperation = 'source-over';
    b.globalAlpha = 1;
    b.clearRect(0, 0, bw, bh);
    if (this.canFilter && this.quality !== 'LOW') {
      b.filter = 'blur(1.6px)';
      b.drawImage(this.bloomCv, 0, 0);
      b.filter = 'none';
    } else {
      b.globalAlpha = 0.33;
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        b.drawImage(this.bloomCv, dx, dy);
      }
      b.globalAlpha = 1;
    }
    const M = this.blM;
    let sx = 0;
    let sy = 0;
    let sw = bw;
    let sh = bh;
    if (this.blx0 > this.blx1) return;
    if (M) {
      const PAD = 8;
      const xs = [this.blx0, this.blx1];
      const ys = [this.bly0, this.bly1];
      let mnx = Infinity;
      let mny = Infinity;
      let mxx = -Infinity;
      let mxy = -Infinity;
      for (const wx of xs) {
        for (const wy of ys) {
          const px = M.a * wx + M.c * wy + M.e;
          const py = M.b * wx + M.d * wy + M.f;
          if (px < mnx) mnx = px;
          if (px > mxx) mxx = px;
          if (py < mny) mny = py;
          if (py > mxy) mxy = py;
        }
      }
      sx = Math.max(0, Math.floor(mnx - PAD));
      sy = Math.max(0, Math.floor(mny - PAD));
      sw = Math.min(bw, Math.ceil(mxx + PAD)) - sx;
      sh = Math.min(bh, Math.ceil(mxy + PAD)) - sy;
      if (sw <= 0 || sh <= 0) return;
    }
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.3;
    const kx = this.vw / bw;
    const ky = this.vh / bh;
    g.drawImage(this.bloomBlurCv, sx, sy, sw, sh, sx * kx, sy * ky, sw * kx, sh * ky);
    g.restore();
  }

  private drawPost(g: CanvasRenderingContext2D, w: World): void {
    const vw = this.vw;
    const vh = this.vh;
    const desatFx = w.desat * this.fxScale;
    if (desatFx > 0.01 && this.canSaturation) {
      g.save();
      g.globalCompositeOperation = 'saturation';
      g.globalAlpha = Math.min(0.9, desatFx);
      g.fillStyle = '#808080';
      g.fillRect(0, 0, vw, vh);
      g.restore();
    }
    const urgent = this.urgentLevel(w);
    if (urgent > 0) {
      g.save();
      g.strokeStyle = hexa(PAL.danger, urgent * 2.2);
      g.lineWidth = 6;
      g.strokeRect(3, 3, vw - 6, vh - 6);
      g.restore();
    }
    if (!this.postBaked) this.bakePost();
    this.mountPostLayer();
    if (!this.postEl) g.drawImage(this.postCv, 0, 0, vw, vh);
  }

  private bakePost(): void {
    const c = this.postc;
    const w = this.postCv.width;
    const h = this.postCv.height;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.clearRect(0, 0, w, h);
    const vg = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) * 0.62);
    vg.addColorStop(0.6, 'rgba(5,6,11,0)');
    vg.addColorStop(1, 'rgba(5,6,11,0.52)');
    c.fillStyle = vg;
    c.fillRect(0, 0, w, h);
    // -24: 폴백 그레인 제거(그레인 0 규칙은 두 경로 공통)
    this.postBaked = true;
  }

  // ── 카메라 (L7) ──────────────────────────────────────────────────────────
  private updateCamera(w: World, dt: number): void {
    const p = w.player;
    const s0 = Math.min(this.vw, this.vh) / (26 * CELL);
    const wantScale = this.quantScale(p.bounce ? s0 * 0.86 : s0);
    this.cam.scale += (wantScale - this.cam.scale) * Math.min(1, dt * 3.6);
    // 목표에 충분히 가까우면 «정확히» 목표로 — 영토 캐시가 정확한 1:1 로 blit 된다(0.2% 어긋남도 매 프레임 재보간이다)
    if (Math.abs(wantScale - this.cam.scale) < wantScale * 0.002) this.cam.scale = wantScale;
    // 줌 펀치는 설계대로 «0.2초»에 끝낸다(예전 감쇠는 ~1초 — 그동안 배율이 비정수라 캐시가 매 프레임 재보간됐다)
    this.cam.punch *= Math.pow(0.005, dt * 4);
    if (this.cam.punch < 3e-4) this.cam.punch = 0;

    const vx = Math.cos(p.heading) * p.speedView * 5.8 * CELL;
    const vy = Math.sin(p.heading) * p.speedView * 5.8 * CELL;
    let tx = p.x + vx * 0.35;
    let ty = p.y + vy * 0.35;
    const hw = this.vw / 2 / this.cam.scale;
    const hh = this.vh / 2 / this.cam.scale;
    tx = ARENA_W <= hw * 2 ? ARENA_W / 2 : Math.min(ARENA_W - hw, Math.max(hw, tx));
    ty = ARENA_H <= hh * 2 ? ARENA_H / 2 : Math.min(ARENA_H - hh, Math.max(hh, ty));
    const k = 1 - Math.pow(1 - 0.12, dt * 60);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    // -24: 기울임 0 (applyCamera 주석 참조). 필드는 가시 사각형 계산 호환을 위해 남긴다.
    this.cam.tilt = 0;
  }

  // ── 시뮬 이벤트 → 연출 ───────────────────────────────────────────────────
  private consumeFx(w: World): void {
    if (w.fx.length === 0) return;
    for (const e of w.fx) {
      const f = faction(e.unit);
      if (e.kind === 'claim') {
        const path = new Path2D();
        let bx0 = Infinity;
        let by0 = Infinity;
        let bx1 = -Infinity;
        let by1 = -Infinity;
        for (const i of e.cells) {
          const cx = (i % COLS) * CELL;
          const cy = ((i / COLS) | 0) * CELL;
          path.rect(cx, cy, CELL, CELL);
          if (cx < bx0) bx0 = cx;
          if (cy < by0) by0 = cy;
          if (cx + CELL > bx1) bx1 = cx + CELL;
          if (cy + CELL > by1) by1 = cy + CELL;
        }
        const r = Math.hypot(Math.max(e.x - bx0, bx1 - e.x), Math.max(e.y - by0, by1 - e.y)) + CELL;
        this.flashes.push({ path, t: 0, f: e.unit, x: e.x, y: e.y, r, bx: bx0, by: by0, bw: bx1 - bx0, bh: by1 - by0 });
        this.rings.push({
          x: e.x,
          y: e.y,
          r: Math.max(CELL * 6, Math.sqrt(e.cells.length) * CELL * 1.6),
          t: 0,
          c: f.glow,
        });
        const n = Math.min(40, 18 + ((e.cells.length / 10) | 0));
        this.spawnShards(e.x, e.y, n, e.unit);
        this.cam.punch = 0.03 * this.fxScale;
        if (e.unit === w.playerId) {
          if (!this.shakeOff) this.cam.punch = Math.max(this.cam.punch, PLAYER_CLAIM_PUNCH);
          const pct = ((e.cells.length / (COLS * ROWS)) * 100).toFixed(1);
          this.pops.push({ x: e.x, y: e.y, txt: `+${pct}%`, t: 0, c: '#FFFFFF' });
        }
      } else if (e.kind === 'kill') {
        this.rings.push({ x: e.x, y: e.y, r: CELL * 9, t: 0, c: PAL.danger });
        this.spawnShards(e.x, e.y, 26, e.unit);
        for (let i = 0; i < e.cells.length; i += 3) {
          const c = e.cells[i]!;
          if (this.parts.length >= this.partCap()) break;
          this.parts.push({
            x: (c % COLS) * CELL + CELL / 2,
            y: ((c / COLS) | 0) * CELL + CELL / 2,
            vx: rnd(-40, 40),
            vy: rnd(-200, -80),
            life: 0,
            max: 0.7,
            s: rnd(1.5, 3),
            rot: 0,
            vr: 0,
            f: e.unit,
            type: 'ember',
          });
        }
        if (e.by === w.playerId) {
          this.pops.push({ x: e.x, y: e.y, txt: t('fx.kill'), t: 0, c: PAL.success });
        }
      } else if (e.kind === 'land') {
        this.rings.push({ x: e.x, y: e.y, r: CELL * 4, t: 0, c: f.glow });
        this.spawnShards(e.x, e.y, 10, e.unit);
      } else if (e.kind === 'revive') {
        this.rings.push({ x: e.x, y: e.y, r: CELL * 12, t: 0, c: PAL.success });
      }
      this.onFx?.(e, w);
    }
    w.fx.length = 0;
  }

  private spawnShards(x: number, y: number, n: number, f: number): void {
    const cap = this.partCap();
    for (let i = 0; i < n && this.parts.length < cap; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rnd(160, 470);
      const spark = i % 3 === 0;
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        max: spark ? 0.38 : 0.5,
        s: spark ? rnd(1.5, 2.5) : rnd(3, 7),
        rot: Math.random() * 6,
        vr: rnd(-6, 6),
        f,
        type: spark ? 'spark' : 'shard',
      });
    }
  }
}

/** 조준 예측선(반사 1회분 포함) — sim.shotPath 와 같은 규칙 */
function shotPreview(x: number, y: number, angle: number, dist: number): Vec2[] {
  const pad = CELL * 0.4;
  const pts: Vec2[] = [{ x, y }];
  let cx = x;
  let cy = y;
  let dx = Math.cos(angle);
  let dy = Math.sin(angle);
  let remain = dist;
  for (let g = 0; g < 3 && remain > 0.01; g++) {
    let tHit = remain;
    let axis = 0;
    if (dx > 1e-6) {
      const t = (ARENA_W - pad - cx) / dx;
      if (t >= 0 && t < tHit) {
        tHit = t;
        axis = 1;
      }
    } else if (dx < -1e-6) {
      const t = (pad - cx) / dx;
      if (t >= 0 && t < tHit) {
        tHit = t;
        axis = 1;
      }
    }
    if (dy > 1e-6) {
      const t = (ARENA_H - pad - cy) / dy;
      if (t >= 0 && t < tHit) {
        tHit = t;
        axis = 2;
      }
    } else if (dy < -1e-6) {
      const t = (pad - cy) / dy;
      if (t >= 0 && t < tHit) {
        tHit = t;
        axis = 2;
      }
    }
    cx += dx * tHit;
    cy += dy * tHit;
    remain -= tHit;
    pts.push({ x: cx, y: cy });
    if (axis === 1) dx = -dx;
    else if (axis === 2) dy = -dy;
    else break;
  }
  return pts;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
