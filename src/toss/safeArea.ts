/**
 * 게임 필수 SDK ② — Safe Area
 *
 * 미적용 시 앱인토스 심사 반려 사유다. 노치/다이나믹아일랜드/홈 인디케이터에
 * UI 가 가리면 바로 반려된다. 특히 이 게임은 navigationBar.transparentBackground
 * = true 라서 상단 네비바 영역까지 게임 화면이 올라온다 — safe area 를 안 먹이면
 * HUD 가 뒤로가기 버튼 밑에 깔린다.
 *
 * ── 구현 방식 ───────────────────────────────────────────────────────────────
 *  SafeAreaInsets.get()            상수 브릿지. 즉시 현재 inset 반환.
 *  SafeAreaInsets.subscribe({...}) 이벤트 브릿지('safeAreaInsetsChange').
 *                                  회전/멀티태스킹으로 값이 바뀌면 다시 온다.
 *  둘 다 @apps-in-toss/web-framework 공개 export 다(직접 브릿지 만들 필요 없음).
 *
 *  받은 값을 CSS 변수로 :root 에 꽂는다.
 *      --sat / --sar / --sab / --sal
 *  게임 UI 는 이 변수만 쓰면 된다. 아래 fallback 순서로 3환경을 모두 커버한다.
 *      토스   → 브릿지 값
 *      APK/웹 → env(safe-area-inset-*)  (styles.css 의 초기값)
 *
 * ── 반환 타입 주의 (실측) ───────────────────────────────────────────────────
 *  web-bridge@2.10.8 dist/index.d.ts 기준
 *      interface SafeAreaInsets { top: number; bottom: number; left: number; right: number }
 *  즉 **단위 없는 숫자**다. 그대로 CSS 에 넣으면 무효값이라 padding 이 통째로
 *  0 이 된다(에러도 안 나고 조용히 실패하는 함정). 반드시 px 를 붙여야 한다.
 *  다만 이건 상수 브릿지로 네이티브가 그대로 밀어넣는 값이라 런타임에
 *  문자열('44' / '44px')이 올 가능성을 배제할 수 없다 — toCssLength() 가
 *  두 경우를 모두 흡수한다.
 */
import { SafeAreaInsets } from '@apps-in-toss/web-framework';
import { safeSync, hasConstant } from './env';

/** CSS 길이 문자열로 정규화된 inset (내부 표현) */
export interface Insets {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

function toCssLength(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (s === '') return null;
  // 이미 단위가 붙어 있으면 그대로 사용
  if (/[a-z%)]$/i.test(s)) return s;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return `${n}px`;
}

function apply(insets: Partial<Record<keyof Insets, unknown>>): void {
  const root = document.documentElement;
  const map: Array<[keyof Insets, string]> = [
    ['top', '--sat'],
    ['right', '--sar'],
    ['bottom', '--sab'],
    ['left', '--sal'],
  ];
  for (const [key, cssVar] of map) {
    const v = toCssLength(insets[key]);
    if (v != null) root.style.setProperty(cssVar, v);
  }
}

let unsubscribe: (() => void) | null = null;

/**
 * Safe Area 를 CSS 변수에 반영하고, 변경 구독을 건다.
 * @returns 구독 해제 함수 (게임 종료 시점에 호출)
 */
export function initSafeArea(): () => void {
  // 1) 초기값. 상수 핸들러가 없으면(토스 밖) 조용히 env() 폴백을 유지한다.
  //    styles.css 의 :root 가 이미 env(safe-area-inset-*) 로 초기화돼 있으므로
  //    여기서 아무것도 안 하는 것이 곧 폴백이다.
  if (hasConstant('getSafeAreaInsets')) {
    const initial = safeSync<Record<string, unknown> | null>(
      'SafeAreaInsets.get',
      () => SafeAreaInsets.get() as unknown as Record<string, unknown>,
      null
    );
    if (initial) {
      apply(initial);
      console.log('[toss-sdk][safeArea] initial insets =', initial);
    }
  } else {
    console.log('[toss-sdk][safeArea] constant bridge unavailable, using CSS env() fallback');
  }

  // 2) 변경 구독. 회전 / 다이나믹아일랜드 상태변화 시 갱신된다.
  unsubscribe = safeSync(
    'SafeAreaInsets.subscribe',
    () =>
      SafeAreaInsets.subscribe({
        onEvent: (next) => {
          apply(next);
          console.log('[toss-sdk][safeArea] insets changed =', next);
          window.dispatchEvent(new CustomEvent('tc:safearea', { detail: next }));
        },
      }),
    () => {}
  );

  return () => {
    unsubscribe?.();
    unsubscribe = null;
  };
}

/** 현재 적용된 safe area 를 픽셀 숫자로 읽는다(캔버스 레이아웃 계산용). */
export function readInsetPx(): { top: number; right: number; bottom: number; left: number } {
  const cs = getComputedStyle(document.documentElement);
  const num = (name: string) => parseFloat(cs.getPropertyValue(name)) || 0;
  return { top: num('--sat'), right: num('--sar'), bottom: num('--sab'), left: num('--sal') };
}
