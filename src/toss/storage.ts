/**
 * 게임 필수 SDK ③ — 네이티브 Storage
 *
 * 미적용 시 앱인토스 심사 반려 사유다.
 *
 * ── 왜 localStorage 로 때우면 안 되는가 ──────────────────────────────────────
 * 미니앱 WebView 의 localStorage 는 영속을 보장하지 않는다. 토스 앱이 WebView
 * 데이터를 비우거나 origin 이 바뀌면 통째로 날아간다. 최고기록/진행도가
 * 사라지는 건 게임에서 치명적이다. 네이티브 Storage(AsyncStorage 계열)는
 * 앱 데이터 영역에 저장되어 살아남는다.
 * (MIRI 에서도 파일 저장 유실 때문에 영속 저장소로 갈아탄 실사고 이력이 있다.)
 *
 * ── API (@apps-in-toss/web-framework 공개 export) ───────────────────────────
 *   Storage.getItem(key)      : Promise<string | null>
 *   Storage.setItem(key, val) : Promise<void>
 *   Storage.removeItem(key)   : Promise<void>
 *   Storage.clearItems()      : Promise<void>
 *   내부적으로 createAsyncBridge('getStorageItem') 등이다(실측).
 *   문자열만 저장된다 — 객체는 JSON.stringify 해서 넣어야 한다.
 *
 * ── 이 래퍼가 하는 일 ───────────────────────────────────────────────────────
 *  1) 토스 안 → 네이티브 Storage, 토스 밖 → localStorage 로 자동 분기.
 *     같은 코드가 vite dev / 플레이스토어 APK / 토스에서 모두 동작한다.
 *  2) 브릿지 실패를 흡수(절대 throw 안 함). 저장 실패로 게임이 죽으면 안 된다.
 *  3) 게임 루프에서 setItem 을 남발하지 못하도록 **쓰기 병합(coalesce)** 제공.
 *     매 프레임 호출하면 postMessage 가 브릿지를 막아 프레임이 떨어진다.
 */
import { Storage } from '@apps-in-toss/web-framework';
import { isInToss, safeBridge } from './env';

const NS = 'tc:'; // territory-clash 네임스페이스. 다른 미니앱과 키 충돌 방지.

function localGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function localSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota / private mode — 무시 */
  }
}
function localRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (!isInToss()) return localGet(key);
    return safeBridge(`Storage.getItem(${key})`, () => Storage.getItem(key), localGet(key));
  },

  async setItem(key: string, value: string): Promise<void> {
    // 네이티브가 실패해도 최소한 세션 내에서는 값이 살아있게 로컬에도 쓴다.
    localSet(key, value);
    if (!isInToss()) return;
    await safeBridge(`Storage.setItem(${key})`, () => Storage.setItem(key, value), undefined);
  },

  async removeItem(key: string): Promise<void> {
    localRemove(key);
    if (!isInToss()) return;
    await safeBridge(`Storage.removeItem(${key})`, () => Storage.removeItem(key), undefined);
  },

  async clearItems(): Promise<void> {
    if (!isInToss()) return;
    await safeBridge('Storage.clearItems', () => Storage.clearItems(), undefined);
  },

  /** JSON 편의 래퍼. 파싱 실패 시 fallback 반환(저장된 값이 깨져도 게임은 뜬다). */
  async getJSON<T>(key: string, fallback: T): Promise<T> {
    const raw = await this.getItem(key);
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      console.warn(`[toss-sdk][storage] corrupt JSON at ${key}, using fallback`);
      return fallback;
    }
  },

  async setJSON(key: string, value: unknown): Promise<void> {
    await this.setItem(key, JSON.stringify(value));
  },
};

/**
 * 쓰기 병합 저장소.
 *   save.set('tc:progress', obj) 를 매 프레임 불러도 실제 브릿지 호출은
 *   flushMs 마다 1회만 일어난다. 게임 루프에서는 반드시 이걸 써라.
 */
export function createCoalescedWriter(flushMs = 800) {
  const pending = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function flush(): Promise<void> {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending.size === 0) return;
    const entries = [...pending.entries()];
    pending.clear();
    for (const [k, v] of entries) {
      await storage.setItem(k, v);
    }
  }

  function schedule(): void {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, flushMs);
  }

  return {
    set(key: string, value: unknown): void {
      pending.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      schedule();
    },
    /** 앱이 백그라운드로 갈 때 / 게임오버 때 즉시 반영 */
    flush,
  };
}

/** 게임 전역 저장 키 정본. 문자열 리터럴을 코드 곳곳에 흩뿌리지 마라. */
export const KEYS = {
  bestScore: `${NS}bestScore`,
  progress: `${NS}progress`,
  settings: `${NS}settings`,
  /** SDK 연동 self-test 용 (심사/디버그 확인 목적) */
  sdkSelfTest: `${NS}sdkSelfTest`,
} as const;
