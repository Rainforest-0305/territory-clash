/**
 * USP-E — 봇 AI 5단계 + 비동기 고스트 리플레이.
 *
 * 기획서 §3-E 표를 파라미터 테이블로 옮겼다. 레벨은 "다른 알고리즘"이 아니라
 * 같은 알고리즘의 파라미터 세트다(반응지연 / 시야 / 지가 가중치 / 절단 의지 /
 * 튕기기 성공률). 그래야 5단계가 실제로 다르게 느껴지면서도 유지보수가 된다.
 *
 * 고스트 하이브리드 폴백(§3-E): 리플레이는 결정론적 시드 맵에서만 유효하므로
 * 사망·장기 이탈·스트림 소진 중 하나라도 발생하면 즉시 봇 AI 로 전환한다.
 * 전환 사실은 유저에게 표시하지 않는다(배지는 유지).
 */
import { CELL, COLS, ROWS, TIER_VALUE } from './grid';
import type { BotState, Unit } from './types';
import type { World } from './sim';

interface LevelSpec {
  /** 반응 지연(초) */
  delay: number;
  /** 탐색 반경(셀) */
  reach: number;
  /** 적 꼬리 추격 반경(셀). 0 = 교전 회피 */
  chase: number;
  /** 튕기기 성공 의도 확률 */
  bounce: number;
  /** 지가 가중치 */
  valueW: number;
  /** 한 번에 나가는 최대 꼬리 길이(리스크 감수) */
  leg: number;
}

/** 기획서 §3-E 표 그대로 */
const LEVELS: readonly LevelSpec[] = [
  { delay: 0.42, reach: 8, chase: 0, bounce: 0.0, valueW: 0.0, leg: 14 },
  { delay: 0.34, reach: 11, chase: 11, bounce: 0.4, valueW: 0.25, leg: 20 },
  { delay: 0.26, reach: 15, chase: 14, bounce: 0.6, valueW: 0.7, leg: 28 },
  { delay: 0.18, reach: 19, chase: 18, bounce: 0.8, valueW: 1.1, leg: 36 },
  { delay: 0.11, reach: 24, chase: 22, bounce: 0.95, valueW: 1.5, leg: 46 },
];

export function makeBotState(): BotState {
  return { think: Math.random() * 0.3, target: -1, returning: false, bounceIntent: false, bounceTimer: 2 };
}

export function updateBot(w: World, u: Unit, dtReal: number): void {
  // ── 고스트 리플레이 우선 ────────────────────────────────────────────────
  const gh = u.ghost;
  if (gh && !gh.fellBack) {
    if (u.deaths > 0 || u.outsideT > 7 || gh.cursor >= gh.frames.length) {
      gh.fellBack = true; // 하이브리드 폴백
    } else {
      gh.acc += dtReal;
      while (gh.acc >= 0.05 && gh.cursor < gh.frames.length) {
        gh.acc -= 0.05;
        gh.cursor++;
      }
      const b = gh.frames[Math.min(gh.frames.length - 1, gh.cursor)]!;
      if (b === 255) {
        u.throttle = 0;
      } else {
        u.aim = (b / 250) * Math.PI * 2 - Math.PI;
        u.throttle = 1;
      }
      return;
    }
  }

  const L = LEVELS[Math.min(LEVELS.length, Math.max(1, u.botLv)) - 1]!;
  const s = u.ai;

  // 튕기기 시도 (§3-A 를 봇도 쓴다 — 안 쓰면 플레이어만 강력해져 밸런스가 깨진다)
  s.bounceTimer -= dtReal;
  if (u.gauge >= 100 && u.cd <= 0 && u.trail.length === 0 && s.bounceTimer <= 0 && L.bounce > 0) {
    s.bounceTimer = 3 + Math.random() * 4;
    if (Math.random() < L.bounce + 0.15) {
      const willSucceed = Math.random() < L.bounce;
      // 120° 씩 꺾는 정삼각형 = 3탄이 정확히 시작점으로 복귀(= 성공).
      // 실패 롤이면 3탄 파워를 줄여 자기 영역 밖에 떨어뜨린다.
      const toCenter = Math.atan2(ROWS * CELL * 0.5 - u.y, COLS * CELL * 0.5 - u.x);
      const a = toCenter + (Math.random() - 0.5) * 1.2;
      const p = 11 + Math.random() * 9;
      w.startAutoBounce(u, [
        { angle: a, power: p },
        { angle: a + (Math.PI * 2) / 3, power: p },
        { angle: a + (Math.PI * 4) / 3, power: willSucceed ? p : p * 0.55 },
      ]);
      return;
    }
  }

  s.think -= dtReal;
  if (s.think > 0) {
    u.throttle = 1;
    return;
  }
  s.think = L.delay;
  u.throttle = 1;

  const g = w.grid;
  const myCell = g.cellAt(u.x, u.y);

  // ── 귀환 판단 ───────────────────────────────────────────────────────────
  if (u.trail.length === 0) s.returning = false;
  if (u.trail.length >= L.leg) s.returning = true;
  // 내 꼬리 근처에 적이 있으면(Lv2+) 즉시 귀환
  if (!s.returning && u.trail.length > 3 && u.botLv >= 2) {
    for (const v of w.units) {
      if (v === u || !v.alive) continue;
      const vc = g.cellAt(v.x, v.y);
      for (let i = 0; i < u.trail.length; i += 3) {
        const t = u.trail[i]!;
        const dc = (t % COLS) - (vc % COLS);
        const dr = ((t / COLS) | 0) - ((vc / COLS) | 0);
        if (dc * dc + dr * dr < 36) {
          s.returning = true;
          break;
        }
      }
      if (s.returning) break;
    }
  }

  if (s.returning) {
    const home = nearestOwnCell(w, u);
    if (home >= 0) {
      u.aim = Math.atan2(g.wy(home) - u.y, g.wx(home) - u.x);
      s.target = home;
      return;
    }
  }

  // ── 절단(공격) 기회 ─────────────────────────────────────────────────────
  if (L.chase > 0) {
    const cut = findCut(w, u, L.chase);
    if (cut >= 0) {
      s.target = cut;
      u.aim = Math.atan2(g.wy(cut) - u.y, g.wx(cut) - u.x);
      return;
    }
  }

  // ── 확장: 16방향 레이캐스트 스코어링 ────────────────────────────────────
  let bestA = u.heading;
  let bestScore = -Infinity;
  const c0 = myCell % COLS;
  const r0 = (myCell / COLS) | 0;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let sc = 0;
    let ok = true;
    for (let step = 1; step <= L.reach; step++) {
      const c = Math.round(c0 + dx * step);
      const r = Math.round(r0 + dy * step);
      if (!g.inb(c, r)) {
        ok = false;
        break;
      }
      const i = g.idx(c, r);
      const own = g.owner[i]!;
      if (own === u.id) sc -= 2.2;
      else {
        sc += 1 + L.valueW * (TIER_VALUE[g.tier[i]!]! - 1) * 0.6;
        // 등기 중인 상대 상업/특수지는 최우선 방해 타깃 (§3-B 설계 의도)
        if (own >= 0 && g.reg[i]! > 0 && u.botLv >= 3) sc += 6;
      }
    }
    if (!ok) sc -= 26;
    // 직진 관성(지그재그 방지)
    let d = a - u.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    sc -= Math.abs(d) * 2.4;
    if (sc > bestScore) {
      bestScore = sc;
      bestA = a;
    }
  }
  u.aim = bestA;
  s.target = -1;
}

function nearestOwnCell(w: World, u: Unit): number {
  const g = w.grid;
  const c0 = g.cellAt(u.x, u.y) % COLS;
  const r0 = (g.cellAt(u.x, u.y) / COLS) | 0;
  let best = -1;
  let bd = Infinity;
  // 나선형 탐색 대신 전수 스캔. 7168셀 = 봇 1회 판단당 0.05ms 수준.
  for (let i = 0; i < g.owner.length; i++) {
    if (g.owner[i] !== u.id) continue;
    const dc = (i % COLS) - c0;
    const dr = ((i / COLS) | 0) - r0;
    const d = dc * dc + dr * dr;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

function findCut(w: World, u: Unit, radius: number): number {
  const g = w.grid;
  const c0 = g.cellAt(u.x, u.y) % COLS;
  const r0 = (g.cellAt(u.x, u.y) / COLS) | 0;
  const rr = radius * radius;
  let best = -1;
  let bd = Infinity;
  for (const v of w.units) {
    if (v === u || !v.alive || v.trail.length === 0 || v.invuln > 0) continue;
    for (let i = 0; i < v.trail.length; i++) {
      const t = v.trail[i]!;
      const dc = (t % COLS) - c0;
      const dr = ((t / COLS) | 0) - r0;
      const d = dc * dc + dr * dr;
      if (d < rr && d < bd) {
        bd = d;
        best = t;
      }
    }
  }
  return best;
}
