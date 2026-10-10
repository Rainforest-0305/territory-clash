/**
 * 세션 시뮬레이션 — 게임 규칙의 구현체.
 *
 * 대응 기획서 절:
 *   §2-2 코어 루프 / §2-3 세션·맵 사양(60초, 64x112, 이동 5.2·5.8셀/초)
 *   §3-A USP-A 3번 튕기기
 *   §3-B USP-B 지가 메타 (등기 지연 3초, 점수 = Σ 가치 × 시간)
 *   §3-D USP-D 지분 뺏기 (사망 = 30% 이전, 완전 봉쇄시에만 탈락)
 *   §3-E USP-E 봇 + 비동기 고스트
 *
 * 렌더링은 여기 없다(render.ts). 이 파일은 순수 상태 전이만 한다 —
 * 그래야 30fps 폴백/백그라운드 복귀에서 물리가 어긋나지 않는다.
 */
import { CELL, Grid, ARENA_W, ARENA_H, NCELL, COLS, ROWS } from './grid';
import { mulberry32, intOf, type Rng } from './rng';
import type { BounceState, FxEvent, GhostPlayback, Unit, Vec2 } from './types';
import { updateBot, makeBotState } from './bots';
import { MODE_TABLE, DEFAULT_MODE, distForDifficulty, type Difficulty, type ModeSpec } from './modes';
import { t, botName } from '../i18n';

// ── 밸런스 상수 (전부 기획서 수치. 임의로 만지지 마라) ──────────────────────
/**
 * 기본(1분) 세션 길이.
 * ★ 2026-08-10 이전에는 이 게임에 «이 값 하나»뿐이었다. 그래서 그때까지 쌓인
 *   최고기록은 전부 «1분 기록»이다 — save.ts 의 bestByMode 귀속 근거가 이것이다.
 *   지금은 모드별 길이가 MODE_TABLE 에 있고, 여기는 그 표의 1분 값을 가리킨다.
 */
export const SESSION_SEC = MODE_TABLE[DEFAULT_MODE].sec;
const SPEED_IN = 5.2 * CELL; // 자기 영역 안
const SPEED_OUT = 5.8 * CELL; // 꼬리 상태(+11%)
const TURN_RATE = 16; // heading 수렴 속도(1/s)

const GAUGE_PER_SEC = 4; // 자연 충전 %p/s
const GAUGE_PER_CELL = 0.5; // 점령 셀당 %p
const GAUGE_PER_LANDMARK = 1.0; // 특수지 보유시 %p/s 추가
const BOUNCE_MIN_CELLS = 8;
const BOUNCE_MAX_CELLS = 34;
const BOUNCE_FLY_SPEED = 30 * CELL; // 비행 속도(월드px/s)
const AIM_WINDOW_FIRST = 2.0; // 최초 조준 최대(실시간 초)
const AIM_WINDOW_RE = 0.8; // 재조준 창
const SLOWMO = 0.35;
const BOUNCE_CAP_CELLS = 900;

const LOSS_RATIO = 0.30;
const LOSS_RATIO_CHAIN = 0.15;
const CHAIN_WINDOW = 3.0;
const RESPAWN_DELAY = 0.4;
const INVULN = 1.5;
/** 무료 부활 횟수(판당). President 결정 B안: 첫 부활은 지금처럼 공짜. */
const FREE_REVIVES = 1;
/** 리워드 광고를 봐야 열리는 «추가» 부활 횟수(판당). */
const AD_REVIVES = 1;
/** 부활 제안 노출 시간(초). hud.ts 의 카운트다운과 같은 값이다. */
const REVIVE_OFFER_SEC = 5;
const GAUGE_ON_DEATH = 40;

/**
 * 참가자 수는 «모드마다 다르다» — modes.ts MODE_TABLE 이 정본이다.
 *
 * ⚠ 상한을 만드는 진짜 제약은 «색 중복»이 아니라 «렌더러 배열 크기»다(실측).
 *   render.ts 의 terr 배열이 `FACTIONS.length + 2` 로 만들어지고 유닛 id 로
 *   인덱싱되기 때문에, 참가자가 팩션 수를 넘으면 그 유닛의 영토가
 *   **예외도 로그도 없이 통째로 안 그려진다.** 색이 겹치는 문제가 아니다.
 *   → modes.assertModeTable() 가 부팅 때 이 조건을 실제로 검사한다.
 *
 * ⚠ 참가자 수를 바꾸면 **러시아어 복수형을 다시 확인해야 한다.**
 *   splash/menu 의 ru 번역이 '{players} игроков' 인데, 이 형태는
 *   0 과 5~20 에서 맞고 2~4 에서는 틀린다(игрока 가 돼야 한다).
 *   현재 쓰는 값 6·8·10 은 전부 안전 구간이다. 2~4 로 내리면 ru 문구를
 *   고치거나 Intl.PluralRules 를 도입해야 한다(i18n/index.ts 주석 참고).
 */
/**
 * 히트스톱 = 격파·점령 순간 «시간을 거의 멈추는» 타격감 연출(dt × 0.06).
 *
 * ★ President 지시로 «기본 끔». 근거(실측):
 *   한 판(60초)에 점령 68회 + 격파 6회 = 74회 발동한다 = «초당 1회 이상».
 *   렌더 비용은 0인데 «화면이 실제로 멈춘다» → 「프레임이 떨어지는 것 같은데」와
 *   증상이 정확히 일치한다. 프로파일러로 못 찾은 이유이기도 하다 —
 *   이건 «비용»이 아니라 «의도된 정지»라 draw 시간에 안 잡힌다.
 * ★ 되돌리기: `?hitstop=on` (한 줄). 타격감 전달 수단이므로 President 가
 *   「밋밋해졌다」고 하면 즉시 되돌린다.
 * ★ 격파 «정보»는 남아 있다 — 킬 링·파편·킬피드·팝업은 게이트를 타지 않는다.
 */
const HITSTOP_SLOW = 0.06;
const HITSTOP_SCALE =
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).get('hitstop') === 'on'
    ? 1
    : 0;
if (typeof console !== 'undefined') {
  console.log('[sim] hitstop scale =', HITSTOP_SCALE, HITSTOP_SCALE === 0 ? '(OFF)' : '(ON)');
}

/**
 * 1분 모드의 참가자 수. 「예전 값」이자 되돌림 기준점으로 남긴다.
 * 실제 참가자 수는 World.participants(= 생성 시 받은 ModeSpec)를 봐라.
 */
export const PARTICIPANTS = MODE_TABLE[DEFAULT_MODE].participants;

/**
 * 봇 이름 풀의 한 변. 원래는 형용사 8종 × 명사 8종을 **런타임에 이어붙였다**.
 * 그 방식은 형용사가 명사의 성·수에 일치해야 하는 언어(es/pt-BR/fr/de/ru)에서
 * 반드시 틀린 말이 된다. 그래서 로케일마다 완성된 64개(8×8) 목록을 두고
 * idx = a*8 + b 로 고르기만 한다. ko 목록은 원본 조합을 같은 순서로 펼친
 * 것이라 표시되는 이름이 예전과 완전히 같다.
 */
const BOT_NAME_DIM = 8;

export interface KillFeedRow {
  a: string;
  b: string;
  fa: number;
  fb: number;
  t: number;
}

export type Phase = 'countdown' | 'play' | 'revive' | 'over';

export class World {
  readonly grid = new Grid();
  readonly units: Unit[] = [];
  readonly fx: FxEvent[] = [];
  readonly killFeed: KillFeedRow[] = [];

  /** 이 판의 모드 사양(시간·맵·참가자). 판 도중에 바뀌지 않는다. */
  readonly mode: ModeSpec;
  /** 이 판의 총 참가자 수(플레이어 포함) */
  readonly participants: number;

  /** 세션 경과(실시간) */
  t = 0;
  timeLeft: number;
  timeScale = 1;
  hitstop = 0;
  phase: Phase = 'countdown';
  countdown = 1.1;
  /** 부활 제안 잔여 시간 */
  reviveOffer = 0;
  /**
   * 이번 판에서 «실제로 부활한» 횟수. 예전 boolean(reviveUsed)의 후신이다.
   *   0 → 무료 부활 가능        (FREE_REVIVES)
   *   1 → 광고 부활 가능        (AD_REVIVES, 단 adReviveAvailable 일 때만)
   *   2 → 더 없음
   */
  revivesUsed = 0;
  /**
   * 지금 떠 있는 부활 제안이 «광고 시청»을 요구하는가.
   * ★ World 는 광고를 모른다 — 이 플래그는 「어떤 제안인가」만 말하고,
   *   광고 실행·성패 판정은 전부 game/index.ts 가 한다(sim 은 순수 유지).
   */
  reviveNeedsAd = false;
  /**
   * 광고를 불러오거나 재생하는 «동안» 세계를 통째로 멈춘다.
   * ★왜 타이머만이 아니라 세계 전체인가: 광고는 15~30초다. 그동안 봇이 계속
   *   움직이고 timeLeft 가 줄면, 60초 판에서 광고 한 번이 판의 절반을 먹는다.
   *   「부활시켜 준다」고 해 놓고 판을 빼앗는 셈이라 그 자체가 기만이다.
   *   무료 부활의 5초 압박(대기 강요 금지 원칙)은 그대로 둔다 — 그건 유저가
   *   «게임 안에서» 고민하는 시간이고, 이건 «게임 밖에» 나가 있는 시간이다.
   */
  revivePaused = false;
  /**
   * 광고 부활을 «제안해도 되는가». index.ts 가 판 시작 시 한 번 넣는다
   *   (지면 ID 가 있고 + SDK 가 리워드 광고를 지원하는 환경일 때만 true).
   *   기본 false = 지금 라이브와 «완전히 동일한 동작»(무료 1회뿐).
   */
  adReviveAvailable = false;
  readonly playerId = 0;
  seed: number;
  private rng: Rng;
  /** 카메라 셰이크 요청량(렌더러가 소비) */
  shake = 0;
  /** 색수차 스파이크 요청(렌더러가 소비) */
  aberr = 0;
  /** 채도 하강 연출(사망) */
  desat = 0;

  /**
   * ── 상한 산정 근거용 계측 (모드 표가 «잠정»이라 필요하다) ────────────────
   * 최대 동시 생존 유닛 수 / 최대 동시 점유 면적. 판이 끝날 때 콘솔에 찍는다.
   * 비용: 프레임당 유닛 수(≤10) 만큼의 덧셈. 렌더에는 영향 없다.
   */
  peakAliveUnits = 0;
  peakAliveBots = 0;
  /** 전 유닛 점유 셀 합의 최댓값 */
  peakOwnedCells = 0;

  /**
   * @param mode 이 판의 모드 사양.
   *   ★ 호출 «전»에 grid.setArena(mode.cols, mode.rows) 가 끝나 있어야 한다.
   *     Grid 가 생성자에서 NCELL 크기의 배열을 잡기 때문이다.
   */
  constructor(
    seed: number,
    ghosts: Array<{ nick: string; frames: Uint8Array }>,
    mode: ModeSpec = MODE_TABLE[DEFAULT_MODE]
  ) {
    this.mode = mode;
    this.participants = mode.participants;
    this.timeLeft = mode.sec;
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.grid.generate(this.rng);

    /**
     * 시드 배치 상수. 예전에는 모듈 상수(64·112 하드코딩)였는데 맵이 모드마다
     * 달라져서 «생성자 안에서» 현재 아레나로부터 계산한다.
     * 값의 의미는 그대로다 — 세로 27%/73% 열, 위아래 8칸은 비워 둔다.
     */
    const colQ = Math.round(COLS * 0.27);
    const col3Q = Math.round(COLS * 0.73);
    const rowLo = 8;
    const rowHi = ROWS - 8;

    // 시드 위치: 세로 맵을 지그재그로 균등 분산 (§2-3)
    const nameRng = mulberry32(seed ^ 0x9e3779b9);
    for (let i = 0; i < this.participants; i++) {
      const row = Math.round(((i + 0.5) / this.participants) * (rowHi - rowLo) + rowLo);
      const col = i % 2 === 0 ? colQ : col3Q;
      const ghost = i >= 1 && i < 1 + mode.ghostSlots ? ghosts[i - 1] : undefined;
      const kind = i === 0 ? 'player' : ghost ? 'ghost' : 'bot';
      // ⚠ 난수 소비는 봇 분기에서 **정확히 2회**여야 한다. 횟수나 순서를 바꾸면
      //   같은 시드가 다른 판을 만들어 고스트 리플레이 결정성이 깨진다.
      let name: string;
      if (i === 0) {
        name = t('unit.you');
      } else if (ghost) {
        name = t('unit.ghost', { nick: ghost.nick });
      } else {
        const a = intOf(nameRng, 0, BOT_NAME_DIM - 1);
        const b = intOf(nameRng, 0, BOT_NAME_DIM - 1);
        name = botName(a * BOT_NAME_DIM + b);
      }
      const u = makeUnit(i, kind, name);
      if (ghost) {
        u.ghost = { frames: ghost.frames, cursor: 0, acc: 0, fellBack: false } satisfies GhostPlayback;
      }
      u.x = (col + 0.5) * CELL;
      u.y = (row + 0.5) * CELL;
      u.lastCell = this.grid.cellAt(u.x, u.y);
      u.heading = i % 2 === 0 ? 0 : Math.PI;
      u.aim = u.heading;
      this.grid.seedTerritory(i, col, row);
      this.units.push(u);
    }
    this.assignBotLevels(1);
    this.grid.tally(this.units.length);
  }

  get player(): Unit {
    return this.units[this.playerId]!;
  }

  /**
   * 봇 레벨 동적 배정 (§3-E MMR-lite). avgRank = 최근 5경기 평균 순위.
   * 온보딩(1~3판)은 호출부에서 avgRank=8 로 넘겨 Lv1,1,2,2 가 되게 한다.
   */
  assignBotLevels(avgRank: number): void {
    let dist: readonly number[];
    if (avgRank <= 2) dist = distForDifficulty('elite');
    else if (avgRank <= 4) dist = distForDifficulty('hard');
    else if (avgRank <= 6) dist = distForDifficulty('normal');
    else dist = distForDifficulty('easy');
    this.setBotLevels(dist);
  }

  /** 분포를 그대로 적용한다. 봇이 분포보다 많으면 순환한다(8·10인 모드). */
  setBotLevels(dist: readonly number[]): void {
    let k = 0;
    for (const u of this.units) {
      if (u.id === this.playerId) continue;
      u.botLv = dist[k % dist.length]!;
      k++;
    }
  }

  /**
   * 난이도 적용. 'auto' 면 기존 MMR-lite(§3-E), 아니면 «사용자 선택이 이긴다».
   * ★ 수동 선택일 때 recentRanks 는 «쳐다보지도 않는다» — 그게 수동의 정의다.
   */
  applyDifficulty(diff: Difficulty, avgRank: number): void {
    if (diff === 'auto') this.assignBotLevels(avgRank);
    else this.setBotLevels(distForDifficulty(diff));
  }

  // ── 입력 (index.ts → 여기로만 들어온다) ─────────────────────────────────
  setPlayerAim(angle: number, throttle: number): void {
    const p = this.player;
    if (!p.alive) return;
    p.aim = angle;
    p.throttle = throttle;
  }
  stopPlayer(): void {
    this.player.throttle = 0;
  }

  /** 튕기기 버튼 누름 → 조준 진입. 조건 미달이면 false */
  bounceHold(): boolean {
    const p = this.player;
    if (!p.alive || p.bounce || p.respawn > 0) return false;
    if (p.gauge < 100 || p.cd > 0) return false;
    if (p.trail.length > 0) return false; // 꼬리 그리는 중엔 불가 (§3-A 조건1)
    if (this.grid.owner[this.grid.cellAt(p.x, p.y)] !== p.id) return false;
    p.bounce = newBounce(p, false);
    this.fx.push({ kind: 'bounceStart', unit: p.id, by: -1, x: p.x, y: p.y, cells: [] });
    return true;
  }

  /** 조준 중 드래그 갱신 (dx,dy = 버튼 기준 상대 벡터, px) */
  bounceAim(dx: number, dy: number): void {
    const b = this.player.bounce;
    if (!b || b.phase !== 'aim' || b.auto) return;
    const len = Math.hypot(dx, dy);
    if (len < 6) return;
    b.dragged = true;
    b.aimAngle = Math.atan2(dy, dx);
    const k = Math.min(1, Math.max(0, (len - 6) / 96));
    b.aimPower = BOUNCE_MIN_CELLS + k * (BOUNCE_MAX_CELLS - BOUNCE_MIN_CELLS);
  }

  /** 릴리스 → 발사 */
  bounceRelease(): void {
    const p = this.player;
    const b = p.bounce;
    if (!b || b.phase !== 'aim' || b.auto) return;
    this.fire(p, b, b.aimAngle, b.aimPower);
  }

  /**
   * 부활 실행 (§3-D 탈락 시 — 무료 1회 + 광고 1회).
   *
   * ★이 함수는 «순수»하다. 광고를 요구하는 제안(reviveNeedsAd)이라도 여기서
   *   광고를 부르지 «않는다» — 호출자(index.ts)가 리워드를 «획득한 뒤에만»
   *   부른다. 그래야 광고 SDK 가 sim 의 결정성에 끼어들지 않는다.
   */
  useRevive(): void {
    if (this.phase !== 'revive') return;
    if (this.revivesUsed >= FREE_REVIVES + AD_REVIVES) return;
    const p = this.player;
    const spot = this.grid.findEmptyPatch(this.rng);
    this.revivesUsed += 1;
    this.reviveNeedsAd = false;
    this.revivePaused = false;
    this.reviveOffer = 0;
    this.phase = 'play';
    if (spot < 0) {
      this.finish();
      return;
    }
    this.grid.seedTerritory(p.id, this.grid.cx(spot), this.grid.cy(spot));
    p.alive = true;
    p.x = this.grid.wx(spot);
    p.y = this.grid.wy(spot);
    p.lastCell = spot;
    p.invuln = INVULN;
    p.respawn = 0;
    clearTrail(p);
    this.grid.markDirty();
    this.fx.push({ kind: 'revive', unit: p.id, by: -1, x: p.x, y: p.y, cells: [] });
  }

  declineRevive(): void {
    if (this.phase !== 'revive') return;
    this.reviveNeedsAd = false;
    this.revivePaused = false;
    this.finish();
  }

  /**
   * 탈락한 플레이어에게 «어떤» 부활을 제안할지 고른다 — 없으면 판을 끝낸다.
   * 여기가 부활 제안의 «유일한» 발생 지점이다(grep 로 증명 가능해야 한다).
   */
  private offerReviveOrFinish(): void {
    if (this.revivesUsed < FREE_REVIVES) {
      this.reviveNeedsAd = false;
    } else if (
      this.adReviveAvailable &&
      this.revivesUsed < FREE_REVIVES + AD_REVIVES &&
      this.hasEmptyPatch()
    ) {
      this.reviveNeedsAd = true;
    } else {
      this.finish();
      return;
    }
    this.phase = 'revive';
    this.reviveOffer = REVIVE_OFFER_SEC;
  }

  /**
   * 「빈 5×5 자리가 «존재하는가»」 — findEmptyPatch 와 같은 조건을 전수로 훑는다.
   *
   * ★난수를 «한 톨도» 쓰지 않는다. 그래서 이 함수를 불러도 시드 재생이 밀리지 않는다
   *   (findEmptyPatch 는 무작위 400회 시도라 부르는 순간 rng 가 소비된다).
   * ★광고 «제안 전»에만 쓴다. 광고를 다 보고 나서 「자리가 없네요」로 끝나면
   *   유저는 보상 없이 광고만 본 셈이 된다.
   * 비용: 최악 7,168셀 × 25 = 약 18만 비교. 판당 최대 한 번이라 무시할 수 있다.
   */
  private hasEmptyPatch(): boolean {
    const own = this.grid.owner;
    for (let r = 3; r <= ROWS - 4; r++) {
      for (let c = 3; c <= COLS - 4; c++) {
        let ok = true;
        for (let dr = -2; dr <= 2 && ok; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            if (own[this.grid.idx(c + dc, r + dr)]! >= 0) {
              ok = false;
              break;
            }
          }
        }
        if (ok) return true;
      }
    }
    return false;
  }

  finish(): void {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.timeLeft = 0;
    /**
     * 모드 표(modes.ts)는 «잠정»이다. 상한을 다시 정할 때 필요한 두 수를
     * 판마다 남긴다 — 최대 동시 생존 유닛 수 / 최대 동시 점유 면적.
     * 콘솔 한 줄이다(전역 훅을 만들지 않는다 — 산출물 감사 grep 을 더럽힌다).
     */
    if (typeof console !== 'undefined') {
      const pct = ((this.peakOwnedCells / NCELL) * 100).toFixed(1);
      console.log(
        `[mode] ${this.mode.key}s ${COLS}x${ROWS} participants=${this.participants}` +
          ` peakAlive=${this.peakAliveUnits}(bots ${this.peakAliveBots})` +
          ` peakOwned=${this.peakOwnedCells}/${NCELL} (${pct}%)`
      );
    }
  }

  // ── 메인 업데이트 ────────────────────────────────────────────────────────
  update(dtReal: number): void {
    if (this.phase === 'over') return;

    if (this.phase === 'countdown') {
      this.countdown -= dtReal;
      if (this.countdown <= 0) this.phase = 'play';
      return;
    }
    if (this.phase === 'revive') {
      // ★광고 로딩·재생 중에는 «세계 전체»가 멈춘다(제안 타이머 포함).
      //   여기서 return 하지 않고 타이머만 멈추면, 광고 보는 30초 동안 봇이
      //   판을 끝내 버린다. revivePaused 주석 참고.
      if (this.revivePaused) return;
      this.reviveOffer -= dtReal;
      if (this.reviveOffer <= 0) this.finish();
      // 부활 대기 중에도 세션 시계는 흐른다(대기 강요 금지 원칙과 정합)
    }

    this.t += dtReal;
    this.timeLeft -= dtReal; // ★ 실시간. 슬로우모션은 세션 시간을 소모한다(가드레일)
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.finish();
      return;
    }

    // 슬로우모션: 조준 중에만. 창(window)은 실시간으로 센다.
    const pb = this.player.bounce;
    this.timeScale = pb && pb.phase === 'aim' && !pb.auto ? SLOWMO : 1;

    let dt = dtReal * this.timeScale;
    if (this.hitstop > 0) {
      this.hitstop -= dtReal;
      // ★ 게이트는 «소비 지점 이 한 곳»에만 둔다. 대입 3곳(점령·튕기기·격파)은
      //   손대지 않았다 — 대입을 목록으로 관리하면 새 호출이 생길 때 또 누락된다.
      //   hitstop «값 자체»도 그대로 둔다(다른 분기가 hitstop>0 을 읽는다).
      //   시간 축소만 끈다: SCALE=0 → dt 무변, SCALE=1 → 기존 0.06 배.
      dt *= 1 - (1 - HITSTOP_SLOW) * HITSTOP_SCALE;
    }

    this.grid.tickRegistration(dt);

    for (const u of this.units) {
      if (!u.alive) continue;
      this.updateUnit(u, dt, dtReal);
    }
    this.resolveCollisions();

    this.grid.tally(this.units.length);
    let alive = 0;
    let aliveBots = 0;
    let owned = 0;
    for (const u of this.units) {
      owned += this.grid.cellCount[u.id]!;
      if (!u.alive) continue;
      alive++;
      if (u.id !== this.playerId) aliveBots++;
      u.score += this.grid.income[u.id]! * dtReal;
    }
    // 상한 산정 근거 계측(모드 표가 잠정이라 필요하다). 유닛 수만큼의 비교뿐이다.
    if (alive > this.peakAliveUnits) this.peakAliveUnits = alive;
    if (aliveBots > this.peakAliveBots) this.peakAliveBots = aliveBots;
    if (owned > this.peakOwnedCells) this.peakOwnedCells = owned;

    this.shake *= Math.pow(0.02, dtReal);
    this.aberr *= Math.pow(0.01, dtReal);
    this.desat *= Math.pow(0.08, dtReal);
    for (let i = this.killFeed.length - 1; i >= 0; i--) {
      this.killFeed[i]!.t -= dtReal;
      if (this.killFeed[i]!.t <= 0) this.killFeed.splice(i, 1);
    }
  }

  private updateUnit(u: Unit, dt: number, dtReal: number): void {
    // 리스폰 대기
    if (u.respawn > 0) {
      u.respawn -= dtReal;
      if (u.respawn <= 0) this.respawnUnit(u);
      return;
    }
    if (u.invuln > 0) u.invuln -= dtReal;
    if (u.cd > 0) u.cd -= dtReal;
    if (u.slowT > 0) u.slowT -= dtReal;

    // 게이지 (§3-A)
    if (!u.bounce) {
      let rate = GAUGE_PER_SEC;
      for (const lm of this.grid.landmarks) {
        if (this.grid.isSettled(lm, u.id)) rate += GAUGE_PER_LANDMARK;
      }
      u.gauge = Math.min(100, u.gauge + rate * dtReal);
    }

    // AI / 고스트 (플레이어 제외)
    if (u.id !== this.playerId) updateBot(this, u, dtReal);

    if (u.bounce) {
      this.updateBounce(u, dt, dtReal);
      return;
    }

    // 이동
    let d = u.aim - u.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const k = Math.min(1, dt * TURN_RATE);
    u.heading += d * k;
    u.rollT = -d * 26;

    const base = u.outside ? SPEED_OUT : SPEED_IN;
    const mul = u.slowT > 0 ? 0.8 : 1; // 튕기기 실패 쿨다운 중 -20%
    const sp = base * mul * u.throttle;
    u.speedView = sp / SPEED_OUT;
    if (sp > 0) {
      u.x += Math.cos(u.heading) * sp * dt;
      u.y += Math.sin(u.heading) * sp * dt;
      this.clampToArena(u);
      this.trackCell(u, dt);
    }
    u.roll += (u.rollT - u.roll) * Math.min(1, dt * 11);
    u.squash += (0 - u.squash) * Math.min(1, dt * 9);
    if (u.outside) u.outsideT += dtReal;
  }

  private clampToArena(u: Unit): void {
    const pad = CELL * 0.35;
    if (u.x < pad) u.x = pad;
    if (u.x > ARENA_W - pad) u.x = ARENA_W - pad;
    if (u.y < pad) u.y = pad;
    if (u.y > ARENA_H - pad) u.y = ARENA_H - pad;
  }

  /** 셀 진입 감지 → 꼬리 기록 / 폐곡선 점령 */
  private trackCell(u: Unit, _dt: number): void {
    // 렌더용 폴리라인(연속 좌표)
    const last = u.pts[u.pts.length - 1];
    if (!last || (last.x - u.x) * (last.x - u.x) + (last.y - u.y) * (last.y - u.y) > 20) {
      if (u.trail.length > 0) {
        u.pts.push({ x: u.x, y: u.y });
        if (u.pts.length > 512) u.pts.shift(); // §L3 정점 상한
      }
    }
    const cell = this.grid.cellAt(u.x, u.y);
    if (cell === u.lastCell) return;
    u.lastCell = cell;

    if (this.grid.owner[cell] === u.id) {
      if (u.trail.length > 2) this.doClaim(u);
      else clearTrail(u);
      u.outside = false;
      u.outsideT = 0;
    } else {
      if (!u.outside) {
        u.outside = true;
        u.pts.length = 0;
        u.pts.push({ x: u.x, y: u.y });
      }
      if (!u.trailSet[cell]) {
        u.trailSet[cell] = 1;
        u.trail.push(cell);
      }
    }
  }

  private doClaim(u: Unit): void {
    const len = u.trail.length;
    const gained = this.grid.claimEnclosed(u.id, u.trail);
    if (len > u.maxTrail) u.maxTrail = len;
    clearTrail(u);
    if (gained.length === 0) return;
    u.gauge = Math.min(100, u.gauge + gained.length * GAUGE_PER_CELL);
    let sx = 0;
    let sy = 0;
    for (const i of gained) {
      sx += this.grid.wx(i);
      sy += this.grid.wy(i);
    }
    this.fx.push({
      kind: 'claim',
      unit: u.id,
      by: -1,
      x: sx / gained.length,
      y: sy / gained.length,
      cells: gained,
    });
    this.hitstop = Math.max(this.hitstop, 0.045);
    this.shake = Math.max(this.shake, Math.min(14, Math.max(2, (gained.length / NCELL) * 900)));
  }

  // ── 튕기기 (USP-A) ───────────────────────────────────────────────────────
  private fire(u: Unit, b: BounceState, angle: number, powerCells: number): void {
    b.phase = 'fly';
    b.path = shotPath(u.x, u.y, angle, powerCells * CELL);
    b.travelled = 0;
    b.total = pathLength(b.path);
    b.aimAngle = angle;
    b.aimPower = powerCells;
  }

  private updateBounce(u: Unit, dt: number, dtReal: number): void {
    const b = u.bounce!;
    if (b.phase === 'aim') {
      if (b.auto) {
        b.autoWait -= dtReal;
        if (b.autoWait <= 0) {
          const q = b.queue[b.shot];
          if (!q) {
            this.resolveBounce(u, false);
            return;
          }
          this.fire(u, b, q.angle, q.power);
        }
        return;
      }
      b.windowT -= dtReal;
      if (b.windowT <= 0) {
        // 재조준 창 초과 = 실패 (§3-A)
        u.gauge = Math.max(0, u.gauge - 50);
        u.cd = 2.0;
        u.slowT = 2.0;
        u.bounce = null;
        u.throttle = 0;
        this.desat = Math.max(this.desat, 0.3);
      }
      return;
    }

    // 비행
    const step = BOUNCE_FLY_SPEED * dt;
    b.travelled = Math.min(b.total, b.travelled + step);
    const p = pointOnPath(b.path, b.travelled);
    const prevX = u.x;
    const prevY = u.y;
    u.x = p.x;
    u.y = p.y;
    if (u.x !== prevX || u.y !== prevY) u.heading = Math.atan2(u.y - prevY, u.x - prevX);
    // 비행 중에도 상대 꼬리를 밟으면 처치된다(§3-A) — resolveCollisions 가 처리
    const cell = this.grid.cellAt(u.x, u.y);
    u.lastCell = cell;
    u.speedView = 1.4;

    if (b.travelled >= b.total) {
      b.land.push({ x: u.x, y: u.y });
      b.shot++;
      this.shake = Math.max(this.shake, 4);
      this.fx.push({ kind: 'land', unit: u.id, by: -1, x: u.x, y: u.y, cells: [] });
      if (b.shot >= 3) {
        this.resolveBounce(u, this.grid.owner[cell] === u.id);
      } else {
        b.phase = 'aim';
        b.windowT = AIM_WINDOW_RE;
        b.autoWait = 0.18;
        b.dragged = false;
      }
    }
  }

  private resolveBounce(u: Unit, landedInside: boolean): void {
    const b = u.bounce!;
    u.bounce = null;
    u.gauge = 0;
    if (!landedInside || b.land.length < 3) {
      // 부분 실패: 착지 지점부터 꼬리 상태 (§3-A)
      u.outside = true;
      u.pts.length = 0;
      u.pts.push({ x: u.x, y: u.y });
      const cell = this.grid.cellAt(u.x, u.y);
      if (this.grid.owner[cell] !== u.id && !u.trailSet[cell]) {
        u.trailSet[cell] = 1;
        u.trail.push(cell);
      }
      this.desat = Math.max(this.desat, 0.22);
      return;
    }
    u.cd = 3.0;
    const poly: Vec2[] = [b.origin, b.land[0]!, b.land[1]!, b.land[2]!];
    const cells = this.grid.polygonCells(poly, u.id, BOUNCE_CAP_CELLS);
    for (const i of cells) this.grid.setOwner(i, u.id);
    if (cells.length === 0) return;
    let sx = 0;
    let sy = 0;
    for (const i of cells) {
      sx += this.grid.wx(i);
      sy += this.grid.wy(i);
    }
    this.fx.push({
      kind: 'claim',
      unit: u.id,
      by: -1,
      x: sx / cells.length,
      y: sy / cells.length,
      cells,
    });
    this.hitstop = Math.max(this.hitstop, 0.08);
    this.shake = Math.max(this.shake, 12);
  }

  /** 봇/고스트용 자동 튕기기 시작 (bots.ts 에서 호출) */
  startAutoBounce(u: Unit, shots: Array<{ angle: number; power: number }>): void {
    if (u.bounce || u.gauge < 100 || u.cd > 0 || u.trail.length > 0) return;
    if (this.grid.owner[this.grid.cellAt(u.x, u.y)] !== u.id) return;
    const b = newBounce(u, true);
    b.queue = shots;
    b.autoWait = 0.1;
    u.bounce = b;
  }

  // ── 충돌 · 사망 (USP-D) ──────────────────────────────────────────────────
  private resolveCollisions(): void {
    const n = this.units.length;
    for (let i = 0; i < n; i++) {
      const u = this.units[i]!;
      if (!u.alive || u.respawn > 0) continue;
      const k = this.grid.cellAt(u.x, u.y);
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const v = this.units[j]!;
        if (!v.alive || v.respawn > 0 || v.trail.length === 0) continue;
        if (v.trailSet[k]) {
          this.kill(v, u);
        }
      }
    }
    // 정면 충돌: 상대 영역에 들어와 있는 쪽이 죽는다
    for (let i = 0; i < n; i++) {
      const a = this.units[i]!;
      if (!a.alive || a.respawn > 0) continue;
      for (let j = i + 1; j < n; j++) {
        const b = this.units[j]!;
        if (!b.alive || b.respawn > 0) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        if (dx * dx + dy * dy > CELL * CELL * 0.7) continue;
        const ca = this.grid.owner[this.grid.cellAt(a.x, a.y)];
        if (ca === b.id && a.outside) this.kill(a, b);
        else if (ca === a.id && b.outside) this.kill(b, a);
      }
    }
  }

  private kill(victim: Unit, attacker: Unit | null): void {
    if (!victim.alive || victim.invuln > 0 || victim.respawn > 0) return;
    const cell = this.grid.cellAt(victim.x, victim.y);
    const chain = this.t - victim.lastDeathAt < CHAIN_WINDOW;
    const ratio = chain ? LOSS_RATIO_CHAIN : LOSS_RATIO;
    const taken = this.grid.erode(victim.id, attacker ? attacker.id : -1, ratio, cell);

    victim.deaths++;
    victim.lastDeathAt = this.t;
    victim.gauge = Math.max(0, victim.gauge - GAUGE_ON_DEATH);
    victim.bounce = null;
    victim.throttle = 0;
    const deathCells = victim.trail.slice();
    clearTrail(victim);
    if (attacker) attacker.kills++;

    this.fx.push({
      kind: 'kill',
      unit: victim.id,
      by: attacker ? attacker.id : -1,
      x: victim.x,
      y: victim.y,
      cells: taken.length ? taken : deathCells,
    });
    this.hitstop = Math.max(this.hitstop, 0.09);
    this.shake = Math.max(this.shake, 11);
    this.aberr = Math.max(this.aberr, 1);
    if (victim.id === this.playerId || (attacker && attacker.id === this.playerId)) {
      this.desat = Math.max(this.desat, victim.id === this.playerId ? 0.45 : 0.15);
    }
    if (attacker) {
      this.killFeed.unshift({
        a: attacker.name,
        b: victim.name,
        fa: attacker.id,
        fb: victim.id,
        t: 2.4,
      });
      if (this.killFeed.length > 3) this.killFeed.length = 3;
    }

    this.grid.tally(this.units.length);
    if (this.grid.cellCount[victim.id] === 0) {
      // 완전 봉쇄 = 유일한 탈락 조건 (§3-D)
      victim.alive = false;
      if (victim.id === this.playerId) {
        this.offerReviveOrFinish();
      }
      return;
    }
    victim.respawn = RESPAWN_DELAY;
  }

  private respawnUnit(u: Unit): void {
    const c = this.grid.centroidCell(u.id);
    if (c < 0) {
      u.alive = false;
      if (u.id === this.playerId) this.finish();
      return;
    }
    u.x = this.grid.wx(c);
    u.y = this.grid.wy(c);
    u.lastCell = c;
    u.invuln = INVULN;
    u.outside = false;
    u.outsideT = 0;
    u.respawn = 0;
    clearTrail(u);
    this.fx.push({ kind: 'death', unit: u.id, by: -1, x: u.x, y: u.y, cells: [] });
  }

  // ── 결과 ────────────────────────────────────────────────────────────────
  /** 점수 내림차순 유닛 인덱스 */
  ranking(): Unit[] {
    return this.units.slice().sort((a, b) => b.score - a.score);
  }
  rankOf(id: number): number {
    let r = 1;
    const s = this.units[id]!.score;
    for (const u of this.units) if (u.score > s) r++;
    return r;
  }
}

function makeUnit(id: number, kind: Unit['kind'], name: string): Unit {
  return {
    id,
    kind,
    name,
    alive: true,
    x: 0,
    y: 0,
    heading: 0,
    aim: 0,
    throttle: 0,
    outside: false,
    outsideT: 0,
    lastCell: 0,
    trail: [],
    trailSet: new Uint8Array(NCELL),
    pts: [],
    respawn: 0,
    invuln: 0,
    lastDeathAt: -99,
    gauge: kind === 'player' ? 35 : 20,
    cd: 0,
    slowT: 0,
    bounce: null,
    score: 0,
    kills: 0,
    deaths: 0,
    maxTrail: 0,
    roll: 0,
    rollT: 0,
    squash: 0,
    speedView: 0,
    botLv: 3,
    ai: makeBotState(),
    ghost: null,
  };
}

function newBounce(u: Unit, auto: boolean): BounceState {
  return {
    phase: 'aim',
    shot: 0,
    origin: { x: u.x, y: u.y },
    land: [],
    path: [],
    travelled: 0,
    total: 0,
    windowT: AIM_WINDOW_FIRST,
    aimAngle: u.heading,
    aimPower: BOUNCE_MIN_CELLS + 8,
    dragged: false,
    auto,
    queue: [],
    autoWait: 0,
  };
}

export function clearTrail(u: Unit): void {
  if (u.trail.length) u.trailSet.fill(0);
  u.trail.length = 0;
  u.pts.length = 0;
}

/** 아레나 벽 반사를 반영한 비행 경로. 최대 5회 반사. */
export function shotPath(x: number, y: number, angle: number, dist: number): Vec2[] {
  const pad = CELL * 0.4;
  const pts: Vec2[] = [{ x, y }];
  let cx = x;
  let cy = y;
  let dx = Math.cos(angle);
  let dy = Math.sin(angle);
  let remain = dist;
  for (let g = 0; g < 6 && remain > 0.01; g++) {
    let tHit = remain;
    let axis = 0;
    if (dx > 1e-6) {
      const t = (ARENA_W - pad - cx) / dx;
      if (t >= 0 && t < tHit) {
        tHit = t;
        axis = 1;
      }
    } else if (dx < -1e-6) {
      const t = (pad - cx) / dx;
      if (t >= 0 && t < tHit) {
        tHit = t;
        axis = 1;
      }
    }
    if (dy > 1e-6) {
      const t = (ARENA_H - pad - cy) / dy;
      if (t >= 0 && t < tHit) {
        tHit = t;
        axis = 2;
      }
    } else if (dy < -1e-6) {
      const t = (pad - cy) / dy;
      if (t >= 0 && t < tHit) {
        tHit = t;
        axis = 2;
      }
    }
    cx += dx * tHit;
    cy += dy * tHit;
    remain -= tHit;
    pts.push({ x: cx, y: cy });
    if (axis === 1) dx = -dx;
    else if (axis === 2) dy = -dy;
    else break;
  }
  return pts;
}

export function pathLength(p: readonly Vec2[]): number {
  let s = 0;
  for (let i = 1; i < p.length; i++) s += Math.hypot(p[i]!.x - p[i - 1]!.x, p[i]!.y - p[i - 1]!.y);
  return s;
}

export function pointOnPath(p: readonly Vec2[], d: number): Vec2 {
  let acc = 0;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1]!;
    const b = p[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + seg >= d) {
      const k = seg === 0 ? 0 : (d - acc) / seg;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    acc += seg;
  }
  const last = p[p.length - 1]!;
  return { x: last.x, y: last.y };
}
