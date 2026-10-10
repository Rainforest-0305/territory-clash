/**
 * 계측 브릿지 — eventLog.
 *
 * ★ 공개 배럴(@apps-in-toss/web-framework → web-bridge)엔 없다. bridge.ts 와
 *   «같은 함정»이다: web-bridge@2.10.8 dist/index.js 최종 export 목록에
 *   eventLog 가 빠져 있다(재수출 배럴이 curated list 라 전부를 내보내지 않음).
 *   [실측] dist/bridge.js 원본:
 *     export var eventLog = createAsyncBridge("eventLog");
 *   구현 자체는 있고 이름만 index.js 의 export 목록에서 빠졌다.
 *
 * → bridge.ts 가 getUserKeyForGame/closeView 등에 쓴 것과 동일한 방식으로
 *   createAsyncBridge 를 직접 불러 뚫는다(SDK 가 공식 노출한 확장점이지 해킹이
 *   아니다 — bridge.ts 상단 주석 참고).
 *
 * ★ 샌드박스(토스 밖)에서는 SDK 문서상 "콘솔에 로그만 찍고 안 죽는다"지만,
 *   방어적으로 try/catch 로 한 번 더 감싼다 — 계측 실패로 게임이 죽으면 안 된다
 *   (조직 규율: SDK 브릿지는 항상 실패를 흡수한다).
 */
import { createAsyncBridge } from '@apps-in-toss/bridge-core';

export type EventLogPrimitive = string | number | boolean | null | undefined;

export type EventLogType =
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'event'
  | 'screen'
  | 'impression'
  | 'click'
  | 'popup';

export interface EventLogParams {
  log_name: string;
  log_type: EventLogType;
  params: Record<string, EventLogPrimitive>;
}

const rawEventLog = createAsyncBridge<[EventLogParams], void>('eventLog');

/** 절대 throw 하지 않는다 — 계측 실패로 게임이 죽으면 안 된다. */
export async function eventLog(p: EventLogParams): Promise<void> {
  try {
    await rawEventLog(p);
  } catch (err) {
    console.warn('[eventLog] bridge failed:', err);
  }
}
