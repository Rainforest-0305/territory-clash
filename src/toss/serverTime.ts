/**
 * 서버 시각 — 출석 스트릭 등 「하루에 한 번」 판정의 시계 조작 방어용.
 *
 * ★ getServerTime 은 공개 배럴(@apps-in-toss/web-framework)에 «정상» 재수출돼
 *   있다(bridge.ts 의 curated export 목록 실측에 이미 포함 — eventLog 와 달리
 *   여기는 barrel-drilling 이 필요 없다).
 * ★ 절대 throw 하지 않는다. 실패·미지원·토스 밖이면 undefined 를 준다 —
 *   호출부(daykey.ts 의 setTimeSource)가 기기 시계로 폴백한다.
 */
import { getServerTime } from '@apps-in-toss/web-framework';
import { isInToss, safeBridge } from './env';

/** 서버 시각(ms) 또는 조회 불가 시 undefined. 절대 throw 하지 않는다. */
export async function fetchServerTime(): Promise<number | undefined> {
  if (!isInToss()) return undefined;
  const t = await safeBridge('getServerTime', () => getServerTime(), undefined);
  return typeof t === 'number' && Number.isFinite(t) && t > 0 ? t : undefined;
}
