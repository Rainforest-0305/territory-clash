/**
 * ############################################################################
 * ##  지원 언어 정의 — 이 파일이 **유일한 정본**이다                        ##
 * ############################################################################
 *
 * 코드베이스 어디에도 언어 코드를 하드코딩하지 마라. 아래 배열이 전부다.
 *
 * ── 언어를 추가/교체하는 절차 (이게 비용의 전부여야 한다) ───────────────────
 *   1) LOCALES 배열을 고친다.
 *   2) src/i18n/messages/<code>.ts 를 하나 추가한다.
 *   끝. 다른 파일은 손대지 않는다.
 *
 *   messages/ 디렉터리는 import.meta.glob 으로 통째로 읽히므로 등록부가 따로
 *   없고, 언어 이름은 Intl.DisplayNames 가 코드 자체에서 만들어 내므로
 *   번역할 이름 목록도 없다. 그래서 'th'/'vi' 를 'ru'/'fr' 자리에 넣는 일이
 *   배열 한 줄 + 파일 하나로 끝난다.
 *
 * ── 왜 지역/문자 부분태그가 붙어 있나 ───────────────────────────────────────
 *   zh-Hans  간체. Microsoft 세계화 가이드가 zh-CN/zh-TW 대신 문자 부분태그
 *            (zh-Hans/zh-Hant)를 쓰라고 명시한다.
 *   pt-BR    브라질 포르투갈어. 스토어는 pt-BR 과 pt/pt-PT 를 **다른 언어로**
 *            취급한다. 유럽 포르투갈어는 출시 대상이 아니므로 bare 'pt' 와
 *            'pt-PT' 는 pt-BR 로 흘리지 않고 en 으로 떨어뜨린다(detect.ts 참고).
 */

/** 지원 언어. 첫 번째가 기준 로케일이자 폴백이다. */
export const LOCALES = ['en', 'ko', 'ja', 'zh-Hans', 'es', 'pt-BR', 'de', 'fr', 'ru'] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * 기준 로케일 = 키의 정본 = 폴백.
 * LOCALES[0] 에서 유도한다 — 코드를 두 번 적지 않기 위해서다.
 */
export const BASE_LOCALE: Locale = LOCALES[0];

/** 임의의 문자열이 지원 언어인지 (대소문자 무시). 맞으면 정규 표기로 돌려준다. */
export function asLocale(value: unknown): Locale | null {
  if (typeof value !== 'string') return null;
  const lower = value.toLowerCase();
  return LOCALES.find((l) => l.toLowerCase() === lower) ?? null;
}
