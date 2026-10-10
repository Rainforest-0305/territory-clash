/**
 * ############################################################################
 * ##  시작화면 배너 2개 (상단 · 하단) — 땅따먹기                            ##
 * ############################################################################
 *
 * President 지시(2026-08-18): 「시작화면 상단과 하단에 얇은 배너 광고 두 개만」
 *
 * ── ★이 모듈의 설계 제약 ───────────────────────────────────────────────────
 * 「딴 건 아무것도 건들지 마라」가 지시의 절반이다. 그래서 배너를 «메뉴 안»에서
 * 그리지 않고 «밖»에서 얹는다.
 *   · src/game/menu.ts / menu.css 를 고치면 「게임 로직 0줄 수정」의 기계적
 *     증명(src/game/** md5 전량 불변)이 깨진다. _NEXT_BUILD_MUST_FIX.md 가
 *     그 증명에 의존하지 말라고 명시한 자산이다.
 *   · 그래서 이 모듈이 .tc-menu 를 «찾아» 자식 두 개를 붙이고, 보이는지 여부는
 *     class 'show' 를 MutationObserver 로 관찰한다. 메뉴 코드는 이 파일의
 *     존재를 «모른다».
 *
 * ── ★빈 띠를 만들지 않는다 ─────────────────────────────────────────────────
 * 자리를 미리 잡아두고 실패하면 접는 방식이 «아니다». 지면 div 는 비어 있을 때
 * 높이가 0 이라 처음부터 아무 자리도 차지하지 않는다. onAdRendered 가 와야만
 * 실제 높이를 재서 시트 쪽 여백을 넓힌다(.tc-adres-*). onNoFill /
 * onAdFailedToRender 면 지면을 통째로 DOM 에서 뗀다.
 *
 * ── ★토스 밖에서는 아무 일도 일어나지 않는다 ───────────────────────────────
 * isSupported() 가 false 면 DOM 조작도, 클래스 추가도, 스크립트 로드도 없다.
 * 브라우저·Capacitor APK·MS Store 패키지의 화면은 이 변경 전과 «픽셀 동일»하다.
 */
import './menuBanners.css';
import { bannerSdk, type BannerHandle } from './bannerAd';
import { BOTTOM_AD_GROUP_ID } from './adConfig'; // ★2026-08-22: ID 리터럴을 배럴로(웹 빌드 리터럴 유출 방지, adConfig.ts 참고)

/**
 * 지면 ID (Partner 콘솔 실측, 2026-08-18 · 둘 다 state=ENABLED · abuseLevel=NONE)
 *   상단  「땅따먹기_배너형_260810 #1」
 *   하단  「땅따먹기_시작화면하단_260818」
 * ★로컬에서 이 ID 로 실제 광고를 요청하면 계정 중단 사유다. 자리 검증은
 *   bannerAd.ts 를 스텁으로 갈아끼워서 한다(이 파일은 손대지 않는다).
 * ★실제 값은 `./adConfig` 참고(2026-08-22, 웹 빌드 shim 대상으로 이동).
 */

const MENU_SELECTOR = '.tc-menu';
/** 시작화면(.tc-menu)이 DOM 에 붙기를 기다리는 최대 시간. 넘으면 조용히 포기. */
const MENU_WAIT_MS = 8000;

type Side = 'top' | 'bot';

interface Slot {
  side: Side;
  /** 바깥 지면 — 배경·세이프에어리어 padding 담당. 높이 측정 대상. */
  el: HTMLDivElement;
  /** 광고가 실제로 들어가는 칸(시트와 같은 폭). attachBanner 의 target. */
  inner: HTMLDivElement;
  adGroupId: string;
  handle: BannerHandle | null;
  ro: ResizeObserver | null;
  dead: boolean;
}

function makeSlot(side: Side, adGroupId: string): Slot {
  const el = document.createElement('div');
  // ★기본은 «꺼짐». 시작화면이 떠 있을 때만 syncVisible() 이 켠다.
  el.className = `tc-adslot tc-adslot-${side} tc-adslot-off`;
  // 광고는 게임 조작과 무관한 부속 콘텐츠다. 스크린리더 탐색에서 시작화면의
  // radiogroup 사이에 끼어들지 않도록 landmark 로 분리해 둔다.
  el.setAttribute('role', 'complementary');
  el.setAttribute('aria-label', 'AD');
  const inner = document.createElement('div');
  inner.className = 'tc-adslot-inner';
  el.appendChild(inner);
  return { side, el, inner, adGroupId, handle: null, ro: null, dead: false };
}

export function installMenuBanners(): () => void {
  // ★첫 관문. 여기서 false 면 이 파일은 화면에 아무 흔적도 남기지 않는다.
  if (!bannerSdk.isSupported()) return () => {};

  let stopped = false;
  let menu: HTMLElement | null = null;
  let observer: MutationObserver | null = null;
  let waitTimer = 0;
  let attached = false;
  const slots: Slot[] = [];

  const reserve = (slot: Slot): void => {
    if (!menu || slot.dead) return;
    // ★배경을 먼저 켜고 «그 다음에» 잰다. --tc-adh-* 는 padding 을 포함한
    //   지면 전체 높이이고, CSS 예약식이 그 전제로 짜여 있다(이중 계산 금지).
    slot.el.classList.add('tc-adslot-on');
    const h = Math.round(slot.el.getBoundingClientRect().height);
    if (h <= 0) return;
    menu.style.setProperty(`--tc-adh-${slot.side}`, `${h}px`);
    menu.classList.add(`tc-adres-${slot.side}`);
  };

  const collapse = (slot: Slot, reason: string): void => {
    if (slot.dead) return;
    slot.dead = true;
    slot.ro?.disconnect();
    slot.ro = null;
    slot.handle?.destroy();
    slot.handle = null;
    slot.el.remove();
    menu?.classList.remove(`tc-adres-${slot.side}`);
    menu?.style.removeProperty(`--tc-adh-${slot.side}`);
    console.info(`[menuBanners] ${slot.side} slot collapsed: ${reason}`);
  };

  /** 광고가 실제로 그려진 뒤에만 호출된다. 여기서 처음으로 자리를 «편다». */
  const onRendered = (slot: Slot): void => {
    if (slot.dead) return;
    reserve(slot);
    // 배너는 소재에 따라 높이가 달라지고 리프레시로 바뀔 수도 있다.
    // 예약 폭을 실제 높이에 계속 맞춘다(안 맞추면 CTA 를 덮거나 여백이 뜬다).
    if (typeof ResizeObserver !== 'undefined') {
      slot.ro = new ResizeObserver(() => reserve(slot));
      slot.ro.observe(slot.el);
    }
  };

  /**
   * ★★방문 토큰 (2026-09-12 Codex 리뷰 P1-3).
   *   [Codex 실측] 메뉴 진입 → SDK 준비 대기 → 메뉴 이탈 → 준비 콜백 순서에서 «부착 1회·destroy 0회».
   *   준비 콜백이 `stopped` 만 봤고, 이탈 처리는 CSS 숨김(tc-adslot-off)뿐이라 지면이 화면 «밖»에서
   *   살아 있었다. 이건 스모 바운스에서 고친 「늦은 콜백이 새 배너를 죽인다」와 같은 계열이라
   *   같은 처방을 쓴다: 부착마다 토큰을 발급하고, 콜백은 «자기 토큰이 아직 현재일 때»만 동작한다.
   *   ⇒ 재진입마다 요청 1회, 이탈 시 destroy 1회.
   */
  let visitSeq = 0;

  const isMenuVisible = (): boolean => !!menu?.classList.contains('show');
  const isHidden = (): boolean => {
    try {
      return typeof document !== 'undefined' && document.visibilityState === 'hidden';
    } catch {
      return false;
    }
  };

  /** 지면 핸들을 놓는다. dead 로 만들지 «않는다» — 다음 방문에 다시 붙일 수 있어야 한다. */
  const detachAll = (reason: string): void => {
    visitSeq += 1; // 진행 중인 준비 콜백을 «남의 것»으로 만든다
    attached = false;
    for (const slot of slots) {
      slot.ro?.disconnect();
      slot.ro = null;
      try {
        slot.handle?.destroy();
      } catch {
        /* SDK 내부 예외는 삼킨다 — 핸들을 놓는 게 더 중요하다 */
      }
      slot.handle = null;
      menu?.classList.remove(`tc-adres-${slot.side}`);
      menu?.style.removeProperty(`--tc-adh-${slot.side}`);
    }
    console.info(`[menuBanners] detached (${reason})`);
  };

  const attachAll = (): void => {
    if (stopped || attached || !menu) return;
    if (isHidden()) return;        // ★숨김 중에는 요청하지 않는다(요청만 늘고 노출은 0)
    if (!isMenuVisible()) return;  // ★보이는 화면에서만 요청한다
    attached = true;
    const token = ++visitSeq;
    /** 이 부착이 아직 «현재»인가 — 늦게 온 준비 콜백의 유일한 문지기. */
    const mine = (): boolean => !stopped && token === visitSeq && isMenuVisible() && !isHidden();
    bannerSdk.ready(
      () => {
        if (!mine()) {
          // 준비를 기다리는 사이 화면을 떠났다. 붙이지 «않는다» — 예전엔 여기서 그대로 붙었다.
          console.info('[menuBanners] ready callback ignored (left the menu)');
          attached = false;
          return;
        }
        for (const slot of slots) {
          if (slot.dead) continue;
          slot.handle = bannerSdk.attach(slot.adGroupId, slot.inner, {
            onAdRendered: () => {
              if (!mine()) return;
              onRendered(slot);
            },
            onAdEmpty: (reason) => {
              if (!mine()) return;
              collapse(slot, reason);
            },
          });
        }
      },
      (err) => {
        if (!mine()) {
          attached = false;
          return;
        }
        // 초기화 실패 = 광고 없음. 자리는 애초에 안 잡혀 있으므로 뗄 것도 없다.
        for (const slot of slots) collapse(slot, `initFailed:${String(err)}`);
      }
    );
  };

  /** 시작화면이 떠 있을 때만 지면을 보인다. */
  const syncVisible = (): void => {
    const on = isMenuVisible();
    for (const slot of slots) slot.el.classList.toggle('tc-adslot-off', !on);
    if (on) attachAll();
    else if (attached) detachAll('menu hidden'); // ★CSS 숨김만으로 끝내지 않는다(P1-3)
  };

  /** 앱이 가려지면 붙어 있던 지면을 놓는다. 다시 보이면 «메뉴에 있을 때만» 1회 재부착. */
  const onVisibility = (): void => {
    if (isHidden()) {
      if (attached) detachAll('app hidden');
      return;
    }
    syncVisible();
  };

  const bind = (el: HTMLElement): void => {
    menu = el;
    /*
     * ★2026-08-23 President 결정 — 「지면 부족하면 윗쪽 배너를 빼든가」
     *   상단 지면을 «제거»했다. 하단 1지면만 남는다.
     *   ⇒ 매출을 포기하는 결정이며 President 본인이 내렸다. 임의로 되돌리지 마라.
     *   ⚠️토스 콘솔의 상단 지면 설정은 그대로 둔다(안 쓰는 지면이 남는 건 위반이
     *     아니다). 코드가 «요청하지 않는» 것으로 충분하다.
     *   ★개인정보처리방침의 「배너 2종/상단·하단 2개 지면」 문구도 같이 고쳤다.
     */
    slots.push(makeSlot('bot', BOTTOM_AD_GROUP_ID));
    // ★지면은 .tc-menu «밖»(=#app)에 붙인다.
    //   .tc-menu 는 overflow-y:auto 스크롤 컨테이너다. 그 안에 넣으면 지면이
    //   내용과 «같이 스크롤»돼서, 시트가 넘치는 작은 화면에서 상단 배너가
    //   토스 시스템 UI 위로 올라가 버린다(360x640 실측 -28px).
    const host = menu.parentElement ?? document.body;
    for (const slot of slots) host.appendChild(slot.el);

    // ★메뉴가 «보일 때» 붙인다. display:none 상태에서 붙이면 폭이 0 이라
    //   SDK 가 소재를 못 고르거나 높이 측정이 틀어진다.
    observer = new MutationObserver(syncVisible);
    observer.observe(menu, { attributes: true, attributeFilter: ['class'] });
    try {
      document.addEventListener('visibilitychange', onVisibility);
    } catch {
      /* 리스너 등록 실패는 무해 — MutationObserver 경로는 그대로 산다 */
    }
    syncVisible();
  };

  // .tc-menu 는 startGame() 이 만든다. 호출 순서가 바뀌어도 죽지 않게 폴링한다.
  const found = document.querySelector<HTMLElement>(MENU_SELECTOR);
  if (found) {
    bind(found);
  } else {
    const t0 = Date.now();
    const tick = (): void => {
      if (stopped) return;
      const el = document.querySelector<HTMLElement>(MENU_SELECTOR);
      if (el) {
        bind(el);
        return;
      }
      if (Date.now() - t0 > MENU_WAIT_MS) {
        console.warn('[menuBanners] .tc-menu not found; banners skipped');
        return;
      }
      waitTimer = window.setTimeout(tick, 100);
    };
    waitTimer = window.setTimeout(tick, 100);
  }

  return () => {
    stopped = true;
    visitSeq += 1; // 남은 콜백을 전부 «남의 것»으로 만든다
    if (waitTimer) window.clearTimeout(waitTimer);
    observer?.disconnect();
    try {
      document.removeEventListener('visibilitychange', onVisibility);
    } catch {
      /* noop */
    }
    for (const slot of slots) {
      slot.ro?.disconnect();
      slot.handle?.destroy();
      slot.el.remove();
      menu?.classList.remove(`tc-adres-${slot.side}`);
    }
  };
}
