/**
 * 영속 데이터 + 고스트 리플레이 저장 (USP-E).
 *
 * ★ 규칙 A 준수: localStorage 를 직접 부르지 않는다. 읽기는 storage,
 *   쓰기는 반드시 createCoalescedWriter. 게임 루프에서 storage.setItem 을
 *   부르면 브릿지가 막혀 프레임이 떨어진다.
 * ★ 키는 KEYS 정본만 쓴다. 새 키를 발명하지 않고 KEYS.progress 한 덩어리에
 *   모아 넣는다(키가 흩어지면 마이그레이션이 지옥이 된다).
 */
import { storage, KEYS } from '../toss';
import { nickName } from '../i18n';
import { DEFAULT_MODE, MODE_ORDER, asModeKey, type ModeKey } from './modes';

export interface GhostRecord {
  nick: string;
  seed: number;
  /** base64(Uint8Array) — 20Hz 각도 스트림 */
  data: string;
  /**
   * 이 리플레이가 «어느 모드»에서 나왔는가 (2026-08-10 추가).
   * ★ 없으면 '60' 으로 «간주»한다 — 이 필드가 생기기 전에는 60초 모드밖에
   *   없었기 때문이다(sim.ts SESSION_SEC 단일 상수였다. 추정이 아니라 사실).
   * ★ 모드가 다르면 맵 치수 자체가 달라서 리플레이가 «무효»다. 그래서 고스트는
   *   seed 뿐 아니라 mode 까지 같아야 재생한다.
   */
  mode?: ModeKey;
}

/** 고스트 레코드의 모드. 없으면 1분으로 귀속. */
export function ghostMode(g: GhostRecord): ModeKey {
  return asModeKey(g.mode) ?? DEFAULT_MODE;
}

export interface SaveData {
  /** 총 플레이 판수 (온보딩 보정 판정용, §3-E) */
  plays: number;
  /** 최근 5경기 순위 (MMR-lite) */
  recentRanks: number[];
  /** 시스템 생성 닉네임 (v1 자유입력 없음, §3-E) */
  nick: string;
  /** 내 리플레이 풀 (최근 4판) */
  ghosts: GhostRecord[];
  /** 고스트 수집 옵트아웃 */
  ghostOptOut: boolean;
  coins: number;
  totalCells: number;
  /**
   * ── 통산 기록 (2026-08-05 추가) ──────────────────────────────────────
   * 이전에는 endSession 이 xp 를 계산해 결과 화면에 보여주기만 하고 버렸다.
   * 판을 아무리 쌓아도 남는 게 없다는 실기기 지적이 나와 누적으로 바꿨다.
   * ★ loadSave 가 `{...DEFAULT_SAVE, ...raw}` 로 병합하므로 이 필드가 없던
   *   기존 저장본도 0 으로 채워져 열린다 — 마이그레이션 코드 불요.
   */
  /** 누적 경험치 */
  xp: number;
  /** 누적 처치 */
  totalKills: number;
  /** 역대 최장 꼬리(칸) */
  bestTrail: number;
  /** 1위로 끝낸 판 수 */
  wins: number;
  /**
   * ── 모드별 최고 점수 (2026-08-10 추가) ────────────────────────────────────
   * ★ 왜 하나로 두면 안 되는가: 점수 = 지가 × 보유시간이라 5분 판은 1분 판보다
   *   «구조적으로» 훨씬 크다. 같은 칸에 쓰면 5분 점수가 1분 최고기록을 덮고,
   *   그 뒤로 1분 기록은 «영원히 갱신 불가»가 된다. 기록이 죽는다.
   * ★ 기존 KEYS.bestScore(숫자 한 개)는 «1분 기록으로 귀속»한다 —
   *   그때는 60초 모드밖에 없었으므로 사실이다. loadBestByMode() 참고.
   */
  bestByMode: Partial<Record<ModeKey, number>>;
}

export const DEFAULT_SAVE: SaveData = {
  plays: 0,
  recentRanks: [],
  nick: '',
  ghosts: [],
  ghostOptOut: false,
  coins: 0,
  totalCells: 0,
  xp: 0,
  totalKills: 0,
  bestTrail: 0,
  wins: 0,
  bestByMode: {},
};

/**
 * 닉네임 풀의 한 변. 예전에는 형용사 8종 × 명사 8종을 런타임에 이어붙였다.
 * 그 방식은 형용사-명사 성·수 일치가 필요한 언어에서 반드시 깨지므로,
 * 로케일마다 **완성된 64개** 목록을 두고 인덱스로만 고른다.
 *
 * ★ idx = (형용사 인덱스) * 8 + (명사 인덱스) 로 원본 조합 순서를 그대로
 *   보존한다. 그래서 ko 에서는 기존 사용자의 닉네임이 한 글자도 바뀌지 않고,
 *   저장 데이터 마이그레이션도 필요 없다.
 */
const NICK_DIM = 8;

/** userKey 해시 → 결정론적 시스템 닉네임(64종). 자유 입력 없음 = 필터·신고 운영 제거. */
export function nickFor(userKey: string): string {
  let h = 2166136261;
  for (let i = 0; i < userKey.length; i++) {
    h ^= userKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h = h >>> 0;
  // ⚠ >>> 를 써야 한다. >> 는 부호비트가 살아 h > 2^31 일 때 음수 인덱스가
  //   나와 닉네임이 'undefined' 로 깨진다(실측 버그).
  return nickName((h % NICK_DIM) * NICK_DIM + ((h >>> 5) % NICK_DIM));
}

export async function loadSave(userKey: string): Promise<SaveData> {
  const raw = await storage.getJSON<Partial<SaveData>>(KEYS.progress, {});
  const s: SaveData = { ...DEFAULT_SAVE, ...raw };
  s.recentRanks = Array.isArray(s.recentRanks) ? s.recentRanks.slice(-5) : [];
  s.ghosts = Array.isArray(s.ghosts) ? s.ghosts.slice(-4) : [];
  /**
   * ★ 반드시 «새 객체»로 만든다.
   *   `{...DEFAULT_SAVE}` 는 얕은 복사라 bestByMode 가 없으면 DEFAULT_SAVE 의
   *   «그 객체»를 그대로 물려받는다. 거기에 점수를 쓰면 모듈 상수가 오염되고,
   *   그 뒤 로드부터 남의 기록이 기본값으로 딸려 나온다.
   */
  s.bestByMode = sanitizeBestByMode(raw?.bestByMode);
  // 저장된 값을 재사용하지 않고 매번 다시 만든다. nickFor 는 userKey 만으로
  // 결정되므로 결과가 흔들리지 않으면서, 사용자가 언어를 바꾸면 닉네임도
  // 그 언어로 따라온다(예전 언어로 굳은 이름이 남지 않는다).
  s.nick = nickFor(userKey);
  return s;
}

/** 알려진 모드 키 + 유한한 양수만 남긴다. 깨진 값이 와도 게임은 뜬다. */
function sanitizeBestByMode(v: unknown): Partial<Record<ModeKey, number>> {
  const out: Partial<Record<ModeKey, number>> = {};
  if (!v || typeof v !== 'object') return out;
  for (const k of MODE_ORDER) {
    const n = (v as Record<string, unknown>)[k];
    if (typeof n === 'number' && Number.isFinite(n) && n > 0) out[k] = n;
  }
  return out;
}

/**
 * 구버전 최고점수 키(숫자 한 개). **지우지 않는다.**
 * 읽어서 1분 칸의 초기값으로만 쓰고 그 자리에 그대로 둔다 —
 * 구버전으로 롤백해도 기록이 살아 있어야 한다.
 */
export async function loadBest(): Promise<number> {
  const n = await storage.getJSON<number>(KEYS.bestScore, 0);
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * 모드별 최고점수 정본을 만든다.
 *   저장된 bestByMode  ∪  구버전 bestScore(→ '60' 으로 귀속)
 *
 * ★ 귀속이 «추정»이 아닌 이유: 이 필드가 생기기 전 코드에는 세션 길이 상수가
 *   60 하나뿐이었다(sim.ts). 그래서 그때까지 나온 모든 점수는 1분 판에서 나왔다.
 */
export async function loadBestByMode(save: SaveData): Promise<Record<ModeKey, number>> {
  const legacy = await loadBest();
  const out: Record<ModeKey, number> = { '60': 0, '180': 0, '300': 0 };
  for (const k of MODE_ORDER) out[k] = save.bestByMode[k] ?? 0;
  if (legacy > out[DEFAULT_MODE]) out[DEFAULT_MODE] = legacy;
  return out;
}

// ── 고스트 인코딩 ──────────────────────────────────────────────────────────
export function encodeGhost(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  try {
    return btoa(s);
  } catch {
    return '';
  }
}

export function decodeGhost(b64: string): Uint8Array {
  try {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array(0);
  }
}

/**
 * 리플레이 녹화 상한(초).
 * ★ 3·5분 모드를 통째로 녹화하면 판당 6,000B → base64 8KB 가 되고, 4판이면
 *   저장 문자열이 32KB 로 부푼다. 브릿지로 오가는 문자열이라 그건 위험하다.
 * ★ 상한을 넘으면 고스트는 스트림 소진 → 봇 AI 로 «이미 있는» 하이브리드
 *   폴백을 탄다(bots.ts: `gh.cursor >= gh.frames.length` → fellBack).
 *   새 실패 경로를 만드는 게 아니라 기존 경로를 쓰는 것이다.
 * ★ 60초 모드는 이 상한에 «닿지 않는다» — 버퍼 상한이 예전 값(1300)과 동일해
 *   1분 판의 녹화 결과는 한 바이트도 달라지지 않는다.
 */
export const GHOST_MAX_SEC = 120;

/** 세션 길이(초) → 녹화 버퍼 상한(샘플). 60초 → 1300 (기존 하드코딩 값과 동일) */
export function ghostBufferCap(sessionSec: number): number {
  return Math.round(Math.min(sessionSec + 5, GHOST_MAX_SEC) * 20);
}

/**
 * 입력 리플레이 레코더. 20Hz 스냅샷(각도 1B).
 * 255 = 입력 없음. 60초 × 20Hz = 1,200B ≈ base64 1.6KB/판.
 */
export class GhostRecorder {
  private buf: number[] = [];
  private acc = 0;
  private cap: number;

  constructor(sessionSec: number = 60) {
    this.cap = ghostBufferCap(sessionSec);
  }

  tick(dtReal: number, aim: number, throttle: number): void {
    this.acc += dtReal;
    while (this.acc >= 0.05 && this.buf.length < this.cap) {
      this.acc -= 0.05;
      if (throttle < 0.05) this.buf.push(255);
      else {
        let a = ((aim + Math.PI) / (Math.PI * 2)) % 1;
        if (a < 0) a += 1;
        this.buf.push(Math.min(250, Math.round(a * 250)));
      }
    }
  }

  bytes(): Uint8Array {
    return Uint8Array.from(this.buf);
  }
  get length(): number {
    return this.buf.length;
  }
}
