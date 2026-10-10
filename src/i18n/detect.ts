/**
 * 로케일 판별 — navigator.language → 지원 로케일.
 *
 * 이 파일은 **locales.ts 말고 아무것도 import 하지 않는다**(브라우저 API 도
 * 직접 만지지 않는다). 순수 함수라서 노드에서 그대로 단위 테스트할 수 있고,
 * 실제로 scripts/i18n-detect-test.mjs 가 이 파일을 그대로 돌린다.
 *
 * ── 매칭 규칙 (딱 한 줄이다) ────────────────────────────────────────────────
 *   지원 태그가 **명시한** 부분태그는 전부 같아야 한다. 명시하지 않은 것은
 *   따지지 않는다. 후보의 script 는 추론하되, region 은 추론하지 않는다.
 *
 * ── 왜 script 는 추론하고 region 은 추론하지 않는가 ─────────────────────────
 *   이 비대칭 하나가 정책 전부를 만든다.
 *     zh-CN  → maximize → zh-Hans-CN → script Hans == 'zh-Hans'  → zh-Hans ✔
 *     zh-TW  → maximize → zh-Hant-TW → script Hant != Hans       → en      ✔
 *     pt-BR  → region br == 'pt-BR'                              → pt-BR   ✔
 *     pt-PT  → region pt != br                                   → en      ✔
 *     bare pt→ region 없음 != br                                  → en      ✔
 *   region 까지 추론하면 CLDR 이 'pt' 를 pt-BR 로 최대화해 버려서, 유럽
 *   포르투갈어 사용자에게 브라질 포르투갈어를 조용히 먹이게 된다. 스토어는
 *   pt 와 pt-BR 을 서로 다른 언어로 취급하므로 그건 오배송이다.
 *   같은 이유로 번체(zh-Hant) 사용자에게 간체를 밀어 넣지 않는다.
 *
 * ★ 언어 코드를 여기에 절대 하드코딩하지 마라. 규칙은 LOCALES 배열에서만
 *   읽어야 하며, 그래서 언어를 갈아끼워도 이 파일은 손댈 필요가 없다.
 */
import { LOCALES, BASE_LOCALE, asLocale, type Locale } from './locales';

export interface Subtags {
  language: string;
  script?: string;
  region?: string;
}

interface IntlLocaleLike {
  language: string;
  script?: string;
  region?: string;
  maximize(): IntlLocaleLike;
}

function intlLocaleCtor(): (new (tag: string) => IntlLocaleLike) | null {
  const ctor = (Intl as unknown as { Locale?: new (tag: string) => IntlLocaleLike }).Locale;
  return typeof ctor === 'function' ? ctor : null;
}

/** BCP-47 을 손으로 쪼갠다. Intl.Locale 이 없는 구형 WebView 대비. */
export function splitTag(tag: string): Subtags | null {
  const parts = tag.replace(/_/g, '-').split('-').filter(Boolean);
  const language = parts.shift();
  if (!language || !/^[A-Za-z]{2,3}$/.test(language)) return null;
  const out: Subtags = { language: language.toLowerCase() };
  if (parts[0] && /^[A-Za-z]{4}$/.test(parts[0])) {
    out.script = parts.shift()!.toLowerCase();
  }
  if (parts[0] && /^([A-Za-z]{2}|\d{3})$/.test(parts[0])) {
    out.region = parts.shift()!.toLowerCase();
  }
  return out;
}

/** 후보 태그를 쪼갠다. script 만 추론하고 region 은 추론하지 않는다(위 주석 참고). */
export function candidateSubtags(tag: string): Subtags | null {
  const manual = splitTag(tag);
  if (!manual) return null;
  if (!manual.script) {
    const Ctor = intlLocaleCtor();
    if (Ctor) {
      try {
        const max = new Ctor(tag).maximize();
        if (max.script) manual.script = max.script.toLowerCase();
      } catch {
        /* 구형 런타임 / 이상한 태그 — 문자 추론 없이 진행한다 */
      }
    }
  }
  return manual;
}

function matches(supported: Subtags, candidate: Subtags): boolean {
  if (supported.language !== candidate.language) return false;
  if (supported.script && supported.script !== candidate.script) return false;
  if (supported.region && supported.region !== candidate.region) return false;
  return true;
}

function specificity(s: Subtags): number {
  return 1 + (s.script ? 1 : 0) + (s.region ? 1 : 0);
}

/** 한 태그를 지원 로케일로 해석한다. 없으면 null. 더 구체적인 지원 태그가 이긴다. */
export function resolveLocale(tag: string): Locale | null {
  const exact = asLocale(tag);
  if (exact) return exact;
  const candidate = candidateSubtags(tag);
  if (!candidate) return null;

  let best: Locale | null = null;
  let bestScore = -1;
  for (const locale of LOCALES) {
    const sup = splitTag(locale);
    if (!sup) continue;
    if (!matches(sup, candidate)) continue;
    const score = specificity(sup);
    if (score > bestScore) {
      best = locale;
      bestScore = score;
    }
  }
  return best;
}

/** 선호 언어 목록을 순서대로 훑어 첫 매칭을 쓴다. 없으면 기준 로케일. */
export function resolvePreferred(tags: readonly string[]): Locale {
  for (const tag of tags) {
    const hit = resolveLocale(tag);
    if (hit) return hit;
  }
  return BASE_LOCALE;
}
