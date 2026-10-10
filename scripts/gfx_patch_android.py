# -*- coding: utf-8 -*-
"""
안드로이드 특화(2026-08-30 03:10 President 「안드로이드 프레임 수 떨어짐」) — post.ts / render.ts 패치. 멱등.
  ① post.ts: Android UA 면 «기본 q1» 로 시작(보수적). 승격은 히스테리시스 규칙 그대로(깨끗한 15s, 세션 ≤2회).
  ② render.ts: #stage(폴백·스플래시) 백버퍼 DPR 상한 2(resBase) — index.ts resize() 는 보호 함수라 renderer.resScale 로 건다.
  ③ render.ts: 봇 이름표 fillText → 스프라이트 캐시(이름당 1회 렌더, 매 프레임 drawImage 1회).
  ④ render.ts: 스러스터 3겹 save/gCO/restore ×3 → 1회.
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
    ("""      if (/[?&]autooff=0\\b/.test(location.search)) this.auto = false;""",
     """      if (/[?&]autooff=0\\b/.test(location.search)) this.auto = false;
      /* 안드로이드(Chromium 웹뷰·저가 GPU)는 «q1 에서 시작»한다 — iOS 와 반대로 보수적. 15초 깨끗하면 q0 으로
         올라간다(세션당 ≤2회). ?tier=0|1|2 로 강제(계측용). 실기기 판정 2026-08-30: 라이브부터 안드로이드 프레임 저하. */
      const tierQ = /[?&]tier=([012])\\b/.exec(location.search);
      this.android = /Android/i.test(navigator.userAgent);
      if (tierQ) this.q = +tierQ[1]!;
      else if (this.android) this.q = 1;
      if (this.q) console.info('[post] initial tier q' + this.q + (this.android ? ' (android)' : ' (forced)'));"""),
    ("""  /** 세션(아레나) 경과 ms — 플레이 중 프레임만 누적 */
  tierMs = 0;""",
     """  /** 세션(아레나) 경과 ms — 플레이 중 프레임만 누적 */
  tierMs = 0;
  /** Android UA (기본 단계 q1) */
  android = false;"""),
], 'this.android = /Android/i')

patch('src/game/render.ts', [
    # ② resBase
    ("""  resScale = 1;
  private resStep = 0;""",
     """  /** #stage 백버퍼 배율(index.ts resize 가 dpr 에 곱한다). resBase 로 DPR 상한 2 를 건다 — 저가 안드로이드 dpr 2.6~3 에서
      스플래시·폴백 캔버스가 화면 픽셀의 1.7~2.3배를 채우지 않게. GL 경로의 scene DPR 은 post.ts 예산(1.5)이 따로 쥔다. */
  resScale = 1;
  private resBase = 1;
  private resStep = 0;"""),
    ("""    const sp = new URLSearchParams(location.search);
    this.diagOn = sp.get('diag') === '1';""",
     """    const sp = new URLSearchParams(location.search);
    this.diagOn = sp.get('diag') === '1';
    {
      const d = Math.min(window.devicePixelRatio || 1, 3);
      this.resBase = d > 2 ? 2 / d : 1;
      this.resScale = this.resBase;
    }"""),
    ("""        this.resScale = RES_STEPS[this.resStep]!;""",
     """        this.resScale = RES_STEPS[this.resStep]! * this.resBase;"""),
    # ③ label sprite cache
    ("""  private labelW = new Map<string, number>();""",
     """  private labelW = new Map<string, number>();
  /** 봇 이름표 스프라이트(이름당 1회 렌더 — 텍스트는 «변할 때만» 그린다) */
  private labelCv = new Map<string, HTMLCanvasElement>();
  private labelScale = 0;"""),
    ("""    if (!isPlayer) {
      const s = this.cam.scale;
      g.save();
      g.scale(1 / s, 1 / s);
      const sx = u.x * s;
      const sy = u.y * s;
      g.font = '700 11px ' + HUD_FONT;
      g.textAlign = 'center';
      let tw = this.labelW.get(u.name);
      if (tw === undefined) {
        tw = g.measureText(u.name).width + 12;
        this.labelW.set(u.name, tw);
      }
      g.fillStyle = 'rgba(5,6,11,0.6)';
      roundRect(g, sx - tw / 2, sy - C * s * 1.15 - 13, tw, 16, 8);
      g.fill();
      g.fillStyle = u.kind === 'ghost' ? PAL.ink1 : PAL.ink0;
      g.fillText(u.name, sx, sy - C * s * 1.15 - 1);
      g.restore();
    }""",
     """    if (!isPlayer) {
      // 이름표: 스프라이트 캐시(대상 픽셀 배율 base 로 1회 렌더) → 매 프레임 drawImage 1회. fillText 는 이름당 1회.
      const s = this.cam.scale;
      const key = (u.kind === 'ghost' ? 'g:' : 'n:') + u.name;
      let cv = this.labelCv.get(key);
      if (!cv || this.labelScale !== this.base) {
        if (this.labelScale !== this.base) {
          this.labelCv.clear();
          this.labelScale = this.base;
        }
        const k = this.base;
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
      const k = this.base;
      const lw = cv.width / k;
      const lh = cv.height / k;
      g.save();
      g.scale(1 / s, 1 / s);
      g.drawImage(cv, Math.round(u.x * s - lw / 2), Math.round(u.y * s - C * s * 1.15 - 15), lw, lh);
      g.restore();
    }"""),
    # ④ thruster gCO churn
    ("""    const len = (0.5 + u.speedView * 1.1) * C * (1 + Math.sin(this.t * 30) * 0.12);
    for (let i = 2; i >= 0; i--) {
      const L = len * [0.3, 0.65, 1.0][i]!;
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = [0.85, 0.55, 0.25][i]! * blink;
      g.fillStyle = ['#FFFFFF', f.s0, f.glow][i]!;
      g.beginPath();
      g.ellipse(-0.55 * C - L / 2, 0, Math.max(0.01, L / 2), C * (0.18 - i * 0.03), 0, 0, 7);
      g.fill();
      g.restore();
    }""",
     """    const len = (0.5 + u.speedView * 1.1) * C * (1 + Math.sin(this.t * 30) * 0.12);
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
    g.globalAlpha = blink;"""),
    ("""const SHAKE_SCALE_DEFAULT = 0;""",
     """const SHAKE_SCALE_DEFAULT = 0;
/** 스러스터 3겹 길이·알파(할당 0) */
const THR_LEN = [0.3, 0.65, 1.0] as const;
const THR_ALPHA = [0.85, 0.55, 0.25] as const;"""),
], 'labelCv')
