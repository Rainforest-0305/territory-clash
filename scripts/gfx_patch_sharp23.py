# -*- coding: utf-8 -*-
"""
-23 «뿌옇다» 정정 (President iPhone 실기기 판정 2026-08-30) — 멱등.
  ① scene DPR 플랫폼별: iOS(WebKit) = min(dpr, 2.0) — 1.5 는 DPR3 화면에서 2배 업스케일 = 전체 소프트. Android 만 픽셀예산(1.5).
  ② emissive 에서 «영역 내부 채움» 제거(림·꼬리·유닛·파티클만) · 점령 플래시 emissive 0.45→0.22 · 블룸 계수 tight .72→.60 · wide .50→.30
  ③ 격자 바닥 알파 .55→.45 · 비네트 .50→.42
  ④ scene 텍스처 NEAREST(GL 캔버스 = scene 크기라 1:1 정확 복사)
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
    ("""  budgetDpr(w: number, h: number, dpr: number): number {
    const cap0 = w * h * Math.min(dpr, 2) * Math.min(dpr, 2) > 1000000 ? 1.5 : 2;
    return Math.min(dpr, cap0);
  }""",
     """  budgetDpr(w: number, h: number, dpr: number): number {
    /* -23: iOS(WebKit) 는 2.0 고정 — 1.5 는 DPR3 화면에서 2배 업스케일이라 «전체가 뿌옇다»(President 실기기).
       Android 만 픽셀예산(1.0M px 초과 시 1.5). ?sdpr= 로 강제(계측용). */
    const forced = /[?&]sdpr=([0-9.]+)\\b/.exec(location.search);
    if (forced) return Math.min(dpr, +forced[1]!);
    if (!this.android) return Math.min(dpr, 2);
    const cap0 = w * h * Math.min(dpr, 2) * Math.min(dpr, 2) > 1000000 ? 1.5 : 2;
    return Math.min(dpr, cap0);
  }"""),
    ("""  tight = 0.72;
  wide = 0.5;""",
     """  tight = 0.6;
  wide = 0.3;"""),
    ("""        gl.uniform1f(u.vig!, 0.5);""",
     """        gl.uniform1f(u.vig!, 0.42);"""),
    ("""    if (this.sceneTex) gl.deleteTexture(this.sceneTex);
    this.sceneTex = this.makeTex(0, 0);""",
     """    if (this.sceneTex) gl.deleteTexture(this.sceneTex);
    this.sceneTex = this.makeTex(0, 0);
    // 씬은 1:1 정확 복사(GL 캔버스 = scene 크기) — LINEAR 는 반텍셀 위상에서 흐려진다(네온 3차 규격)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);"""),
], 'sdpr=([0-9.]+)')

patch('src/game/render.ts', [
    ("""      e.stroke(path);
      e.restore();
      e.globalAlpha = 0.06;
      e.fillStyle = f.glow;
      e.fill(path);
      e.globalAlpha = 1;
    }""",
     """      e.stroke(path);
      e.restore();
      // -23: 영역 «내부»는 emissive 에 넣지 않는다 — 큰 면적이 통째로 번져 «빛나는 안개»가 됐다(President 실기기). 림만 빛난다.
    }"""),
    ("""      bl.globalAlpha = 0.45 * (1 - k);
      bl.fillStyle = f.glow;
      bl.fill(fl.path);""",
     """      bl.globalAlpha = 0.22 * (1 - k);
      bl.fillStyle = f.glow;
      bl.fill(fl.path);"""),
    ("""    g.fillStyle = PAL.void2;
    g.globalAlpha = 0.55;
    g.fillRect(c0 * CELL, r0 * CELL, (c1 - c0) * CELL, (r1 - r0) * CELL);""",
     """    g.fillStyle = PAL.void2;
    g.globalAlpha = 0.45;
    g.fillRect(c0 * CELL, r0 * CELL, (c1 - c0) * CELL, (r1 - r0) * CELL);"""),
], '영역 «내부»는 emissive 에 넣지 않는다')
