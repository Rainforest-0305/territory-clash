# -*- coding: utf-8 -*-
"""DESIGN.md — 2026-08-30 규칙 6항(깜빡임 방지) 반영. 멱등."""
import io, os
P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'DESIGN.md')
s = io.open(P, encoding='utf-8').read()
if 'flicker-rules' in s:
    print('already'); raise SystemExit(0)

def rep(a, b):
    global s
    assert s.count(a) == 1, a[:100]
    s = s.replace(a, b)

rep('''  scene-dpr: "pixel budget: w×h×min(dpr,2)² > 1.0M ? 1.5 : 2 (q0) / 1.25 (q1) / 1.0 (q2)"
  quality-tiers: "q0 tight+wide (6 GL passes) / q1 tight only (3) / q2 wide-only (4) / off = last-resort fuse (22ms>25% of 90 frames)"
  tier-controller: "30-frame window, >19ms ≥5/30 → degrade; 0/30 ×6 windows → recover; 2-window hold"
  fallback: "no WebGL → canvas 1/4 filter:blur bloom + canvas vignette overlay (live path, unchanged)"''',
'''  scene-dpr: "pixel budget: w×h×min(dpr,2)² > 1.0M ? 1.5 : 2 — (w,h,dpr) 만의 함수. 품질 단계와 무관, 플레이 중 불변"
  quality-tiers: "q0 tight+wide (6 GL passes) / q1 tight only (3) / q2 wide-only (4) / off = 블룸 패스 0, GL 합성 1패스 유지(캔버스 크기·경로 불변)"
  tier-controller: "30-frame window >19ms ≥5/30 → degrade 후보; min dwell 8s; recover = clean(≤1/30) 15s 연속 + dwell ≥15s, ≤2 promotions/session; every change = 400ms crossfade(양쪽 단계 원래 버퍼를 둘 다 계산해 계수 lerp)"
  fuse: "q2 에서 dwell 8s 뒤 >33ms 가 90프레임 중 >25% → bloom passes off, 세션 내 불가역(setEnabled 로도 복구 없음)"
  tone: "compose soft-knee: c<0.8 그대로, 그 위는 0.8+0.2(1−e^(−5(c−0.8))) — 하드클립 min(c,1) 폐기. bright-pass 는 «없다»(문턱 자체가 없어 문턱 깜빡임 원천 부재)"
  flicker-rules: "네온 -22 「장애물 깜빡임」 재발 방지 6항(2026-08-30): ①히스테리시스 ②크로스페이드 ③DPR/캔버스 플레이 중 불변 ④같은 오브젝트 두 층 금지·층 지연 0(stageDraws=0·layerLag=0 실측) ⑤soft-knee ⑥폴백 불가역·포스트는 draw() 안 동기 호출"
  fallback: "no WebGL → canvas 1/4 filter:blur bloom + canvas vignette overlay (live path). 폴백 적응해상도(resStep)는 플레이 중 적용 금지 — 결과/메뉴 화면에서만 캔버스 재설정"
  culling: "유닛·트레일은 가시 월드 사각형(+3셀, 틸트 여유) 밖이면 그리지 않는다 — 300s 아레나 92×161 중 화면은 ≈9%"''')

rep('''- 60fps 가 조건: 픽셀 예산(scene DPR ≤ 2, 1.0M px 넘으면 1.5) + 3단계 동적 품질 + 최후 보험(세션 내 블룸 off). WebGL 이
  없으면 라이브 경로(캔버스 블룸·캔버스 후처리)가 그대로 살아 있다.''',
'''- 60fps 가 조건: 픽셀 예산(scene DPR ≤ 2, 1.0M px 넘으면 1.5) + 3단계 동적 품질 + 최후 보험(세션 내 블룸 패스 off). WebGL 이
  없으면 라이브 경로(캔버스 블룸·캔버스 후처리)가 그대로 살아 있다.
- **깜빡임 금지 6항(2026-08-30, 네온 -22 실기기 사고 「장애물이 계속 깜빡거려」 = 동적 품질 토글 추정)**
  1. 단계 전환 히스테리시스 — 최소 체류 8초, 회복은 «깨끗한» 15초 연속 뒤, 세션당 승격 ≤2회.
  2. 전환은 400ms 크로스페이드 — 페이드 중엔 두 단계의 «원래» 블러 버퍼를 둘 다 만들어 합성 계수만 섞는다(페이드 끝에서 튀지 않음).
  3. **DPR·캔버스 크기는 플레이 중 절대 바뀌지 않는다** — scene DPR 은 (w,h,dpr) 만의 함수. 단계는 블러 체인만 바꾼다.
     폴백 경로의 적응해상도도 플레이 중엔 적용하지 않는다(결과·메뉴 화면에서만).
  4. 같은 오브젝트를 두 층에 그리지 않는다 — 후처리가 켜지면 #stage 에는 아무것도 그리지 않고(stageDraws=0 계측),
     scene 드로우와 GL 합성이 같은 draw() 안에서 동기로 끝난다(layerLag=0 계측). emissive 는 «광원 마스크»지 오브젝트 복제가 아니다.
  5. bright-pass 는 없고(문턱이 없으니 문턱 깜빡임도 없다), 합성 클립은 soft-knee(0.8→1.0, C1 연속).
  6. 최후 보험은 불가역 — 블룸 패스만 끄고 GL 합성은 유지(캔버스 크기·경로 불변). 캔버스 블룸 폴백으로 «가지 않는다»(실측: 폴백이 더 느렸다).
  증거: `_gfx_evidence_260830/harness/out/bench_new2/*.json` 의 `qlog`(세션 경과 ms) · `rapidTransitions`(5초 내 2회, 기대 0) · `minDwellMs` · `sizeConstant` · `layer`.''')
io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
print('patched DESIGN.md')
