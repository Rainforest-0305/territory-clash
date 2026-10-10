# -*- coding: utf-8 -*-
"""
-23 3단 (President 「안드로이드도 개선하는 거야?」). sharp23 · sharp23b 위에 적용, 멱등.
  Android scene DPR: 1.5 고정 → «기기 DPR 상한 2 로 시작», 첫 프로브(워밍업 1초 제외, 이후 3초 프레임타임 p95 > 20ms) 면
  localStorage `tc_gfx_android_sdpr=1.5` 를 남겨 «다음 런부터 1.5». 성능 되는 기기는 선명하게, 저가 기기만 1.5.
  블룸 채움 제외·격자/비네트 하향·NEAREST 는 이미 두 플랫폼 공통(render/post 공용 경로).
  계측: window.__tcgfx = { android, sdprCap, sdpr, probeP95, probeN, fallback } · ?sdpr= 강제는 유지.
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
    ("""const IOS_SCENE_DPR_CAP = """,
     """/** -23 3단: Android scene DPR 시작 상한(2) · 저가 기기 폴백(1.5) · 폴백 기록 키 · 프로브 임계(p95 ms) */
const ANDROID_SDPR_START = 2;
const ANDROID_SDPR_FALLBACK = 1.5;
const ANDROID_SDPR_KEY = 'tc_gfx_android_sdpr';
const ANDROID_PROBE_P95_MS = 20;
const IOS_SCENE_DPR_CAP = """),
    ("""  android = false;""",
     """  android = false;
  /** Android scene DPR 상한(2 시작, 프로브 실패 기록이 있으면 1.5) */
  androidCap = ANDROID_SDPR_START;
  private probeLast = 0;
  private probeStart = 0;
  private probeDone = false;
  private probeT: number[] = [];
  probeP95 = 0;"""),
    ("""      this.android = /Android/i.test(navigator.userAgent);""",
     """      this.android = /Android/i.test(navigator.userAgent);
      if (this.android) {
        try {
          if (localStorage.getItem(ANDROID_SDPR_KEY) === String(ANDROID_SDPR_FALLBACK)) this.androidCap = ANDROID_SDPR_FALLBACK;
        } catch (_) {}
        console.info('[post] android scene dpr cap', this.androidCap);
      }
      this.publishGfxDiag();"""),
    ("""    if (!this.android) return Math.min(dpr, IOS_SCENE_DPR_CAP);
    const cap0 = w * h * Math.min(dpr, 2) * Math.min(dpr, 2) > 1000000 ? 1.5 : 2;
    return Math.min(dpr, cap0);
  }""",
     """    if (!this.android) return Math.min(dpr, IOS_SCENE_DPR_CAP);
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
      android: this.android, sdprCap: this.android ? this.androidCap : IOS_SCENE_DPR_CAP, sdpr: this.sdpr,
      probeP95: this.probeP95, probeN: this.probeT.length, probeDone: this.probeDone, fallback,
    };
  }"""),
    ("""    const sd = this.budgetDpr(w, h, dpr);
    this.sdpr = sd;""",
     """    const sd = this.budgetDpr(w, h, dpr);
    if (this.sdpr !== sd) { this.sdpr = sd; this.publishGfxDiag(); } else this.sdpr = sd;
    if (this.android && !this.probeDone) this.probeFrame();"""),
    ("""  budgetDpr(w: number, h: number, dpr: number): number {""",
     """  budgetDpr(_w: number, _h: number, dpr: number): number {"""),
], 'ANDROID_SDPR_KEY')
