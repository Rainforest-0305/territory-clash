/**
 * 「머니 리그」 교차추천 — ★2026-09-10 신설 (Partner 공통 지시서 §5 · 2주 실험)
 *
 * ── 무엇을 하나 ────────────────────────────────────────────────────────────────
 *   결과 화면에 «하루 1회» 추천 카드를 보이고(그날 이미 보였으면 안 보인다), 「열기」를
 *   누르면 토스 안의 머니 리그 미니앱을 연다. 카드 자체는 src/ui/crossPromo.ts 가 그린다 —
 *   이 파일은 «판정·기록·브릿지»만 맡는다(UI 무의존).
 *
 * ── openURL 브릿지를 «직접» 만드는 이유 (bridge.ts 의 getUserKeyForGame 과 같은 함정) ──
 *   web-bridge@2.10.8 dist/index.d.ts 의 최종 export 목록에 `openURL` 이 «없다»(실측).
 *   정의는 있다 — dist/index.js:1181 `var openURL = createAsyncBridge("openURL")` — 광고
 *   오프너가 내부에서만 쓴다(http(s) URL 만 `supertoss://web?url=…&external=true` 로 감싼다.
 *   `intoss://` 스킴은 변형 없이 그대로 넘긴다). dist/openURL.d.ts 원문:
 *     「지정된 URL 을 기기의 기본 브라우저나 관련 앱에서 열어요. react-native 의 Linking.openURL 사용」
 *   ⇒ 공개 API 인 createAsyncBridge 로 같은 이름의 브릿지를 만든다(SDK 가 공식 노출한 확장점).
 *   ⛔bridge-core 는 응답이 없으면 «영원히 pending» 이다 → 아래 openCrossPromo() 가 4초 경쟁으로 감싼다.
 *   ★실기기에서 `intoss://moneyleague` 가 실제로 머니 리그를 여는지는 [미확인] — Partner 테스트 푸시로 본다.
 *
 * ── 저장 규율 ──────────────────────────────────────────────────────────────────
 *   새 키 `tc:crosspromo.v1` 하나만 «추가». 세이브 블롭 무접촉. privacy.html §1 표에 고지.
 *   날짜는 조직 정본 lib/daykey.ts 의 kstDateKey(nowMs()) — 토스 안에서는 부팅 때 서버 시각 스큐가 반영된다.
 *
 * ── 계측 ─────────────────────────────────────────────────────────────────────
 *   노출·클릭은 UI 쪽이 track() 으로 남긴다(crosspromo_impression / crosspromo_click / crosspromo_dismiss).
 *   여기 로컬 카운터(shows·clicks)는 콘솔 로그가 죽어도 남는 최소 기록이다.
 *   ⛔「순사용자 증가」라고 쓰지 않는다 — 앱 간 순사용자를 알 수 없다(전략보고서 §3-4).
 */
import { createAsyncBridge } from '@apps-in-toss/bridge-core';
import { storage } from './storage';
import { isInToss } from './env';
import { kstDateKey, nowMs, isDateKey } from '../lib/daykey';

/** 열기 대상. 공통 지시서 §5 의 값 «글자 그대로». */
export const CROSS_PROMO_TARGET = 'intoss://moneyleague';

/** 노출·클릭 기록. 세이브 블롭 «밖». */
export const CROSS_PROMO_KEY = 'tc:crosspromo.v1';

export interface CrossPromoRecord {
  /** 마지막으로 카드를 «보인» KST 날짜키. 같은 날에는 다시 보이지 않는다 */
  lastShownDay?: string;
  /** 누적 노출 수(로컬) */
  shows?: number;
  /** 누적 「열기」 수(로컬) */
  clicks?: number;
  /** 마지막 「열기」 KST 날짜키 */
  lastClickDay?: string;
}

/** 열기 결과. 'unknown' = 4초 무응답 — 앱이 실제로 열렸을 수 있으므로 «실패로 단정하지 않는다» */
export type CrossPromoOpenOutcome = 'ok' | 'failed' | 'unknown';

/** 무응답 상한. 이 뒤에는 'unknown' 으로 돌려주고 UI 는 실패 문구를 «띄우지 않는다». */
const OPEN_TIMEOUT_MS = 4000;

const openURL = createAsyncBridge<[string], unknown>('openURL');

function sanitize(v: unknown): CrossPromoRecord {
  const o = (v ?? {}) as Partial<CrossPromoRecord>;
  const num = (n: unknown): number =>
    typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  return {
    lastShownDay: isDateKey(o.lastShownDay) ? o.lastShownDay : undefined,
    shows: num(o.shows),
    clicks: num(o.clicks),
    lastClickDay: isDateKey(o.lastClickDay) ? o.lastClickDay : undefined,
  };
}

async function loadRecord(): Promise<CrossPromoRecord> {
  try {
    const raw = await storage.getItem(CROSS_PROMO_KEY);
    if (raw == null) return sanitize({});
    return sanitize(JSON.parse(raw));
  } catch {
    // 깨진 값·저장소 실패 = 「오늘 아직 안 보였다」로 본다(하루 1회 상한은 저장이 살아 있을 때만 의미가 있다).
    return sanitize({});
  }
}

/** 절대 throw 하지 않는다 — 기록 실패로 결과 화면이 막히면 안 된다. */
async function saveRecord(rec: CrossPromoRecord): Promise<void> {
  try {
    await storage.setItem(CROSS_PROMO_KEY, JSON.stringify(rec));
  } catch (err) {
    console.warn('[crosspromo] record save failed:', err);
  }
}

/** 오늘(KST) 아직 카드를 보이지 않았는가. 토스 밖이면 항상 false(카드를 그리지 않는다). */
export async function crossPromoDueToday(): Promise<boolean> {
  if (!isInToss()) return false;
  const rec = await loadRecord();
  return rec.lastShownDay !== kstDateKey(nowMs());
}

/**
 * ★★기록 갱신 직렬화 큐 (2026-09-12 Codex 리뷰 P2-5).
 *   [Codex 실측] 노출 기록 저장이 끝나기 «전»에 클릭 기록 읽기가 시작되면 둘이 각자 «이전 값»을 고쳐
 *   나중 저장이 앞 저장을 지운다 — `lastShownDay` 가 사라지고 `shows=0`, 같은 날 `dueToday=true` 가 됐다.
 *   = 하루 1회 약속이 클릭 한 번으로 깨진다.
 *   ⇒ 읽기-고치기-쓰기 전체를 «한 줄»로 세운다. 두 함수가 같은 큐를 쓰는 것이 핵심이다.
 *   ⛔새 갱신 함수를 만들 때도 반드시 이 큐를 거쳐라(직접 loadRecord/saveRecord 금지).
 */
let recordTail: Promise<void> = Promise.resolve();

function mutateRecord(fn: (rec: CrossPromoRecord) => CrossPromoRecord): Promise<void> {
  const run = async (): Promise<void> => {
    const rec = await loadRecord();
    await saveRecord(fn(rec));
  };
  // 앞 작업이 실패해도 줄은 계속 흐른다(기록 실패로 다음 기록까지 막히면 안 된다).
  recordTail = recordTail.then(run, run);
  return recordTail;
}

/** 카드를 «실제로 그린» 직후 부른다(그날 상한 소비). 멱등 — 같은 날 두 번 불러도 shows 만 늘 뿐 판정은 같다. */
export async function markCrossPromoShown(): Promise<void> {
  await mutateRecord((rec) => ({ ...rec, lastShownDay: kstDateKey(nowMs()), shows: (rec.shows ?? 0) + 1 }));
}

export async function markCrossPromoClicked(): Promise<void> {
  await mutateRecord((rec) => ({ ...rec, clicks: (rec.clicks ?? 0) + 1, lastClickDay: kstDateKey(nowMs()) }));
}

/** 검사기 전용 — 진행 중인 기록 갱신이 모두 끝나기를 기다린다. */
export function __crossPromoSettled(): Promise<void> {
  return recordTail;
}

/**
 * 머니 리그 열기. 절대 throw 하지 않는다.
 *   'ok'      네이티브가 resolve 했다
 *   'failed'  reject·동기 throw·토스 밖 — UI 가 실패 문구를 보인다
 *   'unknown' 4초 무응답 — 열렸을 수도 있다. UI 는 아무 문구도 바꾸지 않는다
 */
export async function openCrossPromo(): Promise<CrossPromoOpenOutcome> {
  if (!isInToss()) return 'failed';
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const outcome = await Promise.race<CrossPromoOpenOutcome>([
      openURL(CROSS_PROMO_TARGET).then((): CrossPromoOpenOutcome => 'ok'),
      new Promise<CrossPromoOpenOutcome>((resolve) => {
        timer = setTimeout(() => resolve('unknown'), OPEN_TIMEOUT_MS);
      }),
    ]);
    if (outcome === 'unknown') console.warn('[crosspromo] openURL: no response within', OPEN_TIMEOUT_MS, 'ms');
    return outcome;
  } catch (err) {
    console.warn('[crosspromo] openURL failed:', err);
    return 'failed';
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** 읽기 전용(하네스·진단). */
export async function crossPromoRecord(): Promise<CrossPromoRecord> {
  return loadRecord();
}
