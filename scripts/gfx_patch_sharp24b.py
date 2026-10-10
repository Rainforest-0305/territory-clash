# -*- coding: utf-8 -*-
"""
-24 2단. gfx_patch_sharp24.py 위에 적용, 멱등.
  · 계측 정합: sceneNearest 는 alloc 뒤에야 확정 → alloc 뒤 publishGfxDiag
  · 줌 펀치를 설계대로 «0.2초»에 끝낸다 — 예전 감쇠(~1초)는 그동안 배율이 비정수라 영토 캐시가 매 프레임 재보간됐다(지글거림 프로브 실측)
  · camPos 에 punch 노출(프로브가 «정상 상태» 프레임만 따로 본다)
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

patch('src/game/post.ts', [
    ("""    if (this.W !== W || this.H !== H) this.alloc(W, H);
    if (this.glc.style.visibility !== 'visible') this.glc.style.visibility = 'visible';""",
     """    if (this.W !== W || this.H !== H) {
      this.alloc(W, H);
      this.publishGfxDiag(); // sceneNearest 는 alloc 뒤에야 확정된다
    }
    if (this.glc.style.visibility !== 'visible') this.glc.style.visibility = 'visible';"""),
], 'sceneNearest 는 alloc 뒤에야')

patch('src/game/render.ts', [
    ("""    this.cam.punch *= Math.pow(0.005, dt);
    if (this.cam.punch < 1e-4) this.cam.punch = 0;""",
     """    // 줌 펀치는 설계대로 «0.2초»에 끝낸다(예전 감쇠는 ~1초 — 그동안 배율이 비정수라 캐시가 매 프레임 재보간됐다)
    this.cam.punch *= Math.pow(0.005, dt * 4);
    if (this.cam.punch < 3e-4) this.cam.punch = 0;"""),
    ("""  camPos(): { x: number; y: number; s: number } {
    return { x: this.cam.x, y: this.cam.y, s: this.cam.scale };
  }""",
     """  camPos(): { x: number; y: number; s: number; punch: number } {
    return { x: this.cam.x, y: this.cam.y, s: this.cam.scale, punch: this.cam.punch };
  }"""),
], '설계대로 «0.2초»')
print('done')
