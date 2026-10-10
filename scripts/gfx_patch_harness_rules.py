# -*- coding: utf-8 -*-
"""
하네스 보강(계측 전용, 게임 코드 아님) — bench 에 「단계 전환 로그 / 5초 내 2회 이상 전환 수 / 캔버스 크기 불변 /
층 지연 / 더티 굽기 비율」 을 넣는다. 멱등.
"""
import io, os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
P = os.path.join(ROOT, '_gfx_evidence_260830', 'harness', 'harness.mjs')
s = io.open(P, encoding='utf-8').read()
if 'rapidTransitions' in s:
    print('already'); raise SystemExit(0)

def rep(a, b):
    global s
    assert s.count(a) == 1, a[:100]
    s = s.replace(a, b)

# 1) 플레이 중 캔버스 크기를 주기적으로 샘플링(불변 증명) — driveInput 중 1초마다
rep("""    const t0 = Date.now();
    await driveInput(page, W, H, SEC * 1000, 7);
    const r = await page.evaluate(() => ({""",
"""    const t0 = Date.now();
    const sizeSamples = [];
    const sizer = setInterval(() => {
      page
        .evaluate(() => {
          const d = window.__tcDiag;
          if (!d) return null;
          const p = d.post();
          const c = d.canvas ? d.canvas() : null;
          return { t: Math.round(performance.now()), q: p ? p.q : -1, off: p ? p.autoOff : null, sw: p ? p.sceneW : null, sh: p ? p.sceneH : null, cw: c ? c.w : null, ch: c ? c.h : null, phase: d.phase() };
        })
        .then((v) => v && sizeSamples.push(v))
        .catch(() => {});
    }, 1000);
    await driveInput(page, W, H, SEC * 1000, 7);
    clearInterval(sizer);
    const r = await page.evaluate(() => ({""")

rep("""      diag: r.diag,
      resultShown: r.result,""",
"""      diag: r.diag,
      /* 규칙 1·7: 전환 로그([frame, q, why, tMs]) 와 「5초 안에 2회 이상 전환」 쌍의 수(기대 0), 최소 체류 */
      qlog: r.diag && r.diag.post ? r.diag.post.qlog : [],
      rapidTransitions: (() => {
        const L = r.diag && r.diag.post ? r.diag.post.qlog : [];
        let n = 0;
        for (let i = 1; i < L.length; i++) if (L[i][3] !== undefined && L[i][3] - L[i - 1][3] < 5000) n++;
        return n;
      })(),
      minDwellMs: (() => {
        const L = r.diag && r.diag.post ? r.diag.post.qlog : [];
        let m = Infinity;
        for (let i = 1; i < L.length; i++) if (L[i][3] !== undefined) m = Math.min(m, L[i][3] - L[i - 1][3]);
        return m === Infinity ? null : m;
      })(),
      promos: r.diag && r.diag.post ? r.diag.post.promos : null,
      /* 규칙 3: 플레이 중 scene/GL·#stage 캔버스 크기 표본(전부 같아야 한다) */
      sizeSamples,
      sizeConstant: (() => {
        const p = sizeSamples.filter((v) => v.phase === 'play');
        if (!p.length) return null;
        const k = (v) => `${v.sw}x${v.sh}/${v.cw}x${v.ch}`;
        return p.every((v) => k(v) === k(p[0]));
      })(),
      /* 규칙 4·8: 층 지연 / 두 층 / 더티 굽기 */
      layer: r.diag && r.diag.stats ? { stageDraws: r.diag.stats.stageDraws, glFrames: r.diag.stats.glFrames, layerLag: r.diag.stats.layerLag, frames: r.diag.stats.n, bakes: r.diag.stats.bakes, shifts: r.diag.stats.shifts, reallocs: r.diag.stats.reallocs } : null,
      resultShown: r.result,""")

io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
print('patched harness')
