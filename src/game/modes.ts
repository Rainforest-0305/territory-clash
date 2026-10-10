/**
 * ############################################################################
 * ##  모드 테이블 — 시간 / 맵 크기 / 참가자 수 / 난이도의 «단일 출처»       ##
 * ############################################################################
 *
 * 여기 말고 다른 곳에 「180초」·「80×140」·「봇 8」 같은 수를 적지 마라.
 * 값이 흩어지면 밸런스를 만질 때마다 어긋난 조합이 하나씩 살아남는다.
 *
 * ── ⚠ 이 표의 수치는 «잠정»이다 ─────────────────────────────────────────────
 * 우리가 «실측»한 범위는 팩션 6종(참가자 6명) · 64×112 맵뿐이다.
 * 참가자 8·10 과 확대된 맵은 그 범위 «밖»이라 외삽이다.
 * 그래서 이 값들은 「이 정도면 된다」가 아니라 「일단 이 값으로 재 본다」다.
 * 실기기 계측이 쌓이면 여기 숫자만 고친다.
 *   · 각 판이 끝날 때 `[mode]` 콘솔 줄에 «최대 동시 생존 유닛·최대 점유 면적»이
 *     찍힌다. 그게 이 표를 다시 정할 때 쓰는 근거다.
 *
 * ── 맵 크기 규칙 ────────────────────────────────────────────────────────────
 * 가로세로비는 «4:7 고정»이다(64×112 = 4:7). 비를 바꾸면 미니맵 종횡비와
 * 카메라 프레이밍이 같이 흔들려서 「같은 게임」으로 안 보인다.
 * 그래서 크기는 배수 k 하나로만 정한다 — cols = 4k, rows = 7k.
 *
 *   60초   k=16   64×112   7,168칸    면적 ×1      (현행과 «완전 동일»)
 *  180초   k=20   80×140  11,200칸    면적 ×1.5625
 *  300초   k=23   92×161  14,812칸    면적 ×2.066
 *
 * ★ 시간에 «선형»으로(×3 / ×5) 키우지 않는다. 세로 스크롤 화면에서 맵이
 *   그만큼 커지면 이동 시간만 늘고 교전이 사라진다 — 같은 게임이 아니게 된다.
 *   면적은 시간보다 훨씬 완만하게 올린다.
 */

/** 저장 키로도 쓰이는 모드 식별자. 값 = 세션 길이(초). */
export type ModeKey = '60' | '180' | '300';

export interface ModeSpec {
  key: ModeKey;
  /** 세션 길이(초) */
  sec: number;
  /** 아레나 가로 셀 수 (= 4k) */
  cols: number;
  /** 아레나 세로 셀 수 (= 7k) */
  rows: number;
  /** 플레이어 포함 총 참가자 수 */
  participants: number;
  /** 참가자 중 고스트(내 과거 리플레이)로 채우는 수 */
  ghostSlots: number;
}

/**
 * ★ participants 는 팔레트(palette.ts FACTIONS)의 길이를 «넘을 수 없다».
 *   넘기면 색이 중복되는 정도가 아니라 render.ts 가 그 유닛의 영토를
 *   «아예 안 그린다»(terr 배열이 FACTIONS.length 기준으로 만들어진다).
 *   assertModeTable() 가 부팅 때 이 조건을 실제로 검사한다.
 */
export const MODE_TABLE: Record<ModeKey, ModeSpec> = {
  '60': { key: '60', sec: 60, cols: 64, rows: 112, participants: 6, ghostSlots: 2 },
  '180': { key: '180', sec: 180, cols: 80, rows: 140, participants: 8, ghostSlots: 2 },
  '300': { key: '300', sec: 300, cols: 92, rows: 161, participants: 10, ghostSlots: 2 },
};

/** 메뉴에 나오는 순서. */
export const MODE_ORDER: readonly ModeKey[] = ['60', '180', '300'];

/** 기존 사용자가 아무것도 고르지 않았을 때의 모드 = 지금까지 유일했던 그 모드. */
export const DEFAULT_MODE: ModeKey = '60';

export function asModeKey(v: unknown): ModeKey | null {
  return v === '60' || v === '180' || v === '300' ? v : null;
}

export function modeOf(key: ModeKey): ModeSpec {
  return MODE_TABLE[key];
}

// ── 난이도 ──────────────────────────────────────────────────────────────────
/**
 * 'auto' = 기존 동작(§3-E MMR-lite). 최근 5경기 평균 순위로 봇 레벨을 정한다.
 * 나머지 4종은 «사용자가 직접 고른 것»이라 MMR 을 «무시»한다 — 수동이 이긴다.
 *
 * ★ 기본값이 'auto' 인 것이 중요하다. 아무것도 건드리지 않은 사용자의 1분 판은
 *   지금까지와 «완전히 같은» 봇 배정을 받는다.
 */
export type Difficulty = 'auto' | 'easy' | 'normal' | 'hard' | 'elite';

export const DIFFICULTY_ORDER: readonly Difficulty[] = ['auto', 'easy', 'normal', 'hard', 'elite'];

export const DEFAULT_DIFFICULTY: Difficulty = 'auto';

export function asDifficulty(v: unknown): Difficulty | null {
  return v === 'auto' || v === 'easy' || v === 'normal' || v === 'hard' || v === 'elite' ? v : null;
}

/**
 * 봇 레벨 분포. sim.ts assignBotLevels 의 avgRank 분기와 «같은 표»를 쓴다.
 * (거기 값을 바꾸면 여기도 같이 바꿔라 — 일부러 값을 복제하지 않고 아래
 *  BOT_LEVEL_DIST 하나만 두고 양쪽이 이걸 참조한다.)
 */
export const BOT_LEVEL_DIST = {
  elite: [4, 4, 5, 5, 5],
  hard: [3, 4, 4, 5, 5],
  normal: [2, 3, 3, 4, 4],
  easy: [1, 1, 2, 2, 3],
} as const;

export function distForDifficulty(d: Exclude<Difficulty, 'auto'>): readonly number[] {
  return BOT_LEVEL_DIST[d];
}

/**
 * 모드 표가 렌더러·팔레트 제약을 지키는지 «실제로» 검사한다.
 * 부팅 때 한 번 부른다. 조용히 넘어가면 참가자가 늘었을 때 영토가 안 그려지는
 * 버그가 «화면에서만» 드러난다(예외가 안 난다) — 그래서 여기서 소리를 낸다.
 *
 * @param factionCount palette.FACTIONS.length
 * @returns 위반 목록(빈 배열이면 정상)
 */
export function assertModeTable(factionCount: number): string[] {
  const bad: string[] = [];
  for (const key of MODE_ORDER) {
    const m = MODE_TABLE[key];
    if (m.participants > factionCount) {
      bad.push(
        `mode ${key}: participants ${m.participants} > factions ${factionCount} ` +
          `(render.ts 가 유닛 ${factionCount}번 이상의 영토를 그리지 않는다)`
      );
    }
    if (m.cols * 7 !== m.rows * 4) {
      bad.push(`mode ${key}: ${m.cols}x${m.rows} 는 4:7 이 아니다(미니맵·카메라 비율이 깨진다)`);
    }
    if (m.ghostSlots >= m.participants) {
      bad.push(`mode ${key}: ghostSlots ${m.ghostSlots} >= participants ${m.participants}`);
    }
  }
  return bad;
}
