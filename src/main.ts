/**
 * 앱 엔트리.
 *
 * 순서가 중요하다 (뒤로가기 핸들러 스택 순서가 여기서 결정된다):
 *   1) SDK 4종 부팅 (Safe Area → 네비바 → 식별키 → Storage 왕복 확인)
 *   2) 종료 확인 모달 설치  ← 스택 최하단(최후 수단)
 *   3) 게임 시작            ← 스택 상단(먼저 호출됨)
 *
 * pushBackHandler 는 "나중에 등록된 것이 먼저" 호출된다. 따라서 2)를 3)보다
 * 먼저 해야 "게임 중 뒤로가기 → 일시정지 → 한 번 더 → 종료 확인" 순서가 된다.
 * 이 두 줄의 순서를 바꾸면 게임 중에 확인 없이 앱이 닫히는 회귀가 생긴다.
 *
 * SDK 부팅이 실패해도 게임은 반드시 뜬다(폴백). 흰 화면은 최악의 실패다.
 *
 * ※ 프론트엔드 엔지니어: 이 파일은 손댈 일이 거의 없다.
 *   게임은 src/game/index.ts 에서 작업하면 된다.
 */
import './styles.css';
import { initTossSdk } from './toss';
import { installExitConfirm } from './ui/exitConfirm';
import { startGame } from './game';
import { initI18n, t } from './i18n';
import { installAdGate } from './ads/adGate';
import { installMenuBanners } from './ads/menuBanners';
import { trackAppEnter } from './analytics/track';
import { initDailyClashClock } from './game/dailyClash';
import { initPromoStreakBaseline } from './toss';
import { installPrivacyLink } from './ui/privacyLink';
import { installPushOptIn } from './ui/pushOptIn';
import { installCrossPromo } from './ui/crossPromo';

const rootEl = document.getElementById('app');
const canvas = document.getElementById('stage') as HTMLCanvasElement | null;
const probeEl = document.getElementById('sdk-probe');

function fatal(message: string, err?: unknown): void {
  console.error('[boot]', message, err);
  if (!rootEl) return;
  // DOM 으로 조립한다. 예전처럼 innerHTML 에 메시지를 끼워 넣으면 에러 문자열에
  // 들어 있는 꺾쇠가 그대로 마크업으로 해석된다.
  const box = document.createElement('div');
  box.className = 'fatal';
  const h1 = document.createElement('h1');
  h1.textContent = t('error.fatal.title');
  const p = document.createElement('p');
  p.textContent = message;
  const pre = document.createElement('pre');
  pre.textContent = err instanceof Error ? err.message : String(err ?? '');
  box.append(h1, p, pre);
  rootEl.textContent = '';
  rootEl.appendChild(box);
}

/**
 * SDK 4종 상태를 화면에 찍는다.
 * 실기기 확인용 — "번들에 들어갔다"와 "실제로 켜진다"는 다른 문제라서
 * 눈으로 확인할 수단이 필요하다. 정식 게임 화면이 붙으면 삭제해도 된다.
 */
function renderProbe(el: HTMLElement, lines: string[]): void {
  el.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
  el.hidden = false;
}

async function main(): Promise<void> {
  // ★계측: 앱 진입은 가장 먼저 찍는다 — 이후 어떤 경로(SDK 실패·fatal 포함)로
  //   가든 "사용자가 앱을 열었다"는 사실 자체는 놓치면 안 된다.
  trackAppEnter();

  // 언어를 가장 먼저 확정한다. 아래 어떤 경로(오류 화면 포함)든 t() 를 쓰므로
  // 이보다 뒤에 두면 부팅 실패 메시지가 기본 언어로 새어 나온다.
  // initI18n 은 절대 throw 하지 않는다.
  await initI18n();

  if (!canvas) {
    fatal(t('error.noCanvas'));
    return;
  }

  let runtime;
  try {
    runtime = await initTossSdk();
  } catch (err) {
    // initTossSdk 는 throw 하지 않도록 만들었지만, 방어적으로 한 번 더 잡는다.
    fatal(t('error.sdkInit'), err);
    return;
  }

  /**
   * 오늘의 대결(출석) 시계 보정 — ★부팅에서 «한 번만» 부른다(daykey.ts 규율).
   * 게임 시작을 막지 않도록 await 하지 않는다(fire-and-forget) — 실패해도
   * daykey.ts 가 기기 시계로 폴백하므로 게임은 그대로 뜬다.
   */
  /**
   * ★프로모션 ②(3일 «연속» 플레이) 기준선 — President 지시 2026-09-01
   *   「프로모션 개설 전에 이미 달성한 사람에게는 지급하지 않는다」.
   * ⛔반드시 «시계 보정 뒤»에 잡는다. 먼저 잡으면 기기 시계 기준으로 기준선
   *   날짜가 박혀 서버 시각과 하루 어긋날 수 있다.
   * 실패해도 게임을 막지 않는다(첫 플레이 경로에서 다시 시도한다).
   */
  void initDailyClashClock()
    .then(() => initPromoStreakBaseline())
    .catch((err) => console.warn('[boot] promo streak baseline skipped:', err));

  if (probeEl) {
    // 지역변수명을 st 로 둔다 — t 로 두면 번역 함수 t() 를 가려서, 나중에 이
    // 블록에 문구를 추가할 때 조용히 깨진다.
    const st = runtime.selfTest;
    renderProbe(probeEl, [
      `env: ${runtime.inToss ? 'Toss MiniApp' : 'Browser/APK'}`,
      `userKey(getUserKeyForGame): ${st.userKey}`,
      `safeArea(SafeAreaInsets): ${st.safeArea}`,
      `storage(native Storage): ${st.storage}`,
      `navigationBar(graniteEvent): ${st.navigationBar}`,
      `id: ${runtime.identity.userKey.slice(0, 16)}… (${runtime.identity.source})`,
    ]);
  }

  // 종료 확인 모달 — 반드시 startGame 보다 먼저(스택 최하단에 깔린다).
  // 이게 있어야 "확인 없이 앱이 닫히는" 경로가 물리적으로 존재하지 않는다.
  let handle: { stop: () => void } | null = null;
  let stopAdGate: (() => void) | null = null;
  let stopMenuBanners: (() => void) | null = null;
  let stopPrivacyLink: (() => void) | null = null;
  let stopPushOptIn: (() => void) | null = null;
  let stopCrossPromo: (() => void) | null = null;
  installExitConfirm({
    onBeforeExit: () => {
      // 종료 직전 저장 플러시 + 리스너 해제.
      handle?.stop();
      stopAdGate?.();
      stopMenuBanners?.();
      stopPrivacyLink?.();
      stopPushOptIn?.();
      stopCrossPromo?.();
      runtime.dispose();
    },
  });

  /**
   * 전면광고 게이트 — ★반드시 startGame «전»에 설치한다.
   * 캡처 단계 클릭 리스너가 게임 버튼 리스너보다 먼저 걸려야
   * 「광고 → 그 다음 판 시작」 순서가 보장된다. 뒤에 두면 게임이
   * 광고 뒤에서 먼저 시작된다.
   * ★뒤로가기 스택에는 손대지 않는다(document 클릭 리스너뿐) — 그래서
   *   installExitConfirm 과 순서를 다퉈도 종료 확인 동작이 바뀌지 않는다.
   * ★게이트는 throw 하지 않지만, 광고 때문에 게임이 안 뜨는 일은
   *   어떤 경우에도 없어야 하므로 한 번 더 감싼다.
   */
  try {
    stopAdGate = installAdGate();
  } catch (err) {
    console.warn('[boot] ad gate install failed, continuing without ads:', err);
  }

  try {
    handle = startGame({
      canvas,
      identity: runtime.identity,
      inToss: runtime.inToss,
      selfTest: runtime.selfTest,
    });
  } catch (err) {
    fatal(t('error.gameStart'), err);
  }

  /**
   * 시작화면 배너 2개 — ★반드시 startGame «뒤»에 설치한다.
   * 시작화면 DOM(.tc-menu)을 startGame 이 만들기 때문이다.
   * ★게임 코드는 이 호출의 존재를 모른다(src/game/** 무접촉).
   * ★토스 밖(브라우저·APK·MS Store)에서는 isSupported()=false 라 아무 일도
   *   하지 않는다. 그래도 광고 때문에 게임이 죽는 일은 없어야 하므로 감싼다.
   */
  try {
    stopMenuBanners = installMenuBanners();
  } catch (err) {
    console.warn('[boot] menu banners install failed, continuing without them:', err);
  }

  /**
   * 개인정보처리방침 링크 — ★반드시 startGame «뒤»에 설치한다.
   * 시작화면 DOM(.tc-menusheet)을 startGame 이 만들기 때문이다(menuBanners와
   * 동일 제약). ★게임 코드는 이 호출의 존재를 모른다(src/game/** 무접촉).
   */
  try {
    stopPrivacyLink = installPrivacyLink();
  } catch (err) {
    console.warn('[boot] privacy link install failed, continuing without it:', err);
  }

  /**
   * 「오늘의 대결 알림」 켜기 행 + 1회 안내 스트립 — ★2026-09-10(머니 리그 -32 푸시 배선 이식).
   * ★반드시 startGame «뒤»(시작 메뉴 DOM 이 있어야 한다). ★토스 밖에서는 내부에서 즉시 no-op —
   *   행·스트립이 «통째로» 그려지지 않는다. ★src/game/** 무접촉(privacyLink 와 같은 패턴).
   * 실패해도 게임은 그대로 떠야 하므로 감싼다.
   */
  try {
    stopPushOptIn = installPushOptIn();
  } catch (err) {
    console.warn('[boot] push opt-in install failed, continuing without it:', err);
  }

  /**
   * 「머니 리그」 교차추천 카드(결과 화면 하루 1회) — ★2026-09-10. 위와 같은 제약:
   * startGame 뒤 · 토스 밖 no-op · src/game/** 무접촉. 결과 시트 재생성을 관측해 스스로 붙는다.
   */
  try {
    stopCrossPromo = installCrossPromo();
  } catch (err) {
    console.warn('[boot] cross promo install failed, continuing without it:', err);
  }
}

void main();
