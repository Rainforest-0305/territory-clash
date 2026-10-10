/**
 * 아레나 그리드 — 게임의 진짜 상태(state of truth).
 *
 * 기획서 §2-3: 64 × 112 셀 세로 그리드, 논리 셀 16px.
 * 기획서 §3-B: 셀 3등급(일반1 / 상업4 / 특수12) + 등기 지연 3초.
 * 기획서 §3-D: 지분 뺏기 — 가해자 영역과 인접한 경계부터 지리적으로 침식.
 *
 * 렌더러는 이 클래스를 읽기만 한다. 상태 변경은 sim.ts 를 통해서만.
 */
import type { Rng } from './rng';
import { intOf } from './rng';

/**
 * ── 아레나 치수는 «모드마다 다르다» (2026-08-10) ────────────────────────────
 * 예전에는 const 였다. 모드(1·3·5분)마다 맵이 커져야 해서 let 으로 바꾸고
 * setArena() 로만 바꾼다.
 *
 * ★ 왜 그냥 let 으로 두면 되는가: ESM 은 «라이브 바인딩»이라
 *   `import { COLS } from './grid'` 한 쪽도 재대입된 값을 그대로 본다.
 *   그래서 sim/render/hud/bots 의 «함수 안» 참조는 한 줄도 안 고쳐도 된다.
 * ★ 위험한 건 «모듈 최상위에서 값을 캡처하는 곳»뿐이다. 캡처하면 첫 값이
 *   굳는다. 실측으로 찾아낸 4곳은 전부 처리했다:
 *     render.ts cam 초기값 / render.ts terrGrad 캐시 (→ Renderer.resetForArena)
 *     hud.ts 미니맵 높이 (→ Hud.setMode)
 *     sim.ts 시드 배치 상수 (→ 생성자 안에서 계산)
 *   새로 캡처를 만들지 마라. 만들려면 무효화 지점을 같이 만들어라.
 * ★ setArena 는 «World 를 새로 만들기 직전»에만 부른다. 살아 있는 World 밑에서
 *   바꾸면 owner 배열 길이와 COLS 가 어긋나 화면이 대각선으로 찢어진다.
 */
export let COLS = 64;
export let ROWS = 112;
/** 논리 셀 크기(월드 px). 카메라 스케일은 render.ts 가 따로 잡는다. 모드 무관 고정. */
export const CELL = 16;
export let NCELL = COLS * ROWS;
export let ARENA_W = COLS * CELL;
export let ARENA_H = ROWS * CELL;

/** 기본(1분) 아레나. 되돌릴 때 쓰는 기준값이자 「예전 값」의 기록. */
export const BASE_COLS = 64;
export const BASE_ROWS = 112;

/**
 * 아레나 치수 변경. new Grid() / new World() «전»에만 부른다.
 * @returns 실제로 값이 바뀌었는지(렌더 캐시 무효화 필요 여부)
 */
export function setArena(cols: number, rows: number): boolean {
  if (!Number.isFinite(cols) || !Number.isFinite(rows) || cols < 8 || rows < 8) {
    console.warn('[grid] setArena ignored — bad dims', cols, rows);
    return false;
  }
  if (cols === COLS && rows === ROWS) return false;
  COLS = cols | 0;
  ROWS = rows | 0;
  NCELL = COLS * ROWS;
  ARENA_W = COLS * CELL;
  ARENA_H = ROWS * CELL;
  return true;
}

/** 등급별 초당 가치 (기획서 §3-B) */
export const TIER_VALUE = [1, 4, 12] as const;
/** 상업지·특수지 등기 지연 (초) */
export const REG_LAG = 3.0;

export class Grid {
  /** 소유자 = 유닛 인덱스. -1 = 미점령 */
  readonly owner: Int8Array = new Int8Array(NCELL).fill(-1);
  /** 0 일반 / 1 상업 / 2 특수 */
  readonly tier: Uint8Array = new Uint8Array(NCELL);
  /** 등기 잔여시간(초). >0 이면 "등기 중" = 수입 0, 미보유 취급 */
  readonly reg: Float32Array = new Float32Array(NCELL);
  /** 본진 코어(시작 5x5 의 중앙 3x3). 튕기기로 탈취 불가 (기획서 §3-A 가드레일) */
  readonly core: Int8Array = new Int8Array(NCELL).fill(-1);
  /** 특수지(랜드마크) 중심 셀 인덱스 3개 */
  readonly landmarks: number[] = [];
  /** 상업지 군집 대표 셀(봇 타깃팅용) */
  readonly commercial: number[] = [];

  /** 소유 셀 수(등기 무관). index = 유닛 */
  readonly cellCount: Int32Array = new Int32Array(16);
  /** 등기 완료 셀만 합산한 초당 수입 */
  readonly income: Int32Array = new Int32Array(16);
  /** 등기 진행중인 셀 목록(전 셀 스캔 회피) */
  private regPending: number[] = [];

  /** 등기 진행중 셀(렌더러가 읽는다) */
  get pendingRegistration(): readonly number[] { return this.regPending; }

  /** 소유권/등기 상태가 바뀔 때마다 증가. 렌더러의 Path2D 재생성 트리거 */
  rev = 0;
  private tallyDirty = true;

  idx(c: number, r: number): number {
    return r * COLS + c;
  }
  cx(i: number): number {
    return i % COLS;
  }
  cy(i: number): number {
    return (i / COLS) | 0;
  }
  inb(c: number, r: number): boolean {
    return c >= 0 && r >= 0 && c < COLS && r < ROWS;
  }
  /** 셀 중심의 월드 좌표 */
  wx(i: number): number {
    return (this.cx(i) + 0.5) * CELL;
  }
  wy(i: number): number {
    return (this.cy(i) + 0.5) * CELL;
  }
  cellAt(x: number, y: number): number {
    const c = Math.min(COLS - 1, Math.max(0, (x / CELL) | 0));
    const r = Math.min(ROWS - 1, Math.max(0, (y / CELL) | 0));
    return r * COLS + c;
  }

  markDirty(): void {
    this.tallyDirty = true;
    this.rev++;
  }

  // ── 맵 생성 (지가 배치) ──────────────────────────────────────────────────
  /**
   * 기획서 §3-B 비율: 일반 88% / 상업 11%(3~5셀 군집) / 특수 정확히 3곳 3x3.
   * 시드 고정이라 같은 날 = 같은 맵 = 고스트 리플레이 유효.
   */
  generate(rng: Rng): void {
    this.tier.fill(0);
    this.landmarks.length = 0;
    this.commercial.length = 0;

    // 특수지 3곳: 세로 맵을 상/중/하 3구간으로 나눠 하나씩. 중앙 열 근처에
    // 배치해 "자연 발생 교전 지점"이 되게 한다(§3-B 설계 의도).
    for (let k = 0; k < 3; k++) {
      const bandTop = 10 + k * ((ROWS - 24) / 3);
      const r = Math.round(bandTop + rng() * ((ROWS - 24) / 3 - 6)) + 2;
      const c = Math.round(COLS * 0.5 + (rng() - 0.5) * COLS * 0.42);
      const cc = Math.min(COLS - 3, Math.max(2, c));
      const rr = Math.min(ROWS - 3, Math.max(2, r));
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) this.tier[this.idx(cc + dc, rr + dr)] = 2;
      }
      this.landmarks.push(this.idx(cc, rr));
    }

    // 상업지 군집: 목표 11% (약 788셀). 군집당 3~5셀짜리 블록을 랜덤 워크로.
    const target = Math.round(NCELL * 0.11);
    let placed = 0;
    let guard = 0;
    while (placed < target && guard++ < 20000) {
      let c = intOf(rng, 1, COLS - 2);
      let r = intOf(rng, 1, ROWS - 2);
      const size = intOf(rng, 3, 5) * intOf(rng, 2, 4); // 6~20셀 덩어리
      let head = this.idx(c, r);
      if (this.tier[head] !== 0) continue;
      this.commercial.push(head);
      for (let s = 0; s < size && placed < target; s++) {
        if (this.tier[head] === 0) {
          this.tier[head] = 1;
          placed++;
        }
        const d = intOf(rng, 0, 3);
        c += d === 0 ? 1 : d === 1 ? -1 : 0;
        r += d === 2 ? 1 : d === 3 ? -1 : 0;
        if (!this.inb(c, r)) break;
        head = this.idx(c, r);
        if (this.tier[head] === 2) break;
      }
    }
    this.markDirty();
  }

  // ── 소유권 ───────────────────────────────────────────────────────────────
  /** 시작 영토 5x5 + 중앙 3x3 코어 마킹 (기획서 §2-3 / §3-A) */
  seedTerritory(unit: number, c: number, r: number): void {
    for (let dc = -2; dc <= 2; dc++) {
      for (let dr = -2; dr <= 2; dr++) {
        const cc = c + dc;
        const rr = r + dr;
        if (!this.inb(cc, rr)) continue;
        const i = this.idx(cc, rr);
        this.owner[i] = unit;
        this.reg[i] = 0; // 시작 영토는 등기 완료 상태로 준다
        if (Math.abs(dc) <= 1 && Math.abs(dr) <= 1) this.core[i] = unit;
      }
    }
    this.markDirty();
  }

  /**
   * 셀 소유권 이전. 상업/특수지는 등기 지연 3초를 건다(§3-B).
   * @param fresh false 면 등기 지연 없이 즉시 소유(시작 영토 등)
   */
  setOwner(i: number, unit: number, fresh = true): void {
    if (this.owner[i] === unit) return;
    this.owner[i] = unit;
    if (fresh && this.tier[i]! > 0) {
      if (this.reg[i] === 0) this.regPending.push(i);
      this.reg[i] = REG_LAG;
    }
    this.markDirty();
  }

  /** 등기 타이머 진행. 완료되면 수입에 편입된다. */
  tickRegistration(dt: number): void {
    if (this.regPending.length === 0) return;
    let w = 0;
    for (let k = 0; k < this.regPending.length; k++) {
      const i = this.regPending[k]!;
      const left = this.reg[i]! - dt;
      if (left <= 0) {
        this.reg[i] = 0;
        this.markDirty();
      } else {
        this.reg[i] = left;
        this.regPending[w++] = i;
      }
    }
    this.regPending.length = w;
  }

  /** 등기까지 끝난 "진짜 내 셀"인가 (§3-B: 등기 전은 미보유 취급) */
  isSettled(i: number, unit: number): boolean {
    return this.owner[i] === unit && this.reg[i] === 0;
  }

  /** 소유 셀 수 / 초당 수입 재집계. dirty 일 때만 전수 스캔한다. */
  tally(nUnits: number): void {
    if (!this.tallyDirty) return;
    this.tallyDirty = false;
    this.cellCount.fill(0);
    this.income.fill(0);
    for (let i = 0; i < NCELL; i++) {
      const o = this.owner[i]!;
      if (o < 0 || o >= nUnits) continue;
      this.cellCount[o]!++;
      if (this.reg[i] === 0) this.income[o] += TIER_VALUE[this.tier[i]!]!;
    }
  }

  // ── 점령 (폐곡선 flood fill) ─────────────────────────────────────────────
  /**
   * 꼬리로 둘러싼 영역을 점령한다.
   * 알고리즘: 꼬리를 내 소유로 칠한 뒤, 맵 바깥 테두리에서 "내 소유가 아닌
   * 셀"을 flood fill → 도달하지 못한 셀 = 폐곡선 내부 → 전부 내 것.
   * @returns 새로 획득한 셀 인덱스 배열(연출·정산용)
   */
  claimEnclosed(unit: number, trail: readonly number[]): number[] {
    const gained: number[] = [];
    for (const i of trail) {
      if (this.owner[i] !== unit) {
        this.setOwner(i, unit);
        gained.push(i);
      }
    }
    const vis = new Uint8Array(NCELL);
    const st: number[] = [];
    for (let c = 0; c < COLS; c++) {
      st.push(c, (ROWS - 1) * COLS + c);
    }
    for (let r = 0; r < ROWS; r++) {
      st.push(r * COLS, r * COLS + COLS - 1);
    }
    while (st.length) {
      const i = st.pop()!;
      if (vis[i] || this.owner[i] === unit) continue;
      vis[i] = 1;
      const c = i % COLS;
      if (c > 0) st.push(i - 1);
      if (c < COLS - 1) st.push(i + 1);
      if (i >= COLS) st.push(i - COLS);
      if (i < NCELL - COLS) st.push(i + COLS);
    }
    for (let i = 0; i < NCELL; i++) {
      if (!vis[i] && this.owner[i] !== unit) {
        this.setOwner(i, unit);
        gained.push(i);
      }
    }
    return gained;
  }

  // ── 튕기기 폐다각형 점령 (USP-A) ─────────────────────────────────────────
  /**
   * 다각형 내부 셀을 반환한다(even-odd). 가드레일 적용:
   *  - 상한 900셀 (§3-A). 초과 시 시작점에 가까운 순으로 자름.
   *  - 상대 본진 코어 셀은 제외.
   */
  polygonCells(pts: ReadonlyArray<{ x: number; y: number }>, unit: number, cap = 900): number[] {
    if (pts.length < 3) return [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const c0 = Math.max(0, (minX / CELL) | 0);
    const c1 = Math.min(COLS - 1, (maxX / CELL) | 0);
    const r0 = Math.max(0, (minY / CELL) | 0);
    const r1 = Math.min(ROWS - 1, (maxY / CELL) | 0);
    const out: number[] = [];
    const n = pts.length;
    for (let r = r0; r <= r1; r++) {
      const py = (r + 0.5) * CELL;
      for (let c = c0; c <= c1; c++) {
        const px = (c + 0.5) * CELL;
        let inside = false;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const a = pts[i]!;
          const b = pts[j]!;
          if (a.y > py !== b.y > py && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) {
            inside = !inside;
          }
        }
        if (!inside) continue;
        const i = this.idx(c, r);
        const cr = this.core[i]!;
        if (cr >= 0 && cr !== unit) continue; // 상대 본진 코어는 튕기기로 못 먹는다
        if (this.owner[i] === unit) continue;
        out.push(i);
      }
    }
    if (out.length > cap) {
      const sx = pts[0]!.x;
      const sy = pts[0]!.y;
      out.sort((a, b) => {
        const dax = this.wx(a) - sx;
        const day = this.wy(a) - sy;
        const dbx = this.wx(b) - sx;
        const dby = this.wy(b) - sy;
        return dax * dax + day * day - (dbx * dbx + dby * dby);
      });
      out.length = cap;
    }
    return out;
  }

  // ── 지분 뺏기 (USP-D) ────────────────────────────────────────────────────
  /**
   * victim 의 셀 중 ratio 비율을, attacker 영역과 인접한 경계부터 지리적으로
   * 침식해서 attacker 에게 넘긴다. attacker < 0 이면 중립화(자멸).
   * @returns 이전된 셀 인덱스
   */
  erode(victim: number, attacker: number, ratio: number, fromCell: number): number[] {
    const owned: number[] = [];
    for (let i = 0; i < NCELL; i++) if (this.owner[i] === victim) owned.push(i);
    const need = Math.floor(owned.length * ratio);
    if (need <= 0) return [];

    const seen = new Uint8Array(NCELL);
    const queue: number[] = [];
    // 1순위 시드: 가해자 영역과 맞닿은 피해자 셀
    if (attacker >= 0) {
      for (const i of owned) {
        const c = i % COLS;
        if (
          (c > 0 && this.owner[i - 1] === attacker) ||
          (c < COLS - 1 && this.owner[i + 1] === attacker) ||
          (i >= COLS && this.owner[i - COLS] === attacker) ||
          (i < NCELL - COLS && this.owner[i + COLS] === attacker)
        ) {
          if (!seen[i]) {
            seen[i] = 1;
            queue.push(i);
          }
        }
      }
    }
    // 인접 영역이 없으면(원거리 처치) 사건 발생 지점에서 가장 가까운 셀부터
    if (queue.length === 0) {
      let bi = -1;
      let bd = Infinity;
      const fx = this.wx(fromCell);
      const fy = this.wy(fromCell);
      for (const i of owned) {
        const dx = this.wx(i) - fx;
        const dy = this.wy(i) - fy;
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      if (bi < 0) return [];
      seen[bi] = 1;
      queue.push(bi);
    }

    const taken: number[] = [];
    let head = 0;
    while (head < queue.length && taken.length < need) {
      const i = queue[head++]!;
      taken.push(i);
      const c = i % COLS;
      const push = (j: number) => {
        if (j < 0 || j >= NCELL || seen[j] || this.owner[j] !== victim) return;
        seen[j] = 1;
        queue.push(j);
      };
      if (c > 0) push(i - 1);
      if (c < COLS - 1) push(i + 1);
      push(i - COLS);
      push(i + COLS);
    }
    for (const i of taken) {
      if (attacker >= 0) this.setOwner(i, attacker);
      else {
        this.owner[i] = -1;
        this.core[i] = this.core[i] === victim ? -1 : this.core[i]!;
        this.markDirty();
      }
    }
    return taken;
  }

  /** 잔여 영역의 무게중심 셀(리스폰 지점). 없으면 -1 */
  centroidCell(unit: number): number {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let i = 0; i < NCELL; i++) {
      if (this.owner[i] !== unit) continue;
      sx += i % COLS;
      sy += (i / COLS) | 0;
      n++;
    }
    if (n === 0) return -1;
    const tc = Math.round(sx / n);
    const tr = Math.round(sy / n);
    // 무게중심이 내 영역 밖(오목한 형태)일 수 있다 → 가장 가까운 내 셀로 스냅
    const ti = this.idx(Math.min(COLS - 1, Math.max(0, tc)), Math.min(ROWS - 1, Math.max(0, tr)));
    if (this.owner[ti] === unit) return ti;
    let bi = -1;
    let bd = Infinity;
    for (let i = 0; i < NCELL; i++) {
      if (this.owner[i] !== unit) continue;
      const dx = (i % COLS) - tc;
      const dy = ((i / COLS) | 0) - tr;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    return bi;
  }

  /** 완전히 빈 5x5 자리를 찾는다(부활용). 없으면 -1 */
  findEmptyPatch(rng: Rng): number {
    for (let attempt = 0; attempt < 400; attempt++) {
      const c = intOf(rng, 3, COLS - 4);
      const r = intOf(rng, 3, ROWS - 4);
      let ok = true;
      for (let dc = -2; dc <= 2 && ok; dc++) {
        for (let dr = -2; dr <= 2; dr++) {
          if (this.owner[this.idx(c + dc, r + dr)]! >= 0) {
            ok = false;
            break;
          }
        }
      }
      if (ok) return this.idx(c, r);
    }
    return -1;
  }
}
