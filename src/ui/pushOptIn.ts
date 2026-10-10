/**
 * 「오늘의 대결 알림」 UI — 설정 행 + 1회 안내 스트립 (★2026-09-10 신설)
 *
 * ── 왜 별도 파일인가(src/game/** 무접촉) ─────────────────────────────────────
 *   `ui/privacyLink.ts`·`ads/menuBanners.ts` 와 같은 패턴 — 시작 메뉴 DOM 을 «찾아» 얹는다.
 *   menu.ts 는 이 파일의 존재를 모른다. src/game/** 18개 파일 md5 는 -29 와 동일하다.
 *
 * ── 배치 ───────────────────────────────────────────────────────────────────
 *   ① 설정 행  : `.tc-menuscroll` 안, 효과음 행(`.tc-sound`) «다음». 언어·효과음과 같은
 *                `.tc-lang` 문법(라벨 + 컨트롤) + 힌트 1줄. 값 = 받기 / 확인 중 / 켜짐 / 다시 켜기.
 *   ② 안내 스트립: 오늘의 대결 카드(`.tc-dc`) «다음». 알림이 곧 「오늘의 대결 맵이 열렸다」이므로
 *                그 카드 바로 아래가 맥락상 맞다. 카드를 «건드리지 않고» 형제로 붙는다.
 *                토스 안 + 미동의 + 미거부 + 안 닫음 + 저장 기록을 읽은 뒤(hydrated)에만 보인다.
 *                닫으면 다시 안 뜬다 — 설정 행은 남으므로 「언제든 켤 수 있다」가 성립한다.
 *   ⛔토스 밖(`isInToss()` false)이면 이 함수는 «아무것도» 만들지 않는다(빈 래퍼 0).
 *
 * ── 접근성 ─────────────────────────────────────────────────────────────────
 *   행 버튼은 <button aria-busy>. 상태는 «텍스트»로 드러난다(색만으로 전하지 않는다).
 *   스트립은 role=group + aria-labelledby, 닫기는 aria-label. 터치 타깃 44/40/32px.
 *
 * ── 끄기 스위치가 없는 이유 ───────────────────────────────────────────────────
 *   토스 SDK 에 동의 철회 API 가 없다(toss/pushAgreement.ts 하단 주석). 거짓 스위치를 두지 않고
 *   힌트 문구로 「끄기는 토스 앱의 알림 설정」을 말한다.
 */
import './pushOptIn.css';
import {
  isInToss,
  subscribePush,
  enablePush,
  dismissPushNudge,
  type PushState,
} from '../toss';
import { t, onLocaleChange } from '../i18n';
import { track } from '../analytics/track';
import { sfx } from '../game/sfx';

const SCROLL_SELECTOR = '.tc-menuscroll';
const AFTER_ROW_SELECTOR = '.tc-sound';
const AFTER_NUDGE_SELECTOR = '.tc-dc';
/** `.tc-menuscroll` 이 DOM 에 붙기를 기다리는 최대 시간(privacyLink.ts 와 같은 관용구). */
const WAIT_MS = 8000;

/** 인라인 SVG — 이모지·유니코드 글리프 대신 그린다(기기마다 다르게 보이지 않는다). */
function bellIcon(): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const p1 = document.createElementNS(NS, 'path');
  p1.setAttribute(
    'd',
    'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2.1H4.4L6 16.5Z'
  );
  const p2 = document.createElementNS(NS, 'path');
  p2.setAttribute('d', 'M9.8 20.6a2.3 2.3 0 0 0 4.4 0');
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

interface Built {
  row: HTMLElement;
  rowBtn: HTMLButtonElement;
  rowLabel: HTMLElement;
  rowState: HTMLElement;
  hint: HTMLElement;
  nudge: HTMLElement;
  nudgeTitle: HTMLElement;
  nudgeSub: HTMLElement;
  nudgeCta: HTMLButtonElement;
  nudgeClose: HTMLButtonElement;
}

function build(): Built {
  // ── 설정 행 ──────────────────────────────────────────────────────────────
  const row = document.createElement('div');
  row.className = 'tc-push';
  const line = document.createElement('div');
  line.className = 'tc-lang tc-push-row';
  const rowLabel = document.createElement('span');
  rowLabel.className = 'tc-lang-label';
  rowLabel.id = 'tc-push-label';
  const rowBtn = document.createElement('button');
  rowBtn.type = 'button';
  rowBtn.className = 'tc-pushbtn';
  rowBtn.setAttribute('aria-describedby', 'tc-push-hint');
  const rowState = document.createElement('b');
  rowBtn.append(bellIcon(), rowState);
  line.append(rowLabel, rowBtn);
  const hint = document.createElement('p');
  hint.className = 'tc-push-hint';
  hint.id = 'tc-push-hint';
  row.append(line, hint);

  // ── 안내 스트립 ──────────────────────────────────────────────────────────
  const nudge = document.createElement('div');
  nudge.className = 'tc-pushnudge';
  nudge.hidden = true;
  nudge.setAttribute('role', 'group');
  nudge.setAttribute('aria-labelledby', 'tc-pushnudge-title');
  const ic = document.createElement('span');
  ic.className = 'tc-pushnudge-ic';
  ic.setAttribute('aria-hidden', 'true');
  ic.appendChild(bellIcon());
  const text = document.createElement('div');
  text.className = 'tc-pushnudge-text';
  const nudgeTitle = document.createElement('span');
  nudgeTitle.className = 'tc-pushnudge-title';
  nudgeTitle.id = 'tc-pushnudge-title';
  const nudgeSub = document.createElement('span');
  nudgeSub.className = 'tc-pushnudge-sub';
  text.append(nudgeTitle, nudgeSub);
  const nudgeCta = document.createElement('button');
  nudgeCta.type = 'button';
  nudgeCta.className = 'tc-pushnudge-cta';
  const nudgeClose = document.createElement('button');
  nudgeClose.type = 'button';
  nudgeClose.className = 'tc-pushnudge-x';
  nudgeClose.appendChild(closeIcon());
  nudge.append(ic, text, nudgeCta, nudgeClose);

  return { row, rowBtn, rowLabel, rowState, hint, nudge, nudgeTitle, nudgeSub, nudgeCta, nudgeClose };
}

function bind(scroll: HTMLElement): () => void {
  if (scroll.querySelector('.tc-push')) return () => {};
  const b = build();

  // 삽입 — 효과음 행 다음 / 오늘의 대결 카드 다음. 못 찾으면 각각 끝·앞에 붙인다(방어적).
  const afterRow = scroll.querySelector(AFTER_ROW_SELECTOR);
  if (afterRow && afterRow.parentElement === scroll) scroll.insertBefore(b.row, afterRow.nextSibling);
  else scroll.appendChild(b.row);
  const afterNudge = scroll.querySelector(AFTER_NUDGE_SELECTOR);
  if (afterNudge && afterNudge.parentElement === scroll) scroll.insertBefore(b.nudge, afterNudge.nextSibling);
  else scroll.insertBefore(b.nudge, scroll.firstChild);

  let last: PushState | null = null;

  const render = (s: PushState = last ?? ({} as PushState)): void => {
    if (!s || !('availability' in s)) return;
    last = s;
    // 토스 밖이면 이 함수 자체가 설치되지 않지만, 상태가 바뀌어도 «통째로» 숨긴다(빈 래퍼 0).
    b.row.hidden = !s.available;
    b.rowLabel.textContent = t('push.row.label');
    b.rowState.textContent = s.busy
      ? t('push.row.busy')
      : s.enabled
        ? t('push.row.on')
        : s.availability === 'rejected'
          ? t('push.row.retry')
          : t('push.row.get');
    b.rowBtn.disabled = s.busy;
    b.rowBtn.setAttribute('aria-busy', s.busy ? 'true' : 'false');
    b.rowBtn.classList.toggle('on', s.enabled);
    b.hint.textContent = s.error ? t('push.row.error') : t('push.row.hint');
    b.hint.classList.toggle('err', !!s.error);

    b.nudge.hidden = !(s.hydrated && s.nudge);
    b.nudgeTitle.textContent = t('push.nudge.title');
    b.nudgeSub.textContent = t('push.nudge.sub');
    b.nudgeCta.textContent = s.busy ? t('push.nudge.busy') : t('push.nudge.cta');
    b.nudgeCta.disabled = s.busy;
    b.nudgeCta.setAttribute('aria-busy', s.busy ? 'true' : 'false');
    b.nudgeClose.setAttribute('aria-label', t('push.nudge.close'));
  };

  const request = (source: 'menu_row' | 'menu_nudge'): void => {
    sfx.unlock();
    sfx.play('tap');
    void enablePush().then((s) => {
      // ★계측 — enum 만. 개인정보 없음. 실패도 남긴다(조용히 삼키지 않는다).
      track('push_agreement', 'event', { source, result: s.lastEvent || 'none' });
    });
  };
  b.rowBtn.addEventListener('click', () => request('menu_row'));
  b.nudgeCta.addEventListener('click', () => request('menu_nudge'));
  b.nudgeClose.addEventListener('click', () => {
    sfx.play('tap');
    dismissPushNudge();
    track('push_nudge_dismiss', 'event', {});
  });

  const offPush = subscribePush(render);
  const offLocale = onLocaleChange(() => render());

  return () => {
    offPush();
    offLocale();
    b.row.remove();
    b.nudge.remove();
  };
}

/**
 * 설치 진입점. main.ts 에서 startGame() «뒤»에 호출한다(.tc-menuscroll 은 startGame 이 만든다).
 * 토스 밖이면 즉시 no-op — DOM 에 아무 흔적도 남기지 않는다.
 */
export function installPushOptIn(): () => void {
  if (!isInToss()) return () => {};

  let stopped = false;
  let waitTimer = 0;
  let unbind: (() => void) | null = null;

  const found = document.querySelector<HTMLElement>(SCROLL_SELECTOR);
  if (found) {
    unbind = bind(found);
  } else {
    const t0 = Date.now();
    const tick = (): void => {
      if (stopped) return;
      const el = document.querySelector<HTMLElement>(SCROLL_SELECTOR);
      if (el) {
        unbind = bind(el);
        return;
      }
      if (Date.now() - t0 > WAIT_MS) {
        console.warn('[pushOptIn] .tc-menuscroll not found; push opt-in UI skipped');
        return;
      }
      waitTimer = window.setTimeout(tick, 100);
    };
    waitTimer = window.setTimeout(tick, 100);
  }

  return () => {
    stopped = true;
    if (waitTimer) window.clearTimeout(waitTimer);
    unbind?.();
  };
}
