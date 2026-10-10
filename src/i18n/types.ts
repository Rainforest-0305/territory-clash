/**
 * 메시지 타입 — en 에서 유도한다.
 *
 * ★ 이것이 9명의 번역자가 서로 어긋나지 않게 막는 유일한 장치다.
 *   각 로케일 파일이 `const x: Messages = { ... }` 로 선언되므로
 *     키 누락  → "Property 'xxx' is missing"        (컴파일 에러)
 *     키 오타/추가 → "Object literal may only specify known properties" (컴파일 에러)
 *   즉 `npm run typecheck` 가 번역 드리프트를 빌드 전에 잡는다.
 *
 *   값 타입을 string 으로 두기 위해 en 에는 `as const` 를 붙이지 않는다.
 *   붙이면 리터럴 타입이 되어 번역문이 전부 타입 에러가 난다.
 */
import { en } from './messages/en';

export type Messages = typeof en;

export type MessageKey = keyof Messages;

/** 치환 파라미터. 값은 이미 로케일 포맷이 끝난 문자열이거나 숫자다. */
export type Params = Record<string, string | number>;

/** tNodes 전용 — 파라미터 자리에 DOM 노드를 꽂을 수 있다(강조 등). */
export type NodeParams = Record<string, string | number | Node>;
