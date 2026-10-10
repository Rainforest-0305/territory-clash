/**
 * ############################################################################
 * ##  땅따먹기 (Territory Clash) — 게임 진입점                              ##
 * ############################################################################
 *
 * src/main.ts 는 SDK 4종을 켠 뒤 `startGame(ctx)` 하나만 호출한다.
 * main.ts / src/toss/** 는 건드릴 필요 없다.
 *
 * ── 이 파일의 역할 ──────────────────────────────────────────────────────────
 * 오케스트레이션만 한다. 캔버스/DPR, 입력, 루프, 세션 수명주기, 저장.
 * 실제 내용물은 아래로 갈라져 있다.
 *   grid.ts    아레나 상태(소유권·지가·등기) — state of truth
 *   sim.ts     규칙 구현(이동·꼬리·점령·튕기기·지분뺏기·타이머·점수)
 *   bots.ts    봇 AI 5단계 + 고스트 리플레이/폴백
 *   render.ts  렌더 파이프라인 L0~L7  ← 품질의 전부. 여기 손댈 땐 조심해라
 *   hud.ts     DOM HUD + 결과 화면
 *   save.ts    영속 데이터 + 고스트 인코딩
 *   palette.ts / textures.ts / rng.ts / types.ts
 *
 * ── 지켜야 할 규칙 (안 지키면 심사/성능에서 터진다) ──────────────────────────
 *  A. 저장은 반드시 `storage` / `createCoalescedWriter` 를 써라.
 *     localStorage 직접 호출 금지 — 미니앱에서 유실된다(storage.ts 주석 참고).
 *     게임 루프 안에서 storage.setItem 직접 호출 금지 — 브릿지가 막혀 프레임이
 *     떨어진다. 반드시 coalesced writer 로.
 *     → 이 파일에서 쓰기는 endSession() 한 곳뿐이고 전부 writer.set 이다.
 *  B. 화면 가장자리 UI 는 CSS 변수 --sat/--sar/--sab/--sal 를 존중해라.
 *     캔버스 좌표 계산이 필요하면 readInsetPx() 를 써라.
 *     상단은 투명 네비바(뒤로가기 버튼)가 겹친다 — HUD 를 top:0 에 두지 마라.
 *     → hud.css 가 --sat + --navh(52px) 로 상단을 비운다.
 *  C. 사용자 단위 데이터의 키는 ctx.identity.userKey 다.
 *     디바이스 ID 나 자체 UUID 로 대체하지 마라(랭킹이 어긋난다).
 *     → 닉네임 생성(save.nickFor)과 고스트 소유자 판정에 userKey 를 쓴다.
 *  D. 뒤로가기는 pushBackHandler 로 가로채라. 게임 중에 그냥 앱이 닫히면 안 된다.
 *  E. 60fps 목표. 캔버스는 2D 컨텍스트 기준으로 잡아 뒀다. WebGL 로 갈 거면
 *     resize()/loop() 만 갈아끼우면 되고 나머지 계약은 그대로다.
 *
 * ── 게임 규칙 요약 (확정본은 ../../design/ 참조) ────────────────────────────
 *  실시간 60초 영역점령. 자기 영역 밖으로 나가면 꼬리가 남고, 꼬리를 밟히면
 *  지분 30% 를 뺏긴다(전멸 아님 — §3-D). 자기 영역으로 돌아오면 꼬리로 둘러싼
 *  면적이 내 영역이 된다(flood fill). 점수는 면적이 아니라 **지가 × 보유시간**
 *  (§3-B). 게이지가 차면 전통 땅따먹기의 3번 튕기기로 폐다각형을 한 번에
 *  먹을 수 있다(§3-A). 트랙 C(턴제 보드/카드)와 메커닉이 겹치면 안 된다.
 */
import {
  pushBackHandler,
  readInsetPx,
  storage,
  KEYS,
  createCoalescedWriter,
  generateHapticFeedback,
  claimReward,
  claimReward10,
  requiredPlays10,
  recordPlayAndClaim,
  type HapticFeedbackType,
  type Identity,
  type SdkSelfTest,
} from '../toss';
import { FACTIONS, PAL } from './palette';
import { dailySeed } from './rng';
import { World } from './sim';
import { Renderer } from './render';
import { Hud } from './hud';
import { Menu } from './menu';
import { setArena } from './grid';
import {
  MODE_TABLE,
  DEFAULT_MODE,
  DEFAULT_DIFFICULTY,
  asModeKey,
  asDifficulty,
  assertModeTable,
  modeOf,
  type Difficulty,
  type ModeKey,
} from './modes';
import { t, fmt } from '../i18n';
import { trackScreenView, trackRunStart, trackRunEnd } from '../analytics/track';
import {
  GhostRecorder,
  decodeGhost,
  encodeGhost,
  ghostMode,
  loadBestByMode,
  loadSave,
  DEFAULT_SAVE,
  type SaveData,
} from './save';
import {
  dailyClashInfo,
  recordDailyClashCompletion,
  dailyClashSeed,
  DAILY_CLASH_MODE,
  DAILY_CLASH_DIFFICULTY,
} from './dailyClash';
import { kstDateKey, nowMs } from '../lib/daykey';
import { sfx } from './sfx';
import { reviveAdAvailable, showReviveAd } from '../ads/rewardedAd';
import { suppressNextInterstitial } from '../ads/adGate';
import { setSoundEnabled, setSoundPersist } from '../ui/soundToggle';

export interface GameContext {
  canvas: HTMLCanvasElement;
  identity: Identity;
  inToss: boolean;
  selfTest: SdkSelfTest;
}

export interface GameHandle {
  stop: () => void;
}

export function startGame(ctx: GameContext): GameHandle {
  const { canvas } = ctx;
  const g = canvas.getContext('2d', { alpha: false });
  if (!g) throw new Error('2D context unavailable');

  const writer = createCoalescedWriter(800);
  let running = true;
  let paused = false;
  let rafId = 0;

  const host = (canvas.parentElement ?? document.body) as HTMLElement;

  // SDK 4종 부팅 진단 패널(#sdk-probe)은 정식 게임 UI 가 붙으면 감춘다.
  // main.ts 를 건드리지 않고 여기서 끈다 — 실기기 점검이 필요하면
  // ?probe=1 로 다시 켤 수 있다(콘솔 로그는 그대로 남는다).
  if (new URLSearchParams(location.search).get('probe') !== '1') {
    document.getElementById('sdk-probe')?.setAttribute('hidden', '');
  }

  // ── 캔버스 크기 / DPR ─────────────────────────────────────────────────────
  let vw = 0;
  let vh = 0;
  let dpr = 1;
  const renderer = new Renderer(g);
  // WebGL 후처리(블룸·비네트·채도·막판 테두리). 실패하면 캔버스 경로 — 호출측은 신경 쓸 게 없다.
  renderer.attachPost(host);
  /**
   * 효과음 — 렌더러가 fx 큐를 소비하는 유일한 곳이라 그 훅에서 판정한다.
   * «플레이어가 관여한» 사건만 소리 낸다(봇끼리 점령·격파는 무음 — 한 판 74회는 소음이다).
   */
  renderer.onFx = (e, w) => {
    if (e.kind === 'claim') {
      if (e.unit === w.playerId) sfx.play(e.cells.length > 80 ? 'claimBig' : 'claim');
    } else if (e.kind === 'kill') {
      if (e.by === w.playerId) sfx.play('kill');
      else if (e.unit === w.playerId) sfx.play('death');
    } else if (e.kind === 'land') {
      if (e.unit === w.playerId) sfx.play('bounceLand');
    } else if (e.kind === 'revive') {
      sfx.play('revive');
    }
  };

  function resize(): void {
    dpr = Math.min(window.devicePixelRatio || 1, 3); // 3 초과는 성능 대비 이득 없음
    vw = canvas.clientWidth;
    vh = canvas.clientHeight;
    /**
     * ★ 적응형 렌더 해상도.
     *   이 게임은 CPU 가 아니라 «픽셀 채우기»에 막힌다(실측: rAF 콜백 안 JS 는
     *   프레임 예산의 6~8% 뿐인데, 래스터 경로만 바꾸면 fps 가 10배 갈린다).
     *   그래서 느린 기기에서 가장 정직하게 듣는 손잡이가 백버퍼 픽셀 수다.
     *   dpr 3 짜리 화면이면 1179x2556 = 300만 픽셀인데, 0.72 배로 내리면
     *   156만 픽셀로 절반이 된다.
     *   CSS 크기(clientWidth/Height)는 건드리지 않으므로 레이아웃·터치 좌표·
     *   HUD 는 그대로다. 캔버스는 CSS 로 늘어나며 보간될 뿐이다.
     */
    const eff = dpr * renderer.resScale;
    canvas.width = Math.max(1, Math.round(vw * eff));
    canvas.height = Math.max(1, Math.round(vh * eff));
    g!.setTransform(eff, 0, 0, eff, 0, 0);
    renderer.resize(vw, vh, eff);
  }
  const onResize = () => resize();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  window.addEventListener('tc:safearea', onResize); // safe area 가 바뀌어도 재계산
  resize();

  // ── 세션 상태 ─────────────────────────────────────────────────────────────
  let save: SaveData = { ...DEFAULT_SAVE, bestByMode: {} };
  /** 모드별 최고점(구버전 bestScore 는 '60' 으로 귀속돼 들어온다) */
  let bestByMode: Record<ModeKey, number> = { '60': 0, '180': 0, '300': 0 };
  /** 지금 고른 모드/난이도. 저장은 KEYS.settings(언어와 같은 슬롯)에 합류시킨다. */
  let modeKey: ModeKey = DEFAULT_MODE;
  let difficulty: Difficulty = DEFAULT_DIFFICULTY;
  let world: World | null = null;
  let recorder = new GhostRecorder(MODE_TABLE[DEFAULT_MODE].sec);
  let resultShown = false;
  let booted = false;
  let lastTickSec = -1;

  // ── 입력 (포인터 = 터치/마우스 통합, 좌하단 고정이 아니라 터치 지점 동적 배치) ──
  const pointer = { id: -1, ox: 0, oy: 0, x: 0, y: 0, down: false };
  const onPointer = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    if (e.type === 'pointerdown') {
      sfx.unlock(); // 첫 사용자 제스처 — 오디오 컨텍스트 해제(모바일 자동재생 정책)
      if (pointer.id !== -1) return;
      pointer.id = e.pointerId;
      pointer.ox = px;
      pointer.oy = py;
      pointer.down = true;
      canvas.setPointerCapture?.(e.pointerId);
    } else if (e.pointerId !== pointer.id) {
      return;
    }
    pointer.x = px;
    pointer.y = py;
    if (e.type === 'pointerup' || e.type === 'pointercancel') {
      pointer.id = -1;
      pointer.down = false;
      world?.stopPlayer();
      hud?.setJoystick(false, 0, 0, 0, 0);
    }
    e.preventDefault();
  };
  for (const evt of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const) {
    canvas.addEventListener(evt, onPointer, { passive: false });
  }

  function applyInput(): void {
    if (!world || !pointer.down) return;
    const dx = pointer.x - pointer.ox;
    const dy = pointer.y - pointer.oy;
    const len = Math.hypot(dx, dy);
    // 데드존 8px. 넘어가면 조이스틱 베이스를 따라 끌어 무한 드래그를 허용한다.
    if (len < 8) {
      world.setPlayerAim(world.player.aim, 0);
      hud?.setJoystick(true, pointer.ox, pointer.oy, dx, dy);
      return;
    }
    if (len > 64) {
      pointer.ox += (dx / len) * (len - 64);
      pointer.oy += (dy / len) * (len - 64);
    }
    world.setPlayerAim(Math.atan2(dy, dx), Math.min(1, len / 42));
    hud?.setJoystick(true, pointer.ox, pointer.oy, pointer.x - pointer.ox, pointer.y - pointer.oy);
  }

  // ── HUD ───────────────────────────────────────────────────────────────────
  const hud: Hud = new Hud(host, {
    onRestart: () => {
      sfx.unlock();
      sfx.play('tap');
      hud.hideResult();
      startSession();
    },
    onChangeMode: () => {
      sfx.unlock();
      sfx.play('tap');
      hud.hideResult();
      showMenu();
    },
    onRevive: () => {
      const w = world;
      if (!w || w.phase !== 'revive') return;
      // 두 번째(광고) 제안이면 «광고를 먼저» 본다. 보상 획득 전에는 절대 부활 없음.
      if (w.reviveNeedsAd) {
        runReviveAd();
        return;
      }
      w.useRevive();
      haptic('success');
    },
    onDeclineRevive: () => {
      // 광고가 떠 있는 동안의 클릭은 무시한다(버튼도 disabled 지만 이중 방어).
      if (world?.revivePaused) return;
      world?.declineRevive();
    },
    onResume: () => {
      sfx.play('tap');
      paused = false;
      hud.setPaused(false);
    },
    onBounceDown: () => {
      if (world?.bounceHold()) haptic('tickMedium');
    },
    onBounceMove: (dx, dy) => world?.bounceAim(dx, dy),
    onBounceUp: () => {
      world?.bounceRelease();
      if (world?.player.bounce?.phase === 'fly') sfx.play('bounceGo');
      haptic('basicMedium');
    },
  });

  /**
   * ── 두 번째 부활: 리워드 광고 ──────────────────────────────────────────────
   * President 결정 B안(2026-09-05). 첫 부활은 공짜 그대로, 두 번째만 광고 1회.
   *
   * ★순서가 계약이다:
   *   ① revivePaused = true  → World.update() 가 통째로 멈춘다. 광고 보는 20초가
   *      판 시간을 먹지 않는다(sim.ts revivePaused 주석 참고).
   *   ② 광고 실행. 성공 = `userEarnedReward` «하나뿐»(rewardedAd.ts).
   *   ③ 성공 → 이번 판의 결과화면 이탈 전면광고를 한 번 건너뛰도록 표시한 뒤
   *      (연속 광고 방지) useRevive(). 실패 → declineRevive() = 결과 화면으로.
   * ★중복 방지가 «두 겹»이다: 여기 reviveAdBusy + rewardedAd.ts 의 inFlight.
   *   더블탭·연타로 광고가 두 번 뜨는 일은 어느 쪽이 뚫려도 막힌다.
   */
  let reviveAdBusy = false;
  function runReviveAd(): void {
    const w = world;
    if (!w || w.phase !== 'revive' || !w.reviveNeedsAd || reviveAdBusy) return;
    reviveAdBusy = true;
    w.revivePaused = true; // ★게임 정지가 «광고 요청보다 먼저»여야 한다
    void showReviveAd().then((earned) => {
      reviveAdBusy = false;
      const cur = world;
      // 광고를 보는 사이에 판이 갈렸으면(재시작·모드변경) 아무것도 하지 않는다.
      if (!cur || cur !== w || cur.phase !== 'revive') return;
      cur.revivePaused = false;
      if (earned) {
        // ★리워드 직후 전면광고 = 연속 광고. 이번 판 결과 이탈에서 한 번 건너뛴다.
        //   (빚·판 계수는 그대로 — adGate.suppressNextInterstitial 주석 참고)
        suppressNextInterstitial();
        cur.useRevive();
        haptic('success');
      } else {
        // 보상 미획득(중도 닫음·실패·타임아웃) = 부활 없음. 결과 화면으로 간다.
        cur.declineRevive();
      }
    });
  }

  // ── 햅틱 (연출 품질 직결. 단 남발하면 브릿지가 막힌다 — 최소 간격 90ms) ────
  let lastHaptic = 0;
  /**
   * ★ 단일 게이트 (President 지시: 진동 제거). 호출부 7곳은 «그대로 뒀다» —
   *   흩어 지우면 되돌리기 어렵고 감사 grep 도 깨진다. 여기 한 줄로 끈다.
   *   되살리려면 HAPTIC_ENABLED = true. URL 로도 켤 수 있다: ?haptic=on
   *
   * ⚠ 실측 기록 — 이 게이트가 President 가 말한 「진동」인지는 «불확실»하다.
   *   한 판(60초, 봇끼리 6킬, 플레이어 미개입)에서 «햅틱 호출 0회»였다.
   *   우리 코드는 «플레이어가 관여한» 격파에만 햅틱을 건다(kills/deaths 증가).
   *   즉 「애들끼리 죽일 때」는 네이티브 진동을 «아예 안 부른다».
   *   같은 판에서 «카메라 셰이크»는 프레임의 76% 에서 켜져 있었다 →
   *   President 가 본 「진동」은 그쪽일 가능성이 높다(render.ts SHAKE_SCALE_DEFAULT).
   *   둘 다 껐다. 어느 쪽이 원인이었는지는 실기기 회신으로 가른다.
   */
  const HAPTIC_ENABLED = new URLSearchParams(location.search).get('haptic') === 'on';
  function haptic(type: HapticFeedbackType): void {
    if (!HAPTIC_ENABLED) return;
    const now = performance.now();
    if (now - lastHaptic < 90) return;
    lastHaptic = now;
    // ⚠ .catch 필수. generateHapticFeedback 은 raw 브릿지라 토스 밖(브라우저·
    //   플레이스토어 APK)에서 reject 한다. void 만 붙이면 unhandled rejection
    //   이 매 입력마다 터진다(실측). 햅틱 실패로 게임이 시끄러워지면 안 된다.
    generateHapticFeedback({ type }).catch(() => {});
  }

  // ── 뒤로가기: 플레이 중이면 먹고 일시정지 ─────────────────────────────────
  const popBack = pushBackHandler(() => {
    if (running && !paused && world && world.phase !== 'over') {
      paused = true;
      hud.setPaused(true);
      haptic('tickWeak');
      console.log('[game] paused by back button');
      trackScreenView('pause'); // 비플레이 화면 진입
      return true; // 소비 → 미니앱 안 닫힘
    }
    return false; // 일시정지 상태에서 한 번 더 누르면 종료 확인 모달
  });

  // ── 앱이 백그라운드로 갈 때 저장 플러시 ───────────────────────────────────
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      if (!paused) trackScreenView('pause'); // 뒤로가기로 이미 일시정지된 경우 중복 방지
      paused = true;
      hud.setPaused(true);
      sfx.suspend();
      void writer.flush();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  // ── 메뉴 ──────────────────────────────────────────────────────────────────
  /** 조용한 실패 카운터 — try/catch 로 감쌌으면 세어서 드러내야 한다. */
  let settingsWriteFailures = 0;
  let settingsReadFailures = 0;

  const menu = new Menu(host, {
    onStart: (m, d) => {
      sfx.unlock();
      sfx.play('tap');
      modeKey = m;
      difficulty = d;
      void persistChoice();
      menu.hide();
      startSession();
    },
    onStartDailyClash: () => {
      sfx.unlock();
      sfx.play('tap');
      menu.hide();
      startDailyClash();
    },
  });

  /**
   * 효과음 설정 — KEYS.settings 에 «합류»(언어·모드와 같은 슬롯, read-modify-write).
   * 없으면 켜짐(기존 저장본 호환 — 새 필드는 없으면 기본값).
   */
  setSoundPersist((on) => {
    void (async () => {
      try {
        const prev = await storage.getJSON<Record<string, unknown>>(KEYS.settings, {});
        await storage.setJSON(KEYS.settings, { ...prev, sound: on });
      } catch (err) {
        settingsWriteFailures++;
        console.warn('[game] failed to persist sound:', err);
      }
    })();
  });

  function showMenu(): void {
    world = null; // 메뉴 중에는 시뮬을 돌리지 않는다(배경만 그린다)
    hud.setHidden(true);
    menu.show({ mode: modeKey, difficulty, bestByMode });
    trackScreenView('menu'); // 비플레이 화면(모드·난이도·언어 선택)
    void refreshDailyClashCard();
  }

  /**
   * 오늘의 대결 카드 새로고침. 저장을 건드리지 않는다(읽기 전용).
   * ★실패해도 게임은 계속된다 — 카드만 숨김/스켈레톤 상태로 남는다.
   */
  async function refreshDailyClashCard(): Promise<void> {
    try {
      const info = await dailyClashInfo();
      menu.setDailyClash(info);
    } catch (err) {
      console.warn('[game] daily clash info load failed:', err);
      menu.setDailyClash(null);
    }
  }

  /**
   * 모드·난이도 선택을 KEYS.settings 에 «합류»시킨다(언어와 같은 슬롯).
   * ★ 반드시 read-modify-write 다. 통째로 덮으면 저장된 언어가 날아간다.
   * ★ 실패해도 게임은 계속된다 — 이번 세션 동안은 선택이 유지된다.
   */
  async function persistChoice(): Promise<void> {
    try {
      const prev = await storage.getJSON<Record<string, unknown>>(KEYS.settings, {});
      await storage.setJSON(KEYS.settings, { ...prev, mode: modeKey, difficulty });
    } catch (err) {
      settingsWriteFailures++;
      console.warn('[game] failed to persist mode/difficulty:', err);
    }
  }

  // ── 부팅: 저장 로드 → 메뉴 ───────────────────────────────────────────────
  void (async () => {
    // 모드 표가 렌더러 제약(팩션 수)을 지키는지 «실제로» 검사한다.
    // 어기면 그 유닛의 영토가 예외도 로그도 없이 안 그려진다 — 그러니 여기서 운다.
    const badModes = assertModeTable(FACTIONS.length);
    if (badModes.length) console.error('[modes] INVALID MODE TABLE:', badModes.join(' | '));

    try {
      save = await loadSave(ctx.identity.userKey);
      bestByMode = await loadBestByMode(save);
    } catch (err) {
      console.warn('[game] save load failed, using defaults', err);
    }
    try {
      const settings = await storage.getJSON<{ mode?: unknown; difficulty?: unknown; sound?: unknown }>(
        KEYS.settings,
        {}
      );
      modeKey = asModeKey(settings.mode) ?? DEFAULT_MODE;
      difficulty = asDifficulty(settings.difficulty) ?? DEFAULT_DIFFICULTY;
      if (settings.sound === false) setSoundEnabled(false);
    } catch (err) {
      settingsReadFailures++;
      console.warn('[game] settings load failed, using defaults', err);
    }
    booted = true;
    showMenu();
    console.log(
      `[game] boot ok. best=${bestByMode[DEFAULT_MODE]} plays=${save.plays} nick=${save.nick}` +
        ` mode=${modeKey} diff=${difficulty}` +
        ` best60=${bestByMode['60']} best180=${bestByMode['180']} best300=${bestByMode['300']}` +
        ` settingsFail=${settingsReadFailures + settingsWriteFailures}`
    );
  })();

  /**
   * 오늘의 맵 4종 중 하나. 고스트는 같은 시드에서만 유효하다(§3-E).
   * ★ 모드가 달라지면 맵 «치수»가 달라져 같은 시드라도 다른 판이다.
   *   그래서 고스트 재생 조건에 mode 를 같이 건다(startSession 참고).
   * ★ dailyClashSeedOverride 가 있으면(=오늘의 대결 세션) 그 값을 대신 쓴다.
   *   이 함수의 «기존 자유 플레이 계산식은 한 글자도 안 바뀐다» — 오늘의
   *   대결은 이 함수 위에 조건 하나를 얹었을 뿐이다(dailyClash.ts 주석 참고:
   *   dailySeed() 는 기기 로컬 시간대라 KST 기준 오늘의 대결과 날짜 경계가
   *   다를 수 있는데, 그건 자유 플레이 쪽을 건드리지 않기 위한 의도된 트레이드오프다).
   */
  function sessionSeed(): number {
    if (dailyClashSeedOverride != null) return dailyClashSeedOverride;
    return dailySeed() * 10 + (save.plays % 4);
  }

  /** ★오늘의 대결 세션 진행 중 표시. endSession() 이 완료 판정·코인 보너스에 쓴다. */
  let dailyClashActive = false;
  /** sessionSeed() 가 이 값이 있으면 우선한다. startDailyClash() 안에서만 잠깐 켰다 끈다. */
  let dailyClashSeedOverride: number | null = null;

  /**
   * 오늘의 대결 — 모드·난이도를 이 세션 «하나»만 고정값으로 바꿔치기해
   * startSession() 을 그대로 재사용한다. ★자유 플레이 경로 무접촉:
   *   startSession() 은 완전히 동기(중간에 await 이 없다) 함수라, 호출
   *   «직후»에 modeKey/difficulty/시드 오버라이드를 원래대로 되돌려도
   *   이 세션의 World 구성엔 전혀 영향이 없다. 그래서 사용자의 평소
   *   자유 플레이 설정(메뉴에서 고른 모드·난이도)은 이 함수 실행 전후로
   *   «한 프레임도» 바뀌어 보이지 않는다.
   */
  function startDailyClash(): void {
    const savedMode = modeKey;
    const savedDifficulty = difficulty;
    modeKey = DAILY_CLASH_MODE; // '60' — 형평성 근거는 dailyClash.ts 참고(평균 세션 95초 실측에 맞춤)
    difficulty = DAILY_CLASH_DIFFICULTY; // 'hard' 고정 — 난이도 상향폭 근거도 dailyClash.ts 참고(+37.5%)
    dailyClashSeedOverride = dailyClashSeed(kstDateKey(nowMs())); // KST 기준 — 전 유저 공통 보드
    dailyClashActive = true;
    startSession();
    modeKey = savedMode;
    difficulty = savedDifficulty;
    dailyClashSeedOverride = null;
  }

  function startSession(): void {
    const spec = modeOf(modeKey);
    const seed = sessionSeed();
    const pool = save.ghostOptOut
      ? []
      : save.ghosts
          // ★ 모드까지 같아야 유효하다. 맵 치수가 다르면 리플레이는 무의미하다.
          .filter((r) => r.seed === seed && r.data && ghostMode(r) === modeKey)
          .slice(-spec.ghostSlots)
          // 고스트는 전부 '내' 과거 리플레이다(저장 시 save.nick 을 박아 넣는다).
          // 저장된 문자열 대신 현재 닉네임을 쓰면 언어를 바꿔도 예전 언어로 굳은
          // 이름이 남지 않는다.
          .map((r) => ({ nick: save.nick, frames: decodeGhost(r.data) }))
          .filter((r) => r.frames.length > 100);

    // ★ 순서가 중요하다: 아레나 치수 → 렌더/HUD 캐시 무효화 → World 생성.
    //   Grid 가 생성자에서 NCELL 크기 배열을 잡기 때문에 setArena 가 먼저다.
    if (setArena(spec.cols, spec.rows)) renderer.resetForArena();
    hud.setMode(spec);

    trackRunStart(modeKey); // ★계측: 판 시작(세션 내 순번 — 「2번째 판」은 run_no===2 로 뽑힌다)
    world = new World(seed, pool, spec);
    /**
     * ★광고 부활 가용성은 «판 시작 시 한 번» 확정한다(판 도중 바뀌지 않는다).
     *   지면 ID 가 비었거나(콘솔 지면 미생성) SDK 가 리워드를 지원하지 않는
     *   환경(웹·스토어 빌드)이면 false → 두 번째 제안이 «존재하지 않는다».
     *   즉 이 값이 false 인 동안 부활 동작은 라이브와 완전히 동일하다.
     */
    world.adReviveAvailable = reviveAdAvailable();
    // 온보딩 보정: 1~3판째는 무조건 하위 레벨 (§3-E — 첫 승리가 D1 최대 변수)
    const avg =
      save.plays < 3 || save.recentRanks.length === 0
        ? 8
        : save.recentRanks.reduce((a, b) => a + b, 0) / save.recentRanks.length;
    // 난이도가 'auto' 가 아니면 여기서 recentRanks 는 «쓰이지 않는다» — 수동이 이긴다.
    world.applyDifficulty(difficulty, avg);
    recorder = new GhostRecorder(spec.sec);
    resultShown = false;
    paused = false;
    hud.setHidden(false);
    hud.setPaused(false);
    pointer.id = -1;
    pointer.down = false;
    hud.setJoystick(false, 0, 0, 0, 0);
  }

  async function endSession(w: World): Promise<void> {
    resultShown = true;
    // ★멱등 가드: 오늘의 대결 플래그를 여기서 «즉시»(await 전에) 소비한다.
    //   재진입해도 두 번 보상되지 않는다(resultShown 가드와 같은 이유).
    const isDailyClash = dailyClashActive;
    dailyClashActive = false;
    const mode = w.mode.key;
    const rank = w.rankOf(w.playerId);
    const p = w.player;
    sfx.play(rank === 1 ? 'win' : 'over');
    // ★계측: 성공·실패 구분 — 이 게임은 승패가 아니라 '판이 끝날 때까지
    //   생존했는가'로 가른다(부활 소진 후 탈락 = fail, 시간 만료까지 생존 = success).
    trackRunEnd(p.alive ? 'success' : 'fail', mode);
    const score = Math.round(p.score);
    const bonus = [400, 220, 140, 60, 60, 60, 60, 60][rank - 1] ?? 60;
    const coins = Math.floor(score * 0.05) + bonus;
    const xp = Math.floor(score * 0.6) + (rank === 1 ? 300 : rank <= 3 ? 150 : 0);

    /**
     * ★오늘의 대결 완료 처리 — «승패 무관»(여기 도달한 것 자체가 phase='over',
     *   즉 완료다). 코인은 «덤»으로 이번 판 coins 에 합산한다(별도 결과화면
     *   UI를 새로 만들지 않는다 — hud.ts ResultData 무접촉, 기존 coins 필드에
     *   자연스럽게 얹는다). 오늘 이미 완료했으면 dcBonus=0(멱등, save.ts 쪽의
     *   recordDailyClashCompletion 자체 멱등 가드도 있다 — 이중 안전).
     */
    let dcBonus = 0;
    if (isDailyClash) {
      try {
        const dc = await recordDailyClashCompletion();
        dcBonus = dc.coinsAwarded;
      } catch (err) {
        console.warn('[game] daily clash completion record failed:', err);
      }
    }
    /**
     * ★ 최고점은 «같은 모드끼리만» 겨룬다.
     *   5분 판은 점수가 구조적으로 훨씬 크다. 한 칸에 몰아 넣으면 1분 최고기록이
     *   덮이고 그 뒤로 영영 갱신이 안 된다.
     */
    const prevBest = bestByMode[mode] ?? 0;
    const newBest = score > prevBest;
    if (newBest) bestByMode[mode] = score;
    const best = bestByMode[mode] ?? 0;

    // 저장 (규칙 A: 루프 밖 + coalesced writer 만 사용)
    save.plays += 1;
    /**
     * ── 프로모션 리워드: 「3판 플레이 «완료»」 → 100원 (★2026-08-26 신설) ──
     * ★판정을 «새로 만들지 않았다». `save.plays` 는 원래 있던 필드다
     *   (save.ts: 「총 플레이 판수 (온보딩 보정 판정용, §3-E)」). 여기가 그
     *   유일한 증가 지점이고, 여기 도달했다는 것 자체가 phase='over' = «완료»다.
     *   ⇒ 승패·등수와 «무관»하다. 토스 심사 체크리스트의 금지 항목
     *     「포인트가 게임 결과나 등수를 기준으로 정해지지 않나요?」를 피한다.
     * ★ `>= 3` 이지 `=== 3` 이 아니다 — 3판째에 지급이 실패(네트워크·일시적
     *   프로모션 중지)했으면 4판째·5판째에 «다시 시도»되어야 한다. `=== 3`
     *   이면 단 한 번의 실패로 그 유저는 영영 못 받는다.
     *   중복 지급은 claimReward() 안의 로컬 기록 + 토스 4113 이 막는다.
     * ★ fire-and-forget: await 하지 «않는다». 지급이 느리거나 실패해도
     *   결과 화면(hud.showResult)이 밀리면 안 된다. claimReward 는 절대
     *   throw 하지 않는다(promotion.ts 계약).
     */
    if (save.plays >= 3) void claimReward();
    /**
     * ── 프로모션 리워드 ③: 「10판 플레이하기」 → 100원 (★2026-09-09 신설) ──
     * ★①(3판)과 «완전히 독립»이다. 한 사람이 둘 다 받는다. 저장키·in-flight
     *   락·DOM 속성이 전부 따로다(toss/promotion.ts 의 두 인스턴스).
     * ★순서: 3판 «먼저», 10판 «다음». 둘 다 fire-and-forget 이라 실제 완료
     *   순서는 브릿지가 정하지만, «요청을 내보내는» 순서는 여기서 고정한다.
     *   plays 가 한 번에 3→10 으로 뛸 일은 없지만(1씩 증가) 저장이 조작되면
     *   같은 판에서 둘 다 열릴 수 있다 — 그때도 3판이 먼저 나간다.
     * ★ `>= 10` 이지 `=== 10` 이 아니다. 이유는 위 3판 주석과 같다 —
     *   10판째 지급이 실패해도 11·12판째에 다시 시도돼야 한다.
     */
    /**
     * ★문턱을 «상수 10 으로 박지 않는다». requiredPlays10() 이 body 의
     *   `data-promo2-testonly` 를 보고 정한다 — 정본은 10, TESTONLY 빌드만 1.
     *   (프로모션 `isTested` 를 켜려면 실기기에서 «실제로» 지급이 나가야 하는데
     *    10판을 매번 돌리는 건 현실적이지 않다. President 지시 2026-09-10.)
     *   ⛔완화 플래그가 든 빌드는 «절대» 검수에 넣지 않는다(파일명 `_TESTONLY`).
     */
    if (save.plays >= requiredPlays10()) void claimReward10();
    /**
     * ── 프로모션 리워드 ②: 「3일 «연속» 플레이하기」 → 50원 (★2026-09-01 신설) ──
     * ★위 ①(3판 플레이 완료)과 «완전히 독립»이다. 한 사람이 둘 다 받을 수 있고,
     *   ①이 실패하거나 예산이 소진돼도 ②는 그대로 지급돼야 한다.
     *   ⇒ 저장키·in-flight 락·DOM 속성이 전부 따로다(toss/promoStreak.ts).
     * ★「플레이」의 정의를 ①과 «같은 지점»으로 맞췄다 — save.plays 가 오르는
     *   바로 이 자리. 새 카운터를 만들지 않았다. 승패·등수 무관.
     * ★날짜 판정은 KST 고정 오프셋(lib/daykey.ts) + 토스 서버시각 스큐.
     * ★ fire-and-forget: await 하지 «않는다». 결과 화면이 밀리면 안 된다.
     *   recordPlayAndClaim 은 절대 throw 하지 않는다(promoStreak.ts 계약).
     */
    void recordPlayAndClaim();
    /**
     * MMR-lite 표본은 «자동 난이도»에서만 모은다.
     *  · 사용자가 난이도를 직접 골랐다면 그 결과는 실력 추정치가 아니다.
     *  · 참가자 수가 모드마다 달라 순위 눈금도 다르다 → 6인 기준으로 환산해
     *    넣는다(1분 모드는 participants=6 이라 환산이 항등 = 예전과 같은 값).
     */
    if (difficulty === 'auto') {
      const norm =
        w.participants > 1 ? 1 + ((rank - 1) * 5) / (w.participants - 1) : 1;
      save.recentRanks = [...save.recentRanks, Math.round(norm)].slice(-5);
    }
    save.coins += coins + dcBonus;
    save.totalCells += w.grid.cellCount[p.id]!;
    // 통산 누적. ★ writer.set(KEYS.progress) 보다 반드시 앞에 와야 한다 —
    //   아래 set 이 이 시점의 save 를 직렬화하므로, 뒤로 가면 한 판씩 밀린다.
    save.xp += xp;
    save.totalKills += p.kills;
    save.bestTrail = Math.max(save.bestTrail, p.maxTrail);
    if (rank === 1) save.wins += 1;
    if (!save.ghostOptOut && recorder.length > 200) {
      save.ghosts = [
        ...save.ghosts,
        { nick: save.nick, seed: w.seed, data: encodeGhost(recorder.bytes()), mode },
      ].slice(-4);
    }
    save.bestByMode = { ...save.bestByMode, [mode]: bestByMode[mode] ?? 0 };
    writer.set(KEYS.progress, save);
    /**
     * ★ 구버전 키(KEYS.bestScore)는 «1분 기록일 때만» 갱신한다.
     *   여기에 3·5분 점수를 쓰면, 구버전으로 롤백했을 때 1분 최고기록 자리에
     *   5분 점수가 앉아 영영 갱신 불가가 된다 — 우리가 막으려던 바로 그 사고다.
     *   1분 기록만 계속 써 주면 롤백해도 사용자가 잃는 게 없다.
     */
    if (newBest && mode === DEFAULT_MODE) writer.set(KEYS.bestScore, score);
    void writer.flush();

    hud.showResult({
      mode,
      rank,
      total: w.participants,
      score,
      best,
      newBest,
      cells: w.grid.cellCount[p.id]!,
      kills: p.kills,
      maxTrail: p.maxTrail,
      coins: coins + dcBonus,
      xp,
      career: {
        plays: save.plays,
        wins: save.wins,
        xp: save.xp,
        kills: save.totalKills,
      },
    });
    haptic(rank === 1 ? 'confetti' : 'success');
  }

  // ── 루프 ──────────────────────────────────────────────────────────────────
  let last = performance.now();
  function loop(now: number): void {
    if (!running) return;
    const ms = now - last;
    const dt = Math.min(ms / 1000, 1 / 20); // 프레임 드랍 시 물리 폭주 방지
    last = now;

    if (!paused) {
      update(dt);
    }
    draw(dt);
    // 후처리 품질 감시 — 플레이 중 프레임 간격만(메뉴·일시정지는 제외). 렌더에만 영향, 판정 무관.
    if (world && world.phase === 'play' && !paused) renderer.samplePlayFrame(ms);
    // 렌더러가 "해상도를 내려야겠다"고 판정했으면 여기서 캔버스를 다시 잡는다.
    if (renderer.consumeResDirty()) resize();

    rafId = requestAnimationFrame(loop);
  }

  function update(dt: number): void {
    const w = world;
    if (!w) return;
    applyInput();
    const beforeKills = w.player.kills;
    const beforeDeaths = w.player.deaths;
    w.update(dt);

    // 고스트 리플레이 기록 (§3-E) — 20Hz, 옵트아웃 시 미수집
    if (!save.ghostOptOut && w.phase === 'play') {
      recorder.tick(dt, w.player.aim, w.player.throttle);
    }

    if (w.player.kills > beforeKills) haptic('success');
    if (w.player.deaths > beforeDeaths) haptic('error');
    // 막판 3초 틱(정보 — 화면 깜빡임이 아니라 소리)
    if (w.phase === 'play') {
      const sec = Math.ceil(w.timeLeft);
      if (sec <= 3 && sec > 0 && sec !== lastTickSec) {
        lastTickSec = sec;
        sfx.play('tick');
      }
    }

    if (w.phase === 'over' && !resultShown) void endSession(w); // async(오늘의 대결 완료 기록) — fire-and-forget, resultShown 가드는 이미 동기로 걸렸다
  }

  function draw(dt: number): void {
    const inset = readInsetPx();
    if (!world || !booted) {
      // 메뉴/스플래시에는 비네트가 «없는» 게 기존 동작이다. 오버레이를 감춘다.
      renderer.setPostLayerVisible(false);
      drawSplash(inset.top);
      return;
    }
    renderer.setPostLayerVisible(true);
    renderer.draw(world, dt);
    hud.update(world, dt);
  }

  /**
   * 저장 로드 대기 동안의 스플래시. 흰 화면은 최악의 실패라 배경부터 깐다.
   * ★ 메뉴가 떠 있을 때는 «배경만» 그린다 — 제목·부제는 메뉴 시트가 들고 있어서
   *   그대로 두면 같은 글자가 두 겹으로 겹쳐 보인다.
   */
  function drawSplash(insetTop: number): void {
    g!.setTransform(dpr * renderer.resScale, 0, 0, dpr * renderer.resScale, 0, 0);
    const lg = g!.createLinearGradient(0, 0, 0, vh);
    lg.addColorStop(0, PAL.void1);
    lg.addColorStop(1, PAL.void0);
    g!.fillStyle = lg;
    g!.fillRect(0, 0, vw, vh);
    if (menu.visible) return;
    const spec = modeOf(modeKey);
    g!.fillStyle = PAL.ink0;
    g!.font = '900 30px system-ui, -apple-system, sans-serif';
    g!.textAlign = 'center';
    g!.fillText(t('game.title'), vw / 2, Math.max(insetTop + 120, vh * 0.42));
    g!.font = '700 12px system-ui, -apple-system, sans-serif';
    g!.fillStyle = PAL.ink2;
    g!.fillText(
      t('splash.subtitle', {
        cols: fmt(spec.cols),
        rows: fmt(spec.rows),
        players: fmt(spec.participants),
        seconds: fmt(spec.sec),
      }),
      vw / 2,
      Math.max(insetTop + 148, vh * 0.42 + 28)
    );
  }

  rafId = requestAnimationFrame(loop);

  /**
   * 검증 훅(?diag=1 에서만) — 헤드리스 하네스가 결과 화면·후처리 상태를 «읽는» 용도.
   * 기본 URL 에서는 만들어지지 않는다. 게임 로직은 건드리지 않는다(강제 종료는 sim.finish 그대로).
   */
  if (new URLSearchParams(location.search).get('diag') === '1') {
    (window as unknown as { __tcDiag: unknown }).__tcDiag = {
      phase: () => world?.phase ?? 'none',
      finish: () => world?.finish(),
      post: () => {
        const p = renderer.post;
        return p
          ? {
              supported: p.supported,
              on: p.on,
              q: p.q,
              sdpr: p.sdpr,
              frames: p.frames,
              autoOff: p.autoOff,
              qlog: p.qlog,
              tierMs: p.tierMs,
              promos: p.promos,
              fading: p.fading,
              sceneW: p.scene.width,
              sceneH: p.scene.height,
            }
          : null;
      },
      quality: () => renderer.quality,
      stats: () => renderer.stats,
      canvas: () => ({ w: canvas.width, h: canvas.height, dpr, res: renderer.resScale }),
      probe: (on: boolean) => {
        if (renderer.post) renderer.post.probe = on;
      },
      energy: () => (renderer.post ? renderer.post.energyLog : []),
      cam: () => renderer.camPos(),
      scene: () => renderer.sceneCanvas(),
      timeLeft: () => world?.timeLeft ?? -1,
      /**
       * 부활 상태 읽기 (?diag=1 전용). 헤드리스 하네스가 「무료 / 광고 / 로딩」
       * 세 화면을 실렌더로 찍는 데 쓴다.
       */
      revive: () =>
        world
          ? {
              phase: world.phase,
              used: world.revivesUsed,
              needsAd: world.reviveNeedsAd,
              paused: world.revivePaused,
              offer: world.reviveOffer,
              adAvailable: world.adReviveAvailable,
            }
          : null,
      /**
       * 부활 플래그 «주입». ★광고 SDK 는 부르지 않는다 — 화면만 그 상태로 만든다.
       *   운영 경로(onRevive → runReviveAd)는 이 훅을 쓰지 않는다.
       */
      setRevive: (o: { adAvailable?: boolean; needsAd?: boolean; paused?: boolean }) => {
        const w = world;
        if (!w) return;
        if (o.adAvailable !== undefined) w.adReviveAvailable = o.adAvailable;
        if (o.needsAd !== undefined) w.reviveNeedsAd = o.needsAd;
        if (o.paused !== undefined) w.revivePaused = o.paused;
      },
      /**
       * 플레이어를 «실제 사망 경로»로 탈락시킨다 — 영토를 전부 비운 뒤 kill().
       * §3-D 완전 봉쇄가 유일한 탈락 조건이라, 테스트 전용 분기를 sim 에
       * 만들지 않고 그 조건을 그대로 만들어 준다.
       */
      killPlayer: () => {
        const w = world;
        if (!w) return;
        const p = w.player;
        p.invuln = 0;
        p.respawn = 0;
        for (let i = 0; i < w.grid.owner.length; i++) {
          if (w.grid.owner[i] === w.playerId) w.grid.owner[i] = -1;
        }
        w.grid.markDirty();
        (w as unknown as { kill(v: typeof p, a: null): void }).kill(p, null);
      },
    };
  }

  return {
    stop(): void {
      running = false;
      cancelAnimationFrame(rafId);
      popBack();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.removeEventListener('tc:safearea', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const evt of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const) {
        canvas.removeEventListener(evt, onPointer);
      }
      hud.destroy();
      menu.destroy();
      void writer.flush();
      void storage.getItem(KEYS.sdkSelfTest); // no-op 참조: storage 임포트 유지 근거
    },
  };
}
