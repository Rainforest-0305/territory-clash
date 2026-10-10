/**
 * 게임 필수 SDK ① — 사용자 식별키 (getUserKeyForGame)
 *
 * 미적용 시 앱인토스 심사 반려 사유다. 랭킹/진행도 저장의 사용자 단위가
 * 이 키다. 절대 다른 식별자(디바이스 ID, 자체 생성 UUID)로 대체하지 마라.
 *
 * ── 반환값 처리 ─────────────────────────────────────────────────────────────
 *   { type:'HASH', hash } 성공. hash 를 유저 ID 로 쓴다.
 *   'INVALID_CATEGORY'    토스 콘솔의 앱 카테고리가 '게임'이 아니다.
 *                         → 코드가 아니라 콘솔 설정 문제. 반드시 표면화할 것.
 *   'ERROR'               알 수 없는 오류.
 *   undefined             토스 앱 버전이 낮아 이 API 를 모른다.
 *
 * ── 오프라인/토스 밖 폴백 ───────────────────────────────────────────────────
 *   로컬 개발과 플레이스토어 APK 에서는 브릿지가 없다. 그때는 로컬에서 만든
 *   익명 ID 를 쓰되, **토스에서 받은 키와 절대 섞지 않는다**(source 필드로 구분).
 *   서버 랭킹을 붙일 때 source==='toss' 인 것만 토스 랭킹에 올려야 한다.
 */
import { getUserKeyForGame, getAnonymousKey } from './bridge';
import { safeBridge, isInToss } from './env';
import { storage } from './storage';

const LOCAL_ID_KEY = 'tc:localAnonId';

export type IdentitySource = 'toss' | 'local';

export interface Identity {
  userKey: string;
  source: IdentitySource;
  /** 토스 브릿지가 카테고리 미설정을 반환했는가 (콘솔 설정 필요 신호) */
  invalidCategory: boolean;
}

let cached: Identity | null = null;

function makeLocalId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return `local-${c.randomUUID()}`;
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

async function resolveLocalIdentity(): Promise<Identity> {
  const existing = await storage.getItem(LOCAL_ID_KEY);
  if (existing) {
    return { userKey: existing, source: 'local', invalidCategory: false };
  }
  const fresh = makeLocalId();
  await storage.setItem(LOCAL_ID_KEY, fresh);
  return { userKey: fresh, source: 'local', invalidCategory: false };
}

/**
 * 사용자 식별키를 확보한다. 앱 부팅 시 1회 호출하고 결과를 캐시한다.
 * 절대 throw 하지 않는다 — 실패해도 게임은 떠야 한다.
 */
export async function resolveIdentity(): Promise<Identity> {
  if (cached) return cached;

  if (!isInToss()) {
    cached = await resolveLocalIdentity();
    console.log('[toss-sdk][identity] not in Toss, local id:', cached.userKey);
    return cached;
  }

  // 신규 API 우선. 구버전 토스 앱이면 undefined 가 오므로 레거시로 폴백한다.
  const modern = await safeBridge('getAnonymousKey', () => getAnonymousKey(), undefined);
  if (modern && modern !== 'ERROR' && modern.type === 'HASH') {
    cached = { userKey: modern.hash, source: 'toss', invalidCategory: false };
    console.log('[toss-sdk][identity] getAnonymousKey ok, userKey=', cached.userKey);
    return cached;
  }

  const legacy = await safeBridge('getUserKeyForGame', () => getUserKeyForGame(), undefined);
  if (legacy && legacy !== 'ERROR' && legacy !== 'INVALID_CATEGORY' && legacy.type === 'HASH') {
    cached = { userKey: legacy.hash, source: 'toss', invalidCategory: false };
    console.log('[toss-sdk][identity] getUserKeyForGame ok, userKey=', cached.userKey);
    return cached;
  }

  if (legacy === 'INVALID_CATEGORY') {
    // 조용히 넘기지 마라. 콘솔에서 앱 카테고리를 '게임'으로 바꿔야 한다.
    console.error(
      '[toss-sdk][identity] INVALID_CATEGORY — 토스 콘솔의 앱 카테고리가 게임이 아닙니다. ' +
        '콘솔 설정을 고쳐야 사용자 식별키를 받을 수 있습니다.'
    );
    const local = await resolveLocalIdentity();
    cached = { ...local, invalidCategory: true };
    return cached;
  }

  console.warn('[toss-sdk][identity] Toss user key unavailable, falling back to local id');
  cached = await resolveLocalIdentity();
  return cached;
}

/** 이미 확보된 식별자(부팅 이후에만 유효). 부팅 전이면 null. */
export function currentIdentity(): Identity | null {
  return cached;
}
