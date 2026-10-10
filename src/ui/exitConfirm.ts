/**
 * 종료 확인 모달 (필수)
 *
 * ── 왜 필수인가 ─────────────────────────────────────────────────────────────
 * 기존 게임 4종(Sumo Bounce 등)이 전부 미구현이었고, 심사 반려 사유 중
 * 하나로 지목됐다. "뒤로가기 한 번에 진행 중인 게임이 증발"하는 동작은
 * 캐주얼 게임에서 치명적인 UX 결함이고, 심사자가 가장 먼저 눌러보는 곳이다.
 * 트랙 D 는 처음부터 넣는다. 지우거나 우회하지 마라.
 *
 * ── 동작 계약 ───────────────────────────────────────────────────────────────
 *  뒤로가기 핸들러 스택은 "나중에 등록된 것이 먼저" 호출된다
 *  (navigationBar.ts pushBackHandler 참고). 그래서 이 모달은
 *  **부팅 시 가장 먼저 등록**해서 스택의 맨 아래(= 최후 수단)에 둔다.
 *
 *    뒤로가기 1회 (플레이 중)  → game 이 소비, 일시정지
 *    뒤로가기 2회 (일시정지)   → game 이 소비 안 함 → 이 모달이 뜸
 *    모달에서 [나가기]         → closeView() 로 미니앱 종료
 *    모달에서 [계속하기]       → 모달 닫힘, 게임 유지
 *    모달이 떠 있을 때 뒤로가기 → 모달만 닫힘 (앱 안 닫힘)
 *
 *  마지막 항목이 중요하다. 모달이 뜬 상태에서 뒤로가기가 앱을 닫아버리면
 *  "확인 모달"이 아무 의미가 없다.
 *
 * ── 접근성/조작 ─────────────────────────────────────────────────────────────
 *  - 딤 영역 탭 = 계속하기 (실수로 나가는 것 방지: 기본 동작은 항상 '머물기')
 *  - 파괴적 동작([나가기])이 기본 포커스를 갖지 않게 한다.
 *  - role="dialog" aria-modal, ESC 키 지원(데스크톱 dev 편의).
 *  - safe area 변수를 존중한다(하단 홈 인디케이터에 버튼이 걸리지 않게).
 */
import { pushBackHandler, exitMiniApp, generateHapticFeedback } from '../toss';
import { t } from '../i18n';

export interface ExitConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 나가기 직전에 실행 — 진행 상황 저장 플러시 등. 실패해도 종료는 진행한다. */
  onBeforeExit?: () => void | Promise<void>;
  /** 모달이 열릴 때 (게임 일시정지 걸기) */
  onOpen?: () => void;
  /** 모달이 취소로 닫힐 때 (게임 재개) */
  onCancel?: () => void;
}

let opened = false;
let popModalBack: (() => void) | null = null;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function isExitConfirmOpen(): boolean {
  return opened;
}

/** 모달을 연다. 이미 열려 있으면 무시한다. */
export function openExitConfirm(options: ExitConfirmOptions = {}): void {
  if (opened) return;
  opened = true;

  const {
    title = t('modal.exit.title'),
    description = t('modal.exit.body'),
    confirmLabel = t('modal.exit.confirm'),
    cancelLabel = t('modal.exit.cancel'),
    onBeforeExit,
    onOpen,
    onCancel,
  } = options;

  onOpen?.();
  void generateHapticFeedback({ type: 'tickWeak' });

  const overlay = el('div', 'tc-modal-overlay');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'tc-modal-title');

  const sheet = el('div', 'tc-modal-sheet');
  const h = el('h2', 'tc-modal-title', title);
  h.id = 'tc-modal-title';
  const p = el('p', 'tc-modal-desc', description);

  const row = el('div', 'tc-modal-actions');
  const cancelBtn = el('button', 'tc-btn tc-btn-ghost', cancelLabel);
  cancelBtn.type = 'button';
  const confirmBtn = el('button', 'tc-btn tc-btn-danger', confirmLabel);
  confirmBtn.type = 'button';

  row.append(cancelBtn, confirmBtn);
  sheet.append(h, p, row);
  overlay.append(sheet);
  document.body.append(overlay);

  // 모달이 떠 있는 동안 뒤로가기는 모달만 닫는다(앱 종료 아님).
  popModalBack = pushBackHandler(() => {
    close();
    return true;
  });

  function close(): void {
    if (!opened) return;
    opened = false;
    popModalBack?.();
    popModalBack = null;
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    onCancel?.();
  }

  async function confirm(): Promise<void> {
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    try {
      await onBeforeExit?.();
    } catch (err) {
      console.warn('[exit-confirm] onBeforeExit failed, exiting anyway:', err);
    }
    await exitMiniApp();
    // 토스 밖(브라우저/APK)에서는 closeView 가 아무 일도 안 한다 → 모달을 닫아 준다.
    close();
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  cancelBtn.addEventListener('click', close);
  confirmBtn.addEventListener('click', () => void confirm());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close(); // 딤 탭 = 머물기
  });
  document.addEventListener('keydown', onKey);

  // 파괴적 버튼이 아니라 '계속하기'에 포커스를 준다.
  cancelBtn.focus();
}

/**
 * 앱 부팅 시 1회 호출. 뒤로가기 스택의 **최하단**(최후 수단) 핸들러로
 * 이 모달을 등록한다. 반드시 게임 시작 전에 호출해야 순서가 맞는다.
 * @returns 해제 함수
 */
export function installExitConfirm(options: ExitConfirmOptions = {}): () => void {
  return pushBackHandler(() => {
    if (opened) return true; // 이미 떠 있으면 소비(중복 오픈 방지)
    openExitConfirm(options);
    return true; // 항상 소비 — 확인 없이 앱이 닫히는 경로를 없앤다
  });
}
