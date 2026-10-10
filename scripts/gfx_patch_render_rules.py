# -*- coding: utf-8 -*-
"""
2026-08-30 추가 규칙 — render.ts / index.ts 소폭 패치 (post.ts 패치 뒤에 실행).
  python scripts/gfx_patch_render_rules.py
  · 규칙 3: 폴백 적응해상도(resStep→resize)는 «플레이 중» 적용 금지 — phase 가 play 가 아닐 때만 소비
  · 규칙 4: 후처리 on 인데 #stage 에 그린 프레임 수(stageDraws) · GL 합성이 같은 draw() 안에서 안 끝난 프레임 수(layerLag) 계측
  · 규칙 2: 페이드 시간 진행 post.tick()
  · diag: tierMs / promos / fading 노출
멱등.
"""
import io, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

def patch(rel, pairs):
    p = os.path.join(ROOT, rel)
    s = io.open(p, encoding='utf-8').read()
    if pairs[0][1] in s:
        print('already patched', rel); return
    for a, b in pairs:
        if s.count(a) != 1:
            raise SystemExit(rel + ' anchor x' + str(s.count(a)) + ': ' + a[:120])
        s = s.replace(a, b)
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
    print('patched', rel, len(pairs))

patch('src/game/render.ts', [
    ("""  readonly stats = { n: 0, bg: 0, grid: 0, cache: 0, terr: 0, trails: 0, units: 0, parts: 0, post: 0, bakes: 0, bakeMs: 0, shifts: 0, reallocs: 0, maxBake: 0 };""",
     """  readonly stats = { n: 0, bg: 0, grid: 0, cache: 0, terr: 0, trails: 0, units: 0, parts: 0, post: 0, bakes: 0, bakeMs: 0, shifts: 0, reallocs: 0, maxBake: 0, stageDraws: 0, glFrames: 0, layerLag: 0 };
  /** 마지막 draw() 의 세계 국면 — 폴백 적응해상도를 «플레이 중» 적용하지 않기 위해 */
  private phase = 'none';"""),
    ("""  consumeResDirty(): boolean {
    if (!this.resDirty) return false;
    this.resDirty = false;
    return true;
  }""",
     """  /**
   * 폴백 경로 적응해상도 적용 요청. ★플레이 중엔 «내주지 않는다»(2026-08-30 규칙 3: DPR/캔버스 크기는
   * 플레이 중 불변 — 네온 -22 깜빡임 사후분석). 결과 화면·메뉴에서 캔버스를 다시 잡는다.
   */
  consumeResDirty(): boolean {
    if (!this.resDirty || this.phase === 'play') return false;
    this.resDirty = false;
    return true;
  }"""),
    ("""    this.lastDt = dtReal;
    this.sampleQuality(dtReal);""",
     """    this.lastDt = dtReal;
    this.phase = w.phase;
    this.post?.tick(dtReal * 1000);
    this.sampleQuality(dtReal);"""),
    ("""    if (sc) {
      this.drawPops(g, dtReal);
      const urgent = this.urgentLevel(w);
      this.post!.end(this.bloomCv, {
        desat: Math.min(0.85, w.desat * 0.7),
        urgent,
        grain: this.quality === 'HIGH' ? 0.05 : 0,
      });
    } else {""",
     """    if (sc) {
      this.drawPops(g, dtReal);
      const urgent = this.urgentLevel(w);
      const fb = D ? this.post!.frames : 0;
      this.post!.end(this.bloomCv, {
        desat: Math.min(0.85, w.desat * 0.7),
        urgent,
        grain: this.quality === 'HIGH' ? 0.05 : 0,
      });
      if (D) {
        // 층 간 지연 실측: GL 합성이 «이 draw() 안에서» 끝나지 않은 프레임 수(기대 0)
        st.glFrames++;
        if (this.post!.frames !== fb + 1) st.layerLag++;
      }
    } else {
      // 후처리가 살아 있는데 #stage 에 그린 프레임(같은 오브젝트 두 층 — 기대 0)
      if (D && this.post && this.post.on && !this.post.lost) st.stageDraws++;"""),
])

patch('src/game/index.ts', [
    ("""          ? { supported: p.supported, on: p.on, q: p.q, sdpr: p.sdpr, frames: p.frames, autoOff: p.autoOff, qlog: p.qlog }""",
     """          ? {
              supported: p.supported,
              on: p.on,
              q: p.q,
              sdpr: p.sdpr,
              frames: p.frames,
              autoOff: p.autoOff,
              qlog: p.qlog,
              tierMs: p.tierMs,
              promos: p.promos,
              fading: p.fading,
              sceneW: p.scene.width,
              sceneH: p.scene.height,
            }"""),
    ("""      quality: () => renderer.quality,
      stats: () => renderer.stats,""",
     """      quality: () => renderer.quality,
      stats: () => renderer.stats,
      canvas: () => ({ w: canvas.width, h: canvas.height, dpr, res: renderer.resScale }),"""),
])
