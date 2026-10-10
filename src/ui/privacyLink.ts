/**
 * 개인정보처리방침 링크 — 2026-08-23 QA 레인 신규.
 *
 * ── 근거 ────────────────────────────────────────────────────────────────
 * PRIVACY_LINK_KIT.md(_shared/) — Chief 실측: 게임 5종 .ait web/ 전수 스캔
 * 결과 「개인정보」·「방침」·「privacy」 매치가 전부 주석 안이었다. 방침
 * 문서를 써놔도 유저가 거기 닿을 길이 게임 화면 어디에도 없었다.
 *
 * ── 접근 방식 = (A) 번들 동봉 + 상대경로 ───────────────────────────────────
 * (PRIVACY_LINK_KIT.md §7(g) 2026-08-23 확정 — 게임 5종 + 머니리그 공통 채택안)
 * `public/privacy.html` 이 vite publicDir 복사로 dist 루트(=index.html 과 같은
 * 위치)에 실린다. base:'./' 라 .ait 안에서도 상대경로가 유효하다. 오프라인
 * 동작·GH Pages 업로드 게이트 비종속·isInToss() 분기 불요(한 경로)의 장점이
 * 있다(이 프로젝트 vite.config.ts 에는 AIT_PUBLIC_ALLOWLIST 류의 public/
 * 가지치기 플러그인이 «없음»을 직접 확인했다 — 머니리그 전용, 여기 해당 없음).
 *
 * ── target="_blank" 를 안 쓰는 이유 (bloom-circuit 2026-08-23 Partner 정정 선례) ──
 * 토스 웹뷰는 팝업이 막혀 새 창 요청이 «에러 없이 조용히» 무시될 수 있다
 * (PRIVACY_LINK_KIT.md §1 「팝업 차단은 조용히 실패한다」와 같은 계열).
 * 방침이 이제 번들 «안»(같은 오리진)이라 새 창을 열 이유가 애초에 없다 —
 * 같은 뷰에서 이동하고 뒤로가기로 돌아온다. 이 링크는 시작 메뉴(플레이 중이
 * 아닌 화면)에만 존재해서, 페이지 전체 언로드가 나도 «끊길 진행 중 세션이
 * 없다»(게임 진행 데이터는 KEYS.progress 로 매 상태 변화마다 localStorage에
 * 이미 영속화되고, localStorage 는 페이지 전체 리로드에도 살아남는다 —
 * dailyClash.ts/save.ts 기존 영속 설계 재사용, 이 파일은 그 코드를 안 건드림).
 * ⚠️[미검증] 토스 실기기 웹뷰가 same-origin 상대경로 풀 네비게이션 + 뒤로가기를
 * 어떻게 처리하는지는 이 레인에서 실기기로 확인하지 못했다. headless(웹 채널
 * 시뮬레이션)로 「이동 성공 + 뒤로가기 후 localStorage 보존」만 확인했다.
 *
 * ── 왜 별도 파일인가(src/game/** 무접촉) ────────────────────────────────
 * `ads/menuBanners.ts` 와 같은 패턴 — .tc-menu 를 «찾아» DOM 을 얹는다.
 * src/game/menu.ts 를 고치면 다른 트랙(성능 검증 등)이 기대는 「src/game/**
 * md5 불변」류의 증명이 깨진다(menuBanners.ts 상단 주석 참고). 그래서 게임
 * 코드는 이 파일의 존재를 모른다.
 *
 * ── 배치 ────────────────────────────────────────────────────────────────
 * `.tc-menusheet` 안, `.tc-lang`(언어 선택) 다음 · `.tc-actions`(시작 버튼,
 * sticky) 앞에 삽입한다 — PRIVACY_LINK_KIT.md §4 「설정 다음 줄 · 플레이
 * 영역/광고 지면과 인접 금지」를 따른다. 광고 지면(.tc-adslot-*)은 .tc-menu
 * «밖»(menuBanners.ts가 #app 레벨에 붙임)이라 구조적으로 인접하지 않는다.
 *
 * ── 언어 반영 ───────────────────────────────────────────────────────────
 * 이 게임은 이미 자체 i18n 모듈(t()/onLocaleChange)이 있어 bloom-circuit의
 * documentElement.lang MutationObserver 패턴이 필요 없다 — 기존 관용구를
 * 그대로 재사용한다(languageSelect.ts 와 동일 패턴).
 */
import './privacyLink.css';
import { t, onLocaleChange } from '../i18n';

const SHEET_SELECTOR = '.tc-menusheet';
const ACTIONS_SELECTOR = '.tc-actions';
/** .tc-menusheet 가 DOM 에 붙기를 기다리는 최대 시간(menuBanners.ts 와 동일 관용구). */
const WAIT_MS = 8000;

function build(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'tc-privacy-row';

  const link = document.createElement('a');
  link.id = 'linkPrivacy';
  link.className = 'tc-privacy-link';
  // 상대경로 + 같은 오리진 네비게이션. target="_blank" 없음(위 주석 참고) —
  // preventDefault 도 하지 않는다. 클릭 핸들러가 없으므로 네이티브 <a> 기본
  // 동작 그대로다 — 팝업차단이 걸릴 코드 경로 자체가 존재하지 않는다.
  link.href = './privacy.html';
  link.rel = 'noopener noreferrer';
  link.textContent = t('settings.privacyLink');

  row.appendChild(link);
  return row;
}

function bind(sheet: HTMLElement): void {
  // 이미 붙어 있으면(예: 재호출) 다시 만들지 않는다.
  if (sheet.querySelector('#linkPrivacy')) return;

  const row = build();
  const actions = sheet.querySelector(ACTIONS_SELECTOR);
  // .tc-actions 바로 앞에 삽입 — 언어 선택 다음 줄이 된다(insertBefore 이므로
  // sheet 의 기존 자식 순서는 건드리지 않는다). actions 를 못 찾으면(방어적)
  // 시트 맨 끝에 붙인다.
  if (actions) {
    sheet.insertBefore(row, actions);
  } else {
    sheet.appendChild(row);
  }

  const link = row.querySelector<HTMLAnchorElement>('#linkPrivacy');
  if (!link) return;
  const off = onLocaleChange(() => {
    if (!link.isConnected) {
      off();
      return;
    }
    link.textContent = t('settings.privacyLink');
  });
}

/**
 * 설치 진입점. main.ts 에서 startGame() «뒤»에 호출한다(menuBanners.ts 와 같은
 * 순서 제약 — .tc-menusheet 는 startGame() 이 만든다).
 */
export function installPrivacyLink(): () => void {
  let stopped = false;
  let waitTimer = 0;

  const found = document.querySelector<HTMLElement>(SHEET_SELECTOR);
  if (found) {
    bind(found);
  } else {
    const t0 = Date.now();
    const tick = (): void => {
      if (stopped) return;
      const el = document.querySelector<HTMLElement>(SHEET_SELECTOR);
      if (el) {
        bind(el);
        return;
      }
      if (Date.now() - t0 > WAIT_MS) {
        console.warn('[privacyLink] .tc-menusheet not found; link skipped');
        return;
      }
      waitTimer = window.setTimeout(tick, 100);
    };
    waitTimer = window.setTimeout(tick, 100);
  }

  return () => {
    stopped = true;
    if (waitTimer) window.clearTimeout(waitTimer);
  };
}
