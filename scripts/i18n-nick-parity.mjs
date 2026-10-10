/**
 * 회귀 테스트 — 한국어 닉네임/봇이름 무손실 보존.
 *
 * 예전 코드는 형용사+명사를 런타임에 이어붙였다.
 *     nickFor: NICK_A[h % 8] + NICK_B[(h >>> 5) % 8]
 *     bot    : BOT_NAME_A[intOf(rng,0,7)] + BOT_NAME_B[intOf(rng,0,7)]
 * 지금은 로케일마다 미리 합성된 64개 목록에서 idx = i*8 + j 로 고른다.
 *
 * 이 테스트는 **ko 목록이 옛 조합과 순서까지 완전히 같은지**를 확인한다.
 * 여기가 어긋나면 기존 사용자의 닉네임이 조용히 바뀌고(저장된 고스트 이름도
 * 같이 틀어진다) 아무도 눈치채지 못한다. 그래서 자동 검증으로 못 박아 둔다.
 *
 * ★ 아래 두 배열은 **역사적 사실**이다. 리팩터링했다고 고치지 마라.
 *   ko.ts 를 재정렬하고 싶다면 이 테스트가 먼저 빨개져야 정상이다.
 */
import fs from 'node:fs';

const NICK_A = ['빠른', '고요한', '푸른', '작은', '깊은', '맑은', '둥근', '단단한'];
const NICK_B = ['소나기', '민들레', '까치', '노을', '연필', '두루미', '바람개비', '단추'];
const BOT_A = ['성실한', '냉철한', '느긋한', '집요한', '조용한', '대담한', '치밀한', '눈치빠른'];
const BOT_B = ['부동산', '지주', '측량사', '개척자', '건축가', '투자자', '중개인', '토지왕'];

const ko = fs.readFileSync('src/i18n/messages/ko.ts', 'utf8');
function value(key) {
  const line = ko.split('\n').find((l) => l.startsWith(`  '${key}': `));
  if (!line) throw new Error('missing key ' + key);
  return line.slice(line.indexOf(": '") + 3, line.lastIndexOf("',"));
}

let fail = 0;
function check(label, got, want) {
  if (got !== want) {
    console.log(`  FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
    fail++;
  }
}

console.log('ko name pools preserve the original 8x8 concatenation order');
for (let i = 0; i < 8; i++) {
  for (let j = 0; j < 8; j++) {
    const idx = i * 8 + j;
    check(`nick.name.${idx}`, value(`nick.name.${idx}`), NICK_A[i] + NICK_B[j]);
    check(`bot.name.${idx}`, value(`bot.name.${idx}`), BOT_A[i] + BOT_B[j]);
  }
}
console.log(`  checked 128 entries`);

// nickFor 해시 매핑까지 동일한지 — 실제 userKey 로 옛 식과 새 식을 비교한다.
function hash(userKey) {
  let h = 2166136261;
  for (let i = 0; i < userKey.length; i++) {
    h ^= userKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const SAMPLES = [
  'local-abc', 'local-8f2e1d', '', 'a', 'toss-hash-0123456789abcdef',
  'ffffffffffffffffffffffffffffffff', '한글키', 'x'.repeat(64),
  ...Array.from({ length: 200 }, (_, i) => 'user-' + i),
];
console.log('\nnickFor() produces the identical string for real user keys');
for (const key of SAMPLES) {
  const h = hash(key);
  const legacy = NICK_A[h % 8] + NICK_B[(h >>> 5) % 8];
  const modern = value(`nick.name.${(h % 8) * 8 + ((h >>> 5) % 8)}`);
  check(`nickFor(${JSON.stringify(key.slice(0, 20))})`, modern, legacy);
}
console.log(`  checked ${SAMPLES.length} user keys`);

console.log(`\n${fail} failure(s)`);
process.exit(fail ? 1 : 0);
