# -*- coding: utf-8 -*-
"""
-24 (President iPhone -23 판정 「렉이 좀 심해졌고, 저 픽셀 단위로 짜글짜글해 보이는 건 여전한데?」). sharp23{,b,c} 위에 적용, 멱등.

A. «픽셀 단위 짜글짜글»(그레인·지글거림)
  1. 그레인·노이즈·해치 전부 0 — 합성 셰이더 그레인(.05, 매 프레임 재시드 = 기기 픽셀 단위 잡음) 제거,
     배경 노이즈 오버레이(.022) 제거, 폴백 그레인 제거, 영토 해치(1px/14px .085 — 카메라 이동 중 재보간) 제거. 평평한 면은 평평하게.
  2. 카메라 «정수 장치 픽셀» 스냅 + 셀 한 변 «정수 픽셀» 배율 양자화 + 배율 목표 스냅 + 기울임(tilt) 0 —
     영토 캐시 blit·격자 타일·림 코어(1.6px)가 프레임마다 다른 위상으로 재보간되던 것을 없앤다. 캐시는 배율이 «정확히» 안정되면 0.05% 어긋남에도 다시 굽는다.
  3. scene→GL 텍스처 필터: 정확히 1:1 일 때만 NEAREST, 아니면 LINEAR.
  4. 이름표·팝업 텍스트는 HUD 층(#tc-ov, 기기 DPR 그대로, AA)에 — scene(블룸·업스케일 대상)에 두지 않는다.
B. 렉
  5. iOS scene DPR 3 → 2 (HUD 층은 3). 블룸 체인은 이미 1/4·1/8 만. 파티클 상한 1400/800 → 900/500.
  6. 동적 품질: 모든 플랫폼 q1 로 시작, iOS 는 3초 깨끗하면 q0 승격(Android 는 15초 유지). 나머지 히스테리시스 그대로.
"""
import io, os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

def patch(rel, pairs, marker):
    p = os.path.join(ROOT, rel)
    s = io.open(p, encoding='utf-8').read()
    if marker in s:
        print('already', rel); return
    for a, b in pairs:
        if s.count(a) != 1:
            raise SystemExit(rel + ' anchor x' + str(s.count(a)) + ': ' + a[:160])
        s = s.replace(a, b)
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
    print('patched', rel, len(pairs))

# ── post.ts ─────────────────────────────────────────────────────────────────
patch('src/game/post.ts', [
    ("""const IOS_SCENE_DPR_CAP = 3;""",
     """// -24: iOS scene DPR 2 (3 은 -22 대비 픽셀 4배 → 「렉이 좀 심해졌고」). HUD 층(이름표·팝업)은 기기 DPR 3 그대로.
const IOS_SCENE_DPR_CAP = 2;"""),
    ("""/* 합성: 씬 + 블룸 2겹 가산 → 비네트 → 막판 테두리 틴트 → 채도하강 → 그레인 */
const FS_COMP =
  PREC +
  'varying vec2 v;uniform sampler2D s;uniform sampler2D b1;uniform sampler2D b2;' +
  'uniform float k1;uniform float k2;uniform float vig;uniform float urgent;uniform float desat;uniform float grain;uniform float seed;' +""",
     """/* 합성: 씬 + 블룸 2겹 가산 → 비네트 → 막판 테두리 틴트 → 채도하강. -24: 그레인 «없음» — 매 프레임 재시드되는
   기기 픽셀 단위 잡음이 President iPhone 에서 「픽셀 단위로 짜글짜글」로 보였다. 평평한 면은 평평하게. */
const FS_COMP =
  PREC +
  'varying vec2 v;uniform sampler2D s;uniform sampler2D b1;uniform sampler2D b2;' +
  'uniform float k1;uniform float k2;uniform float vig;uniform float urgent;uniform float desat;' +"""),
    ("""  'float l=dot(c,vec3(.2126,.7152,.0722));c=mix(c,vec3(l),desat);' +
  'float n=fract(sin(dot(gl_FragCoord.xy+seed,vec2(12.9898,78.233)))*43758.5453);c+=(n-.5)*grain;' +""",
     """  'float l=dot(c,vec3(.2126,.7152,.0722));c=mix(c,vec3(l),desat);' +"""),
    ("""  /** 막판 테두리 틴트 0..1 */
  urgent: number;
  /** 그레인 진폭(HIGH 만 > 0) */
  grain: number;
}""",
     """  /** 막판 테두리 틴트 0..1 */
  urgent: number;
}"""),
    ("""        gl.uniform1f(u.desat!, p.desat);
        gl.uniform1f(u.grain!, p.grain);
        gl.uniform1f(u.seed!, (this.frames % 97) * 7.31);
      });""",
     """        gl.uniform1f(u.desat!, p.desat);
      });"""),
    ("""/** 회복(승격)에 필요한 연속 «깨끗한» 시간 */
const RECOVER_MS = 15000;""",
     """/** 회복(승격)에 필요한 연속 «깨끗한» 시간 */
const RECOVER_MS = 15000;
/** -24: 첫 승격(q1 시작 → q0)은 iOS 에서 3초 깨끗하면 — 보수적으로 시작하되 빨리 올린다. Android 는 프로브(1~4초)와 겹치지 않게 15초 유지. */
const FIRST_RECOVER_MS = 3000;"""),
    ("""      if (tierQ) this.q = +tierQ[1]!;
      else if (this.android) this.q = 1;
      if (this.q) console.info('[post] initial tier q' + this.q + (this.android ? ' (android)' : ' (forced)'));""",
     """      if (tierQ) this.q = +tierQ[1]!;
      else this.q = 1; // -24: 모든 플랫폼 q1 로 시작(보수적). iOS 는 3초 깨끗하면 q0, Android 는 15초.
      if (this.q) console.info('[post] initial tier q' + this.q + (tierQ ? ' (forced)' : this.android ? ' (android)' : ' (conservative start)'));"""),
    ("""    // 씬은 1:1 정확 복사(GL 캔버스 = scene 크기) — LINEAR 는 반텍셀 위상에서 흐려진다(네온 3차 규격)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);""",
     """    // 씬은 1:1 정확 복사(GL 캔버스 = scene 크기) — LINEAR 는 반텍셀 위상에서 흐려진다(네온 3차 규격).
    // -24 규칙: «정확히 1:1» 일 때만 NEAREST. 비율이 다르면 NEAREST 는 프레임마다 경계가 흔들린다 → LINEAR.
    const oneToOne = this.scene.width === this.glc.width && this.scene.height === this.glc.height;
    const filt = oneToOne ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
    this.sceneNearest = oneToOne;"""),
    ("""  /** 이번 프레임 scene 캔버스 DPR */
  sdpr = 1;""",
     """  /** 이번 프레임 scene 캔버스 DPR */
  sdpr = 1;
  /** scene 텍스처가 NEAREST 인가(1:1 일 때만 true — 계측용) */
  sceneNearest = false;"""),
    ("""        } else if (
          this.cleanMs >= RECOVER_MS &&
          this.q > 0 &&
          this.promos < MAX_PROMOS &&
          this.sinceChange >= RECOVER_MS
        ) {""",
     """        } else if (
          this.cleanMs >= this.recoverMs() &&
          this.q > 0 &&
          this.promos < MAX_PROMOS &&
          this.sinceChange >= this.recoverMs()
        ) {"""),
    ("""  /** 새 아레나: 창·세션 카운터 리셋. 단계(q)와 보험(autoOff)은 «유지» — 판 시작마다 화면이 튀지 않게. */
  resetWindow(): void {""",
     """  /** 승격에 필요한 연속 깨끗한 시간 — 첫 승격(iOS)만 3초, 그 뒤·Android 는 15초 */
  private recoverMs(): number {
    return !this.android && this.qChanges === 0 ? FIRST_RECOVER_MS : RECOVER_MS;
  }

  /** 새 아레나: 창·세션 카운터 리셋. 단계(q)와 보험(autoOff)은 «유지» — 판 시작마다 화면이 튀지 않게. */
  resetWindow(): void {"""),
    ("""    (window as unknown as { __tcgfx?: unknown }).__tcgfx = {
      android: this.android, sdprCap: this.android ? this.androidCap : IOS_SCENE_DPR_CAP, sdpr: this.sdpr,""",
     """    (window as unknown as { __tcgfx?: unknown }).__tcgfx = {
      android: this.android, sdprCap: this.android ? this.androidCap : IOS_SCENE_DPR_CAP, sdpr: this.sdpr, sceneNearest: this.sceneNearest, q: this.q,"""),
], 'FIRST_RECOVER_MS')

# ── render.ts ───────────────────────────────────────────────────────────────
patch('src/game/render.ts', [
    ("""import { NOISE, mkc } from './textures';""",
     """import { mkc } from './textures';"""),
    ("""  private postBaked = false;
  private bgNoisePat: CanvasPattern | null = null;
  private postNoisePat: CanvasPattern | null = null;
""",
     """  private postBaked = false;
  /** -24: HUD 층 캔버스(#tc-ov, 기기 DPR 그대로, AA) — 이름표·팝업 텍스트는 scene(블룸·업스케일 대상)에 두지 않는다 */
  private ovCv: HTMLCanvasElement | null = null;
  private ovc: CanvasRenderingContext2D | null = null;
  private ovDirty = false;
  private labels: { cv: HTMLCanvasElement; x: number; y: number; off: number }[] = [];
  /** -24: 스냅된 카메라 사상(세계 원점의 장치 픽셀 위치 · 대상 배율) — worldToScreen 이 같은 사상을 쓴다 */
  private camOx = 0;
  private camOy = 0;
  private camBase = 0;
"""),
    ("""  private lastS = 0;
  private hatchPats = new Map<string, CanvasPattern>();
  private terrGrad""",
     """  private lastS = 0;
  private terrGrad"""),
    ("""    this.bgc = this.bgCv.getContext('2d', { alpha: false })!;
    this.bgNoisePat = null;
    this.bgAge = 1e9;""",
     """    this.bgc = this.bgCv.getContext('2d', { alpha: false })!;
    this.bgAge = 1e9;"""),
    ("""      this.postc = this.postCv.getContext('2d')!;
      this.postNoisePat = null;
      this.postBaked = false;""",
     """      this.postc = this.postCv.getContext('2d')!;
      this.postBaked = false;"""),
    ("""    c.restore();

    if (!this.bgNoisePat) this.bgNoisePat = c.createPattern(NOISE, 'repeat');
    if (this.bgNoisePat) {
      c.save();
      c.globalAlpha = 0.022;
      c.globalCompositeOperation = 'overlay';
      c.fillStyle = this.bgNoisePat;
      c.fillRect(0, 0, w, h);
      c.restore();
    }
    this.bgAge = 0;""",
     """    c.restore();
    // -24: 배경 노이즈 오버레이(.022) 제거 — 「픽셀 단위 짜글짜글」(President iPhone). 평평한 면은 평평하게.
    this.bgAge = 0;"""),
    ("""    c.fillStyle = vg;
    c.fillRect(0, 0, w, h);
    if (!this.postNoisePat) this.postNoisePat = c.createPattern(NOISE, 'repeat');
    if (this.quality === 'HIGH' && this.postNoisePat) {
      c.save();
      c.globalAlpha = 0.025;
      c.fillStyle = this.postNoisePat;
      c.translate((Math.random() * 128) | 0, (Math.random() * 128) | 0);
      c.fillRect(-128, -128, w + 256, h + 256);
      c.restore();
    }
    this.postBaked = true;""",
     """    c.fillStyle = vg;
    c.fillRect(0, 0, w, h);
    // -24: 폴백 그레인 제거(그레인 0 규칙은 두 경로 공통)
    this.postBaked = true;"""),
    ("""        this.tcc = this.tcCv.getContext('2d')!;
        this.hatchPats.clear();
      }""",
     """        this.tcc = this.tcCv.getContext('2d')!;
      }"""),
    ("""  private hatchPat(ctx: CanvasRenderingContext2D, f: Faction): CanvasPattern | null {
    const key = f.id;
    const hit = this.hatchPats.get(key);
    if (hit) return hit;
    const s = 14;
    const c = mkc(s, s);
    const x = c.getContext('2d')!;
    x.translate(s / 2, s / 2);
    x.rotate((f.hatch * Math.PI) / 180);
    x.strokeStyle = 'rgba(255,255,255,.32)';
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(-s, 0);
    x.lineTo(s, 0);
    x.stroke();
    const p = ctx.createPattern(c, 'repeat');
    if (p) this.hatchPats.set(key, p);
    return p;
  }

""",
     """"""),
    ("""      c.fillStyle = dg;
      c.fillRect(wx, wy, ww, wh);
      // 해치(색각 보조 + 마이크로 텍스처) — 캐시라서 등급 무관
      const hp = this.hatchPat(c, f);
      if (hp) {
        c.globalAlpha = lowQ ? 0.06 : 0.085;
        c.scale(1 / S, 1 / S);
        c.fillStyle = hp;
        c.fillRect(wx * S, wy * S, ww * S, wh * S);
        c.globalAlpha = 1;
      }
      c.restore();""",
     """      c.fillStyle = dg;
      c.fillRect(wx, wy, ww, wh);
      // -24: 해치(1px/14px 마이크로 텍스처) 제거 — 카메라 이동 중 재보간돼 «픽셀 단위 짜글거림»이 됐다(President iPhone). 평평한 면은 평평하게.
      c.restore();"""),
    ("""      this.post!.end(this.bloomCv, {
        desat: Math.min(0.85, w.desat * 0.7),
        urgent,
        grain: this.quality === 'HIGH' ? 0.05 : 0,
      });""",
     """      this.post!.end(this.bloomCv, {
        desat: Math.min(0.85, w.desat * 0.7),
        urgent,
      });"""),
    # 카메라: 스냅
    ("""  // ── 좌표 변환 ────────────────────────────────────────────────────────────
  worldToScreen(x: number, y: number): Vec2 {
    const s = this.cam.scale * (1 + this.cam.punch);
    return {
      x: this.vw / 2 + (x - this.cam.x) * s,
      y: this.vh / 2 + (y - this.cam.y) * s,
    };
  }

  private applyCamera(ctx: CanvasRenderingContext2D, base: number): void {
    const s = this.cam.scale * (1 + this.cam.punch);
    ctx.setTransform(base, 0, 0, base, 0, 0);
    ctx.translate(this.vw / 2, this.vh / 2);
    if (this.shakeAmp > 0.15) {
      ctx.translate(rnd(-1, 1) * this.shakeAmp, rnd(-1, 1) * this.shakeAmp);
    }
    ctx.rotate(this.cam.tilt);
    ctx.scale(s, s);
    ctx.translate(-this.cam.x, -this.cam.y);
  }""",
     """  // ── 좌표 변환 ────────────────────────────────────────────────────────────
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
  }"""),
    ("""    this.dpr = dpr;
    this.postBaked = false;
    this.tcValid = false;
    this.cam.scale = Math.min(vw, vh) / (26 * CELL);""",
     """    this.dpr = dpr;
    this.postBaked = false;
    this.tcValid = false;
    this.cam.scale = this.quantScale(Math.min(vw, vh) / (26 * CELL));"""),
    ("""    const s0 = Math.min(this.vw, this.vh) / (26 * CELL);
    const wantScale = p.bounce ? s0 * 0.86 : s0;
    this.cam.scale += (wantScale - this.cam.scale) * Math.min(1, dt * 3.6);
    this.cam.punch *= Math.pow(0.005, dt);""",
     """    const s0 = Math.min(this.vw, this.vh) / (26 * CELL);
    const wantScale = this.quantScale(p.bounce ? s0 * 0.86 : s0);
    this.cam.scale += (wantScale - this.cam.scale) * Math.min(1, dt * 3.6);
    // 목표에 충분히 가까우면 «정확히» 목표로 — 영토 캐시가 정확한 1:1 로 blit 된다(0.2% 어긋남도 매 프레임 재보간이다)
    if (Math.abs(wantScale - this.cam.scale) < wantScale * 0.002) this.cam.scale = wantScale;
    this.cam.punch *= Math.pow(0.005, dt);
    if (this.cam.punch < 1e-4) this.cam.punch = 0;"""),
    ("""    const k = 1 - Math.pow(1 - 0.12, dt * 60);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    const wantTilt = (-p.roll / 26) * 0.0105;
    this.cam.tilt += (wantTilt - this.cam.tilt) * Math.min(1, dt * 3);
  }""",
     """    const k = 1 - Math.pow(1 - 0.12, dt * 60);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    // -24: 기울임 0 (applyCamera 주석 참조). 필드는 가시 사각형 계산 호환을 위해 남긴다.
    this.cam.tilt = 0;
  }"""),
    # 캐시 안정 판정
    ("""    const [c0, c1, r0, r1] = this.visibleBox();
    const stable = Math.abs(S - this.lastS) < 0.004 * S;
    this.lastS = S;
    const dimsChanged = this.tcCols !== COLS || this.tcRows !== ROWS;
    const scaleOff = Math.abs(S / this.tcS - 1);
    const needRealloc =
      !this.tcValid ||
      dimsChanged ||
      scaleOff > 0.25 ||
      (scaleOff > 0.04 && stable) ||""",
     """    const [c0, c1, r0, r1] = this.visibleBox();
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
      (scaleOff > 0.0005 && stable) ||"""),
    # 파티클 상한
    ("""    return this.quality === 'HIGH' ? 1400 : this.quality === 'MID' ? 800 : 320;""",
     """    // -24: 상한 1400/800 → 900/500 (렉)
    return this.quality === 'HIGH' ? 900 : this.quality === 'MID' ? 500 : 320;"""),
    # HUD 층 생성
    ("""    const p = new PostFx();
    if (p.init(host)) {
      this.post = p;
      console.log('[render] post-process: WebGL bloom ON');
      return true;
    }""",
     """    const p = new PostFx();
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
    }"""),
    ("""  setPostLayerVisible(v: boolean): void {
    this.post?.setVisible(v);""",
     """  /** diag: 이번 프레임의 2D 씬 캔버스(지글거림 프로브가 getImageData 로 읽는다) */
  sceneCanvas(): HTMLCanvasElement {
    return this.usingPost && this.post ? this.post.scene : this.g.canvas;
  }

  setPostLayerVisible(v: boolean): void {
    this.post?.setVisible(v);
    if (this.ovCv) {
      const want = v ? '' : 'none';
      if (this.ovCv.style.display !== want) this.ovCv.style.display = want;
    }"""),
    # draw(): HUD 층 준비 + 팝업/이름표
    ("""    const bl = this.bl;
    bl.setTransform(1, 0, 0, 1, 0, 0);
    bl.globalCompositeOperation = 'source-over';
    bl.globalAlpha = 1;
    bl.clearRect(0, 0, this.bloomCv.width, this.bloomCv.height);
    const bscale = base / 4;""",
     """    const bl = this.bl;
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
    this.labels.length = 0;"""),
    ("""    if (sc) {
      this.drawPops(g, dtReal);
      const urgent = this.urgentLevel(w);""",
     """    if (sc) {
      if (ov) this.drawOverlay(ov, dtReal);
      else this.drawPops(g, dtReal);
      const urgent = this.urgentLevel(w);"""),
    # 이름표: HUD 층으로
    ("""      const s = this.cam.scale;
      const key = (u.kind === 'ghost' ? 'g:' : 'n:') + u.name;
      let cv = this.labelCv.get(key);
      if (!cv || this.labelScale !== this.base) {
        if (this.labelScale !== this.base) {
          this.labelCv.clear();
          this.labelScale = this.base;
        }
        const k = this.base;
        const mc = mkc(2, 2);""",
     """      const s = this.cam.scale;
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
        const mc = mkc(2, 2);"""),
    ("""        cv = mc;
        this.labelCv.set(key, cv);
        this.labelW.set(u.name, tw);
      }
      const k = this.base;
      const lw = cv.width / k;
      const lh = cv.height / k;
      g.save();
      g.scale(1 / s, 1 / s);
      g.drawImage(cv, Math.round(u.x * s - lw / 2), Math.round(u.y * s - C * s * 1.15 - 15), lw, lh);
      g.restore();
    }""",
     """        cv = mc;
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
    }"""),
    ("""  private drawPops(g: CanvasRenderingContext2D, dt: number): void {""",
     """  /** -24: HUD 층 — 이름표(정수 장치 픽셀 1:1 blit) + 팝업(기기 DPR 벡터 텍스트) */
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

  private drawPops(g: CanvasRenderingContext2D, dt: number): void {"""),
], 'drawOverlay(')

# ── index.ts (diag 만) ───────────────────────────────────────────────────────
patch('src/game/index.ts', [
    ("""      cam: () => renderer.camPos(),""",
     """      cam: () => renderer.camPos(),
      scene: () => renderer.sceneCanvas(),"""),
], 'renderer.sceneCanvas()')

# ── DESIGN.md ────────────────────────────────────────────────────────────────
patch('DESIGN.md', [
    ("""- 배경은 순수 검정 금지(#05060B 계열). 미점령 셀 `void-2` 55%, 바닥 `void-1→void-0` 세로 그라디언트 + 오로라 3겹 + 심해 어둠 + 노이즈.""",
     """- 배경은 순수 검정 금지(#05060B 계열). 미점령 셀 `void-2` 25%, 바닥 `void-1→void-0` 세로 그라디언트 + 오로라 3겹(.15) + 심해 어둠. **노이즈·그레인·디더링 0** (-24: «평평한 면은 평평하게» — 기기 픽셀 단위 잡음은 iPhone 에서 「짜글짜글」로 보였다)."""),
    ("""  TOXIN .45 / AURORA .24 / EMBER .16 / VIOLET .13). 10종(3·5분 모드)은 팩션별 **해치 각도**(hatch)가 색을 보조한다 —
  영토가 캐시에 구워지므로 해치의 매 프레임 비용은 0 이다.""",
     """  TOXIN .45 / AURORA .24 / EMBER .16 / VIOLET .13). 10종(3·5분 모드)의 팩션별 해치(hatch)는 -24 에서 **제거** — 1px/14px
  마이크로 텍스처가 카메라 이동 중 재보간돼 「픽셀 단위 짜글거림」이 됐다. 구분은 명도 사다리 + 림 색으로만 한다."""),
    ("""- 두 겹: 1/4 해상도(타이트 .72) + 1/8(와이드 .50), 가산. 비네트(.5)·막판 테두리 틴트·채도하강·그레인(.05, HIGH)은 같은
  합성 셰이더의 유니폼 — 풀스크린 캔버스 패스 0.""",
     """- 두 겹: 1/4 해상도(타이트 .45) + 1/8(와이드 .15), 가산. 비네트(.25)·막판 테두리 틴트·채도하강은 같은 합성 셰이더의
  유니폼 — 풀스크린 캔버스 패스 0. **그레인 없음**(-24). emissive 에는 «채움»을 넣지 않는다(림·꼬리·유닛·파티클만, -23).
- **픽셀 위상 규율(-24)**: 세계 원점은 «정수 장치 픽셀»에 스냅, 셀 한 변은 «정수 픽셀»로 배율 양자화, 카메라 기울임 0,
  영토 캐시는 배율이 정확히 안정되면 0.05% 어긋남에도 재굽기 → 캐시 blit·격자 타일·림 코어가 프레임마다 재보간되지 않는다.
  scene→GL 은 정확히 1:1 일 때만 NEAREST(아니면 LINEAR). 텍스트(이름표·팝업)는 HUD 층 `#tc-ov`(기기 DPR, AA)에 — scene 에 두지 않는다.
- **해상도(-24)**: iOS scene DPR 2 (HUD 층 3) · Android 2 시작→프로브 실패 시 다음 런 1.5. 동적 품질은 «q1 로 시작», iOS 3초 깨끗하면 q0
  (Android 15초), 파티클 상한 900/500/320."""),
    ("""| 해치 | 팩션 각도, 1px/14px, 8.5%(LOW 6%) |
""",
     """"""),
    ("""| emissive(1/4) | 림 glow CELL·0.55 80% + 내부 6% |""",
     """| emissive(1/4) | 림 glow CELL·0.55 80% (내부 채움 없음, -23) |"""),
    ("""  카메라 이탈 시 자기복사 + 드러난 띠 / 배율 4% 이상 «안정» 변화 시 전체.""",
     """  카메라 이탈 시 자기복사 + 드러난 띠 / 배율이 «정확히» 안정된 뒤 0.05% 이상 어긋나면 전체(-24)."""),
], '픽셀 위상 규율(-24)')
print('done')
