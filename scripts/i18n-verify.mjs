/**
 * i18n 정합성 검사.
 *
 * `npm run typecheck` 는 **키 집합**만 보장한다(누락/오타/추가 → 컴파일 에러).
 * 타입이 못 잡는 것들이 여기 있다:
 *   - 자리표시자 드리프트: en 에 {rate} 가 있는데 번역문에서 사라졌거나
 *     {Rate}/{rat} 로 잘못 적힌 경우. 화면에서 숫자가 통째로 증발한다.
 *   - 번역문에 몰래 들어간 HTML 태그.
 *   - 이름 풀(nick/bot) 64개 안의 중복, 과도한 길이.
 *   - 아직 번역 안 된(en 과 값이 같은) 항목 수.
 *
 * 실패(exit 1) 조건은 "명백한 버그"뿐이고, 미번역은 경고로만 알린다 —
 * 번역이 들어오는 도중에도 빌드가 초록이어야 하기 때문이다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MSG_DIR = path.join(ROOT, 'src/i18n/messages');

// locales.ts 의 배열을 그대로 읽는다 — 언어 목록을 두 번 적지 않기 위해서다.
const localesSrc = fs.readFileSync(path.join(ROOT, 'src/i18n/locales.ts'), 'utf8');
const arrayMatch = localesSrc.match(/export const LOCALES = \[([^\]]+)\]/);
if (!arrayMatch) {
  console.error('FAIL: could not find LOCALES array in src/i18n/locales.ts');
  process.exit(1);
}
const LOCALES = [...arrayMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const BASE = LOCALES[0];

function parseMessages(file) {
  const src = fs.readFileSync(file, 'utf8');
  const out = {};
  const re = /^\s{2}'((?:[^'\\]|\\.)*)':\s*'((?:[^'\\]|\\.)*)',$/gm;
  let m;
  while ((m = re.exec(src))) {
    const unescape = (s) => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    out[unescape(m[1])] = unescape(m[2]);
  }
  return { messages: out, untranslatedMarker: src.includes('TODO(i18n)') };
}

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/;

let errors = 0;
let warnings = 0;
const fail = (msg) => {
  console.error('  FAIL  ' + msg);
  errors++;
};
const warn = (msg) => {
  console.warn('  warn  ' + msg);
  warnings++;
};

const basePath = path.join(MSG_DIR, `${BASE}.ts`);
if (!fs.existsSync(basePath)) {
  console.error(`FAIL: base locale file missing: ${basePath}`);
  process.exit(1);
}
const base = parseMessages(basePath).messages;
const baseKeys = Object.keys(base);

console.log(`i18n verify — base=${BASE}, keys=${baseKeys.length}, locales=${LOCALES.length}`);

// 기준 로케일 자체 점검
for (const k of baseKeys) {
  if (HTML_TAG.test(base[k])) fail(`${BASE}: HTML tag in value at '${k}': ${base[k]}`);
}

for (const locale of LOCALES) {
  const file = path.join(MSG_DIR, `${locale}.ts`);
  console.log(`\n[${locale}]`);
  if (!fs.existsSync(file)) {
    fail(`missing message file: src/i18n/messages/${locale}.ts`);
    continue;
  }
  const { messages, untranslatedMarker } = parseMessages(file);
  const keys = Object.keys(messages);

  // 키 집합 (타입체크와 중복이지만, 사람이 읽을 수 있는 형태로 한 번 더)
  const missing = baseKeys.filter((k) => !(k in messages));
  const extra = keys.filter((k) => !(k in base));
  if (missing.length) fail(`${missing.length} missing key(s): ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ' …' : ''}`);
  if (extra.length) fail(`${extra.length} unknown key(s): ${extra.slice(0, 5).join(', ')}${extra.length > 5 ? ' …' : ''}`);

  // 자리표시자 · HTML
  let phBad = 0;
  for (const k of baseKeys) {
    if (!(k in messages)) continue;
    const a = placeholders(base[k]).join(',');
    const b = placeholders(messages[k]).join(',');
    if (a !== b) {
      fail(`placeholder mismatch at '${k}': ${BASE}=[${a}] ${locale}=[${b}]`);
      phBad++;
    }
    if (HTML_TAG.test(messages[k])) fail(`HTML tag in value at '${k}': ${messages[k]}`);
  }

  // 이름 풀: 중복 · 길이
  for (const pool of ['nick.name', 'bot.name']) {
    const vals = baseKeys.filter((k) => k.startsWith(pool + '.')).map((k) => messages[k]).filter(Boolean);
    const dupes = vals.filter((v, i) => vals.indexOf(v) !== i);
    if (dupes.length) {
      const uniq = [...new Set(dupes)];
      fail(`${pool}.*: ${uniq.length} duplicate name(s): ${uniq.slice(0, 4).join(', ')}`);
    }
    const long = vals.filter((v) => v.length > 16);
    if (long.length) warn(`${pool}.*: ${long.length} name(s) longer than 16 chars, may clip on small screens (e.g. "${long[0]}")`);
  }

  // 미번역
  const same = baseKeys.filter((k) => k in messages && messages[k] === base[k]).length;
  if (locale !== BASE) {
    // 숫자만 있는 값(예: "{count}", "+{count}") 은 같아도 정상이다.
    const trivial = baseKeys.filter((k) => /^[^\p{L}]*$/u.test(base[k])).length;
    const real = same - trivial;
    if (untranslatedMarker || real > baseKeys.length * 0.5) {
      warn(`NOT TRANSLATED YET — ${real}/${baseKeys.length - trivial} values still identical to ${BASE}`);
    } else if (real > 0) {
      warn(`${real} value(s) still identical to ${BASE} (may be intentional)`);
    } else {
      console.log('  ok    fully translated');
    }
  }
  if (!missing.length && !extra.length && !phBad) console.log('  ok    keys + placeholders consistent');
}

console.log(`\n${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
