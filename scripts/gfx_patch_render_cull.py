# -*- coding: utf-8 -*-
"""
가시영역 컬링 — 유닛·트레일 (2026-08-30, 규칙 반영 뒤 CPU 8× 실측에서 drawUnits 가 프레임의 1/3 이었다).
300초 모드 아레나 92×161 셀 중 화면은 ≈26×56 셀(9%) — 봇 9마리와 트레일 대부분이 화면 밖인데 매 프레임
스러터 3겹·스프라이트 2장·이름표(fillText)·트레일 5스트로크를 그리고 있었다. 화면 밖이면 건너뛴다.
렌더 전용 — 시뮬·판정은 모른다. 멱등.
"""
import io, os
HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(os.path.dirname(HERE), 'src', 'game', 'render.ts')
s = io.open(P, encoding='utf-8').read()
if 'visX0' in s:
    print('already'); raise SystemExit(0)

def rep(a, b):
    global s
    assert s.count(a) == 1, a[:120]
    s = s.replace(a, b)

rep("""  /** 마지막 draw() 의 세계 국면 — 폴백 적응해상도를 «플레이 중» 적용하지 않기 위해 */
  private phase = 'none';""",
"""  /** 마지막 draw() 의 세계 국면 — 폴백 적응해상도를 «플레이 중» 적용하지 않기 위해 */
  private phase = 'none';
  /** 이번 프레임 가시 월드 사각형(+여유) — 유닛·트레일 컬링 */
  private visX0 = -1e9;
  private visY0 = -1e9;
  private visX1 = 1e9;
  private visY1 = 1e9;""")

rep("""    const S = this.cam.scale * (1 + this.cam.punch) * base;

    const D = this.diagOn;""",
"""    const S = this.cam.scale * (1 + this.cam.punch) * base;
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

    const D = this.diagOn;""")

# drawTrails: bbox 먼저, 교차 없으면 스킵
rep("""      const f = faction(u.id);
      const pts = u.pts;
      const trace = (ctx: CanvasRenderingContext2D) => {""",
"""      const pts = u.pts;
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
      const trace = (ctx: CanvasRenderingContext2D) => {""")
rep("""      bl.restore();
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
      const pad = CELL * 1.1;""",
"""      bl.restore();
      const pad = CELL * 1.1;""")

# drawUnits: 화면 밖 스킵
rep("""    for (const u of w.units) {
      if (!u.alive || u.respawn > 0) continue;
      this.drawSkiff(g, bl, u, w);
    }""",
"""    for (const u of w.units) {
      if (!u.alive || u.respawn > 0) continue;
      if (u.x < this.visX0 || u.x > this.visX1 || u.y < this.visY0 || u.y > this.visY1) continue;
      this.drawSkiff(g, bl, u, w);
    }""")
io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
print('patched cull')
