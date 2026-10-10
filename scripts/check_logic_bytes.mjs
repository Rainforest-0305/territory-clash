#!/usr/bin/env node
/**
 * 무접촉 증명 — 게임 규칙·저장·랭킹·광고·SDK 코드가 라이브(20260826-20) 와 «바이트 단위로» 같은가.
 *   node scripts/check_logic_bytes.mjs [live root] [gfx root]
 * 1) PROTECTED 파일: sha256 동일해야 한다(점령·충돌·타이머·봇 AI·저장·모드·광고 지면·SDK·계측·방침).
 * 2) index.ts 는 «오케스트레이션»이라 수정이 허용되지만, 그 안의 세션 수명주기·저장·점수 함수 본문은
 *    동일해야 한다(2칸 들여쓰기 중첩 함수 단위 sha).
 * 3) 양성대조: 보호 함수에 공백 1개를 넣은 사본을 넣으면 FAIL 이 나는지 확인한다.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const GFX = resolve(process.argv[3] || resolve(HERE, '..'));
const LIVE = resolve(process.argv[2] || resolve(HERE, '../../territory-clash'));

const PROTECTED_FILES = [
  'src/game/sim.ts', 'src/game/grid.ts', 'src/game/bots.ts', 'src/game/modes.ts', 'src/game/save.ts', 'src/game/rng.ts',
  'src/game/types.ts', 'src/game/dailyClash.ts', 'src/game/textures.ts',
  'src/ads/adConfig.ts', 'src/ads/adGate.ts', 'src/ads/adSdk.ts', 'src/ads/bannerAd.ts', 'src/ads/menuBanners.ts',
  'src/ads/menuBanners.css', 'src/ads/tossAdsSdk.ts', 'src/ads-web/adConfig.ts', 'src/ads-web/tossAdsSdk.ts',
  'src/analytics/track.ts', 'src/lib/daykey.ts', 'src/main.ts',
  'src/toss/ageGate.ts', 'src/toss/bridge.ts', 'src/toss/env.ts', 'src/toss/eventLog.ts', 'src/toss/identity.ts',
  'src/toss/index.ts', 'src/toss/navigationBar.ts', 'src/toss/promotion.ts', 'src/toss/safeArea.ts',
  'src/toss/serverTime.ts', 'src/toss/storage.ts', 'src/toss-web/index.ts',
  'src/ui/exitConfirm.ts', 'src/ui/privacyLink.ts', 'src/ui/privacyLink.css',
  'src/i18n/index.ts', 'src/i18n/detect.ts', 'src/i18n/locales.ts', 'src/i18n/types.ts', 'src/i18n/languageSelect.ts',
  'vite.config.ts', 'granite.config.ts', 'package.json', 'tsconfig.json', 'public/privacy.html',
];
/* index.ts 안에서 «반드시 동일»해야 하는 중첩 함수(2칸 들여쓰기 function 선언) */
const PROTECTED_FUNCS = [
  'resize', 'applyInput', 'haptic', 'showMenu', 'refreshDailyClashCard', 'persistChoice', 'sessionSeed',
  'startDailyClash', 'startSession', 'drawSplash',
];
/* endSession/update/loop/draw 는 효과음·후처리 «호출 한 줄»만 추가됐다 — 그 줄을 지운 뒤 동일해야 한다 */
const ALLOWED_INSERT_LINES = [
  /^\s*sfx\.play\([^)]*\);\s*$/,
  /^\s*if \(world && world\.phase === 'play' && !paused\) renderer\.samplePlayFrame\(ms\);\s*$/,
  /^\s*\/\/ 후처리 품질 감시.*$/,
  /^\s*const ms = now - last;\s*$/,
  /^\s*\/\/ 막판 3초 틱.*$/,
  /^\s*if \(w\.phase === 'play'\) \{\s*$/,
  /^\s*const sec = Math\.ceil\(w\.timeLeft\);\s*$/,
  /^\s*if \(sec <= 3 && sec > 0 && sec !== lastTickSec\) \{\s*$/,
  /^\s*lastTickSec = sec;\s*$/,
  /^\s*\}\s*$/,
];
const RELAXED_FUNCS = ['endSession', 'update', 'loop', 'draw'];

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const norm = (s) => s.replace(/\r\n/g, '\n');
let fail = 0;
const same = [];
const diff = [];
for (const f of PROTECTED_FILES) {
  const a = resolve(LIVE, f);
  const b = resolve(GFX, f);
  if (!existsSync(a) || !existsSync(b)) {
    console.log(`  MISSING ${f}`);
    fail++;
    continue;
  }
  const ha = sha(norm(readFileSync(a, 'utf8')));
  const hb = sha(norm(readFileSync(b, 'utf8')));
  if (ha === hb) same.push(f);
  else {
    diff.push(`${f}: ${ha} -> ${hb}`);
    fail++;
  }
}
console.log(`protected files identical: ${same.length}/${PROTECTED_FILES.length}`);
if (diff.length) console.log('PROTECTED FILE CHANGED:\n  ' + diff.join('\n  '));

/* 2) index.ts 중첩 함수 추출 */
function extractFuncs(src) {
  src = norm(src);
  const out = new Map();
  const re = /^  (?:async )?function ([A-Za-z_$][\w$]*)\s*\(/gm;
  let m;
  while ((m = re.exec(src))) {
    let depth = 0;
    let started = false;
    let end = -1;
    for (let i = src.indexOf('{', m.index); i < src.length; i++) {
      const ch = src[i];
      if (ch === '{') {
        depth++;
        started = true;
      } else if (ch === '}') {
        depth--;
        if (started && depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    out.set(m[1], src.slice(m.index, end));
  }
  return out;
}
const liveIdx = readFileSync(resolve(LIVE, 'src/game/index.ts'), 'utf8');
const gfxIdx = readFileSync(resolve(GFX, 'src/game/index.ts'), 'utf8');
const fa = extractFuncs(liveIdx);
const fb = extractFuncs(gfxIdx);
let fsame = 0;
for (const name of PROTECTED_FUNCS) {
  if (!fa.has(name)) {
    console.log(`  (index.ts: ${name} not found in live)`);
    continue;
  }
  if (fa.get(name) === fb.get(name)) fsame++;
  else {
    console.log(`  index.ts PROTECTED FUNC CHANGED: ${name} ${sha(fa.get(name))} -> ${sha(fb.get(name) || '')}`);
    fail++;
  }
}
console.log(`index.ts protected funcs identical: ${fsame}/${PROTECTED_FUNCS.length}`);
/* loop(): `(now - last) / 1000` → `ms / 1000` 로 이름만 바뀌었다(ms 를 후처리 감시에도 넘기려고). 되돌려서 비교한다. */
const strip = (t) =>
  t
    .replace('Math.min(ms / 1000, 1 / 20)', 'Math.min((now - last) / 1000, 1 / 20)')
    .split('\n')
    .filter((l) => !ALLOWED_INSERT_LINES.some((r) => r.test(l)))
    .join('\n');
let rsame = 0;
for (const name of RELAXED_FUNCS) {
  const a = strip(fa.get(name) || '');
  const b = strip(fb.get(name) || '');
  if (a === b) rsame++;
  else {
    console.log(`  index.ts RELAXED FUNC differs beyond allowed inserts: ${name}`);
    fail++;
  }
}
console.log(`index.ts relaxed funcs identical after removing allowed sfx/post lines: ${rsame}/${RELAXED_FUNCS.length}`);

/* 3) 양성대조 */
{
  const mutated = gfxIdx.replace('function startSession(): void {', 'function startSession(): void { ');
  const fc = extractFuncs(mutated);
  const detected = fc.get('startSession') !== fa.get('startSession');
  console.log('positive control (startSession + 1 space):', detected ? 'DETECTED' : 'NOT DETECTED');
  if (!detected) fail++;
  const simA = norm(readFileSync(resolve(LIVE, 'src/game/sim.ts'), 'utf8'));
  const detected2 = sha(simA + ' ') !== sha(simA);
  console.log('positive control (sim.ts + 1 byte):', detected2 ? 'DETECTED' : 'NOT DETECTED');
  if (!detected2) fail++;
}
console.log(fail ? `RESULT: FAIL (${fail})` : 'RESULT: PASS');
process.exit(fail ? 1 : 0);
