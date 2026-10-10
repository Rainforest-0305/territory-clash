/**
 * 로케일 판별 규칙 단위 테스트.
 *
 * src/i18n/detect.ts 를 esbuild 로 번들해서 **실제 코드 그대로** 돌린다
 * (로직을 복사해 두고 복사본을 테스트하는 짓은 하지 않는다).
 * detect.ts 가 locales.ts 말고 아무것도 import 하지 않기 때문에 가능하다.
 *
 * 특히 지키려는 계약:
 *   - zh-CN/zh-SG → zh-Hans   (문자 추론은 한다)
 *   - zh-TW/zh-HK → en        (번체 사용자에게 간체를 주지 않는다)
 *   - pt-PT, bare pt → en     (유럽 포르투갈어에 브라질어를 주지 않는다)
 *   - pt-BR → pt-BR
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const out = path.join(os.tmpdir(), `tc-detect-${Date.now()}.mjs`);
await build({
  entryPoints: ['src/i18n/detect.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'error',
});
const { resolveLocale, resolvePreferred } = await import(pathToFileURL(out).href);

const CASES = [
  // [input, expected]
  ['en', 'en'], ['en-US', 'en'], ['en-GB', 'en'], ['EN-us', 'en'],
  ['ko', 'ko'], ['ko-KR', 'ko'],
  ['ja', 'ja'], ['ja-JP', 'ja'],

  // 문자(script) 추론은 한다
  ['zh-Hans', 'zh-Hans'], ['zh-CN', 'zh-Hans'], ['zh-SG', 'zh-Hans'], ['zh-Hans-CN', 'zh-Hans'],
  // 번체는 간체로 흘리지 않는다
  ['zh-TW', null], ['zh-HK', null], ['zh-Hant', null], ['zh-Hant-TW', null],

  // 지역(region) 은 추론하지 않는다 — 이게 pt 정책의 핵심
  ['pt-BR', 'pt-BR'],
  ['pt', null], ['pt-PT', null], ['pt-pt', null],

  ['es', 'es'], ['es-MX', 'es'], ['es-419', 'es'],
  ['de', 'de'], ['de-AT', 'de'], ['de-CH', 'de'],
  ['fr', 'fr'], ['fr-CA', 'fr'],
  ['ru', 'ru'], ['ru-RU', 'ru'],

  // 미지원 / 쓰레기 입력
  ['th', null], ['vi', null], ['it', null], ['', null], ['x', null], ['!!!', null],
];

let fail = 0;
console.log('resolveLocale()');
for (const [input, expected] of CASES) {
  const got = resolveLocale(input);
  const ok = got === expected;
  if (!ok) fail++;
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'} ${JSON.stringify(input).padEnd(14)} -> ${String(got).padEnd(9)} (expected ${expected})`
  );
}

// navigator.languages 우선순위
const PREF = [
  [['zh-TW', 'ko-KR', 'en-US'], 'ko'],   // 미지원은 건너뛰고 다음 선호로
  [['pt-PT', 'pt-BR'], 'pt-BR'],         // pt-PT 는 매칭 실패, pt-BR 이 잡힌다
  [['th-TH', 'vi-VN'], 'en'],            // 전부 미지원 -> 기준 로케일
  [[], 'en'],
];
console.log('\nresolvePreferred()');
for (const [tags, expected] of PREF) {
  const got = resolvePreferred(tags);
  const ok = got === expected;
  if (!ok) fail++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} [${tags.join(', ')}] -> ${got} (expected ${expected})`);
}

fs.rmSync(out, { force: true });
console.log(`\n${fail} failure(s)`);
process.exit(fail ? 1 : 0);
