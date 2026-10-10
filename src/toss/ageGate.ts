/**
 * 연령 게이트 (getDeclaredAgeRange) — **기본 비활성.** 켜는 것은 정책 결정이다.
 *
 * ── 왜 만들어 뒀나 ──────────────────────────────────────────────────────────
 * 트랙 D 기획서(04_땅따먹기/README.md)에 "타깃: 앱인토스(성인 19+)" 라고
 * 적혀 있다. 만약 이 게임이 토스에 19+ 로 등재된다면 연령 확인이 필요하고,
 * **자체 연령 게이트를 만들면 안 된다** — SDK 에 공식 API 가 실재한다.
 * 나중에 붙이면 부팅 시퀀스를 다시 짜야 하므로 지금 자리만 잡아 둔다.
 *
 * 다만 "땅따먹기(영역점령)"는 그 자체로 성인 콘텐츠가 아니다. 19+ 등재가
 * 실제 요건인지, 아니면 트랙 폴더 설명의 관성인지 **미확인**이다.
 * → Partner→President 확인 사항. 확인 전에는 켜지 마라(불필요한 이탈 유발).
 *
 * ── API 실측 (web-bridge@2.10.8) ────────────────────────────────────────────
 *   getDeclaredAgeRange({ ageGates: number[] }) : Promise<DeclaredAgeRange>
 *   getDeclaredAgeRange.isSupported()           : boolean (상수 브릿지)
 *     dist/index.js 실측:
 *       var getDeclaredAgeRange = Object.assign(
 *         createAsyncBridge("getDeclaredAgeRange"),
 *         { isSupported: createConstantBridge("getDeclaredAgeRange_isSupported") });
 *
 *   status 6종: SHARING / DECLINED_SHARING / UNSUPPORTED_OS /
 *               NOT_AVAILABLE / INVALID_REQUEST / FAILED
 *   activeParentalControls 는 **필수 필드**다(옵셔널 아님) — 자녀보호가 걸린
 *   계정을 반드시 고려하라는 신호.
 *
 * ── 정책 결정이 필요한 지점 (기술총괄이 정하지 않는다) ──────────────────────
 *   DECLINED_SHARING(공유 거부) / NOT_AVAILABLE 사용자를 어떻게 할 것인가?
 *     차단  = 이탈률 급증
 *     허용  = 연령 확인이 사실상 무의미
 *   이건 법무·정책 판단이다. Partner→President 게이트.
 */
import { getDeclaredAgeRange } from '@apps-in-toss/web-framework';
import { isInToss, safeBridge, safeSync } from './env';

export type AgeGateResult =
  | { allowed: true; reason: 'not-required' | 'verified' | 'unsupported-env' }
  | { allowed: false; reason: 'declined' | 'underage' | 'unavailable' | 'error' };

export interface AgeGateOptions {
  /** false 면 아무 것도 하지 않고 통과시킨다(기본값). */
  enabled?: boolean;
  /** 확인할 연령 경계. 19+ 등재라면 [19]. */
  ageGates?: number[];
  /**
   * 연령 정보를 공유하지 않은 사용자를 통과시킬 것인가.
   * ★ 정책 결정 전에는 손대지 마라. 기본 false(차단)로 두면 이탈이 크고,
   *   true 로 두면 연령 확인이 무의미해진다. 어느 쪽도 기술총괄이 정할 수 없다.
   */
  allowWhenDeclined?: boolean;
}

export async function checkAgeGate(options: AgeGateOptions = {}): Promise<AgeGateResult> {
  const { enabled = false, ageGates = [19], allowWhenDeclined = false } = options;

  if (!enabled) return { allowed: true, reason: 'not-required' };
  if (!isInToss()) return { allowed: true, reason: 'unsupported-env' };

  const supported = safeSync('getDeclaredAgeRange.isSupported', () => getDeclaredAgeRange.isSupported(), false);
  if (!supported) {
    console.warn('[toss-sdk][ageGate] getDeclaredAgeRange unsupported on this Toss version');
    return allowWhenDeclined ? { allowed: true, reason: 'unsupported-env' } : { allowed: false, reason: 'unavailable' };
  }

  const r = await safeBridge('getDeclaredAgeRange', () => getDeclaredAgeRange({ ageGates }), null);
  if (r == null) return { allowed: false, reason: 'error' };
  console.log('[toss-sdk][ageGate] result =', r);

  if (r.status !== 'SHARING') {
    if (r.status === 'DECLINED_SHARING') {
      return allowWhenDeclined ? { allowed: true, reason: 'verified' } : { allowed: false, reason: 'declined' };
    }
    return allowWhenDeclined ? { allowed: true, reason: 'verified' } : { allowed: false, reason: 'unavailable' };
  }

  const min = Math.max(...ageGates);
  const lower = r.lowerBound ?? -1;
  if (lower >= min) return { allowed: true, reason: 'verified' };
  return { allowed: false, reason: 'underage' };
}
