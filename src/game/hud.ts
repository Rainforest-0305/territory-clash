/**
 * 인게임 HUD + 결과 화면 (ART_DIRECTION §6.4 / §6.5).
 *
 * ★ HUD 는 DOM 으로 그린다 — 캔버스 텍스트는 dpr 배율에서 흐려지고 tabular
 *   numeral 도 못 쓴다. 문서 §6.4 원칙 "화면의 82% 이상은 아레나".
 * ★ 규칙 B 준수: 모든 가장자리 요소는 --sat/--sar/--sab/--sal 존중.
 *   상단은 **투명 네비바(뒤로가기 버튼)** 가 겹치므로 --navh(52px) 만큼 더
 *   내린다. top:0 에 두면 뒤로가기 버튼 밑에 깔린다.
 */
import './hud.css';
import { COLS, ROWS, CELL, TIER_VALUE } from './grid';
import { PAL, faction } from './palette';
import type { World } from './sim';
import { MODE_TABLE, DEFAULT_MODE, type ModeKey, type ModeSpec } from './modes';
import { t, tNodes, fmt, fmtDecimal, onLocaleChange } from '../i18n';
import type { MessageKey } from '../i18n/types';
import { createLanguageSelect } from '../i18n/languageSelect';
import { createSoundToggle } from '../ui/soundToggle';

/** 부활 시 받는 정사각 영토 한 변(칸). grid.seedTerritory 의 -2..2 범위와 같다. */
const REVIVE_SPAN = 5;

/**
 * 남은 시간 표기.
 * ★ 1분 모드는 예전 그대로 «초 숫자»다(60 → 0). 표기가 달라지면 안 된다.
 * ★ 100초를 넘는 모드에서만 m:ss 로 바꾼다 — 「300」이라는 숫자는 남은 시간이
 *   얼마인지 직관이 안 온다. 단위 라벨도 같이 갈아끼운다(초 → 시간).
 */
function useClock(sessionSec: number): boolean {
  return sessionSec > 99;
}

function clockText(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  // 초 두 자리는 «자릿수 맞춤»이지 숫자 포맷이 아니다. 로케일 숫자 변환 후
  // 붙이면 아랍숫자 이외 자형에서 자릿수가 어긋나므로 fmt() 를 쓰지 않는다.
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export interface HudCallbacks {
  onRestart: () => void;
  onChangeMode: () => void;
  onRevive: () => void;
  onDeclineRevive: () => void;
  onResume: () => void;
  onBounceDown: () => void;
  onBounceMove: (dx: number, dy: number) => void;
  onBounceUp: () => void;
}

export interface ResultData {
  /** 이 판의 모드 — 최고기록이 모드별로 갈리므로 결과에도 명시한다 */
  mode: ModeKey;
  rank: number;
  total: number;
  score: number;
  best: number;
  newBest: boolean;
  cells: number;
  kills: number;
  maxTrail: number;
  coins: number;
  xp: number;
  /** 통산 기록. 이 판 결과 아래에 따로 묶어 보여준다. */
  career: {
    plays: number;
    wins: number;
    xp: number;
    kills: number;
  };
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  html?: string
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

export class Hud {
  private root: HTMLDivElement;
  private elScore: HTMLElement;
  private elRate: HTMLElement;
  private elRank: HTMLElement;
  private elTime: HTMLElement;
  private elGauge: HTMLElement;
  private elFeed: HTMLElement;
  private elMini: HTMLCanvasElement;
  private mctx: CanvasRenderingContext2D;
  private elBounce: HTMLButtonElement;
  private elJoy: HTMLElement;
  private elJoyKnob: HTMLElement;
  private elDanger: HTMLElement;
  private elCenter: HTMLElement;
  private elPause: HTMLElement;
  private elRevive: HTMLElement;
  private elResult: HTMLElement;

  // 언어가 바뀌면 다시 써야 하는 정적 라벨들. innerHTML 로 매 프레임 다시
  // 만들지 않기 위해 조각별 참조를 들고 있는다(성능에도 유리하다).
  private elRankNum: HTMLElement;
  private elRankUnit: HTMLElement;
  private elTimeNum: HTMLElement;
  private elTimeUnit: HTMLElement;
  private elBounceLabel: HTMLElement;
  private elPauseTitle: HTMLElement;
  private elPauseBody: HTMLElement;
  private elPauseResume: HTMLElement;
  private elReviveTitle: HTMLElement;
  private elReviveBody: HTMLElement;
  private elReviveDecline: HTMLButtonElement;
  /** 수락 버튼의 «라벨 span» (카운트다운 <i> 와 형제) */
  private elReviveAccept: HTMLElement;
  /** 수락 버튼 «자체» — 광고 로딩 중 비활성화해야 해서 따로 들고 있는다. */
  private elReviveAcceptBtn: HTMLButtonElement;
  /** 남은 시간 카운트다운. 광고 로딩 중에는 «타이머가 멈추므로» 숨긴다. */
  private elReviveCnt: HTMLElement;
  private offLocale: () => void;

  /** 현재 판의 모드. 시간 표기·미니맵 비율이 여기에 달려 있다. */
  private mode: ModeSpec = MODE_TABLE[DEFAULT_MODE];
  private miniAcc = 0;
  private shownScore = 0;
  private bouncePid = -1;
  private bounceOrigin = { x: 0, y: 0 };
  private cb: HudCallbacks;
  private disposed = false;

  /**
   * ── 매 프레임 DOM 쓰기 억제용 «직전 값» 캐시 (2026-08-20 성능) ─────────────
   *
   * 왜: update() 는 rAF 마다 불린다. 예전에는 값이 «안 바뀌어도» textContent·
   *     style·attribute 를 매번 다시 썼다. DOM 쓰기는 값이 같아도 공짜가 아니다 —
   *     스타일 무효화가 걸리고, 그 요소가 페인트 대상으로 다시 큐에 올라간다.
   * ★ 특히 비쌌던 두 가지:
   *     · `--g` : .tc-bounce u 의 conic-gradient + radial mask 를 «다시 칠하게»
   *               만든다. 마스크가 붙은 요소는 별도 렌더패스를 탄다. 60Hz 로
   *               다시 칠하던 걸 «게이지가 1% 바뀔 때만» 으로 줄였다.
   *     · width : .tc-gauge i 는 레이아웃을 유발하는 속성이다. 게다가 CSS
   *               transition(0.12s) 이 걸려 있어서 매 프레임 새로 쓰면 전이가
   *               끝없이 재시작한다(= 값이 목표에 영영 못 닿는다).
   * ★ 표시되는 «값»은 하나도 바뀌지 않는다. 쓰기 «횟수»만 줄인다.
   *   게이지 양자화 단위 1% 는 4px 폭 트랙에서 0.04px 이라 표시상 무의미하다.
   */
  private lastScore = -1;
  private lastRate = -1;
  private lastRank = -1;
  private lastSecs = -1;
  private lastGauge = -1;
  private lastConic = -1;
  private lastReady: boolean | null = null;
  private ariaReady: boolean | null = null;
  private lastDanger: boolean | null = null;
  private lastCenterPhase = '';
  private lastRevive = false;
  private lastReviveCnt = -1;
  /** 지금 그려져 있는 부활 모달의 변형. null = 아직 안 그림 */
  private lastReviveAd: boolean | null = null;
  /** 지금 그려져 있는 로딩 상태. null = 아직 안 그림 */
  private lastReviveLoading: boolean | null = null;
  /**
   * 이번 판에 «광고 부활이 열려 있는가»(World.adReviveAvailable 의 사본).
   * 무료 제안의 본문이 여기에 따라 달라진다 — 「세션당 1회만」 vs 「무료 부활은 1회」.
   * update() 가 World 에서 그대로 복사한다(HUD 가 스스로 판단하지 않는다).
   */
  private adReviveOffered = false;

  constructor(parent: HTMLElement, cb: HudCallbacks) {
    this.cb = cb;
    this.root = el('div', 'tc-hud');
    /**
     * 막판 카운트다운(잔여 10초) 펄스 + 영토 밖 위험 펄스 «끔» — President 지시.
     * ★ 이건 canvas 가 아니라 «CSS 애니메이션»이라 render.ts 의 fxScale 게이트를
     *   «타지 않는다». v7 에서 격파 연출을 껐는데도 President 가 이걸 따로 지목한
     *   이유가 그것이다. 끄는 지점이 캔버스와 DOM 두 곳으로 나뉜다는 걸 기록해 둔다.
     * ★ 색·발광은 남기고 «반복 애니메이션»만 끈다(hud.css .tc-noflash 참고).
     */
    const COUNTDOWN_FX_ENABLED =
      new URLSearchParams(location.search).get('countdownfx') === 'on';
    if (!COUNTDOWN_FX_ENABLED) this.root.classList.add('tc-noflash');
    console.log('[hud] countdown/danger pulse =', COUNTDOWN_FX_ENABLED ? 'ON' : 'OFF');

    // ── 상단 ──────────────────────────────────────────────────────────────
    const top = el('div', 'tc-top');
    // 칩은 <b>숫자</b><span>단위</span> 구조를 유지한다. 번역문에는 태그가
    // 들어가지 않고, 단위 라벨만 키로 뽑는다.
    const rank = el('div', 'tc-chip');
    const rankNum = el('b');
    rankNum.textContent = fmt(1);
    const rankUnit = el('span');
    rank.append(rankNum, rankUnit);
    const pill = el('div', 'tc-pill');
    const score = el('div', 'tc-score', '0');
    const rate = el('div', 'tc-rate');
    const gaugeWrap = el('div', 'tc-gauge');
    const gauge = el('i');
    gaugeWrap.appendChild(gauge);
    pill.append(score, rate, gaugeWrap);
    const time = el('div', 'tc-chip tc-time');
    const timeNum = el('b');
    timeNum.textContent = fmt(MODE_TABLE[DEFAULT_MODE].sec);
    const timeUnit = el('span');
    time.append(timeNum, timeUnit);
    top.append(rank, pill, time);

    // ── 미니맵 · 킬피드 ───────────────────────────────────────────────────
    const mini = el('canvas', 'tc-mini');
    mini.width = 78 * 2;
    mini.height = Math.round((78 * ROWS) / COLS) * 2;
    const feed = el('div', 'tc-feed');

    // ── 조이스틱 · 튕기기 ─────────────────────────────────────────────────
    const joy = el('div', 'tc-joy');
    const knob = el('i');
    joy.appendChild(knob);
    const bounce = el('button', 'tc-bounce');
    bounce.type = 'button';
    const bounceGlow = el('u');
    const bounceLabel = el('b');
    bounce.append(bounceGlow, bounceLabel);

    // ── 오버레이 ──────────────────────────────────────────────────────────
    // 시트는 전부 DOM 으로 조립한다. 예전처럼 HTML 문자열에 한국어를 박아 두면
    // 번역 값 안에 태그가 섞여 번역자가 마크업을 깨뜨리게 된다.
    const danger = el('div', 'tc-danger');
    const center = el('div', 'tc-center');

    const pause = el('div', 'tc-modal');
    const pauseSheet = el('div', 'tc-sheet');
    const pauseTitle = el('h2');
    const pauseBody = el('p');
    const pauseActions = el('div', 'tc-actions');
    const pauseResume = el('button', 'tc-cta');
    pauseResume.type = 'button';
    pauseActions.appendChild(pauseResume);
    // 언어 선택은 게임 중에도 닿을 수 있어야 한다.
    pauseSheet.append(pauseTitle, pauseBody, createLanguageSelect(), createSoundToggle(), pauseActions);
    pause.appendChild(pauseSheet);

    const revive = el('div', 'tc-modal tc-revive');
    const reviveSheet = el('div', 'tc-sheet');
    const reviveTitle = el('h2');
    const reviveBody = el('p');
    const reviveActions = el('div', 'tc-actions');
    const reviveDecline = el('button', 'tc-ghost');
    reviveDecline.type = 'button';
    const reviveAccept = el('button', 'tc-cta');
    reviveAccept.type = 'button';
    const reviveAcceptLabel = el('span');
    const reviveCount = el('i', 'tc-cnt');
    reviveCount.textContent = fmt(5);
    reviveAccept.append(reviveAcceptLabel, reviveCount);
    reviveActions.append(reviveDecline, reviveAccept);
    reviveSheet.append(reviveTitle, reviveBody, reviveActions);
    revive.appendChild(reviveSheet);

    const result = el('div', 'tc-modal tc-result');

    this.root.append(top, mini, feed, danger, joy, bounce, center, pause, revive, result);
    parent.appendChild(this.root);

    this.elScore = score;
    this.elRate = rate;
    this.elRank = rank;
    this.elTime = time;
    this.elGauge = gauge;
    this.elFeed = feed;
    this.elMini = mini;
    this.mctx = mini.getContext('2d')!;
    this.elBounce = bounce;
    this.elJoy = joy;
    this.elJoyKnob = knob;
    this.elDanger = danger;
    this.elCenter = center;
    this.elPause = pause;
    this.elRevive = revive;
    this.elResult = result;

    this.elRankNum = rankNum;
    this.elRankUnit = rankUnit;
    this.elTimeNum = timeNum;
    this.elTimeUnit = timeUnit;
    this.elBounceLabel = bounceLabel;
    this.elPauseTitle = pauseTitle;
    this.elPauseBody = pauseBody;
    this.elPauseResume = pauseResume;
    this.elReviveTitle = reviveTitle;
    this.elReviveBody = reviveBody;
    this.elReviveDecline = reviveDecline;
    this.elReviveAccept = reviveAcceptLabel;
    this.elReviveAcceptBtn = reviveAccept;
    this.elReviveCnt = reviveCount;

    // 정적 라벨을 현재 언어로 채우고, 언어가 바뀌면 다시 채운다.
    this.applyLocale();
    this.offLocale = onLocaleChange(() => this.applyLocale());

    pauseResume.addEventListener('click', () => cb.onResume());
    reviveDecline.addEventListener('click', () => cb.onDeclineRevive());
    reviveAccept.addEventListener('click', () => cb.onRevive());

    // 튕기기 버튼: 길게 누름 → 조준 드래그 → 릴리스
    bounce.addEventListener(
      'pointerdown',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.bouncePid = e.pointerId;
        this.bounceOrigin = { x: e.clientX, y: e.clientY };
        bounce.setPointerCapture(e.pointerId);
        bounce.classList.add('on');
        cb.onBounceDown();
      },
      { passive: false }
    );
    bounce.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.bouncePid) return;
      cb.onBounceMove(e.clientX - this.bounceOrigin.x, e.clientY - this.bounceOrigin.y);
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId !== this.bouncePid) return;
      this.bouncePid = -1;
      bounce.classList.remove('on');
      cb.onBounceUp();
    };
    bounce.addEventListener('pointerup', up);
    bounce.addEventListener('pointercancel', up);
  }

  /**
   * 언어에 의존하는 정적 라벨을 현재 언어로 다시 쓴다.
   * 매 프레임 갱신되는 값(점수·순위·시간)은 update() 가 맡는다.
   */
  /**
   * 모드 전환. World 를 만들기 «전»에 부른다.
   * 미니맵 크기는 아레나 종횡비에서 나오므로 여기서 다시 잡는다
   * (모듈 최상위에서 ROWS/COLS 를 캡처하던 자리다 — 캡처를 없앤 것이다).
   */
  /**
   * ★ 매 프레임 쓰기 억제 캐시를 통째로 무효화한다 (2026-08-20 성능 최적화의 짝).
   *
   * 캐시는 «값이 같으면 DOM 을 안 만진다» 는 최적화다. 그래서 DOM 이 «밖에서»
   * 바뀌거나(applyLocale 이 텍스트를 다시 씀) 판이 새로 시작돼 값이 되감기면
   * 반드시 여기서 지워야 한다. 안 지우면 «같은 값이니 안 쓴다» 판정이 나서
   * 화면이 지난 판 숫자에 얼어붙는다.
   * ★ 새 캐시 필드를 추가하면 «여기에도» 넣어라.
   */
  private invalidateCache(): void {
    this.lastScore = -1;
    this.lastRate = -1;
    this.lastRank = -1;
    this.lastSecs = -1;
    this.lastGauge = -1;
    this.lastConic = -1;
    this.lastReady = null;
    this.ariaReady = null;
    this.lastDanger = null;
    this.lastCenterPhase = '';
    this.lastRevive = false;
    this.lastReviveCnt = -1;
    this.lastReviveAd = null;
    this.lastReviveLoading = null;
  }

  setMode(spec: ModeSpec): void {
    this.mode = spec;
    this.invalidateCache();
    const h = Math.round((78 * spec.rows) / spec.cols) * 2;
    if (this.elMini.height !== h) this.elMini.height = h;
    this.elTimeUnit.textContent = useClock(spec.sec)
      ? t('hud.time.unit.long')
      : t('hud.time.unit');
    this.elTimeNum.textContent = useClock(spec.sec) ? clockText(spec.sec) : fmt(spec.sec);
  }

  private applyLocale(): void {
    // 언어가 바뀌면 «같은 값이라도» 문자열이 달라진다 → 캐시를 버린다.
    this.invalidateCache();
    this.elRankUnit.textContent = t('hud.rank.unit');
    this.elTimeUnit.textContent = useClock(this.mode.sec)
      ? t('hud.time.unit.long')
      : t('hud.time.unit');
    this.elBounceLabel.textContent = t('hud.bounce');
    this.elBounce.setAttribute('aria-label', t('hud.bounce.aria'));

    this.elPauseTitle.textContent = t('modal.pause.title');
    this.elPauseBody.textContent = t('modal.pause.body');
    this.elPauseResume.textContent = t('modal.pause.resume');

    this.elReviveTitle.textContent = t('modal.revive.title');
    this.elReviveDecline.textContent = t('modal.revive.decline');
    // 본문·수락 라벨은 «변형에 따라 달라진다» → 한 곳에서만 만든다.
    //   언어가 바뀌면 캐시를 버리고(위 invalidateCache) 현재 변형으로 다시 그린다.
    this.lastReviveAd = null;
    this.lastReviveLoading = null;
    this.renderReviveCopy(false, false);

    if (this.elCenter.classList.contains('show')) {
      this.elCenter.textContent = t('game.title');
    }
  }

  /**
   * 부활 모달의 «본문 + 수락 버튼»을 현재 변형으로 그린다.
   *
   * 변형 3가지 — 제목(「영토를 전부 잃었어요」)은 셋 다 같다. 상황이 같기 때문이다.
   *   ① 무료 부활        : 지금 라이브와 같은 문구
   *   ② 광고 부활 제안   : 「광고를 보면 한 번 더 복귀할 수 있어요」 + 「광고 보고 부활하기」
   *   ③ 광고 로딩·재생 중: 버튼을 «비활성»으로 두고 「광고 불러오는 중…」.
   *      카운트다운도 숨긴다 — 이때는 sim 의 제안 타이머가 «실제로» 멈춰 있어서
   *      (World.revivePaused) 멈춘 숫자를 보여주면 화면이 고장 난 것처럼 보인다.
   *
   * ★ ①의 문구는 «광고 부활이 가능할 때만» 달라진다. 광고 지면이 없어 두 번째
   *   제안이 아예 없는 상태(=지금 라이브)에서는 예전 문장 그대로 나간다. 반대로
   *   광고 부활이 살아 있는데 「세션당 1회만 가능합니다」라고 하면 «거짓말»이
   *   된다 — 그래서 그때는 「무료 부활은 1회예요」로 바꾼다.
   */
  private renderReviveCopy(needsAd: boolean, loading: boolean): void {
    const size = `${fmt(REVIVE_SPAN)}×${fmt(REVIVE_SPAN)}`;
    if (needsAd) {
      this.elReviveBody.textContent = t('modal.revive.body.ad');
    } else {
      // 강조(<b>)는 코드가 만든다 — 번역 값에는 태그가 없다.
      const limit = document.createElement('b');
      limit.textContent = t('modal.revive.limit');
      this.elReviveBody.textContent = '';
      this.elReviveBody.appendChild(
        tNodes(this.adReviveOffered ? 'modal.revive.body.free' : 'modal.revive.body', {
          size,
          limit,
        })
      );
    }
    this.elReviveAccept.textContent = loading
      ? t('modal.revive.loading')
      : needsAd
        ? t('modal.revive.accept.ad')
        : t('modal.revive.accept');
    this.elReviveAcceptBtn.disabled = loading;
    this.elReviveDecline.disabled = loading;
    this.elReviveAcceptBtn.setAttribute('aria-busy', loading ? 'true' : 'false');
    this.elReviveCnt.hidden = loading;
    this.elRevive.classList.toggle('ad', needsAd);
    this.elRevive.classList.toggle('loading', loading);
  }

  /** 조이스틱 시각화 (index.ts 의 캔버스 포인터가 좌표를 넘긴다) */
  setJoystick(active: boolean, ox: number, oy: number, dx: number, dy: number): void {
    if (!active) {
      this.elJoy.classList.remove('on');
      return;
    }
    this.elJoy.classList.add('on');
    this.elJoy.style.left = `${ox}px`;
    this.elJoy.style.top = `${oy}px`;
    const len = Math.hypot(dx, dy);
    const k = len > 46 ? 46 / len : 1;
    this.elJoyKnob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  }

  setPaused(p: boolean): void {
    this.elPause.classList.toggle('show', p);
  }

  /**
   * 메뉴가 떠 있는 동안 인게임 HUD 를 감춘다.
   * 안 감추면 «직전 판의 점수·타이머»가 흐린 배경 뒤에 그대로 남아서,
   * 새 판을 고르는 화면에 죽은 숫자가 비쳐 보인다.
   * ★ display 가 아니라 visibility 계열(클래스)로 감춘다 — 레이아웃을 흔들지
   *   않아야 메뉴를 닫는 순간 HUD 가 튀지 않는다.
   */
  setHidden(h: boolean): void {
    this.root.classList.toggle('tc-hidden', h);
  }

  update(w: World, dt: number): void {
    if (this.disposed) return;
    const p = w.player;

    // 점수 오도미터 롤업
    // ★ 아래 전부 «값이 바뀐 프레임에만» DOM 을 만진다. 표시값은 동일하다.
    this.shownScore += (p.score - this.shownScore) * Math.min(1, dt * 9);
    const score = Math.round(this.shownScore);
    if (score !== this.lastScore) {
      this.lastScore = score;
      this.elScore.textContent = fmt(score);
    }
    const rate = w.grid.income[p.id]!;
    if (rate !== this.lastRate) {
      this.lastRate = rate;
      this.elRate.textContent = t('hud.rate', { rate: fmt(rate) });
      this.elRate.style.color = rate > 260 ? PAL.goldA : PAL.ink1;
    }

    const rank = w.rankOf(p.id);
    if (rank !== this.lastRank) {
      this.lastRank = rank;
      this.elRankNum.textContent = fmt(rank);
      this.elRank.classList.toggle('lead', rank === 1);
    }

    const secs = Math.max(0, Math.ceil(w.timeLeft));
    if (secs !== this.lastSecs) {
      this.lastSecs = secs;
      this.elTimeNum.textContent = useClock(this.mode.sec) ? clockText(secs) : fmt(secs);
      this.elTime.classList.toggle('urgent', secs <= 10);
    }

    /**
     * 게이지 — 양자화해서 «바뀔 때만» 쓴다.
     * 가로 트랙은 화면폭 -24px(≈370px)이라 1% ≈ 3.7px 로 눈에 띈다.
     * 그래서 0.2% 단위(≈0.74px)로 잡는다 — 남는 틈은 CSS transition 0.12s 가
     * 메운다. 표시상 차이가 없다.
     */
    const gq = Math.round(p.gauge * 5) / 5;
    if (gq !== this.lastGauge) {
      this.lastGauge = gq;
      this.elGauge.style.width = `${gq}%`;
    }
    /**
     * ★ conic-gradient + radial mask 재칠은 이 HUD 에서 «가장 비싼 쓰기»다.
     *   마스크가 걸린 요소는 별도 렌더패스를 타기 때문이다. 지름 80px 원이라
     *   1% = 3.6° — 양자화해도 눈으로 구분이 안 된다.
     */
    const cq = Math.round(p.gauge);
    if (cq !== this.lastConic) {
      this.lastConic = cq;
      this.elBounce.style.setProperty('--g', String(cq / 100));
    }
    const ready = p.gauge >= 100 && p.cd <= 0;
    if (ready !== this.lastReady) {
      this.lastReady = ready;
      this.elBounce.classList.toggle('ready', ready);
    }
    /**
     * 사용 가능 여부를 **시각 말고도** 알린다.
     * 예전에는 ready 가 CSS 클래스에만 쓰여서, 스크린리더 사용자는 게이지가
     * 찼는지 알 방법이 아예 없었다(게이지 채움과 .ready 색이 유일한 신호였다).
     *
     * ★ disabled 대신 aria-disabled 인 이유
     *   disabled 를 걸면 버튼이 포커스 순서에서 빠진다. 이 능력은 몇 초 뒤
     *   다시 켜지는데, 그동안 키보드 사용자는 버튼을 찾지 못하고 다시 켜진
     *   것도 알 수 없다. aria-disabled 는 포커스를 유지한 채 "지금은 못 쓴다"만
     *   알려 준다.
     * ★ 상태를 라벨(hud.bounce.aria)에 넣지 않는다. 접근가능한 이름에는 보이는
     *   버튼 텍스트가 들어 있어야 한다(WCAG 2.5.3 Label in Name). 상태는 이름이
     *   아니라 ARIA 상태로 표현한다.
     * ★ 클릭 차단은 DOM 이 아니라 모델이 한다 — sim.ts bounceHold() 가
     *   gauge<100 || cd>0 이면 false 를 돌려준다(sim.ts:185). 그래서 여기서는
     *   막지 않고 알리기만 하면 된다.
     */
    // ★ ready 가 «바뀐 프레임에만» 쓴다. 위 lastReady 블록과 같은 조건이지만
    //   접근성 계약(aria-disabled 가 항상 최신)이 깨지면 안 되므로 조건을 따로
    //   두지 않고 여기서 같이 처리한다.
    if (this.ariaReady !== ready) {
      this.ariaReady = ready;
      this.elBounce.setAttribute('aria-disabled', String(!ready));
      // disabled 는 «절대 걸지 않는다»(위 주석 참조). 생성 시 false 이므로
      // 매 프레임 다시 쓸 이유가 없다 — 상태가 바뀔 때만 재확인한다.
      this.elBounce.disabled = false;
    }

    // 영토 밖 5초 이상 → 가장자리 danger 펄스
    const danger = p.outsideT > 5 && p.alive;
    if (danger !== this.lastDanger) {
      this.lastDanger = danger;
      this.elDanger.classList.toggle('on', danger);
    }

    // 킬 피드
    if (w.killFeed.length !== this.elFeed.childElementCount) {
      this.elFeed.innerHTML = w.killFeed
        .map(
          (r) =>
            `<div class="tc-feed-row"><em style="color:${faction(r.fa).glow}">${esc(r.a)}</em>` +
            // ★2026-08-23 — 글자 ✕(U+2715)를 뺐다. 폰트마다 굵기·크기·베이스라인이
            //   달라 기기별로 다르게 보인다(▲▼·♪ 를 CSS/SVG 로 바꾼 것과 같은 이유).
            //   ⇒ 십자는 `hud.css` 의 `.tc-feed-row s::before/::after` 가 «그린다».
            //   ⛔`<s>` 요소 자체는 남긴다 — 그게 CSS 훅이다. 지우면 십자가 사라진다.
            `<s aria-hidden="true"></s><em style="color:${faction(r.fb).glow}">${esc(r.b)}</em></div>`
        )
        .join('');
    }

    // 카운트다운 / 상태 메시지 — 국면이 바뀔 때만 만진다.
    if (w.phase === 'countdown') {
      if (this.lastCenterPhase !== 'countdown') {
        this.lastCenterPhase = 'countdown';
        this.elCenter.className = 'tc-center show';
        this.elCenter.textContent = t('game.title');
      }
    } else if (w.phase === 'play' && this.elCenter.classList.contains('show')) {
      this.lastCenterPhase = 'play';
      this.elCenter.className = 'tc-center';
    }

    // 부활 제안 — 상태·카운트가 바뀔 때만 만진다.
    // (querySelector 를 매 프레임 돌리던 것도 같이 없앤다)
    const showRevive = w.phase === 'revive';
    if (showRevive !== this.lastRevive) {
      this.lastRevive = showRevive;
      this.lastReviveCnt = -1;
      this.elRevive.classList.toggle('show', showRevive);
    }
    if (showRevive) {
      // 변형(무료/광고)·로딩은 «바뀔 때만» 다시 그린다(매 프레임 DOM 금지).
      const needsAd = w.reviveNeedsAd;
      const loading = w.revivePaused;
      if (this.adReviveOffered !== w.adReviveAvailable) {
        this.adReviveOffered = w.adReviveAvailable;
        this.lastReviveAd = null; // 무료 제안의 본문이 달라진다 → 강제 재렌더
      }
      if (needsAd !== this.lastReviveAd || loading !== this.lastReviveLoading) {
        this.lastReviveAd = needsAd;
        this.lastReviveLoading = loading;
        this.renderReviveCopy(needsAd, loading);
      }
      const cnt = Math.max(0, Math.ceil(w.reviveOffer));
      if (cnt !== this.lastReviveCnt) {
        this.lastReviveCnt = cnt;
        this.elReviveCnt.textContent = fmt(cnt);
      }
    }

    // 미니맵 4Hz
    this.miniAcc += dt;
    if (this.miniAcc > 0.25) {
      this.miniAcc = 0;
      this.drawMini(w);
    }
  }

  private drawMini(w: World): void {
    const m = this.mctx;
    const W = this.elMini.width;
    const H = this.elMini.height;
    const sx = W / COLS;
    const sy = H / ROWS;
    m.clearRect(0, 0, W, H);
    m.fillStyle = 'rgba(5,6,11,0.78)';
    m.fillRect(0, 0, W, H);
    const g = w.grid;
    for (let r = 0; r < ROWS; r++) {
      let run = -1;
      let cur = -2;
      for (let c = 0; c <= COLS; c++) {
        const o = c < COLS ? g.owner[r * COLS + c]! : -2;
        if (o !== cur) {
          if (cur >= 0 && run >= 0) {
            m.fillStyle = faction(cur).s1;
            m.fillRect(run * sx, r * sy, (c - run) * sx + 0.5, sy + 0.5);
          }
          run = c;
          cur = o;
        }
      }
    }
    // 특수지 3곳 소유자 상시 노출 (§3-B HUD 표시)
    for (const lm of g.landmarks) {
      const o = g.owner[lm]!;
      m.fillStyle = o >= 0 ? faction(o).glow : PAL.goldA;
      m.beginPath();
      m.arc(((lm % COLS) + 0.5) * sx, (((lm / COLS) | 0) + 0.5) * sy, 3.4, 0, 7);
      m.fill();
    }
    const p = w.player;
    m.fillStyle = '#fff';
    m.beginPath();
    m.arc((p.x / CELL) * sx, (p.y / CELL) * sy, 3, 0, 7);
    m.fill();
  }

  showResult(d: ResultData): void {
    const medal = d.rank === 1 ? PAL.goldA : d.rank <= 3 ? PAL.ink0 : PAL.ink1;
    this.elResult.textContent = '';

    const sheet = el('div', 'tc-sheet tc-resheet');

    const rankBig = el('div', 'tc-rankbig');
    rankBig.style.color = medal;
    rankBig.append(fmt(d.rank));
    const rankUnit = el('small');
    rankUnit.textContent = t('hud.rank.unit');
    rankBig.appendChild(rankUnit);
    sheet.appendChild(rankBig);

    /**
     * 어느 모드의 결과인지 밝힌다. 최고기록이 모드별로 갈리기 때문에,
     * 이게 없으면 「기록이 왜 안 깨지지」로 읽힌다.
     */
    const modeTag = el('div', 'tc-menu-sub');
    modeTag.textContent = t('result.mode', {
      mode: t(`menu.mode.${d.mode}` as MessageKey),
      players: fmt(d.total),
    });
    sheet.appendChild(modeTag);

    if (d.newBest) {
      const nb = el('div', 'tc-newbest');
      nb.textContent = t('result.newBest');
      sheet.appendChild(nb);
    }

    const stats = el('ul', 'tc-stats');
    stats.append(
      row(t('result.cells'), t('result.value.cells', {
        percent: fmtDecimal((d.cells / (COLS * ROWS)) * 100, 1),
      })),
      row(t('result.income'), fmt(d.score)),
      row(t('result.kills'), t('result.value.kills', { count: fmt(d.kills) })),
      row(t('result.maxTrail'), t('result.value.trail', { count: fmt(d.maxTrail) })),
      row(t('result.coins'), t('result.value.coins', { count: fmt(d.coins) }), PAL.goldA),
      row(t('result.xp'), t('result.value.xp', { count: fmt(d.xp) }), PAL.success)
    );
    sheet.appendChild(stats);

    // ── 통산 기록 (2026-08-05) ────────────────────────────────────────────
    //  이 판 성적만 보여주고 끝나서 "쌓이는 게 없다"는 실기기 지적이 나왔다.
    //  저장은 되고 있었는데 화면에 나오는 경로가 아예 없었던 게 원인이다.
    const careerTitle = el('div', 'tc-career-title');
    careerTitle.textContent = t('career.title');
    sheet.appendChild(careerTitle);

    const career = el('ul', 'tc-stats tc-career');
    career.append(
      row(t('career.plays'), t('career.value.plays', { count: fmt(d.career.plays) })),
      row(t('career.wins'), t('career.value.wins', { count: fmt(d.career.wins) }), PAL.goldA),
      row(t('career.kills'), t('career.value.kills', { count: fmt(d.career.kills) })),
      row(t('career.xp'), t('career.value.xp', { count: fmt(d.career.xp) }), PAL.success)
    );
    sheet.appendChild(career);

    // ★ 언어 선택을 결과 화면에도 둔다. 설치된 앱에서 9개 언어를 실제로
    //   전달하는 경로가 이 셀렉터뿐이라, 한 판만 끝내면 누구나 보게 되는
    //   여기가 가장 확실한 노출 지점이다.
    sheet.appendChild(createLanguageSelect());

    const actions = el('div', 'tc-actions');
    // 모드 변경이 «결과 화면»에도 있어야 한다. 한 판 끝낸 직후가 다른 길이를
    // 고를 마음이 드는 유일한 순간이고, 여기 없으면 앱을 껐다 켜야 한다.
    const change = el('button', 'tc-ghost');
    change.type = 'button';
    change.textContent = t('result.changeMode');
    const btn = el('button', 'tc-cta');
    btn.type = 'button';
    btn.textContent = t('result.restart');
    actions.append(change, btn);
    sheet.appendChild(actions);

    this.elResult.appendChild(sheet);
    this.elResult.classList.add('show');
    btn.addEventListener('click', () => this.cb.onRestart());
    change.addEventListener('click', () => this.cb.onChangeMode());
    // 80ms 스태거 롤업 (§6.5 — 동시 등장 금지)
    const items = this.elResult.querySelectorAll('.tc-stats li');
    items.forEach((li, i) => {
      (li as HTMLElement).style.animationDelay = `${i * 80}ms`;
    });
  }

  hideResult(): void {
    this.elResult.classList.remove('show');
    this.elResult.textContent = '';
    this.shownScore = 0;
  }

  destroy(): void {
    this.disposed = true;
    this.offLocale();
    this.root.remove();
  }
}

function row(k: string, v: string, color?: string): HTMLLIElement {
  const li = document.createElement('li');
  const key = document.createElement('span');
  key.textContent = k;
  const val = document.createElement('b');
  val.textContent = v;
  if (color) val.style.color = color;
  li.append(key, val);
  return li;
}

function esc(s: string): string {
  return s.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * 지가 등급 라벨 — 디버그/툴팁용(현재 미사용이지만 값 테이블 단일 출처 유지).
 * 상수가 아니라 함수인 이유: 모듈 로드 시점에 언어가 확정돼 있지 않고,
 * 사용자가 언어를 바꾸면 값도 따라 바뀌어야 하기 때문이다.
 */
export function tierLabels(): string[] {
  return [t('tier.normal'), t('tier.commercial'), t('tier.special')].map((n, i) =>
    t('tier.label', { name: n, value: fmt(TIER_VALUE[i] ?? 0) })
  );
}
