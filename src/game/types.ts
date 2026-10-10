/** sim / bots / render / hud 가 공유하는 타입. 순환 import 방지용 분리. */

export type UnitKind = 'player' | 'bot' | 'ghost';

export interface Vec2 {
  x: number;
  y: number;
}

/** 튕기기(USP-A) 상태 머신 */
export interface BounceState {
  /** aim = 조준 중(슬로우), fly = 비행 중 */
  phase: 'aim' | 'fly';
  /** 0,1,2 — 3탄까지 */
  shot: number;
  /** 폐다각형 시작점(발동 위치) */
  origin: Vec2;
  /** 착지점 누적 */
  land: Vec2[];
  /** 현재 탄의 비행 폴리라인(반사점 포함) */
  path: Vec2[];
  /** path 위 진행 거리 */
  travelled: number;
  /** path 전체 길이 */
  total: number;
  /** 재조준 창 잔여(실시간 초). 0 이하 = 실패 */
  windowT: number;
  /** 조준 각 / 파워(셀) */
  aimAngle: number;
  aimPower: number;
  /** 사용자가 실제로 드래그를 시작했는가(미조작 릴리스 방지) */
  dragged: boolean;
  /** 봇/고스트의 자동 튕기기 — 조준 UI·슬로우 없이 큐대로 발사 */
  auto: boolean;
  queue: Array<{ angle: number; power: number }>;
  /** 자동 발사 대기 시간 */
  autoWait: number;
}

export interface GhostPlayback {
  /** 20Hz 각도 스트림(0~255 → rad) */
  frames: Uint8Array;
  cursor: number;
  acc: number;
  /** 리플레이 이탈 → 봇 AI 전환 (§3-E 하이브리드 폴백) */
  fellBack: boolean;
}

export interface BotState {
  /** 반응 지연 타이머 */
  think: number;
  /** 현재 목표 셀 */
  target: number;
  /** 귀환 모드 */
  returning: boolean;
  /** 이번 판 튕기기 성공 의도 여부 */
  bounceIntent: boolean;
  bounceTimer: number;
}

export interface Unit {
  id: number;
  kind: UnitKind;
  name: string;
  /** 세션 내 생존. false = 탈락(완전 봉쇄) */
  alive: boolean;

  x: number;
  y: number;
  heading: number;
  aim: number;
  /** 입력 강도 0..1 (조이스틱 기울기) */
  throttle: number;
  /** 현재 셀이 내 영역 밖인가 */
  outside: boolean;
  /** 영역 밖 체류 시간(경고 UI 용) */
  outsideT: number;
  /** 직전 프레임의 셀 인덱스(셀 진입 이벤트 판정용) */
  lastCell: number;

  trail: number[];
  trailSet: Uint8Array;
  pts: Vec2[];

  respawn: number;
  invuln: number;
  lastDeathAt: number;

  gauge: number;
  cd: number;
  slowT: number;
  bounce: BounceState | null;

  score: number;
  kills: number;
  deaths: number;
  maxTrail: number;

  roll: number;
  rollT: number;
  squash: number;
  speedView: number;

  botLv: number;
  ai: BotState;
  ghost: GhostPlayback | null;
}

export type FxKind = 'claim' | 'kill' | 'death' | 'land' | 'revive' | 'bounceStart';

export interface FxEvent {
  kind: FxKind;
  unit: number;
  by: number;
  x: number;
  y: number;
  cells: number[];
}
