/**
 * ############################################################################
 * ##  i18n 런타임                                                           ##
 * ############################################################################
 *
 * 사용법은 세 개뿐이다.
 *   t('result.kills')                     → 문자열
 *   t('hud.rate', { rate: fmt(n) })       → 이름 있는 치환. **문자열 결합 금지**
 *   tNodes('modal.revive.body', { limit }) → 파라미터에 DOM 노드를 꽂을 때
 *
 * ── 지켜야 할 규칙 ──────────────────────────────────────────────────────────
 *  A. 사용자에게 보이는 문자열을 코드에 직접 쓰지 마라. 반드시 키를 통해라.
 *  B. "점수: " + n 같은 결합 금지. 어순이 다른 언어에서 통째로 깨진다.
 *  C. 숫자는 반드시 fmt()/fmtDecimal() 로 넘겨라. toLocaleString('ko-KR') 처럼
 *     로케일을 박아 넣으면 9개 언어 중 8개가 틀린 표기를 보게 된다.
 *  D. 번역문 안에 HTML 태그를 넣지 마라. 강조·구조는 코드가 만든다(tNodes).
 *
 * ── 알려진 한계: 복수형(plural) 처리가 없다 — 실수가 아니라 결정이다 ────────
 *  Intl.PluralRules 를 붙이지 않았다. 숫자가 붙는 값이 result.value.* 몇 개뿐이고,
 *  거기에 복수형 엔진을 얹으면 번역자 9명이 언어마다 one/few/many/other 를
 *  채워야 해서 비용이 이득을 넘는다고 봤다.
 *  대신 번역자들이 문법적으로 안전한 표현으로 우회했다(ru 는 '{count} кл.' 처럼
 *  축약형, de 는 '{count} Felder').
 *  ⚠ 남는 위험: de 의 'Felder' 는 count 가 정확히 1 일 때만 어색하고,
 *    ru 의 '{players} игроков' 는 2~4 에서 깨진다(현재 PARTICIPANTS=6 이라 안전).
 *    숫자 범위가 넓어지는 문구를 새로 추가한다면 그때는 PluralRules 를 붙여라.
 *
 * ── 저장 ────────────────────────────────────────────────────────────────────
 *  기존 저장 계층(src/toss 의 storage)과 **이미 있던** KEYS.settings 슬롯을
 *  그대로 쓴다. 저장소를 새로 만들지 않는다. settings 는 객체라서 나중에
 *  사운드/진동 같은 설정이 같은 키에 합류할 수 있다.
 */
import { storage, KEYS } from '../toss';
import { LOCALES, BASE_LOCALE, asLocale, type Locale } from './locales';
import { resolvePreferred } from './detect';
import { en } from './messages/en';
import type { Messages, MessageKey, Params, NodeParams } from './types';

// ── 번들 등록부 ─────────────────────────────────────────────────────────────
/**
 * messages/*.ts 를 통째로 읽는다. 등록부를 손으로 유지하지 않기 때문에
 * "언어 추가 = 배열 한 줄 + 파일 하나" 가 성립한다.
 * eager 인 이유: 언어 전환이 비동기가 되면 전환 순간 한 프레임이 빈다.
 */
const modules = import.meta.glob('./messages/*.ts', { eager: true }) as Record<
  string,
  { default: Messages }
>;

const BUNDLES: Partial<Record<Locale, Messages>> = {};
for (const [filePath, mod] of Object.entries(modules)) {
  const code = filePath.slice(filePath.lastIndexOf('/') + 1).replace(/\.ts$/, '');
  const locale = asLocale(code);
  // LOCALES 에 없는 파일은 무시한다(언어를 뺐는데 파일이 남아 있는 경우).
  if (locale) BUNDLES[locale] = mod.default;
}

// ── 상태 ────────────────────────────────────────────────────────────────────
let active: Locale = BASE_LOCALE;
let bundle: Messages = en;
let numberFormat: Intl.NumberFormat | null = null;
const decimalFormats = new Map<number, Intl.NumberFormat>();
const listeners = new Set<(locale: Locale) => void>();

export function activeLocale(): Locale {
  return active;
}

export { LOCALES, BASE_LOCALE };
export type { Locale };

// ── 번역 ────────────────────────────────────────────────────────────────────
const PLACEHOLDER = /\{(\w+)\}/g;

function raw(key: MessageKey): string {
  // 번역 누락 시 en 으로 떨어진다. 화면이 비는 것보다 영어가 낫다.
  return bundle[key] || en[key];
}

/** 이름 있는 치환. 값이 없는 자리표시자는 그대로 남겨서 QA 가 눈으로 잡게 한다. */
function interpolate(text: string, params?: Params | NodeParams): string {
  if (!params) return text;
  return text.replace(PLACEHOLDER, (whole, name: string) => {
    const v = (params as Record<string, unknown>)[name];
    return v == null ? whole : String(v);
  });
}

export function t(key: MessageKey, params?: Params): string {
  return interpolate(raw(key), params);
}

/**
 * 파라미터 자리에 DOM 노드를 꽂아 조각을 만든다.
 * 번역문에 <b> 같은 태그를 넣지 않기 위해 존재한다 — 강조는 코드가 만든다.
 */
export function tNodes(key: MessageKey, params: NodeParams): DocumentFragment {
  const text = raw(key);
  const frag = document.createDocumentFragment();
  let last = 0;
  PLACEHOLDER.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PLACEHOLDER.exec(text)) !== null) {
    if (m.index > last) frag.append(text.slice(last, m.index));
    const v = params[m[1]!];
    if (v instanceof Node) frag.append(v);
    else frag.append(v == null ? m[0] : String(v));
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.append(text.slice(last));
  return frag;
}

// ── 숫자 포맷 ───────────────────────────────────────────────────────────────
/** 정수 표기. 하드코딩된 'ko-KR' 을 대체한다. */
export function fmt(n: number): string {
  if (!numberFormat) {
    try {
      numberFormat = new Intl.NumberFormat(active);
    } catch {
      numberFormat = new Intl.NumberFormat();
    }
  }
  return numberFormat.format(n);
}

/** 소수 자릿수 고정 표기(예: 영토 비율 12.3 → de 에서는 "12,3"). */
export function fmtDecimal(n: number, digits: number): string {
  let f = decimalFormats.get(digits);
  if (!f) {
    try {
      f = new Intl.NumberFormat(active, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
    } catch {
      f = new Intl.NumberFormat(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
    }
    decimalFormats.set(digits, f);
  }
  return f.format(n);
}

// ── 이름 풀 (미리 합성된 64종) ──────────────────────────────────────────────
/**
 * ★ 형용사+명사를 런타임에 붙이지 않는다.
 *   원래 코드는 NICK_A[i] + NICK_B[j] 였는데, es/pt-BR/fr/de/ru 처럼 형용사가
 *   명사의 성·수에 일치해야 하는 언어에서 이런 결합은 반드시 틀린 말이 된다.
 *   그래서 로케일마다 **완성된 이름 64개**를 두고 인덱스로만 고른다.
 *   ko 는 idx = i*8 + j 순서로 원본 조합을 그대로 펼쳐 놓았기 때문에
 *   기존 사용자의 닉네임이 바뀌지 않는다.
 */
export const NAME_POOL_SIZE = 64;

export function nickName(index: number): string {
  const i = ((index % NAME_POOL_SIZE) + NAME_POOL_SIZE) % NAME_POOL_SIZE;
  return t(`nick.name.${i}` as MessageKey);
}

export function botName(index: number): string {
  const i = ((index % NAME_POOL_SIZE) + NAME_POOL_SIZE) % NAME_POOL_SIZE;
  return t(`bot.name.${i}` as MessageKey);
}

// ── 로케일 판별 ─────────────────────────────────────────────────────────────
/**
 * 실제 매칭 규칙은 detect.ts 에 있다. 그 파일은 locales.ts 말고 아무것도
 * import 하지 않는 순수 함수 모음이라, 노드에서 그대로 단위 테스트할 수 있다
 * (scripts/i18n-detect-test.mjs). 규칙을 바꾸려면 저기를 고쳐라.
 */
export { resolveLocale } from './detect';

/** navigator 선호 언어를 순서대로 훑어 첫 매칭을 쓴다. 없으면 기준 로케일. */
export function detectLocale(): Locale {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const tags: string[] = [];
  if (nav?.languages?.length) tags.push(...nav.languages);
  if (nav?.language) tags.push(nav.language);
  return resolvePreferred(tags);
}

// ── 언어 이름(엔도님) ───────────────────────────────────────────────────────
interface DisplayNamesLike {
  of(code: string): string | undefined;
}

/**
 * 언어 이름은 번역 키가 아니다. Intl 이 코드 자체에서 만들어 낸다.
 * 그래서 messages 파일 어디에도 언어 코드가 없고, 언어를 추가해도
 * 번역자가 할 일이 늘지 않는다. 각 언어를 **그 언어로** 표기(엔도님)하므로
 * UI 를 못 읽는 사용자도 자기 언어를 찾을 수 있다.
 */
export function localeLabel(code: Locale): string {
  const ctor = (
    Intl as unknown as {
      DisplayNames?: new (locales: string[], options: { type: string }) => DisplayNamesLike;
    }
  ).DisplayNames;
  if (ctor) {
    try {
      const name = new ctor([code], { type: 'language' }).of(code);
      if (name && name.toLowerCase() !== code.toLowerCase()) {
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
    } catch {
      /* 구형 런타임 — 코드를 그대로 보여준다 */
    }
  }
  return code;
}

// ── 적용 / 전환 ─────────────────────────────────────────────────────────────
function applyToDocument(): void {
  if (typeof document === 'undefined') return;
  // index.html 의 lang 속성은 부팅 전 기본값일 뿐 — 여기서 실제 값으로 덮는다.
  document.documentElement.lang = active;
  // ★ document.title 은 game.title 이 아니라 brand.name 이다.
  //   전자는 인게임 표시용(현지화), 후자는 제품 메타데이터(영문 브랜드 고정).
  //   여기를 game.title 로 되돌리면 스토어 예약명과 창 제목이 어긋난다.
  document.title = t('brand.name');
}

/** 즉시 전환(저장하지 않음). 부팅 경로에서 쓴다. */
export function setLocale(locale: Locale): void {
  active = locale;
  bundle = BUNDLES[locale] ?? en;
  numberFormat = null;
  decimalFormats.clear();
  applyToDocument();
  for (const fn of listeners) {
    try {
      fn(locale);
    } catch (err) {
      console.warn('[i18n] locale listener threw:', err);
    }
  }
}

/** 사용자가 직접 고른 경우. 전환 + 영속화. */
export async function setLocalePersisted(locale: Locale): Promise<void> {
  setLocale(locale);
  try {
    const prev = await storage.getJSON<Record<string, unknown>>(KEYS.settings, {});
    await storage.setJSON(KEYS.settings, { ...prev, locale });
  } catch (err) {
    // 저장 실패로 게임이 죽으면 안 된다. 이번 세션 동안은 선택이 유지된다.
    console.warn('[i18n] failed to persist locale:', err);
  }
}

/** 언어가 바뀔 때 UI 를 다시 그리기 위한 구독. @returns 해제 함수 */
export function onLocaleChange(fn: (locale: Locale) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * 부팅 시 1회. 저장된 선택 > navigator 자동판별 > en.
 * 절대 throw 하지 않는다 — 언어 때문에 흰 화면이 뜨면 안 된다.
 */
export async function initI18n(): Promise<Locale> {
  let chosen: Locale | null = null;
  try {
    const settings = await storage.getJSON<{ locale?: unknown }>(KEYS.settings, {});
    chosen = asLocale(settings.locale);
  } catch (err) {
    console.warn('[i18n] failed to read saved locale:', err);
  }
  if (!chosen) chosen = detectLocale();
  setLocale(chosen);
  console.log(`[i18n] active=${chosen} (supported: ${LOCALES.join(', ')})`);
  return chosen;
}
