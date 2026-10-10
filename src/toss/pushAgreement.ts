/**
 * 토스 푸시 알림 동의 «배선» — ★2026-09-10 신설 (머니 리그 -32 `client/src/toss/pushAgreement.ts` 정본 이식)
 *
 * ── 구조 (SDK 실측 · web-bridge@2.10.8 dist/index.d.ts:1109-1135) ──────────────
 *   requestNotificationAgreement({ options:{ templateCode }, onEvent, onError }): () => void
 *   onEvent.type = 'newAgreement' | 'alreadyAgreed' | 'agreementRejected'
 *   반환값 = 앱브릿지 콜백 «해제» 함수. 결과가 오면 반드시 호출한다(SDK 예제와 동일).
 *   ⛔이 함수 «하나»뿐이다. 동의 상태만 조회하는 API · 철회 API 는 없다.
 *     ⇒ 「동의했는지」는 이 기기 Storage 에 적어 두고, 잃으면 다시 눌러 'alreadyAgreed' 로 복구한다.
 *
 * ── templateCode 가 무엇인가 [확인 · 개발자센터 스마트 발송 가이드] ─────────────────
 *   미니앱에서 알림 동의문을 호출할 때 쓰는 templateCode 는 그 알림 동의문이 연결된
 *   «기능성 메시지의 발송 코드»다(콘솔 → 스마트 발송 → 기능성 탭). 발송 코드는 `{appName}-` 로 시작한다.
 *   ⇒ 콘솔 기능성 정기 발송(매일 19:00 KST 「오늘의 대결 — 오늘의 대결 맵이 새로 열렸어요.」)의 코드가 아래 상수다.
 *   ⛔콘솔 코드와 «글자 하나» 다르면 동의창이 안 뜨거나 엉뚱한 동의문이 뜬다 — 바꿀 땐 둘을 같이.
 *
 * ── 발송 주체 ──────────────────────────────────────────────────────────────────
 *   우리 서버는 없다. 콘솔의 «정기 발송»이 동의한 사용자에게 매일 보낸다.
 *   이 파일은 «동의창을 띄우는 것»까지만 한다. 무엇을 언제 보내는지는 콘솔 템플릿이 정본.
 *
 * ── 저장 규율 ──────────────────────────────────────────────────────────────────
 *   새 키 `tc:push.v1` 하나만 «추가». 세이브 블롭(tc:progress)·SAVE_VERSION 무접촉(선례: tc:promo.*).
 *   public/privacy.html §1 표에 같은 키를 고지했다.
 *
 * ── 토스 밖 ────────────────────────────────────────────────────────────────────
 *   itch.io·GitHub Pages·MS Store 경로는 vite shim(src/toss-web)이 이 모듈을 통째로 대체한다 —
 *   availability='unavailable' 이고 설정 행·안내 스트립이 «통째로» 그려지지 않는다(빈 자리 0).
 *
 * ── 머니 리그 정본과 다른 점 (이 레포는 React 가 아니다) ─────────────────────────
 *   · useSyncExternalStore → `subscribePush(listener)` 구독 함수. 첫 구독 때 저장 기록을 읽는다.
 *   · ★`hydrated` 를 상태에 넣었다 — 저장 기록을 읽기 «전»에는 안내 스트립을 그리지 않는다
 *     (정본은 hydrate 전 nudge=true 라 「뜨고 곧 사라지는」 깜빡임이 가능했다. 게임 메뉴는
 *      부팅 직후 바로 보이는 화면이라 그 깜빡임이 눈에 띈다).
 *   · `lastEvent` — 계측(track) 용 enum. 개인정보 없음.
 */
import { requestNotificationAgreement } from '@apps-in-toss/web-framework';
import { storage } from './storage';
import { isInToss } from './env';

/** 콘솔 기능성 정기 발송의 «발송 코드». 콘솔 값과 반드시 같아야 한다(위 주석). */
export const PUSH_TEMPLATE_CODE = '__PUSH_TEMPLATE_CODE__';

/** 이 기기의 동의 기록 + 안내 스트립 닫음 기록. 세이브 블롭 «밖». */
export const PUSH_KEY = 'tc:push.v1';

export interface PushRecord {
  /** 동의 완료('newAgreement' | 'alreadyAgreed')를 이 기기에서 확인한 시각(ms) */
  agreedAt?: number;
  /** 안내 스트립을 닫은 시각(ms). 닫으면 다시 띄우지 않는다(설정 행에서 언제든 켤 수 있다) */
  dismissedAt?: number;
  /** 사용자가 동의창에서 거부한 시각(ms). 안내는 접고, 행은 「다시 켜기」 */
  rejectedAt?: number;
}

export type PushAvailability =
  /** 토스 밖 — 행 자체를 그리지 않는다 */
  | 'unavailable'
  /** 동의 가능(아직 안 함 또는 상태 모름) */
  | 'ready'
  /** 이 기기에서 동의 완료로 기록됨 */
  | 'agreed'
  /** 동의창에서 거부. 다시 시도 가능 */
  | 'rejected';

/** 마지막 동의창 결과(계측용 enum). 개인정보 없음. */
export type PushLastEvent = '' | 'newAgreement' | 'alreadyAgreed' | 'agreementRejected' | 'error';

export interface PushState {
  availability: PushAvailability;
  /** 설정 행·안내 스트립을 그릴지. 토스 안에서만 true */
  available: boolean;
  enabled: boolean;
  /** 동의창 호출 진행 중(중복 호출 방지) */
  busy: boolean;
  /** 안내 스트립을 보일지: 토스 안 + 미동의 + 미거부 + 안 닫음 */
  nudge: boolean;
  /** 저장 기록을 읽었는가. false 면 UI 는 스트립을 그리지 않는다(깜빡임 방지) */
  hydrated: boolean;
  /** 마지막 오류(있으면). 조용히 삼키지 않는다 */
  error: string;
  lastEvent: PushLastEvent;
}

let record: PushRecord = {};
let hydrated = false;
let hydrating: Promise<void> | null = null;

function derive(patch: { busy?: boolean; error?: string; lastEvent?: PushLastEvent } = {}): PushState {
  const available = isInToss();
  const availability: PushAvailability = !available
    ? 'unavailable'
    : record.agreedAt
      ? 'agreed'
      : record.rejectedAt
        ? 'rejected'
        : 'ready';
  return {
    availability,
    available,
    enabled: availability === 'agreed',
    busy: patch.busy ?? state.busy,
    nudge: available && availability === 'ready' && !record.dismissedAt,
    hydrated,
    error: patch.error ?? state.error,
    lastEvent: patch.lastEvent ?? state.lastEvent,
  };
}

let state: PushState = {
  availability: 'unavailable',
  available: false,
  enabled: false,
  busy: false,
  nudge: false,
  hydrated: false,
  error: '',
  lastEvent: '',
};
state = derive();

const listeners = new Set<(s: PushState) => void>();
function emit(): void {
  for (const l of listeners) {
    try {
      l(state);
    } catch (err) {
      console.warn('[push] listener threw:', err);
    }
  }
}
function persist(): void {
  void storage.setItem(PUSH_KEY, JSON.stringify(record)).catch(() => undefined);
}
/**
 * ★기록 판(version) — 2026-09-12 Codex 리뷰 P2-4.
 *   [Codex 실측] 저장 읽기가 «느린» 상태에서 동의가 완료되면, 뒤늦게 돌아온 hydrate 가
 *   `record = o` 로 «옛 거부 기록»을 덮어써 `agreed → rejected` 로 되돌아갔다.
 *   (동의 저장도 cleanup 도 이미 끝난 뒤였다 — 화면만 거짓말을 한다)
 *   ⇒ 살아 있는 변경이 저장소보다 «최신»이다. hydrate 는 자기가 읽기 시작한 뒤 변경이 있었으면 덮지 않는다.
 */
let recordVersion = 0;

function setRecord(patch: PushRecord): void {
  record = { ...record, ...patch };
  recordVersion += 1;
  persist();
  state = derive();
  emit();
}
function setFlags(patch: { busy?: boolean; error?: string; lastEvent?: PushLastEvent }): void {
  state = derive(patch);
  emit();
}

/** 부팅 후 1회. 저장된 기록을 읽는다(실패해도 무해 — 다시 누르면 'alreadyAgreed' 로 복구). */
export function hydratePushState(): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (hydrating) return hydrating;
  hydrating = (async () => {
    const startedAt = recordVersion; // ★읽기를 «시작한» 시점의 판
    try {
      const raw = await storage.getItem(PUSH_KEY);
      if (raw) {
        const o = JSON.parse(raw) as PushRecord;
        if (o && typeof o === 'object') {
          if (recordVersion === startedAt) {
            record = o;
          } else {
            // 읽는 동안 «실제 동의/거부»가 일어났다. 그쪽이 최신이다 — 덮지 않는다(P2-4).
            console.info('[push] hydrate discarded — live change is newer');
          }
        }
      }
    } catch {
      /* 읽기 실패 = 미동의로 보인다. 켜면 복구된다 */
    } finally {
      hydrated = true;
      state = derive();
      emit();
    }
  })();
  return hydrating;
}

export function getPushState(): PushState {
  return state;
}

/**
 * 상태 구독. 첫 구독 때 저장 기록을 자동으로 읽어 온다. 등록 즉시 현재 상태를 한 번 밀어준다.
 * @returns 해제 함수
 */
export function subscribePush(listener: (s: PushState) => void): () => void {
  listeners.add(listener);
  try {
    listener(state);
  } catch (err) {
    console.warn('[push] listener threw:', err);
  }
  void hydratePushState();
  return () => {
    listeners.delete(listener);
  };
}

function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`.slice(0, 120);
  if (typeof error === 'string') return error.slice(0, 120);
  try {
    return JSON.stringify(error).slice(0, 120);
  } catch {
    return String(error).slice(0, 120);
  }
}

/**
 * 알림 켜기 = 토스 알림 동의창 호출.
 * 절대 throw 하지 않는다. 결과가 어느 쪽이든 브릿지 콜백을 해제한다.
 * ⛔타임아웃을 두지 않는다 — 동의창은 «사용자가 읽고 누르는» UI 라 몇 분이 걸려도 정상이다.
 *   대신 busy 로 중복 호출만 막는다(정본과 같은 결정).
 */
export function enablePush(): Promise<PushState> {
  if (!isInToss()) {
    setFlags({ error: 'not in toss', lastEvent: 'error' });
    return Promise.resolve(state);
  }
  if (state.busy) return Promise.resolve(state);
  setFlags({ busy: true, error: '' });

  return new Promise<PushState>((resolve) => {
    let settled = false;
    let cleanup: (() => void) | undefined;
    const finish = (rec: PushRecord | null, lastEvent: PushLastEvent, error = ''): void => {
      if (settled) return;
      settled = true;
      try {
        cleanup?.();
      } catch {
        /* 해제 실패는 결과와 무관 */
      }
      if (rec) {
        record = { ...record, ...rec };
        persist();
      }
      state = derive({ busy: false, error, lastEvent });
      emit();
      resolve(state);
    };
    try {
      cleanup = requestNotificationAgreement({
        options: { templateCode: PUSH_TEMPLATE_CODE },
        onEvent: (result) => {
          if (result.type === 'agreementRejected') {
            finish({ rejectedAt: Date.now(), agreedAt: undefined }, 'agreementRejected');
            return;
          }
          /* 'newAgreement' | 'alreadyAgreed' — 둘 다 켜짐 */
          finish(
            { agreedAt: Date.now(), rejectedAt: undefined },
            result.type === 'alreadyAgreed' ? 'alreadyAgreed' : 'newAgreement'
          );
        },
        onError: (error) => {
          console.warn('[push] requestNotificationAgreement failed:', error);
          finish(null, 'error', describeError(error));
        },
      });
      // 동기적으로 이미 끝났으면(드물지만) 방금 받은 cleanup 을 지금 해제한다.
      if (settled) {
        try {
          cleanup();
        } catch {
          /* noop */
        }
      }
    } catch (error) {
      console.warn('[push] requestNotificationAgreement threw:', error);
      finish(null, 'error', describeError(error));
    }
  });
}

/** 안내 스트립 닫기. 설정 행은 그대로 남는다. */
export function dismissPushNudge(): void {
  setRecord({ dismissedAt: Date.now() });
}

/*
 * ★끄기 버튼은 «없다». 토스 SDK 에 동의 철회 API 가 없다(export 목록 실측 · 켜기 하나뿐).
 *   앱 안에 「끄기」를 두면 로컬 표시만 바뀌고 알림은 계속 온다 = 약속을 안 지키는 스위치다.
 *   ⇒ 끄는 길은 토스 앱 알림 설정이고, 그 사실을 문구(push.row.hint)로 그대로 말한다.
 */
