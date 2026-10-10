# -*- coding: utf-8 -*-
"""파티클 emissive: 파티클마다 bl.save/gCO/restore → 루프 밖 1회 (드로우콜 계수: gco 59/frame·save 84/frame 의 대부분). 멱등."""
import io, os
P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src', 'game', 'render.ts')
s = io.open(P, encoding='utf-8').read()
if 'bl.globalCompositeOperation = \'lighter\';\n    bl.globalAlpha = 1;\n    for (let i = this.parts.length - 1' in s:
    print('already'); raise SystemExit(0)
a = """  private drawParticles(g: CanvasRenderingContext2D, bl: CanvasRenderingContext2D, dt: number): void {
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    for (let i = this.parts.length - 1; i >= 0; i--) {"""
b = """  private drawParticles(g: CanvasRenderingContext2D, bl: CanvasRenderingContext2D, dt: number): void {
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    // emissive 는 루프 내내 lighter — 파티클마다 save/restore 하지 않는다(안드로이드 드로우콜 계수 절감)
    bl.globalCompositeOperation = 'lighter';
    bl.globalAlpha = 1;
    for (let i = this.parts.length - 1; i >= 0; i--) {"""
assert s.count(a) == 1
s = s.replace(a, b)
a2 = """      if (q.type !== 'dust') {
        bl.save();
        bl.globalCompositeOperation = 'lighter';
        bl.globalAlpha = a * 0.6;
        bl.fillStyle = f.glow;
        bl.fillRect(q.x - q.s, q.y - q.s, q.s * 2, q.s * 2);
        bl.restore();
        this.blMark(q.x - q.s, q.y - q.s, q.x + q.s, q.y + q.s);
      }
    }
    g.restore();
  }"""
b2 = """      if (q.type !== 'dust') {
        bl.globalAlpha = a * 0.6;
        bl.fillStyle = f.glow;
        bl.fillRect(q.x - q.s, q.y - q.s, q.s * 2, q.s * 2);
        this.blMark(q.x - q.s, q.y - q.s, q.x + q.s, q.y + q.s);
      }
    }
    bl.globalAlpha = 1;
    bl.globalCompositeOperation = 'source-over';
    g.restore();
  }"""
assert s.count(a2) == 1
s = s.replace(a2, b2)
io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
print('patched particles')
