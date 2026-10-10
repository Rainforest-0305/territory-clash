/**
 * 게임 필수 SDK ④ — 내비게이션 바
 *
 * 미적용 시 앱인토스 심사 반려 사유다.
 *
 * ── 두 조각으로 이루어져 있다. 둘 다 해야 "적용"이다 ────────────────────────
 *  (A) 선언부 — granite.config.ts 의 navigationBar { ... }
 *      빌드타임 고정값. 뒤로가기 버튼 유무/제목/투명배경/테마.
 *      web-config 의 babelBuild 가 JSON.stringify 해서
 *      플랫폼 번들의 `Ait.navigationBar` 자리에 상수로 박아넣는다.
 *      → 여기(웹 코드)에는 안 들어간다. 헷갈리지 마라.
 *
 *  (B) 런타임부 — 이 파일.
 *      graniteEvent 'backEvent' / 'homeEvent' 를 받아서 처리하고,
 *      필요하면 partner.addAccessoryButton 으로 상단 우측 버튼을 단다.
 *      (B)를 안 하면 뒤로가기 버튼이 눌려도 아무 일도 안 일어난다.
 *      = 사용자가 미니앱에서 못 나간다 = 반려.
 *
 * ── 게임에서 뒤로가기를 어떻게 다뤄야 하나 ──────────────────────────────────
 *  플레이 중에 뒤로가기가 바로 앱을 닫으면 최악의 UX다(진행 중 게임 증발).
 *  그래서 onBack 핸들러를 게임이 등록할 수 있게 스택으로 만들어 뒀다.
 *    - 게임 중  : 일시정지 + 확인 모달 → 확인 시 closeView()
 *    - 메인메뉴 : 곧바로 closeView()
 *  핸들러가 true 를 반환하면 "내가 처리했다"는 뜻이라 앱을 닫지 않는다.
 */
import { graniteEvent, tdsEvent, partner } from '@apps-in-toss/web-framework';
import { closeView } from './bridge';
import { isInToss, safeSync, safeBridge } from './env';

/** true 를 반환하면 소비(=앱 종료 안 함), false/void 면 다음 핸들러로 넘어간다. */
export type BackHandler = () => boolean | void;

const backHandlers: BackHandler[] = [];

/**
 * 뒤로가기 핸들러 등록. 나중에 등록된 것이 먼저 호출된다(모달 > 게임 > 메뉴).
 * @returns 해제 함수
 */
export function pushBackHandler(handler: BackHandler): () => void {
  backHandlers.push(handler);
  return () => {
    const i = backHandlers.indexOf(handler);
    if (i >= 0) backHandlers.splice(i, 1);
  };
}

async function handleBack(): Promise<void> {
  for (let i = backHandlers.length - 1; i >= 0; i--) {
    let consumed = false;
    try {
      consumed = backHandlers[i]!() === true;
    } catch (err) {
      console.warn('[toss-sdk][nav] back handler threw:', err);
    }
    if (consumed) return;
  }
  // 아무도 처리하지 않았다 → 미니앱 종료
  console.log('[toss-sdk][nav] no handler consumed backEvent, closing view');
  await safeBridge('closeView', () => closeView(), undefined);
}

export interface NavigationBarOptions {
  /**
   * 상단 우측 악세서리 버튼. 게임에서는 보통 설정(사운드/진동) 진입점으로 쓴다.
   * icon.name 은 토스 TDS 아이콘 이름이어야 한다(임의 URL 불가).
   * 아이콘 이름을 확정하기 전엔 undefined 로 두는 게 낫다 —
   * 존재하지 않는 이름을 넣으면 버튼이 조용히 안 뜬다.
   */
  accessoryButton?: { id: string; title: string; iconName: string };
  onAccessoryPress?: (id: string) => void;
}

let disposers: Array<() => void> = [];

/**
 * 내비게이션 바 런타임 연동을 시작한다.
 * @returns 해제 함수
 */
export function initNavigationBar(options: NavigationBarOptions = {}): () => void {
  if (!isInToss()) {
    // 토스 밖에서는 브라우저 뒤로가기 / 안드로이드 하드웨어 백을 같은 경로로 잇는다.
    const onPop = () => void handleBack();
    window.addEventListener('popstate', onPop);
    disposers.push(() => window.removeEventListener('popstate', onPop));
    console.log('[toss-sdk][nav] not in Toss, bound popstate instead');
    return dispose;
  }

  // 상단 네비바 뒤로가기 (granite.config.ts navigationBar.withBackButton: true)
  disposers.push(
    safeSync(
      'graniteEvent.backEvent',
      () =>
        graniteEvent.addEventListener('backEvent', {
          onEvent: () => {
            console.log('[toss-sdk][nav] backEvent');
            void handleBack();
          },
          onError: (e) => console.warn('[toss-sdk][nav] backEvent error', e),
        }),
      () => {}
    )
  );

  // 홈 버튼. 현재 config 에서는 withHomeButton:false 라 뜨지 않지만,
  // 켜는 순간 핸들러가 없으면 먹통이 되므로 미리 붙여둔다.
  disposers.push(
    safeSync(
      'graniteEvent.homeEvent',
      () =>
        graniteEvent.addEventListener('homeEvent', {
          onEvent: () => {
            console.log('[toss-sdk][nav] homeEvent');
            window.dispatchEvent(new CustomEvent('tc:nav-home'));
          },
          onError: (e) => console.warn('[toss-sdk][nav] homeEvent error', e),
        }),
      () => {}
    )
  );

  // 악세서리 버튼(선택)
  if (options.accessoryButton) {
    const { id, title, iconName } = options.accessoryButton;
    void safeBridge(
      'partner.addAccessoryButton',
      () => partner.addAccessoryButton({ id, title, icon: { name: iconName } }),
      undefined
    );
    disposers.push(
      safeSync(
        'tdsEvent.navigationAccessoryEvent',
        () =>
          tdsEvent.addEventListener('navigationAccessoryEvent', {
            onEvent: ({ id: pressedId }) => {
              console.log('[toss-sdk][nav] accessory pressed', pressedId);
              options.onAccessoryPress?.(pressedId);
            },
          }),
        () => {}
      )
    );
    disposers.push(() => {
      void safeBridge('partner.removeAccessoryButton', () => partner.removeAccessoryButton(), undefined);
    });
  }

  console.log('[toss-sdk][nav] navigation bar wired (back/home listeners active)');
  return dispose;
}

function dispose(): void {
  for (const d of disposers) {
    try {
      d();
    } catch {
      /* noop */
    }
  }
  disposers = [];
}

/** 게임 코드에서 "지금 미니앱을 닫아라"가 필요할 때 쓴다. */
export async function exitMiniApp(): Promise<void> {
  await safeBridge('closeView', () => closeView(), undefined);
}
