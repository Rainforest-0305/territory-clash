/**
 * 「머니 리그」 교차추천 카드 — 결과 화면 «하루 1회» (★2026-09-10 신설 · 2주 실험)
 *
 * ── 왜 별도 파일인가(src/game/** 무접촉) ─────────────────────────────────────
 *   `ads/adGate.ts` 가 결과 화면을 관측하는 방식과 같다 — `.tc-result` 의 class 'show' 와 자식
 *   교체를 MutationObserver 로 보고, 시트(`.tc-resheet`)가 «새로 만들어질 때마다» 판정한다.
 *   hud.ts 의 showResult()/hideResult() 는 이 파일의 존재를 모른다.
 *
 * ── 배치 ───────────────────────────────────────────────────────────────────
 *   결과 시트 안, 통산 기록(`.tc-career`) «아래» · 언어 선택(`.tc-lang`) «위». 이번 판 성적·통산이
 *   먼저 읽히고, 그 다음 「다음에 해볼 것」 자리다. 행동 버튼(다시하기·모드 변경)과는 언어 행 하나가
 *   사이에 있어 오탭 위치가 아니다.
 *   ⛔버튼에 `.tc-cta`/`.tc-ghost` 를 쓰지 않는다 — adGate 캡처 클릭이 그 두 클래스를 「판 시작/이탈」로
 *     가로채 광고를 띄운다(adGate.ts onCaptureClick 실측).
 *
 * ── 하루 1회 ────────────────────────────────────────────────────────────────
 *   toss/crossPromo.ts 가 `tc:crosspromo.v1` 의 lastShownDay(KST 날짜키)로 판정한다. 카드를 «실제로
 *   붙인 직후» 그날 상한을 소비한다. 닫기는 DOM 제거만 한다(그날 기록은 이미 남았다).
 *   결과 시트가 재생성되면(다음 판) 카드도 사라지고 다음 'show' 에서 다시 판정 → 같은 날은 0장.
 *
 * ── 열기 ──────────────────────────────────────────────────────────────────
 *   `openCrossPromo()` → 'ok' | 'failed' | 'unknown'. 'failed' 만 부제를 실패 문구로 바꾼다.
 *   'unknown'(4초 무응답)은 앱이 실제로 열렸을 수 있어 아무 문구도 바꾸지 않는다.
 *   ★실기기에서 `intoss://moneyleague` 가 머니 리그를 여는지는 [미확인] — Partner 테스트 푸시.
 *
 * ── 계측 ─────────────────────────────────────────────────────────────────
 *   crosspromo_impression(impression) · crosspromo_click(click) · crosspromo_dismiss(event) —
 *   params 는 target enum 만. 「순사용자 증가」는 측정할 수 없으므로 쓰지 않는다.
 */
import './crossPromo.css';
import {
  isInToss,
  crossPromoDueToday,
  markCrossPromoShown,
  markCrossPromoClicked,
  openCrossPromo,
} from '../toss';
import { t, onLocaleChange } from '../i18n';
import { track } from '../analytics/track';
import { sfx } from '../game/sfx';

const RESULT_SELECTOR = '.tc-result';
const SHEET_SELECTOR = '.tc-resheet';
const BEFORE_SELECTOR = '.tc-lang';
const ACTIONS_SELECTOR = '.tc-actions';
const WAIT_MS = 8000;
const TARGET_TAG = 'moneyleague';

function leagueIcon(): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  // 상승 꺾은선 + 바닥선 — 「투자」를 한 획으로.
  const p1 = document.createElementNS(NS, 'path');
  p1.setAttribute('d', 'M4 16.5l4.6-5.2 3.6 3 4.4-6.1L20 10');
  const p2 = document.createElementNS(NS, 'path');
  p2.setAttribute('d', 'M4 20h16');
  for (const p of [p1, p2]) {
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '1.7');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(p);
  }
  return svg;
}

function closeIcon(): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 14 14');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', 'M2.5 2.5l9 9M11.5 2.5l-9 9');
  p.setAttribute('stroke', 'currentColor');
  p.setAttribute('stroke-width', '1.7');
  p.setAttribute('stroke-linecap', 'round');
  svg.appendChild(p);
  return svg;
}

interface Card {
  root: HTMLElement;
  title: HTMLElement;
  tag: HTMLElement;
  sub: HTMLElement;
  open: HTMLButtonElement;
  close: HTMLButtonElement;
  failed: boolean;
}

function buildCard(): Card {
  const root = document.createElement('div');
  root.className = 'tc-xp';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-labelledby', 'tc-xp-title');
  const ic = document.createElement('span');
  ic.className = 'tc-xp-ic';
  ic.setAttribute('aria-hidden', 'true');
  ic.appendChild(leagueIcon());
  const text = document.createElement('div');
  text.className = 'tc-xp-text';
  const head = document.createElement('div');
  head.className = 'tc-xp-head';
  const title = document.createElement('span');
  title.className = 'tc-xp-title';
  title.id = 'tc-xp-title';
  const tag = document.createElement('span');
  tag.className = 'tc-xp-tag';
  head.append(title, tag);
  const sub = document.createElement('span');
  sub.className = 'tc-xp-sub';
  text.append(head, sub);
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'tc-xp-open';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'tc-xp-x';
  close.appendChild(closeIcon());
  root.append(ic, text, open, close);
  return { root, title, tag, sub, open, close, failed: false };
}

function renderCard(c: Card): void {
  c.title.textContent = t('promo.ml.title');
  c.tag.textContent = t('promo.ml.label');
  c.sub.textContent = c.failed ? t('promo.ml.fail') : t('promo.ml.sub');
  c.sub.classList.toggle('err', c.failed);
  c.open.textContent = t('promo.ml.open');
  c.close.setAttribute('aria-label', t('promo.ml.close'));
}

/**
 * 설치 진입점. main.ts 에서 startGame() «뒤»에 호출한다(.tc-result 는 startGame 의 Hud 가 만든다).
 * 토스 밖이면 즉시 no-op — DOM 에 아무 흔적도 남기지 않는다.
 */
export function installCrossPromo(): () => void {
  if (!isInToss()) return () => {};

  let stopped = false;
  let waitTimer = 0;
  let observer: MutationObserver | null = null;
  let card: Card | null = null;
  let offLocale: (() => void) | null = null;
  /** 이번 'show' 사이클에서 이미 판정했는가(저장 왕복이 비동기라 재진입을 막는다). */
  let judged = false;
  let wasShown = false;

  const removeCard = (): void => {
    card?.root.remove();
    card = null;
  };

  const mount = (result: HTMLElement): void => {
    const sheet = result.querySelector<HTMLElement>(SHEET_SELECTOR);
    if (!sheet || sheet.querySelector('.tc-xp')) return;
    const c = buildCard();
    renderCard(c);
    const before = sheet.querySelector(BEFORE_SELECTOR) ?? sheet.querySelector(ACTIONS_SELECTOR);
    if (before && before.parentElement === sheet) sheet.insertBefore(c.root, before);
    else sheet.appendChild(c.root);
    card = c;

    c.open.addEventListener('click', () => {
      sfx.unlock();
      sfx.play('tap');
      c.open.disabled = true;
      track('crosspromo_click', 'click', { target: TARGET_TAG });
      void markCrossPromoClicked();
      void openCrossPromo().then((outcome) => {
        if (card !== c) return; // 그 사이 시트가 갈렸으면 아무것도 하지 않는다
        c.open.disabled = false;
        c.failed = outcome === 'failed';
        renderCard(c);
        if (outcome !== 'ok') track('crosspromo_open_result', 'event', { target: TARGET_TAG, outcome });
      });
    });
    c.close.addEventListener('click', () => {
      sfx.play('tap');
      track('crosspromo_dismiss', 'event', { target: TARGET_TAG });
      removeCard();
    });

    // ★그날 상한은 «실제로 붙인 뒤» 소비한다. 판정만 하고 못 붙였으면 기록하지 않는다.
    void markCrossPromoShown();
    track('crosspromo_impression', 'impression', { target: TARGET_TAG });
  };

  const sync = (result: HTMLElement): void => {
    const shown = result.classList.contains('show');
    if (!shown) {
      // 결과가 닫혔다(hideResult 가 자식을 비운다). 다음 판을 위해 리셋.
      if (wasShown) removeCard();
      wasShown = false;
      judged = false;
      return;
    }
    wasShown = true;
    if (judged) return;
    judged = true;
    void crossPromoDueToday().then((due) => {
      if (stopped || !due) return;
      if (!result.classList.contains('show')) return; // 판정 사이에 닫혔다
      mount(result);
    });
  };

  const bind = (result: HTMLElement): void => {
    observer = new MutationObserver(() => sync(result));
    observer.observe(result, { attributes: true, attributeFilter: ['class'], childList: true });
    offLocale = onLocaleChange(() => {
      if (card) renderCard(card);
    });
    sync(result);
  };

  const found = document.querySelector<HTMLElement>(RESULT_SELECTOR);
  if (found) {
    bind(found);
  } else {
    const t0 = Date.now();
    const tick = (): void => {
      if (stopped) return;
      const el = document.querySelector<HTMLElement>(RESULT_SELECTOR);
      if (el) {
        bind(el);
        return;
      }
      if (Date.now() - t0 > WAIT_MS) {
        console.warn('[crossPromo] .tc-result not found; cross promo skipped');
        return;
      }
      waitTimer = window.setTimeout(tick, 100);
    };
    waitTimer = window.setTimeout(tick, 100);
  }

  return () => {
    stopped = true;
    if (waitTimer) window.clearTimeout(waitTimer);
    observer?.disconnect();
    offLocale?.();
    removeCard();
  };
}
