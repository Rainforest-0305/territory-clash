# -*- coding: utf-8 -*-
"""
네온 깜빡임 원인 확정(2026-08-30 03:5x 코디네이터) 반영 — 수정 규격:
  · 문턱은 다운샘플 «전» 텍셀 각각 + soft-knee  → 이 게임은 bright-pass 자체가 없다(emissive 명시 버퍼, 문턱 0).
    다운샘플(FS_DOWN 2×2)은 «평균만»(선형) — 위상 무관. 합성 soft-knee 는 이미 있음.
  · precision highp(지원 시 #ifdef GL_FRAGMENT_PRECISION_HIGH)  → 3개 프래그먼트 셰이더 전부.
  · 런 중 DPR 고정 → 이미 반영(budgetDpr 는 (w,h,dpr) 만의 함수).
검증용(diag 전용, 기본 URL 비용 0):
  · ?adapt=0 → post 동적 단계·보험 off(품질 전환 0 조건)   · ?parts=0 → 파티클 생성 0(림·트레일·머리만 남겨 위상 깜빡임 격리)
  · post.probe=true 면 end() 에서 a1(1/4) FBO readPixels → 프레임별 블룸 에너지 로그 [tierMs, energy, k1, k2, q]
멱등.
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
            raise SystemExit(rel + ' anchor x' + str(s.count(a)) + ': ' + a[:120])
        s = s.replace(a, b)
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
    print('patched', rel, len(pairs))

patch('src/game/post.ts', [
    ("""const VS = 'attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}';""",
     """const VS = 'attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}';
/* 프래그먼트 정밀도 highp(지원 시). 네온 3차 실측: iOS(Apple GPU) mediump=fp16 이라 텍셀 좌표가 양자화돼
   얇은 선 샘플이 위치마다 흔들렸다. 이 게임의 영역 경계선(2~4텍셀)·꼬리선이 정확히 그 조건이다. */
const PREC = '#ifdef GL_FRAGMENT_PRECISION_HIGH\\nprecision highp float;\\n#else\\nprecision mediump float;\\n#endif\\n';"""),
    ("""const FS_BLUR =
  'precision mediump float;varying vec2 v;""",
     """const FS_BLUR =
  PREC +
  'varying vec2 v;"""),
    ("""const FS_DOWN =
  'precision mediump float;varying vec2 v;""",
     """/* ★문턱 없음 — 순수 2×2 평균(선형). 문턱이 있었다면 «다운샘플 전 텍셀 각각»에 걸어야 한다(네온 -22 깜빡임 원인). */
const FS_DOWN =
  PREC +
  'varying vec2 v;"""),
    ("""const FS_COMP =
  'precision mediump float;varying vec2 v;""",
     """const FS_COMP =
  PREC +
  'varying vec2 v;"""),
    ("""      const tierQ = /[?&]tier=([012])\\b/.exec(location.search);""",
     """      if (/[?&]adapt=0\\b/.test(location.search)) {
        this.adaptive = false;
        this.auto = false;
        console.info('[post] adaptive tiers + fuse disabled by ?adapt=0');
      }
      const tierQ = /[?&]tier=([012])\\b/.exec(location.search);"""),
    ("""  /** Android UA (기본 단계 q1) */
  android = false;""",
     """  /** Android UA (기본 단계 q1) */
  android = false;
  /** 깜빡임 프로브(diag 전용): end() 마다 a1 FBO 를 읽어 블룸 에너지를 기록한다. readPixels 는 동기 스톨 — 계측에만 쓴다. */
  probe = false;
  readonly energyLog: number[][] = [];
  private probeBuf: Uint8Array | null = null;"""),
    ("""    this.frames++;
  }""",
     """    if (this.probe) this.readEnergy();
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
  }"""),
], 'GL_FRAGMENT_PRECISION_HIGH')

patch('src/game/render.ts', [
    ("""  private partCap(): number {
    return this.quality === 'HIGH' ? 1400 : this.quality === 'MID' ? 800 : 320;
  }""",
     """  private partCap(): number {
    if (this.partsOff) return 0;
    return this.quality === 'HIGH' ? 1400 : this.quality === 'MID' ? 800 : 320;
  }
  /** ?parts=0 — 파티클 생성 0(깜빡임 프로브에서 림·트레일·머리 발광만 격리) */
  private partsOff = false;"""),
    ("""    this.diagOn = sp.get('diag') === '1';
    {""",
     """    this.diagOn = sp.get('diag') === '1';
    this.partsOff = sp.get('parts') === '0';
    {"""),
], 'partsOff')

patch('src/game/index.ts', [
    ("""      canvas: () => ({ w: canvas.width, h: canvas.height, dpr, res: renderer.resScale }),""",
     """      canvas: () => ({ w: canvas.width, h: canvas.height, dpr, res: renderer.resScale }),
      probe: (on: boolean) => {
        if (renderer.post) renderer.post.probe = on;
      },
      energy: () => (renderer.post ? renderer.post.energyLog : []),
      cam: () => renderer.camPos(),"""),
], 'energyLog')

patch('src/game/render.ts', [
    ("""  // ── 좌표 변환 ────────────────────────────────────────────────────────────""",
     """  /** diag: 카메라 위치(프로브가 «이동 중» 프레임만 고르는 데 쓴다) */
  camPos(): { x: number; y: number; s: number } {
    return { x: this.cam.x, y: this.cam.y, s: this.cam.scale };
  }

  // ── 좌표 변환 ────────────────────────────────────────────────────────────"""),
], 'camPos()')
