---
name: Territory Clash — Aurora Enamel on Obsidian (2026-08-30 그래픽 고도화)
surface: game (canvas world + WebGL post + DOM overlay UI), mobile portrait first
reference: 네온 스레드 파일럿(Ketchapp 급 2D — 블룸·배경 깊이·팔레트 규율·주스·효과음) + design/ART_DIRECTION.md v1.1(「액체 흑요석 위의 오로라 에나멜」)
mode: Experience (아레나가 주인공) / Operate (메뉴·결과)
family: awesome-design «cinematic» 계열(runway·nvidia 구조 차용) — playful 은 배제(근거 §0)
colors:
  void-0: "#05060B"    # 최심부·비네트 바깥
  void-1: "#0A0D16"    # 아레나 바닥(위)
  void-2: "#121728"    # 미점령 셀
  void-3: "#1B2238"    # 시트 상단
  haze: ["#2A3A6B", "#3B2A6B", "#0E4A55"]   # 오로라 3겹(배경 베이크)
  ink-0: "#F2F5FF"
  ink-1: "#A8B2D8"
  ink-2: "#93A6CC"     # 6.6:1 on #121728 — 12px 라벨도 AA
  danger: "#FF2D55"
  success: "#24E5A0"
  gold-a: "#FFCE4A"
  accent-cta: "linear-gradient(135deg,#7DF4FF,#3B82F6 70%,#4C6BFF)"  # 플레이어(AURORA) 계열 = 브랜드
  ink-on-cta: "#06121A"   # 8.9:1 on #7DF4FF · 4.9:1 on #4C6BFF
  aurora-glow: "#7DF4FF"  # 2026-09-10 문서화 — 보조 컨트롤 틴트의 기준색. rgba(125,244,255,.10/.12/.45) = .tc-dc-play(기존)·.tc-pushnudge-cta·.tc-xp-open
  hairline-white: "#FFFFFF" # 2026-09-10 문서화 — 흰 헤어라인·컨트롤 테두리 rgba(255,255,255,.14)(.tc-switch·.tc-lang-select 기존값)·면 rgba(255,255,255,.045)
  factions:               # 내부 3-스톱(s0→s1→s2, 림보다 어둡다) · glow = 림·트레일·머리·블룸
    AURORA:  { s: ["#22D3EE","#3B82F6","#6D3BE8"], glow: "#7DF4FF", hatch: 45 }    # 플레이어 고정
    EMBER:   { s: ["#FF5A36","#D6261E","#7A0F14"], glow: "#FF8A5C", hatch: -45 }
    TOXIN:   { s: ["#A6F04A","#2ECC71","#128C5C"], glow: "#C6FF6E", hatch: 0 }
    VIOLET:  { s: ["#E24CF5","#8E2BE0","#43158F"], glow: "#F58CFF", hatch: 90 }
    SOLAR:   { s: ["#FFF06E","#FFCC1F","#F08A12"], glow: "#FFF7B3", hatch: 22 }
    FROST:   { s: ["#FFFFFF","#DCE8FF","#A9BCF5"], glow: "#FFFFFF", hatch: -22 }
    CRIMSON: { s: ["#FF5C7A","#B0113A","#560A22"], glow: "#FF8FA6", hatch: 67 }   # 3·5분 전용
    LAGOON:  { s: ["#4DF5D0","#0FA3A8","#0A5763"], glow: "#8AFFE6", hatch: -67 }
    LILAC:   { s: ["#EEDCFF","#B49BE6","#7B55C4"], glow: "#F4E9FF", hatch: 112 }
    BRONZE:  { s: ["#E8B06A","#B5732A","#6B3E10"], glow: "#FFD59A", hatch: 157 }
typography:
  display: '"Chakra Petch", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", system-ui, sans-serif'   # 숫자·라틴만(latin 서브셋 self-host, OFL)
  body: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", Pretendard, "Malgun Gothic", system-ui, sans-serif'
  weights: [600, 700]
  numerals: tabular
rounded: { control: 13–15px, card: 14px, sheet: 22px, pill: 999px }
spacing: 4px base (6 / 8 / 12 / 14 / 16 / 20)
glow:
  pipeline: "explicit emissive buffer (1/4 res) → WebGL gaussian 1/4 tight + 1/8 wide → additive compose"   # bright-pass 없음
  tight: 0.72
  wide: 0.50
  emissive-sources: "territory rim (glow, w=CELL*.55, a.8) · interior fill a.06 · trail ribbon (CELL*1.6, a.42) · head disc · landmarks · particles · claim fill pulse"
  canvas-shadowBlur: "0 per frame — only inside baked caches (territory shadow, unit sprite shadow)"
  scene-dpr: "pixel budget: w×h×min(dpr,2)² > 1.0M ? 1.5 : 2 — (w,h,dpr) 만의 함수. 품질 단계와 무관, 플레이 중 불변"
  quality-tiers: "q0 tight+wide (6 GL passes) / q1 tight only (3) / q2 wide-only (4) / off = 블룸 패스 0, GL 합성 1패스 유지(캔버스 크기·경로 불변)"
  tier-controller: "30-frame window >19ms ≥5/30 → degrade 후보; min dwell 8s; recover = clean(≤1/30) 15s 연속 + dwell ≥15s, ≤2 promotions/session; every change = 400ms crossfade(양쪽 단계 원래 버퍼를 둘 다 계산해 계수 lerp)"
  fuse: "q2 에서 dwell 8s 뒤 >33ms 가 90프레임 중 >25% → bloom passes off, 세션 내 불가역(setEnabled 로도 복구 없음)"
  tone: "compose soft-knee: c<0.8 그대로, 그 위는 0.8+0.2(1−e^(−5(c−0.8))) — 하드클립 min(c,1) 폐기. bright-pass 는 «없다»(문턱 자체가 없어 문턱 깜빡임 원천 부재)"
  flicker-rules: "네온 -22 「장애물 깜빡임」 재발 방지 6항(2026-08-30): ①히스테리시스 ②크로스페이드 ③DPR/캔버스 플레이 중 불변 ④같은 오브젝트 두 층 금지·층 지연 0(stageDraws=0·layerLag=0 실측) ⑤soft-knee ⑥폴백 불가역·포스트는 draw() 안 동기 호출"
  fallback: "no WebGL → canvas 1/4 filter:blur bloom + canvas vignette overlay (live path). 폴백 적응해상도(resStep)는 플레이 중 적용 금지 — 결과/메뉴 화면에서만 캔버스 재설정"
  culling: "유닛·트레일은 가시 월드 사각형(+3셀, 틸트 여유) 밖이면 그리지 않는다 — 300s 아레나 92×161 중 화면은 ≈9%"
particles:
  cap: 1400 HIGH / 800 MID / 320 LOW
  claim burst: 18–40 (2/3 shards with top-edge highlight, 1/3 white streak sparks)
  kill: 26 burst + ember streaks (gravity 160) from lost cells
  trail: 1 white spark / 2 frames at the head
  rings: claim (glow) · kill (danger) · land · revive
---

# 땅따먹기 — DESIGN.md (그래픽 고도화, 2026-08-30)

## 0. 세계관 한 줄 · 계열 선택 근거
「거의 검은 흑요석 판 위에서, 두께를 가진 에나멜 영토가 빛나는 가장자리로 차오른다.」
(ART_DIRECTION v1.1 의 한 줄을 그대로 잇는다 — 장르 기본값(검정 + 형광 단색 타일)과 갈리는 것은 «재질»이다.)

awesome-design 계열은 **cinematic** 을 고른다(playful 배제):
- 19+ 토스 미니앱·대전 게임 — 파스텔·둥근 마스코트 톤은 의도적으로 배제된 브리프다(AD §1).
- cinematic(runway·nvidia)의 구조 — «검정 캔버스 + 소수의 채도 높은 강조 + 오버사이즈 숫자 + 깊고 부드러운 그림자» — 가
  이 게임의 「어둡고 무거운 베이스 위의 고채도」와 정확히 겹친다. 토큰(색·서체·로고)은 가져오지 않고 구조만 빌렸다.
- 토스 미니앱 상위 규칙(토스 문법: 시트·라운드·버튼 위계)은 그대로 — DESIGN.md 는 그 «안»에서 토큰 정합성을 잡는다.

## 1. 팔레트 규율 — 배경 4단 + 잉크 3단 + 팩션 10 (구분 가능성 «측정»)
- 배경은 순수 검정 금지(#05060B 계열). 미점령 셀 `void-2` 25%, 바닥 `void-1→void-0` 세로 그라디언트 + 오로라 3겹(.15) + 심해 어둠. **노이즈·그레인·디더링 0** (-24: «평평한 면은 평평하게» — 기기 픽셀 단위 잡음은 iPhone 에서 「짜글짜글」로 보였다).
- 팩션 색은 **내부(s0→s1→s2)가 어둡고 가장자리(glow)가 밝다**. 깊이가 「내부 어둡고 림 밝음」에서 나오고, 블룸은 emissive 만
  번지므로 내부가 하얗게 타지 않는다. HUD 가 영토 위에 얹혀도 대비가 산다.
- **색각 이상 구분 가능성은 측정했다**(`scripts/palette_cvd.mjs`, CIEDE2000 · Machado 2009 severity 1.0):

  | 지표(최소 ΔE2000) | 라이브 | **신규** |
  |---|---|---|
  | 앞 6종 s1 · 정상 | 11.63 (EMBER↔SOLAR) | **27.41** |
  | 앞 6종 s1 · deutan | 4.44 | **9.50** |
  | 앞 6종 s1 · protan | 2.87 | **11.06** |
  | 앞 6종 glow · deutan | 2.77 | **8.81** |
  | 10종 s1 · 정상 / deutan / protan | 11.63 / 4.44 / 2.87 | **14.75 / 4.61 / 10.41** |

  원리: 적록 색각 이상에서 남는 축은 «명도»와 «청-황»뿐 → 앞 6종을 명도 사다리로 재배치(s1 상대휘도 FROST .80 / SOLAR .65 /
  TOXIN .45 / AURORA .24 / EMBER .16 / VIOLET .13). 10종(3·5분 모드)의 팩션별 해치(hatch)는 -24 에서 **제거** — 1px/14px
  마이크로 텍스처가 카메라 이동 중 재보간돼 「픽셀 단위 짜글거림」이 됐다. 구분은 명도 사다리 + 림 색으로만 한다.
- 플레이어는 항상 AURORA. CTA·선택 세그먼트·조이스틱·게이지도 같은 오로라 그라디언트 = 「내 색」이 곧 브랜드.
- 위험 = danger(꼬리 취약 구간·킬피드 십자·막판 테두리), 보상 = success/gold, 구조 = 팩션 glow. 4번째 강조 계열은 만들지 않는다.

## 2. 글로우(블룸) 규칙
- 블룸은 **WebGL 후처리 한 장**(`src/game/post.ts`). 밝기 문턱이 없다 — 이 게임은 원래 「무엇이 빛나는가」를 emissive 버퍼에
  명시적으로 그렸고(림·트레일·머리·파티클), 그 버퍼를 그대로 블러한다. 씬을 한 번 더 읽는 bright-pass 가 통째로 빠진다.
- 두 겹: 1/4 해상도(타이트 .45) + 1/8(와이드 .15), 가산. 비네트(.25)·막판 테두리 틴트·채도하강은 같은 합성 셰이더의
  유니폼 — 풀스크린 캔버스 패스 0. **그레인 없음**(-24). emissive 에는 «채움»을 넣지 않는다(림·꼬리·유닛·파티클만, -23).
- **픽셀 위상 규율(-24)**: 세계 원점은 «정수 장치 픽셀»에 스냅, 셀 한 변은 «정수 픽셀»로 배율 양자화, 카메라 기울임 0,
  영토 캐시는 배율이 정확히 안정되면 0.05% 어긋남에도 재굽기 → 캐시 blit·격자 타일·림 코어가 프레임마다 재보간되지 않는다.
  scene→GL 은 정확히 1:1 일 때만 NEAREST(아니면 LINEAR). 텍스트(이름표·팝업)는 HUD 층 `#tc-ov`(기기 DPR, AA)에 — scene 에 두지 않는다.
- **해상도(-24)**: iOS scene DPR 2 (HUD 층 3) · Android 2 시작→프로브 실패 시 다음 런 1.5. 동적 품질은 «q1 로 시작», iOS 3초 깨끗하면 q0
  (Android 15초), 파티클 상한 900/500/320.
- 캔버스 `shadowBlur` 는 매 프레임 «0» — 영토 그림자·스키프 그림자는 캐시/스프라이트에 1회 굽는다.
- 60fps 가 조건: 픽셀 예산(scene DPR ≤ 2, 1.0M px 넘으면 1.5) + 3단계 동적 품질 + 최후 보험(세션 내 블룸 패스 off). WebGL 이
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
  증거: `_gfx_evidence_260830/harness/out/bench_new2/*.json` 의 `qlog`(세션 경과 ms) · `rapidTransitions`(5초 내 2회, 기대 0) · `minDwellMs` · `sizeConstant` · `layer`.

## 3. 영토 — 재질과 캐시
| 레이어(캐시에 굽는 순서) | 규칙 |
|---|---|
| 지가 | 상업지 gold 5% + 군집 외곽선 30% · 특수지 gold 22% |
| 접지 그림자 | 팩션별 fill + shadowBlur 7 / offset (2,3), 55% — HIGH·MID |
| 베이스 | 월드 고정 135° 3-스톱 그라디언트, 90% |
| 깊이 | 월드 고정 세로 그라디언트 흰 7% → deep 18% → deep 50% (아래로 갈수록 가라앉는다) |
| 베벨 | offset-mask(±CELL·0.2) 흰 32% / 검정 38% — LOW 에서도 유지 |
| 림 | 바깥 클립 스트로크 glow 4.8px 90% + 흰 코어 1.6px 55% («액체 금속» 가장자리) |
| emissive(1/4) | 림 glow CELL·0.55 80% (내부 채움 없음, -23) |
- 매 프레임은 캐시 blit 1회 + (HIGH) 에나멜 시트(4.5s 주기 흰 7.5% 대각 스윕) + 등기 링 + 랜드마크 회전 링 + 점령 플래시.
- 캐시 = 가시영역 + 여유 6셀, 장치 해상도. 갱신: 소유권 더티 사각형(+1셀, «정수 픽셀 clip» — 분수 픽셀 이음선 방지) /
  카메라 이탈 시 자기복사 + 드러난 띠 / 배율이 «정확히» 안정된 뒤 0.05% 이상 어긋나면 전체(-24).

## 4. 주스
| 사건 | 연출 |
|---|---|
| 점령 | 중심에서 퍼지는 glow 채움(0.6s easeOutCubic, 클립 = 점령 셀) + 흰 플래시 감쇠 + 링 + 파편 18~40 + emissive 펄스. 플레이어 본인 점령만 줌 펀치 1.2%(`?shake=off` 로 끔) + `+x.x%` 팝 |
| 격파 | danger 링 + 파편 26 + 잃은 셀에서 불씨 스트릭(중력) + 킬피드 + 「처치!」 팝. 봇 사건 셰이크는 기본 0(President 결정 유지) |
| 이동 | 트레일 = emissive 리본(CELL·1.6) + 팩션 미드 + 흰 코어 + 흐르는 펄스 대시 + 꼬리 20% danger 점선. 머리 = 라디얼 광 스프라이트 + 스러스터 3겹 + 속도 스쿼시(≤14%) |
| 막판 10초 | 합성 셰이더 테두리 틴트 0.07→0.17, 1Hz 숨쉬기(깜빡임 아님) · 마지막 3초 틱 효과음. `?urgent=off` |
| 사망/실패 | 채도하강(셰이더, 0.7×) |
| 결과 | 순위 68px 디스플레이체 + 오프셋 하드섀도, 통계 80ms 스태거(기존) |

## 5. 캐릭터(스키프) — 코드 드로잉, 스프라이트 캐시
좌상단 315° 광원 하나: 접지 그림자(6px 블러, 오프셋) → 선체 3-스톱 그라디언트 → 하부 오클루전(deep 60%) → 앞쪽 하이라이트 →
바이저(눈: 어두운 슬릿 + glow 홍채 + 흰 하이라이트 점) → 캐노피 스펙큘러 → 흰 림 62%. 팩션별 1장 + 머리 광 1장, 배율 8% 변화 시 재생성.
매 프레임은 drawImage 2회 + 스러스터 타원 3개 + 상태 링 1개.

## 6. 타이포
- 숫자·라틴: **Chakra Petch 600/700**(OFL, latin 서브셋 self-host 각 ≈10KB, 외부 요청 0 — 게임 4종 공통 디스플레이체).
  한글은 unicode-range 밖 → Apple SD Gothic Neo / Pretendard / Malgun. `tabular-nums`.
- 위계: HUD 점수 23px · 칩 21px · 결과 순위 68px(+단위 18px) · 통계 값 18px · 라벨 12~13px(ink-2 6.6:1).
- 제목은 «단색 잉크 + 3px 오프셋 하드섀도(오로라 블루)». 그라디언트 텍스트·제로오프셋 글로우·트래킹 대문자 아이브로우 없음.

## 7. UI 오버레이 규칙(게임 제약)
- 인게임 HUD 에 `backdrop-filter` 없음(라이브 결정 유지) — 킬피드·미니맵은 불투명도 .78/.82 로 대비 확보. 메뉴·모달 블러(정지 화면)는 유지.
- 터치 타깃: 세그먼트 46 · CTA 50(압축 46) · 토글 44 · 오늘의대결 44 · 언어 44 — Web WCAG 2.2 AA 24px 상회.
- 대비: 텍스트 4.5:1(대형 3:1) — 실렌더 픽셀로 측정(`_gfx_evidence_260830/harness/harness.mjs contrast`).
- 효과음 토글 = 언어 행과 같은 문법(라벨 + 스위치 + 상태 텍스트). 색만으로 상태를 전하지 않는다.

## 8. 효과음(ZzFX, MIT, 인라인)
tap · claim · claimBig(80셀↑) · kill · death · bounceGo · bounceLand · tick(마지막 3초) · over · win · revive — 11종.
플레이어가 관여한 사건만(봇끼리 무음). 첫 제스처 뒤 AudioContext. 90ms 디바운스. 설정은 KEYS.settings 에 합류(`sound:false` 만 저장).

## 9. 하지 않는 것
- 이미지 에셋 0장(폰트 2파일 제외). 3D 없음. 봇 사건 셰이크·히트스톱·햅틱은 President 결정대로 «기본 끔» 그대로.
- 게임 규칙·저장·랭킹·광고 지면·SDK 코드 무접촉(`scripts/check_logic_bytes.mjs`).
