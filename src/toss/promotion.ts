/**
 * 프로모션 리워드(토스 포인트) 지급 — ★2026-08-26 신설
 *
 * 땅따먹기 조건: **3판 플레이 «완료»** → 100원 (President 확정 2026-08-26)
 *   ⚠️「오늘의 대결 1등」에서 바뀐 것이다. 토스 프로모션 사전 심사 체크리스트에
 *     「지급하는 포인트가 게임 결과나 등수를 기준으로 정해지지 않나요?」가 있고,
 *     불가 예시로 「랭킹 1등 달성하면 N포인트 지급」이 «명문»으로 실려 있다.
 *     ⇒ 등수 기준은 반려 확정이라 «완료» 기준으로 바꿨다. 가능 예시인
 *       「미션 1단계 완료 시 N포인트」와 동형이다.
 *
 * ── ⛔ 이 파일이 안고 가는 «한계». 숨기지 마라 (President 결정 2026-08-26) ──
 *   서버를 두지 않는다. 중복 지급 방지가 **로컬 저장 하나뿐**이다.
 *   1) ★저장을 지우거나 앱을 재설치하면 «같은 사람이 다시 받을 수 있다».
 *      우리는 이걸 못 막는다. 토스도 안 막아준다 — 토스 공식 답변(2026-03-06)
 *      원문: 「프로모션 지급 내역 API를 제공하고 있지 않습니다」.
 *      게다가 익명 식별키가 재설치·기기변경 후에도 같은 값인지는 **[미확인]**
 *      이다(문서에 없고, 토스 문의는 President 가 금지했다).
 *      ⇒ ★**최종 방어선은 「콘솔에 설정한 프로모션 예산」 하나뿐이다.**
 *        예산이 소진되면 토스가 프로모션을 자동 종료한다(4112). 그래서 손실은
 *        «예산 상한»으로 캡된다. 예산을 크게 잡는 것이 곧 노출된 위험이다.
 *   2) 조건 판정도 클라이언트가 한다. 저장을 조작해 미달성 상태로 요청할 수 있다.
 *      이것도 예산 상한 말고는 막을 수단이 없다.
 *   ⇒ 그러니 ★「막을 수 있는 것」은 확실히 막는다: 성공 즉시 기록 · 1인 1회 ·
 *     동시호출 차단 · 실패를 조용히 삼키지 않기. 아래 구현이 그것이다.
 *
 * ── ⛔ 저장 규율 ────────────────────────────────────────────────────────────
 *   ★기존 저장키(`tc:progress` 등)를 **건드리지 않는다**. 새 키를 «추가»만 한다.
 *   지급 기록이 깨져도 게임 진행(코인·기록·고스트)은 멀쩡해야 하므로 세이브
 *   블롭 «밖»의 독립 키다. SAVE_VERSION 과 무관 ⇒ 마이그레이션 0회.
 */
import { storage } from './storage';
import { safeBridge, isInToss } from './env';
import {
  grantPromotionReward,
  grantPromotionRewardForGame,
  type GrantPromotionResult,
} from './bridge';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ★★ 2026-09-09 — 「10판 플레이하기」(100원) 추가. 이 파일은 이제 «팩토리»다.
 *
 *   President 지시로 3판(100원)과 «똑같은» 10판 프로모션을 하나 더 만든다.
 *   복사해서 두 벌로 두지 않는다 — 4113 처리·in-flight 락·레거시 폴백 같은
 *   «어렵게 얻은 규칙»이 두 곳으로 갈라지면 한쪽만 고쳐지는 날이 온다.
 *   ⇒ 하나의 createPromotion(spec) 이 둘을 만든다.
 *
 *   ⛔ 3판 인스턴스는 «동작이 바뀌면 안 된다». 이미 251명에게 지급됐고 그
 *     기록이 `tc:promo.v1` 에 남아 있다. 그래서 팩토리에 codeScoped 스위치를
 *     두고 3판은 «끄고»(옛 판정 그대로: grantedAt 만 본다) 10판만 «켠다».
 *     - 3판: 기록 있으면 코드 무관하게 already  ← 예전 그대로
 *     - 10판: 기록의 code 가 «지금 코드와 같을 때만» already
 *       (메모리 [[ait-promotion-rules]] 「코드가 바뀌면 빌드가 죽는다」 +
 *        promoStreak.ts 가 이미 같은 이유로 코드 스코프를 쓴다)
 *
 *   ★판정 순서도 인스턴스마다 다르다. 코드 스코프가 아니면 «기록 먼저»(옛
 *     순서 유지 — 미설정이어도 already 가 나온다), 코드 스코프면 코드를
 *     알아야 비교가 되므로 «설정 먼저»다(promoStreak.ts 와 같은 순서).
 * ════════════════════════════════════════════════════════════════════════════
 */

/** ★기존 키와 겹치지 않는 «새» 키. 추가만 한다. */
const PROMO_KEY = 'tc:promo.v1';
/** 10판 전용 키. 3판 키(`tc:promo.v1`)는 «절대» 건드리지 않는다. */
const PROMO10_KEY = 'tc:promo10.v1';

/** 지급 결과. 호출부는 이걸 무시해도 된다(게임 흐름과 무관). */
export type PromoOutcome =
  | 'granted' // 실제로 지급됐다
  | 'already' // 이미 받았다(로컬 기록 또는 토스 4113)
  | 'unconfigured' // 프로모션 코드가 아직 안 꽂혔다
  | 'unsupported' // 토스 밖이거나 앱 버전 미달
  | 'failed'; // 지급 시도했으나 실패(다음 기회에 재시도 가능)

interface PromoRecord {
  /** 지급이 «확정»된 시각(ms). 있으면 다시 요청하지 않는다. */
  grantedAt?: number;
  /** 토스가 준 리워드 키. 사고 시 추적용. */
  key?: string;
  /** 4113(이미 지급)으로 닫힌 경우 표시 */
  viaAlreadyGranted?: boolean;
  /** ★코드 스코프 인스턴스만 쓴다. 어떤 «프로모션 코드»로 받았는가. */
  code?: string;
}

/** 인스턴스 한 벌을 정의하는 값. 로직은 전부 공유하고 «이것만» 다르다. */
interface PromoSpec {
  /** 로그 접두. 사고 때 어느 프로모션인지 즉시 갈리게 한다. */
  tag: string;
  /** body 에서 읽을 코드/금액 속성 이름. ⛔상수로 두지 않는 이유는 readConfig 주석. */
  attrCode: string;
  attrAmount: string;
  /** 지급 기록 저장키. 인스턴스마다 «독립»이다. */
  storageKey: string;
  /**
   * 기록을 «코드별»로 볼 것인가.
   * false = 옛 판정(grantedAt 만 본다). 3판이 이것이다 — 기존 251건과 호환.
   * true  = 기록의 code 가 지금 코드와 같을 때만 already. 10판이 이것이다.
   */
  codeScoped: boolean;
  /**
   * 트리거 문턱(누적 판 수). 호출부(game/index.ts)가 requiredPlays() 로 읽는다.
   * ★문턱을 «여기» 두는 이유: 코드·금액과 «같은 곳»에서 읽혀야 셋이 어긋나지
   *   않는다. promoStreak.ts 가 requiredDays 를 자기 readConfig 에 둔 것과 같다.
   */
  plays?: number;
  /**
   * 테스트 승인용 완화 플래그 속성. body 에 이 속성이 "1" 이면 문턱을
   * playsTestonly 로 낮춘다.
   *
   * ⛔★이 플래그가 든 빌드는 «절대» 검수에 넣지 마라 — 파일명이 `_TESTONLY`
   *   인 이유다. 프로모션의 `isTested` 는 앱이 `TEST_{code}` 로 지급 API 를
   *   «실제로» 호출해야 켜지는데(MCP 로는 못 켠다), 10판을 실기기에서 매번
   *   돌리는 것이 현실적이지 않아 President 가 완화를 지시했다(2026-09-10).
   * ★정본 index.html 에는 이 속성이 «없다». 없으면 plays(10) 그대로다.
   */
  attrTestonly?: string;
  playsTestonly?: number;
}

/**
 * 지금 이 인스턴스의 트리거 문턱(판 수).
 * ⛔DOM 을 매번 읽는다 — 상수로 접히면 완화 플래그가 통째로 사라진다
 *   (readConfig 주석의 번들러 상수 접기 함정과 같은 이유).
 */
function readRequiredPlays(spec: PromoSpec): number {
  const base = spec.plays ?? 0;
  if (!spec.attrTestonly || spec.playsTestonly === undefined) return base;
  try {
    const on = (document.body?.getAttribute(spec.attrTestonly) || '').trim() === '1';
    return on ? spec.playsTestonly : base;
  } catch {
    return base;
  }
}

/**
 * ★지급 기록이 «지금 코드»에 대해 유효한가.
 *   codeScoped 가 아니면 예전과 똑같이 grantedAt 만 본다(3판 호환).
 *   codeScoped 면 promoStreak.ts 의 grantedFor() 와 «같은 규칙»이다:
 *     - 옛 레코드(code 없음)  → 새 코드를 막지 «않는다»
 *     - 다른 코드의 레코드    → 그 프로모션은 끝났다. 막지 «않는다»
 *     - 코드가 빈 문자열이면  → 어떤 기록도 「받았다」로 보지 않는다
 */
function grantedFor(spec: PromoSpec, rec: PromoRecord, code: string): boolean {
  if (!spec.codeScoped) return !!rec.grantedAt;
  return !!rec.grantedAt && typeof rec.code === 'string' && rec.code !== '' && rec.code === code;
}

async function loadRecord(spec: PromoSpec): Promise<PromoRecord> {
  try {
    const raw = await storage.getItem(spec.storageKey);
    if (!raw) return {};
    const o = JSON.parse(raw) as PromoRecord;
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

/**
 * ★지급 확정을 기록한다. **성공한 «직후»에만** 부른다.
 *   성공 «전»에 기록하면 지급이 실패했는데 영영 못 받는다(President 지시).
 *   ⚠️여기서 storage 쓰기가 실패하면 다음 실행에서 다시 요청하게 되고 그때는
 *     토스가 4113 으로 막는다 — 그래서 4113 도 «지급 완료»로 기록한다.
 */
async function markGranted(spec: PromoSpec, rec: PromoRecord): Promise<void> {
  try {
    await storage.setItem(spec.storageKey, JSON.stringify(rec));
  } catch (e) {
    console.error(`${spec.tag} 지급 기록 저장 실패 — 다음 실행에서 4113 으로 막힌다:`, e);
  }
}

/**
 * 프로모션 설정을 «런타임»에 읽는다.
 *
 * ⛔★상수로 두지 «않는» 이유 (2026-08-11 광고 실사고와 같은 함정)
 *   `const CODE = ''` 처럼 두면 번들러가 `if (!CODE) return;` 을 상수 접기로
 *   판정해 **지급 호출 블록을 통째로 삭제**한다. 광고에서 실제로 그렇게
 *   「호출이 사라진」 사고가 있었다(오직주님 src/ait-ads.js 주석 참고).
 *   ⇒ 코드는 index.html 의 body data 속성에 두고 여기서 «읽기만» 한다.
 *     번들러는 DOM 값을 접을 수 없다.
 */
function readConfig(spec: PromoSpec): { code: string; amount: number } {
  try {
    const b = document.body;
    const code = (b?.getAttribute(spec.attrCode) || '').trim();
    const amount = Number.parseInt(b?.getAttribute(spec.attrAmount) || '', 10);
    return { code, amount: Number.isFinite(amount) && amount > 0 ? amount : 0 };
  } catch {
    return { code: '', amount: 0 };
  }
}

/** 성공 응답인가 — `{ key }` 형태 */
function isSuccess(r: GrantPromotionResult): r is { key: string } {
  return !!r && r !== 'ERROR' && typeof (r as { key?: unknown }).key === 'string';
}
/** 비즈니스 실패 응답인가 — `{ errorCode, message }` 형태 */
function isFailure(r: GrantPromotionResult): r is { errorCode: string; message: string } {
  return !!r && r !== 'ERROR' && typeof (r as { errorCode?: unknown }).errorCode === 'string';
}

/**
 * 인스턴스 한 벌을 만든다. 로직은 «여기 한 곳»에만 있다.
 * @returns claim(조건 달성 시 호출) · already(읽기 전용 조회)
 */
function createPromotion(spec: PromoSpec): {
  claim: () => Promise<PromoOutcome>;
  already: () => Promise<boolean>;
  requiredPlays: () => number;
} {
  /**
   * ★동시 호출 차단(메모리). 저장 왕복이 비동기라 그 사이에 두 번 불리면
   *   둘 다 "아직 안 받았다"로 읽고 «두 번» 요청한다. 게임오버 연타·이벤트
   *   중복 발화로 충분히 일어난다.
   * ★인스턴스마다 «따로»다 — 3판 지급이 진행 중이라고 10판이 막히면 안 된다.
   */
  let inFlight: Promise<PromoOutcome> | null = null;

  async function run(): Promise<PromoOutcome> {
    /**
     * ★판정 순서가 인스턴스마다 다르다(파일 상단 주석).
     *   codeScoped=false(3판): «기록 먼저» — 옛 순서 그대로. 설정이 비어 있어도
     *     기록이 있으면 already 다. 251건이 이 동작 위에 있다.
     *   codeScoped=true(10판): 코드를 알아야 비교가 되므로 «설정 먼저».
     */
    let rec: PromoRecord;
    let code = '';
    let amount = 0;
    if (!spec.codeScoped) {
      // ① 이미 받았는가 — 가장 먼저. 브릿지를 아예 안 탄다.
      rec = await loadRecord(spec);
      if (grantedFor(spec, rec, code)) return 'already';
      // ② 설정이 꽂혔는가. 프로모션 생성은 Partner 게이트라 코드가 «나중에» 들어온다.
      ({ code, amount } = readConfig(spec));
      if (!code || amount <= 0) {
        console.warn(
          `${spec.tag} 프로모션 코드/금액 미설정 — 지급 요청 생략. index.html 의 ${spec.attrCode} 확인`
        );
        return 'unconfigured';
      }
    } else {
      ({ code, amount } = readConfig(spec));
      if (!code || amount <= 0) {
        console.warn(
          `${spec.tag} 프로모션 코드/금액 미설정 — 지급 요청 생략. index.html 의 ${spec.attrCode} 확인`
        );
        return 'unconfigured';
      }
      rec = await loadRecord(spec);
      if (grantedFor(spec, rec, code)) return 'already';
    }

    // ③ 토스 밖(로컬 dev / 플레이스토어 APK)이면 브릿지 자체가 없다.
    if (!isInToss()) return 'unsupported';

    console.log(`${spec.tag} 조건 달성 — 지급 요청 code=${code} amount=${amount}`);

    // ④ 현행 API 먼저. 네이티브가 이 메서드를 모르면 undefined 가 오거나
    //    응답이 없어 safeBridge 의 3초 타임아웃에 걸린다 → 레거시로 폴백.
    let res = await safeBridge<GrantPromotionResult>(
      'grantPromotionReward',
      () => grantPromotionReward({ params: { promotionCode: code, amount } }),
      undefined
    );

    if (res === undefined || res === 'ERROR') {
      console.warn(`${spec.tag} grantPromotionReward 미응답/오류 — 레거시(ForGame)로 폴백`);
      res = await safeBridge<GrantPromotionResult>(
        'grantPromotionRewardForGame',
        () => grantPromotionRewardForGame({ params: { promotionCode: code, amount } }),
        undefined
      );
    }

    // ⑤ 판정. ⚠️«성공했다고 가정하지 않는다» — 서버 API 쪽에서 HTTP 200 인데
    //    resultType:FAIL 로 오는 사고와 같은 급의 함정이다. 반드시 형태로 가른다.
    // ★코드 스코프 인스턴스는 기록에 code 를 «반드시» 남긴다. 안 남기면 다음
    //   프로모션 코드로 바꿨을 때 옛 기록이 새 지급을 영영 막는다.
    const stamp = spec.codeScoped ? { code } : {};
    if (isSuccess(res)) {
      await markGranted(spec, { grantedAt: Date.now(), key: res.key, ...stamp }); // ★성공 «직후» 기록
      console.log(`${spec.tag} 지급 성공 key=`, res.key);
      return 'granted';
    }

    if (isFailure(res)) {
      // ★실패를 조용히 삼키지 않는다(President 지시).
      console.error(`${spec.tag} 지급 실패 code=${res.errorCode} msg=${res.message}`);
      if (res.errorCode === '4113') {
        // 이미 지급됨 — 로컬 기록만 유실된 상태다. 기록을 복원하고 닫는다.
        await markGranted(spec, { grantedAt: Date.now(), viaAlreadyGranted: true, ...stamp });
        return 'already';
      }
      if (res.errorCode === '4112') {
        // ★예산 소진 = 최종 방어선이 작동한 것. 정상 동작이다. 앱은 그냥 진행한다.
        console.warn(`${spec.tag} 프로모션 예산 소진 — 더 지급하지 않는다`);
      }
      // 4100/4104/4105/4108/4109 등은 «우리 잘못이 아니거나 일시적»이다.
      // 기록하지 «않는다» → 프로모션이 다시 열리면 재시도된다.
      return 'failed';
    }

    if (res === undefined) {
      console.warn(`${spec.tag} 토스 앱 버전이 낮아 프로모션 미지원(5.232.0+ 필요) — 건너뛴다`);
      return 'unsupported';
    }

    console.error(`${spec.tag} 알 수 없는 오류(ERROR) — 지급되지 않았다`);
    return 'failed';
  }

  return {
    claim(): Promise<PromoOutcome> {
      if (inFlight) return inFlight; // ★동시 호출 차단
      inFlight = run();
      const p = inFlight;
      return p.finally(() => {
        if (inFlight === p) inFlight = null;
      });
    },
    async already(): Promise<boolean> {
      const rec = await loadRecord(spec);
      // 코드 스코프면 «지금 코드» 기준으로 답한다. 아니면 옛 판정 그대로.
      return grantedFor(spec, rec, spec.codeScoped ? readConfig(spec).code : '');
    },
    requiredPlays(): number {
      return readRequiredPlays(spec);
    },
  };
}

/* ── 인스턴스 두 벌 ────────────────────────────────────────────────────────
   ★ 3판은 «옛 동작 그대로»(codeScoped=false, 키 tc:promo.v1).
     10판은 코드 스코프(키 tc:promo10.v1) — 코드가 바뀌면 다시 받을 수 있다. */
const promo3Plays = createPromotion({
  tag: '[promo]',
  attrCode: 'data-promo-code',
  attrAmount: 'data-promo-amount',
  storageKey: PROMO_KEY,
  codeScoped: false,
});

const promo10Plays = createPromotion({
  tag: '[promo10]',
  attrCode: 'data-promo2-code',
  attrAmount: 'data-promo2-amount',
  storageKey: PROMO10_KEY,
  codeScoped: true,
  plays: 10,
  // ★테스트 승인(isTested) 전용 완화 — 정본에는 이 속성이 «없다».
  attrTestonly: 'data-promo2-testonly',
  playsTestonly: 1,
});

/**
 * 「3판 플레이 완료」 → 100원. 조건을 만족했을 때 부른다.
 * **절대 throw 하지 않고, 게임을 막지 않는다.** `void claimReward()` 로 흘려보내도 된다.
 */
export function claimReward(): Promise<PromoOutcome> {
  return promo3Plays.claim();
}

/** 「10판 플레이 완료」 → 100원 (★2026-09-09 신설). 계약은 claimReward 와 같다. */
export function claimReward10(): Promise<PromoOutcome> {
  return promo10Plays.claim();
}

/** 이미 받았는지 조회(읽기 전용). UI 표시용. */
export function alreadyRewarded(): Promise<boolean> {
  return promo3Plays.already();
}

/** 10판 보상을 이미 받았는지 조회(읽기 전용). */
export function alreadyRewarded10(): Promise<boolean> {
  return promo10Plays.already();
}

/**
 * 10판 프로모션의 «지금» 문턱(판 수). 보통 10, TESTONLY 빌드에서만 1.
 * 호출부(game/index.ts)가 `save.plays >= requiredPlays10()` 로 쓴다.
 * ⛔상수로 캐시하지 마라 — 캐시하면 완화 플래그를 읽는 시점이 고정된다.
 */
export function requiredPlays10(): number {
  return promo10Plays.requiredPlays();
}
