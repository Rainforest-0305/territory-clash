# -*- coding: utf-8 -*-
"""
-23 2단 (President 「저런 뿌연 느낌 안 나게 개선은 안 되는 거야?」 → 선명도 1순위). gfx_patch_sharp23.py 위에 적용, 멱등.
  ① iOS scene DPR = 기기 DPR 그대로(상한 IOS_SCENE_DPR_CAP=3). 다운샘플은 블룸 내부 버퍼(1/2·1/8)에서만.
  ② 영역 «채움»은 블룸에서 완전 제외 — 점령 플래시의 emissive 채움 제거(씬 쪽 플래시는 유지). 블룸 계수 tight .60→.45 · wide .30→.15
  ③ 격자 .45→.25 · 비네트 .42→.25 · 배경 안개(haze) .30→.15 · 2D 폴백 블룸 합성 .55→.30 — 전부 원본(.55/.5/.3/.55) 의 절반 이하
"""
import io, os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
IOS_CAP = os.environ.get('IOS_SCENE_DPR_CAP', '3')

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
    ("""    if (!this.android) return Math.min(dpr, 2);""",
     """    // -23 2단: iOS 는 기기 DPR 그대로(상한 IOS_SCENE_DPR_CAP). 선명도 1순위(President). 다운샘플은 블룸 내부 버퍼에서만.
    if (!this.android) return Math.min(dpr, IOS_SCENE_DPR_CAP);"""),
    ("""  tight = 0.6;
  wide = 0.3;""",
     """  tight = 0.45;
  wide = 0.15;"""),
    ("""        gl.uniform1f(u.vig!, 0.42);""",
     """        gl.uniform1f(u.vig!, 0.25);"""),
], 'IOS_SCENE_DPR_CAP)')

# 상수 선언(파일 상단 import 뒤)
p = os.path.join(ROOT, 'src/game/post.ts')
s = io.open(p, encoding='utf-8').read()
if 'const IOS_SCENE_DPR_CAP' not in s:
    idx = s.find('\nexport ')
    if idx < 0: idx = s.find('\nclass ')
    s = s[:idx] + '\n/** -23: iOS(WebKit) scene DPR 상한. 3 = 기기 DPR 그대로(iPhone). 성능 여유 없으면 2. */\nconst IOS_SCENE_DPR_CAP = ' + IOS_CAP + ';\n' + s[idx:]
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
    print('const IOS_SCENE_DPR_CAP =', IOS_CAP)

patch('src/game/render.ts', [
    ("""      const d = Math.min(window.devicePixelRatio || 1, 3);
      this.resBase = d > 2 ? 2 / d : 1;""",
     """      const d = Math.min(window.devicePixelRatio || 1, 3);
      // -23 2단: iOS(WebKit) 는 기기 DPR 그대로 렌더(resBase 1) — 2/d 는 iPhone 에서 «전체 소프트»의 첫 단이었다. Android 만 기존 2/d.
      const isAndroid = /Android/i.test(navigator.userAgent);
      this.resBase = d > 2 && isAndroid ? 2 / d : 1;"""),
    ("""      g.restore();
      bl.save();
      bl.globalCompositeOperation = 'lighter';
      bl.globalAlpha = 0.22 * (1 - k);
      bl.fillStyle = f.glow;
      bl.fill(fl.path);
      bl.restore();
      this.blMark(fl.bx, fl.by, fl.bx + fl.bw, fl.by + fl.bh);""",
     """      g.restore();
      // -23 2단: 점령 플래시도 emissive 에 «채움»을 넣지 않는다(영역 채움은 블룸에서 완전 제외 — President). 씬 쪽 플래시만 남는다."""),
    ("""  private terrFlashes(g: CanvasRenderingContext2D, bl: CanvasRenderingContext2D): void {""",
     """  private terrFlashes(g: CanvasRenderingContext2D, _bl: CanvasRenderingContext2D): void {"""),
    ("""      rg.addColorStop(0, hexa(PAL.haze[i]!, 0.3));""",
     """      rg.addColorStop(0, hexa(PAL.haze[i]!, 0.15));"""),
    ("""    g.fillStyle = PAL.void2;
    g.globalAlpha = 0.45;""",
     """    g.fillStyle = PAL.void2;
    g.globalAlpha = 0.25;"""),
    ("""    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.55;
    const kx = this.vw / bw;""",
     """    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.3;
    const kx = this.vw / bw;"""),
], '점령 플래시도 emissive 에 «채움»을 넣지 않는다')
