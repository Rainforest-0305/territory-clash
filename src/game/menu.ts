/**
 * 시작 메뉴 — 경기 시간(1·3·5분) · 난이도 선택.
 *
 * ★ 이 화면은 «판이 시작되기 전»에만 뜬다. 인게임 HUD 와 겹치지 않는다.
 * ★ 접근성: 두 선택지는 radiogroup/radio 다. 체크박스나 그냥 버튼이 아니다 —
 *   스크린리더가 "3개 중 2번째, 선택됨" 을 읽어야 한다. 로빙 tabindex 라
 *   Tab 은 그룹을 통째로 지나가고 그룹 «안»은 방향키로 옮긴다(WAI-ARIA 표준
 *   radiogroup 패턴). 이 패턴을 임의로 바꾸지 마라.
 * ★ 문자열은 전부 i18n 키다. 여기에 한국어를 박지 마라.
 */
import './menu.css';
import { MODE_ORDER, DIFFICULTY_ORDER, modeOf, type Difficulty, type ModeKey } from './modes';
import { t, fmt, onLocaleChange } from '../i18n';
import type { MessageKey } from '../i18n/types';
import { createLanguageSelect } from '../i18n/languageSelect';
import type { DailyClashInfo } from './dailyClash';
import { createSoundToggle } from '../ui/soundToggle';

export interface MenuState {
  mode: ModeKey;
  difficulty: Difficulty;
  /** 모드별 최고점(0 = 기록 없음) */
  bestByMode: Record<ModeKey, number>;
}

export interface MenuCallbacks {
  onStart: (mode: ModeKey, difficulty: Difficulty) => void;
  /** 「오늘의 대결」 카드의 플레이 버튼 */
  onStartDailyClash: () => void;
}

/** 순환 표시 칸 수(REWARD_TABLE 길이와 같다 — dailyClash.ts 가 정본). */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}

export class Menu {
  private root: HTMLDivElement;
  private title: HTMLElement;
  private sub: HTMLElement;
  private modeLabel: HTMLElement;
  private diffLabel: HTMLElement;
  private modeBtns = new Map<ModeKey, HTMLButtonElement>();
  private diffBtns = new Map<Difficulty, HTMLButtonElement>();
  private desc: HTMLElement;
  private hint: HTMLElement;
  private bestLabel: HTMLElement;
  private bestValue: HTMLElement;
  private start: HTMLButtonElement;
  private offLocale: () => void;

  // ── 오늘의 대결 카드(출석) ────────────────────────────────────────────────
  private dcCard: HTMLElement;
  private dcTitle: HTMLElement;
  private dcStatus: HTMLElement;
  private dcButton: HTMLButtonElement;
  private dcInfo: DailyClashInfo | null = null;

  private mode: ModeKey = '60';
  private difficulty: Difficulty = 'auto';
  private best: Record<ModeKey, number> = { '60': 0, '180': 0, '300': 0 };

  constructor(parent: HTMLElement, cb: MenuCallbacks) {
    this.root = el('div', 'tc-menu');
    const sheet = el('div', 'tc-menusheet');

    this.title = el('h1', 'tc-menu-title');
    this.sub = el('p', 'tc-menu-sub');

    // ── 오늘의 대결(출석) 카드 ───────────────────────────────────────────────
    // ★신규 모달 아님 — 기존 시트 «안»의 카드 하나다(.tc-menu-best 와 같은 급).
    this.dcCard = el('div', 'tc-dc');
    this.dcCard.hidden = true; // 데이터 로드 전엔 숨김(빈 카드 깜빡임 방지)
    const dcHead = el('div', 'tc-dc-head');
    this.dcTitle = el('span', 'tc-dc-title');
    /* ★2026-08-23: 7개 도트를 «제거»했다(President 지적).
       가로 도트 행은 「좌우로 넘기는 캐러셀」이라는 보편 관례다. 그런데 이건
       7일 출석 사이클 «진행 표시»라 넘길 대상이 없다 ⇒ 거짓 어포던스였다.
       (실제로 President 가 스와이프를 시도했다)
       정보 손실 0: 같은 내용을 바로 아래 dcStatus 가 「연속 N일째」로 이미
       말하고 있었고, 도트는 aria-hidden=true 라 스크린리더에도 없던 것이다. */
    dcHead.append(this.dcTitle);
    this.dcStatus = el('p', 'tc-dc-status');
    this.dcButton = el('button', 'tc-dc-play');
    this.dcButton.type = 'button';
    this.dcButton.addEventListener('click', () => {
      if (this.dcInfo && !this.dcInfo.completedToday) cb.onStartDailyClash();
    });
    this.dcCard.append(dcHead, this.dcStatus, this.dcButton);

    // ── 경기 시간 ─────────────────────────────────────────────────────────
    const modeGroup = el('div', 'tc-menu-group');
    this.modeLabel = el('div', 'tc-menu-label');
    this.modeLabel.id = 'tc-menu-modelabel';
    const modeSeg = el('div', 'tc-seg');
    modeSeg.setAttribute('role', 'radiogroup');
    modeSeg.setAttribute('aria-labelledby', this.modeLabel.id);
    for (const key of MODE_ORDER) {
      const b = el('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.addEventListener('click', () => this.setMode(key));
      this.modeBtns.set(key, b);
      modeSeg.appendChild(b);
    }
    this.wireRoving(modeSeg);
    modeGroup.append(this.modeLabel, modeSeg);
    this.desc = el('p', 'tc-menu-desc');

    // ── 난이도 ────────────────────────────────────────────────────────────
    const diffGroup = el('div', 'tc-menu-group');
    this.diffLabel = el('div', 'tc-menu-label');
    this.diffLabel.id = 'tc-menu-difflabel';
    const diffSeg = el('div', 'tc-seg tc-seg5');
    diffSeg.setAttribute('role', 'radiogroup');
    diffSeg.setAttribute('aria-labelledby', this.diffLabel.id);
    for (const key of DIFFICULTY_ORDER) {
      const b = el('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.addEventListener('click', () => this.setDifficulty(key));
      this.diffBtns.set(key, b);
      diffSeg.appendChild(b);
    }
    this.wireRoving(diffSeg);
    diffGroup.append(this.diffLabel, diffSeg);
    this.hint = el('p', 'tc-menu-hint');

    // ── 이 모드 최고 기록 ─────────────────────────────────────────────────
    const best = el('div', 'tc-menu-best');
    this.bestLabel = el('span');
    this.bestValue = el('b');
    best.append(this.bestLabel, this.bestValue);

    const actions = el('div', 'tc-actions');
    this.start = el('button', 'tc-cta');
    this.start.type = 'button';
    this.start.addEventListener('click', () => cb.onStart(this.mode, this.difficulty));
    actions.appendChild(this.start);

    /*
     * ★2026-08-23 구조 변경 — 스티키 CTA 오버레이를 «폐기»한다.
     *
     * 이전: .tc-actions 를 position:sticky 로 띄워 항상 보이게 했다.
     *   ⇒ 항상 보이긴 하지만 «그 아래 내용을 덮는다». 언어 선택·최고기록·
     *     개인정보처리방침이 첫 화면에서 가려졌다(President 실기기 지적).
     *
     * 지금: 시트를 flex 세로 컬럼으로 만들고
     *   .tc-menuscroll  = 넘치는 내용만 스크롤(flex:1, min-height:0)
     *   .tc-actions     = 스크롤 «밖»의 형제 푸터(flex:none)
     *   ⇒ CTA 가 오버레이가 아니므로 «구조적으로» 아무것도 덮을 수 없다.
     *     겹침 0 이 CSS 규칙이 아니라 레이아웃 «불변식»이 된다.
     *
     * ⛔privacyLink.ts 는 sheet.insertBefore(row, .tc-actions) 로 삽입한다.
     *   actions 가 sheet 의 직계 자식으로 «남아 있어야» 그 코드가 그대로 동작한다.
     *   (결과적으로 방침 링크도 스크롤 밖 푸터가 되어 항상 보인다 — 의도한 것)
     */
    const scroll = el('div', 'tc-menuscroll');
    scroll.append(
      this.title,
      this.sub,
      this.dcCard,
      modeGroup,
      this.desc,
      diffGroup,
      this.hint,
      best,
      createLanguageSelect(),
      createSoundToggle()
    );
    sheet.append(scroll, actions);
    this.root.appendChild(sheet);
    parent.appendChild(this.root);

    this.applyLocale();
    this.offLocale = onLocaleChange(() => this.applyLocale());
  }

  /**
   * radiogroup 로빙 tabindex — 방향키로 이동 + 이동 즉시 선택(표준 동작).
   * Home/End 도 지원한다.
   */
  private wireRoving(group: HTMLElement): void {
    group.addEventListener('keydown', (e: KeyboardEvent) => {
      const btns = Array.from(group.querySelectorAll('button'));
      const cur = btns.indexOf(document.activeElement as HTMLButtonElement);
      if (cur < 0) return;
      let next = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (cur + 1) % btns.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
        next = (cur - 1 + btns.length) % btns.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = btns.length - 1;
      if (next < 0) return;
      e.preventDefault();
      const b = btns[next]!;
      b.focus();
      b.click();
    });
  }

  private setMode(key: ModeKey): void {
    this.mode = key;
    this.refresh();
  }
  private setDifficulty(key: Difficulty): void {
    this.difficulty = key;
    this.refresh();
  }

  /** 선택 상태 → 화면. 라벨 텍스트는 applyLocale 이 맡는다. */
  private refresh(): void {
    for (const [key, b] of this.modeBtns) {
      const on = key === this.mode;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    for (const [key, b] of this.diffBtns) {
      const on = key === this.difficulty;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    const spec = modeOf(this.mode);
    this.desc.textContent = t('menu.mode.desc', {
      cols: fmt(spec.cols),
      rows: fmt(spec.rows),
      players: fmt(spec.participants),
    });
    this.hint.textContent = this.difficulty === 'auto' ? t('menu.difficulty.auto.hint') : '';
    const b = this.best[this.mode] ?? 0;
    this.bestValue.textContent = b > 0 ? fmt(b) : t('menu.best.none');
  }

  private applyLocale(): void {
    this.title.textContent = t('game.title');
    this.sub.textContent = t('menu.subtitle');
    this.dcTitle.textContent = t('menu.dailyClash.title');
    this.modeLabel.textContent = t('menu.mode');
    this.diffLabel.textContent = t('menu.difficulty');
    this.bestLabel.textContent = t('menu.best');
    this.start.textContent = t('menu.start');
    // 키 조립은 여기 두 줄뿐이다. modes.ts 의 목록과 en.ts 의 키가 1:1 이라
    // 어느 한쪽만 늘리면 화면에 키 문자열이 그대로 나와 바로 들킨다.
    for (const [key, btn] of this.modeBtns) {
      btn.textContent = t(`menu.mode.${key}` as MessageKey);
    }
    for (const [key, btn] of this.diffBtns) {
      btn.textContent = t(`menu.difficulty.${key}` as MessageKey);
    }
    this.renderDailyClash();
    this.refresh();
  }

  /**
   * 오늘의 대결 카드 갱신. index.ts 가 저장 읽기(비동기)를 끝낸 뒤 부른다.
   * ★info=null 이면 카드를 숨긴다(로드 실패·아직 로드 전) — 빈 카드보다 낫다.
   */
  setDailyClash(info: DailyClashInfo | null): void {
    this.dcInfo = info;
    this.renderDailyClash();
  }

  private renderDailyClash(): void {
    const info = this.dcInfo;
    if (!info) {
      this.dcCard.hidden = true;
      return;
    }
    this.dcCard.hidden = false;
    if (info.completedToday) {
      this.dcStatus.textContent = t('menu.dailyClash.status.done', { streak: fmt(info.streak) });
      this.dcButton.textContent = t('menu.dailyClash.doneButton');
      this.dcButton.disabled = true;
    } else {
      this.dcStatus.textContent = t('menu.dailyClash.status.pending', {
        coins: fmt(info.reward),
        streak: fmt(info.streak),
      });
      this.dcButton.textContent = t('menu.dailyClash.play');
      this.dcButton.disabled = false;
    }
  }

  show(state: MenuState): void {
    this.mode = state.mode;
    this.difficulty = state.difficulty;
    this.best = state.bestByMode;
    this.refresh();
    this.root.classList.add('show');
    // 포커스를 시트 안으로 넣어 준다. 키보드/스위치 사용자가 배경에 갇히지 않게.
    this.modeBtns.get(this.mode)?.focus({ preventScroll: true });
  }

  hide(): void {
    this.root.classList.remove('show');
  }

  get visible(): boolean {
    return this.root.classList.contains('show');
  }

  destroy(): void {
    this.offLocale();
    this.root.remove();
  }
}
