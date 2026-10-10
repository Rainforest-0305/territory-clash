# -*- coding: utf-8 -*-
"""
하네스 보강 2 — ① --android (UA Android Chrome WebView + 415×900 @2.6 = 1080×2340 중저가 안드로이드 대리)
② 2D 컨텍스트 드로우콜 계수(프로토타입 래핑, 플레이 중 프레임당 평균): fill/stroke/drawImage/fillText/fillRect/clip/
   gCO 전환/filter 전환/shadowBlur 설정/getImageData/save. 라이브·신규 «같은 초기 스크립트»로 잰다. 멱등.
"""
import io, os
P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '_gfx_evidence_260830', 'harness', 'harness.mjs')
s = io.open(P, encoding='utf-8').read()
if '__dc' in s:
    print('already'); raise SystemExit(0)

def rep(a, b):
    global s
    assert s.count(a) == 1, a[:100]
    s = s.replace(a, b)

rep("""async function openPage(w, h, dpr, locale, extraQuery = '') {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, locale: locale === 'en' ? 'en-US' : 'ko-KR' });""",
"""const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 13; SM-A346B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36';
async function openPage(w, h, dpr, locale, extraQuery = '') {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, locale: locale === 'en' ? 'en-US' : 'ko-KR', ...(argv.android ? { userAgent: ANDROID_UA } : {}) });""")

rep("""    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) =>
      raf((t) => {
        if (window.__rec && window.__fn < 40000) window.__frames[window.__fn++] = t;
        return cb(t);
      });""",
"""    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) =>
      raf((t) => {
        if (window.__rec && window.__fn < 40000) window.__frames[window.__fn++] = t;
        return cb(t);
      });
    /* 드로우콜 계수 — 2D 컨텍스트 프로토타입 래핑(모든 캔버스: 화면·오프스크린·캐시 굽기 포함). __rec 중만 센다. */
    const DC = (window.__dc = { fill: 0, stroke: 0, drawImage: 0, fillText: 0, fillRect: 0, clip: 0, gco: 0, filter: 0, shadowBlur: 0, getImageData: 0, save: 0, setLineDash: 0, createGradient: 0 });
    const P = CanvasRenderingContext2D.prototype;
    for (const [m, k] of [['fill', 'fill'], ['stroke', 'stroke'], ['drawImage', 'drawImage'], ['fillText', 'fillText'], ['fillRect', 'fillRect'], ['clip', 'clip'], ['getImageData', 'getImageData'], ['save', 'save'], ['setLineDash', 'setLineDash'], ['createLinearGradient', 'createGradient'], ['createRadialGradient', 'createGradient']]) {
      const o = P[m];
      P[m] = function () {
        if (window.__rec) DC[k]++;
        return o.apply(this, arguments);
      };
    }
    for (const [prop, k] of [['globalCompositeOperation', 'gco'], ['filter', 'filter'], ['shadowBlur', 'shadowBlur']]) {
      const d = Object.getOwnPropertyDescriptor(P, prop);
      if (!d || !d.set) continue;
      Object.defineProperty(P, prop, {
        configurable: true,
        get: d.get,
        set(v) {
          if (window.__rec && d.get.call(this) !== v) DC[k]++;
          return d.set.call(this, v);
        },
      });
    }""")

rep("""    const W = +(argv.w || 390);
    const H = +(argv.h || 844);
    const DPR = +(argv.dpr || 3);""",
"""    const W = +(argv.w || (argv.android ? 415 : 390));
    const H = +(argv.h || (argv.android ? 900 : 844));
    const DPR = +(argv.dpr || (argv.android ? 2.6 : 3));""")

rep("""    const r = await page.evaluate(() => ({
      pf: Array.from(window.__frames.subarray(0, window.__fn)),""",
"""    const r = await page.evaluate(() => ({
      pf: Array.from(window.__frames.subarray(0, window.__fn)),
      dc: window.__dc,""")

rep("""      diag: r.diag,
      /* 규칙 1·7""",
"""      diag: r.diag,
      android: !!argv.android,
      /* 드로우콜/프레임(플레이 중 평균, 모든 2D 캔버스 합산) */
      drawCallsPerFrame: Object.fromEntries(Object.entries(r.dc || {}).map(([k, v]) => [k, +(v / Math.max(1, r.pf.length)).toFixed(2)])),
      /* 규칙 1·7""")

rep("""    fs.writeFileSync(path.join(OUT, `bench_m${MODE}_cpu${CPU}${argv.bloom === 'off' ? '_bloomoff' : ''}""",
"""    fs.writeFileSync(path.join(OUT, `bench_m${MODE}_cpu${CPU}${argv.android ? '_android' : ''}${argv.bloom === 'off' ? '_bloomoff' : ''}""")
io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
print('patched harness android')
