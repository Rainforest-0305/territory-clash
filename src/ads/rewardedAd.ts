/**
 * ############################################################################
 * ##  리워드(보상형) 광고 — 「두 번째 부활」 전용                            ##
 * ############################################################################
 *
 * President 결정 B안(2026-09-05): 첫 부활은 지금처럼 공짜, 두 번째 부활만
 * 리워드 광고 시청으로 «1회» 추가한다.
 *
 * ── 전면광고 게이트(adGate.ts)와 무엇이 다른가 ──────────────────────────────
 *   전면(interstitial) : 우리가 «띄우기로 정해서» 띄운다. 유저는 보상이 없다.
 *                        판 계수·빚(debt) 회계가 붙는다.
 *   리워드(여기)       : 유저가 «보상을 얻으려고» 스스로 누른다. 회계가 없다.
 *                        성공 판정은 오직 `userEarnedReward` 이벤트 하나다.
 * 그래서 이 파일은 adGate.ts 의 카운터를 «한 글자도» 건드리지 않는다.
 *
 * ── 성공의 정의 ─────────────────────────────────────────────────────────────
 *   `userEarnedReward` 를 «받았을 때만» true.
 *   dismissed(중간에 닫음) · failedToShow · onError · 타임아웃 = false.
 *   ⛔ 「광고를 띄우려고 시도했으니 부활시켜 준다」는 절대 금지 — 그건 광고
 *      네트워크에 노출 없이 보상을 주는 것이고, 어뷰징 판정 대상이다.
 *
 * ── 정확히 한 번 ───────────────────────────────────────────────────────────
 *   Promise 는 «반드시 한 번» settle 된다. adGate.ts 의 show() 와 같은 규율:
 *     · settle 가드(finished) 로 중복 방지
 *     · 구독 해지 함수(unsub)를 반드시 부른다 — 재시도 시 구독 중첩 방지
 *     · 타임아웃을 «2단»으로 나눈다(열리지 않을 때 / 열린 뒤 안전망)
 */
import { GoogleAdMob } from './tossAdsSdk';
import { REVIVE_AD_GROUP_ID } from './adConfig';
import { trackAdRequestFail } from '../analytics/track';

/** 로드가 이 시간 안에 끝나지 않으면 실패로 본다. 유저는 죽은 채 기다리는 중이다. */
const LOAD_TIMEOUT_MS = 6_000;
/** show() 를 불렀는데 광고가 «열리지 않을» 때만 도는 타이머. show/impression 오면 해제. */
const OPEN_TIMEOUT_MS = 8_000;
/** 열린 뒤의 안전망. dismissed 가 영영 안 오는 기기가 있다(adGate.ts 실측 이력). */
const HARD_CAP_MS = 180_000;

/**
 * 지금 이 환경에서 「광고 보고 부활」을 «제안해도 되는가».
 *
 * ★두 개를 «둘 다» 본다:
 *   ① 지면 ID 가 비어 있지 않은가  — 콘솔 지면이 아직 없으면 제안 자체를 숨긴다.
 *      (빈 ID 로 SDK 를 부르면 계정 정지 사유다. 부르지 «않는» 게 아니라
 *       제안을 «만들지 않는» 것이 맞다 — 눌러도 실패하는 버튼은 UI 결함이다)
 *   ② SDK 가 이 환경에서 리워드 광고를 지원하는가 — 웹/스토어 빌드에서는
 *      웹 스텁이 항상 false 를 준다(src/ads-web/tossAdsSdk.ts).
 * ★절대 throw 하지 않는다. 광고 판정 때문에 게임이 안 뜨는 일은 없어야 한다.
 */
export function reviveAdAvailable(): boolean {
  if (!REVIVE_AD_GROUP_ID) return false;
  try {
    return (
      typeof GoogleAdMob?.loadAppsInTossAdMob?.isSupported === 'function' &&
      GoogleAdMob.loadAppsInTossAdMob.isSupported() === true &&
      typeof GoogleAdMob?.showAppsInTossAdMob?.isSupported === 'function' &&
      GoogleAdMob.showAppsInTossAdMob.isSupported() === true
    );
  } catch {
    return false;
  }
}

/** 중복 실행 방지 — 광고가 떠 있는 동안 두 번째 요청이 들어오면 즉시 거절한다. */
let inFlight = false;

/**
 * 리워드 광고를 불러와 보여준다.
 * @returns 보상을 «실제로 획득»했으면 true. 그 외 전부 false.
 *          ★절대 reject 하지 않는다 — 호출부가 catch 를 잊어도 게임이 멈추면 안 된다.
 */
export function showReviveAd(): Promise<boolean> {
  if (!reviveAdAvailable()) {
    console.log('[revivead] unavailable (no placement or unsupported)');
    return Promise.resolve(false);
  }
  if (inFlight) {
    console.log('[revivead] rejected (already in flight)');
    return Promise.resolve(false);
  }
  inFlight = true;

  return new Promise<boolean>((resolve) => {
    let finished = false;
    let earned = false;
    let unsub: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let capTimer: ReturnType<typeof setTimeout> | null = null;

    const drop = (): void => {
      const u = unsub;
      unsub = null;
      if (u) {
        try {
          u();
        } catch {
          /* noop */
        }
      }
    };

    /** ★정확히 한 번. 어디서 몇 번 불려도 안전하다. */
    const settle = (ok: boolean, why: string): void => {
      if (finished) return;
      finished = true;
      if (timer != null) clearTimeout(timer);
      if (capTimer != null) clearTimeout(capTimer);
      timer = null;
      capTimer = null;
      drop();
      inFlight = false;
      console.log(`[revivead] settled ok=${ok} (${why})`);
      // 계측 — 「보상을 못 받은 이유」. dismissed(유저가 스스로 닫음)는
      // 광고 요청 실패가 아니므로 제외한다.
      if (why === 'load-timeout' || why === 'open-timeout') {
        trackAdRequestFail('reward', 'timeout');
      } else if (why === 'load-error' || why === 'show-error' || why === 'throw') {
        trackAdRequestFail('reward', 'onError');
      } else if (why === 'failedToShow') {
        trackAdRequestFail('reward', 'noFill');
      }
      resolve(ok);
    };

    /** 로드가 끝난 뒤 실제 노출. 여기서부터 성공 판정(userEarnedReward)이 산다. */
    const doShow = (): void => {
      drop(); // 로드 구독 해지 후 show 구독으로 교체
      if (timer != null) clearTimeout(timer);
      timer = setTimeout(() => settle(false, 'open-timeout'), OPEN_TIMEOUT_MS);
      capTimer = setTimeout(() => settle(earned, 'hard-cap'), HARD_CAP_MS);
      try {
        unsub = GoogleAdMob.showAppsInTossAdMob({
          options: { adGroupId: REVIVE_AD_GROUP_ID },
          onEvent: (e) => {
            // 광고가 «열렸다»는 증거 → open 타임아웃만 푼다(hard cap 은 유지).
            if (e?.type === 'show' || e?.type === 'impression') {
              if (timer != null) {
                clearTimeout(timer);
                timer = null;
              }
              return;
            }
            if (e?.type === 'userEarnedReward') {
              // ★보상 획득. 다만 여기서 바로 게임을 재개하면 «광고 뒤에서»
              //   부활이 일어난다 — 닫힘(dismissed)까지 기다린다.
              earned = true;
              return;
            }
            if (e?.type === 'dismissed') settle(earned, 'dismissed');
            else if (e?.type === 'failedToShow') settle(false, 'failedToShow');
          },
          onError: () => settle(false, 'show-error'),
        });
      } catch {
        settle(false, 'throw');
      }
    };

    timer = setTimeout(() => settle(false, 'load-timeout'), LOAD_TIMEOUT_MS);
    try {
      unsub = GoogleAdMob.loadAppsInTossAdMob({
        options: { adGroupId: REVIVE_AD_GROUP_ID },
        onEvent: (e) => {
          if (e?.type === 'loaded') doShow();
        },
        onError: () => settle(false, 'load-error'),
      });
    } catch {
      settle(false, 'throw');
    }
  });
}
