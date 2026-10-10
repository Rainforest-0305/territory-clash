/**
 * 컬러 시스템 정본 — DESIGN.md §2 (2026-08-30 그래픽 고도화) 를 그대로 옮긴 것이다.
 * 색을 코드 곳곳에 하드코딩하지 마라. 전부 여기서 가져다 써라.
 *
 * 주의: 참가자 수는 이 배열의 길이를 «넘을 수 없다».
 * 넘기면 색이 겹치는 정도가 아니라 render.ts 가 그 유닛의 영토를 «아예 안
 * 그린다»(terr 배열이 FACTIONS.length 기준으로 만들어진다. 예외도 로그도 없다).
 * modes.assertModeTable() 가 부팅 때 이 조건을 실제로 검사한다.
 */

export interface Faction {
  id: string;
  /** 3-스톱 그라디언트 — 영토 «내부». 림보다 어둡다(깊이 = 내부 어둡고 가장자리 밝음). */
  s0: string;
  s1: string;
  s2: string;
  /** 림라이트 / 트레일 / 머리 / 블룸용 발광색 — 팔레트에서 가장 밝은 값 */
  glow: string;
  /** 하부 오클루전용 딥 컬러 */
  deep: string;
  /** 색각 보조 해치 각도(도). 팩션마다 다르다 — 영토 캐시에 1회 구워지므로 매 프레임 비용 0. */
  hatch: number;
}

/**
 * §2.2 팩션 팔레트 (2026-08-30 재설계). index 0(AURORA)은 로컬 플레이어 고정.
 *
 * ── 왜 다시 골랐나 (측정, scripts/palette_cvd.mjs) ────────────────────────────
 * 라이브 팔레트는 정상 시각에서는 갈렸지만(앞 6종 s1 최소 ΔE2000 11.6) 색각 이상
 * 시뮬레이션(Machado 2009, severity 1.0)에서는 «거의 같은 색»이었다:
 *   deutan  s1 최소 4.44 (EMBER↔SOLAR) · glow 최소 2.77 (TOXIN↔SOLAR)
 *   protan  s1 최소 2.87 (AURORA↔VIOLET) · glow 최소 2.03 (AURORA↔FROST)
 * 적록 색각 이상에서 남는 축은 «명도»와 «청-황»뿐이다. 그래서 앞 6종을
 * 명도 사다리로 재배치했다(s1 상대휘도): FROST .80 / SOLAR .65 / TOXIN .45 /
 * AURORA .24 / EMBER .16 / VIOLET .13 — 이웃끼리 «색상»도 «명도»도 다르다.
 *   결과(앞 6종)  normal s1 27.4 · deutan s1 9.50 · protan s1 11.06 · glow deutan 8.81
 *   결과(10종)    normal s1 14.8 · deutan s1 4.61 · protan s1 10.41
 * 10종은 3·5분 모드에서만 쓰이고, 그 모드는 팩션별 «해치 각도»(hatch)가 색을
 * 보조한다 — 영토가 캐시에 구워지므로 해치는 매 프레임 비용이 «0»이다.
 *
 * ── 내부는 어둡게, 가장자리는 밝게 ──────────────────────────────────────────
 * s0→s1→s2 는 영토 «내부» 그라디언트라 일부러 glow 보다 어둡다. 깊이감은
 * 「내부 어둡고 림 밝음」에서 나오고, 블룸은 emissive 버퍼(림·트레일·머리)만
 * 번지므로 내부가 하얗게 타지 않는다. HUD 텍스트가 영토 위에 얹혀도 대비가 산다.
 */
export const FACTIONS: readonly Faction[] = [
  { id: 'AURORA', s0: '#22D3EE', s1: '#3B82F6', s2: '#6D3BE8', glow: '#7DF4FF', deep: '#0B1E52', hatch: 45 },
  { id: 'EMBER', s0: '#FF5A36', s1: '#D6261E', s2: '#7A0F14', glow: '#FF8A5C', deep: '#4A1206', hatch: -45 },
  { id: 'TOXIN', s0: '#A6F04A', s1: '#2ECC71', s2: '#128C5C', glow: '#C6FF6E', deep: '#0A3B2E', hatch: 0 },
  { id: 'VIOLET', s0: '#E24CF5', s1: '#8E2BE0', s2: '#43158F', glow: '#F58CFF', deep: '#33095C', hatch: 90 },
  { id: 'SOLAR', s0: '#FFF06E', s1: '#FFCC1F', s2: '#F08A12', glow: '#FFF7B3', deep: '#4D2400', hatch: 22 },
  { id: 'FROST', s0: '#FFFFFF', s1: '#DCE8FF', s2: '#A9BCF5', glow: '#FFFFFF', deep: '#101F52', hatch: -22 },
  // ── 아래 4종은 3·5분 모드 전용 ───────────────────────────────────────────
  { id: 'CRIMSON', s0: '#FF5C7A', s1: '#B0113A', s2: '#560A22', glow: '#FF8FA6', deep: '#3D0217', hatch: 67 },
  { id: 'LAGOON', s0: '#4DF5D0', s1: '#0FA3A8', s2: '#0A5763', glow: '#8AFFE6', deep: '#032836', hatch: -67 },
  { id: 'LILAC', s0: '#EEDCFF', s1: '#B49BE6', s2: '#7B55C4', glow: '#F4E9FF', deep: '#2A1A4A', hatch: 112 },
  { id: 'BRONZE', s0: '#E8B06A', s1: '#B5732A', s2: '#6B3E10', glow: '#FFD59A', deep: '#3A2008', hatch: 157 },
] as const;

/** §2.1 / §2.3 베이스 · 시맨틱 토큰 */
export const PAL = {
  void0: '#05060B',
  void1: '#0A0D16',
  void2: '#121728',
  void3: '#1B2238',
  /** 오로라 헤이즈 3겹 */
  haze: ['#2A3A6B', '#3B2A6B', '#0E4A55'] as const,
  gridMinor: 'rgba(126,156,220,0.045)',
  gridMajor: 'rgba(126,156,220,0.10)',
  gridDot: 'rgba(126,156,220,0.16)',
  gridEdge: 'rgba(126,156,220,0.35)',
  danger: '#FF2D55',
  success: '#24E5A0',
  goldA: '#FFCE4A',
  goldB: '#FF9B2E',
  ink0: '#F2F5FF',
  ink1: '#A8B2D8',
  ink2: '#8FA3C8',
  line: 'rgba(168,178,216,0.14)',
} as const;

/** '#RRGGBB' + alpha → 'rgba(r,g,b,a)'. 매 프레임 호출되므로 캐시한다. */
const rgbaCache = new Map<string, string>();
export function hexa(hex: string, a: number): string {
  const key = hex + '|' + a.toFixed(3);
  const hit = rgbaCache.get(key);
  if (hit) return hit;
  const n = parseInt(hex.slice(1), 16);
  const out = `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  if (rgbaCache.size < 4096) rgbaCache.set(key, out);
  return out;
}

/** 팩션 인덱스를 안전하게 감싼다(플레이어 수 > 팩션 수 여도 크래시 금지). */
export function faction(i: number): Faction {
  return FACTIONS[((i % FACTIONS.length) + FACTIONS.length) % FACTIONS.length]!;
}
