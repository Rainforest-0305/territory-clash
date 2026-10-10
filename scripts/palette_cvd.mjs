#!/usr/bin/env node
/**
 * 팩션 팔레트 «구분 가능성» 실측 — 정상 시각 + 색각 이상(deuteranopia / protanopia, Machado 2009 severity 1.0).
 *   node scripts/palette_cvd.mjs [palette.ts 경로]   → FACTIONS 를 읽어 표 출력
 * 지표: 쌍별 CIEDE2000 (s1 = 영토 내부 대표색, glow = 림/트레일/머리 발광색).
 *       앞 6종(1분 모드)과 10종 전체의 «최소값». 휘도(상대 luminance)도 같이 찍는다.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = process.argv[2] || resolve(HERE, '../src/game/palette.ts');
const src = readFileSync(FILE, 'utf8');
const re = /\{ id: '(\w+)', s0: '(#[0-9A-Fa-f]{6})', s1: '(#[0-9A-Fa-f]{6})', s2: '(#[0-9A-Fa-f]{6})', glow: '(#[0-9A-Fa-f]{6})'/g;
const rows = [...src.matchAll(re)].map((m) => ({ id: m[1], s0: m[2], s1: m[3], s2: m[4], glow: m[5] }));
if (rows.length < 6) throw new Error('FACTIONS parse failed');
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c) => {
  c = Math.max(0, Math.min(1, c));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
};
const lum = (rgb) => {
  const [r, g, b] = rgb.map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
function rgb2lab(rgb) {
  const [r, g, b] = rgb.map(lin);
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  let y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  [x, y, z] = [f(x), f(y), f(z)];
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
function de2000(l1, l2) {
  const [L1, a1, b1] = l1;
  const [L2, a2, b2] = l2;
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h = (a, b) => {
    let t = Math.atan2(b, a) / rad;
    return t < 0 ? t + 360 : t;
  };
  const h1 = h(a1p, b1);
  const h2 = h(a2p, b2);
  const dL = L2 - L1;
  const dC = C2p - C1p;
  let dh = h2 - h1;
  if (C1p * C2p === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh / 2) * rad);
  const Lb = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let Hb = (h1 + h2) / 2;
  if (C1p * C2p === 0) Hb = h1 + h2;
  else if (Math.abs(h1 - h2) > 180) Hb += h1 + h2 < 360 ? 180 : -180;
  const T =
    1 -
    0.17 * Math.cos((Hb - 30) * rad) +
    0.24 * Math.cos(2 * Hb * rad) +
    0.32 * Math.cos((3 * Hb + 6) * rad) -
    0.2 * Math.cos((4 * Hb - 63) * rad);
  const SL = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2);
  const SC = 1 + 0.045 * Cbp;
  const SH = 1 + 0.015 * Cbp * T;
  const RT =
    -2 *
    Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) *
    Math.sin(60 * Math.exp(-(((Hb - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}
/* Machado et al. 2009, severity 1.0 — linear RGB */
const M = {
  normal: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
};
function sim(rgb, m) {
  const l = rgb.map(lin);
  return [0, 1, 2].map((i) => gam(m[i][0] * l[0] + m[i][1] * l[1] + m[i][2] * l[2]));
}
const out = {};
for (const role of ['s0', 's1', 's2', 'glow']) {
  for (const cvd of Object.keys(M)) {
    const labs = rows.map((r) => rgb2lab(sim(hex2rgb(r[role]), M[cvd])));
    const pairs = [];
    for (let i = 0; i < rows.length; i++)
      for (let j = i + 1; j < rows.length; j++) pairs.push({ i, j, d: de2000(labs[i], labs[j]) });
    const min6 = pairs.filter((p) => p.j < 6).reduce((a, b) => (a.d < b.d ? a : b));
    const min10 = pairs.reduce((a, b) => (a.d < b.d ? a : b));
    out[`${role}/${cvd}`] = {
      min6: `${min6.d.toFixed(2)} (${rows[min6.i].id}-${rows[min6.j].id})`,
      min10: `${min10.d.toFixed(2)} (${rows[min10.i].id}-${rows[min10.j].id})`,
    };
  }
}
console.log('file:', FILE);
console.log('faction   lum(s0) lum(s1) lum(s2) lum(glow)');
for (const r of rows)
  console.log(
    r.id.padEnd(9),
    ...['s0', 's1', 's2', 'glow'].map((k) => lum(hex2rgb(r[k])).toFixed(2).padStart(7))
  );
console.log('\nrole/vision        min dE2000 (first 6 = 1-min mode)     min dE2000 (all 10)');
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(18), v.min6.padEnd(36), v.min10);
