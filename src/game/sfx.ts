/**
 * 효과음 — ZzFX(Frank Force, MIT) 생성기 인라인. 파일 0 · 의존성 0.
 *
 * 이 게임에는 원래 소리가 «없었다»(AudioContext 0건). 2026-08-30 그래픽 고도화에서
 * 「주스」의 일부로 붙였다. 규칙:
 *   · AudioContext 는 «첫 사용자 제스처 뒤»에만 만든다(모바일 자동재생 정책). 그 전
 *     호출은 조용히 버린다 — 게임 로직·프레임과 무관하다.
 *   · 키별 버퍼를 1회 생성해 캐시한다(런타임 할당 0). 재생은 BufferSource 하나.
 *   · 90ms 안에 같은 키가 또 오면 버린다(봇 6~10명이 동시에 점령하면 소리가 겹쳐 터진다).
 *   · 소리는 «플레이어가 관여한» 사건에만 낸다. 봇끼리의 점령·격파는 무음이다 —
 *     한 판 74회(실측)나 되는 사건마다 소리를 내면 소음이다.
 *   · 끄기: setEnabled(false). 설정 저장은 index.ts 가 KEYS.settings 에 합류시킨다.
 */

export type SfxKey =
  | 'tap'
  | 'claim'
  | 'claimBig'
  | 'kill'
  | 'death'
  | 'bounceGo'
  | 'bounceLand'
  | 'tick'
  | 'over'
  | 'win'
  | 'revive';

/* ZzFX 파라미터: [volume, randomness, frequency, attack, sustain, release, shape, shapeCurve,
   slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay,
   sustainVolume, decay, tremolo] — 생략은 기본값. */
const TABLE: Record<SfxKey, number[]> = {
  tap: [0.45, 0, 880, 0, 0.02, 0.05, 0, 1.6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0.01],
  claim: [0.55, 0, 440, 0.01, 0.07, 0.16, 0, 1.4, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0.03],
  claimBig: [0.65, 0, 280, 0.02, 0.12, 0.28, 0, 1.2, 7, 0, 120, 0.06, 0, 0, 0, 0, 0, 0.8, 0.05],
  kill: [0.7, 0, 190, 0, 0.05, 0.22, 3, 1.8, -4, 0, 0, 0, 0, 0.5, 0, 0, 0, 0.7, 0.05],
  death: [0.7, 0, 320, 0.02, 0.14, 0.42, 1, 1.4, -8, 0, 0, 0, 0, 0.25, 0, 0.15, 0, 0.6, 0.08],
  bounceGo: [0.55, 0, 520, 0.01, 0.05, 0.12, 0, 1.6, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0.02],
  bounceLand: [0.55, 0, 210, 0, 0.03, 0.11, 2, 1.2, 0, 0, 0, 0, 0, 0.35, 0, 0, 0, 0.6, 0.03],
  tick: [0.4, 0, 1180, 0, 0.02, 0.04, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.01],
  over: [0.7, 0, 196, 0.05, 0.28, 0.5, 0, 1.2, 0, 0, -42, 0.22, 0, 0, 0, 0, 0, 0.8, 0.1],
  win: [0.7, 0, 392, 0.02, 0.18, 0.4, 0, 1.3, 0, 0, 131, 0.12, 0, 0, 0, 0, 0, 0.8, 0.06],
  revive: [0.6, 0, 330, 0.02, 0.2, 0.32, 0, 1.3, 4, 0, 80, 0.1, 0, 0, 0, 0, 0, 0.7, 0.05],
};

const RATE = 44100;
const MASTER = 0.3;

/** ZzFX v1.2 생성기(원본 알고리즘 그대로, 타입만 붙였다). */
function zzfxG(
  volume = 1,
  randomness = 0.05,
  frequency = 220,
  attack = 0,
  sustain = 0,
  release = 0.1,
  shape = 0,
  shapeCurve = 1,
  slide = 0,
  deltaSlide = 0,
  pitchJump = 0,
  pitchJumpTime = 0,
  repeatTime = 0,
  noise = 0,
  modulation = 0,
  bitCrush = 0,
  delay = 0,
  sustainVolume = 1,
  decay = 0,
  tremolo = 0
): Float32Array {
  const PI2 = Math.PI * 2;
  const sign = (v: number) => (v > 0 ? 1 : -1);
  const startSlide = (slide *= (500 * PI2) / RATE / RATE);
  const startFrequency = (frequency *= ((1 + randomness * 2 * Math.random() - randomness) * PI2) / RATE);
  let b = [] as number[];
  let t = 0;
  let tm = 0;
  let i = 0;
  let j = 1;
  let r = 0;
  let c = 0;
  let s = 0;
  let f: number;
  let length: number;

  attack = attack * RATE + 9;
  decay *= RATE;
  sustain *= RATE;
  release *= RATE;
  delay *= RATE;
  deltaSlide *= (500 * PI2) / RATE ** 3;
  modulation *= PI2 / RATE;
  pitchJump *= PI2 / RATE;
  pitchJumpTime *= RATE;
  repeatTime = (repeatTime * RATE) | 0;

  for (length = (attack + decay + sustain + release + delay) | 0; i < length; b[i++] = s) {
    if (!(++c % ((bitCrush * 100) | 0))) {
      s = shape
        ? shape > 1
          ? shape > 2
            ? shape > 3
              ? Math.sin((t % PI2) ** 3)
              : Math.max(Math.min(Math.tan(t), 1), -1)
            : 1 - (((((2 * t) / PI2) % 2) + 2) % 2)
          : 1 - 4 * Math.abs(Math.round(t / PI2) - t / PI2)
        : Math.sin(t);
      s =
        (repeatTime ? 1 - tremolo + tremolo * Math.sin((PI2 * i) / repeatTime) : 1) *
        sign(s) *
        Math.abs(s) ** shapeCurve *
        volume *
        MASTER *
        (i < attack
          ? i / attack
          : i < attack + decay
            ? 1 - ((i - attack) / decay) * (1 - sustainVolume)
            : i < attack + decay + sustain
              ? sustainVolume
              : i < length - delay
                ? ((length - i - delay) / release) * sustainVolume
                : 0);
      s = delay
        ? s / 2 +
          (delay > i ? 0 : ((i < length - delay ? 1 : (length - i) / delay) * b[(i - delay) | 0]!) / 2)
        : s;
    }
    f = (frequency += slide += deltaSlide) * Math.cos(modulation * tm++);
    t += f - f * noise * (1 - (((Math.sin(i) + 1) * 1e9) % 2));
    if (j && ++j > pitchJumpTime) {
      frequency += pitchJump;
      j = 0;
    }
    if (repeatTime && !(++r % repeatTime)) {
      frequency = startFrequency;
      slide = startSlide;
      j = j || 1;
    }
  }
  const out = new Float32Array(b.length);
  for (let k = 0; k < b.length; k++) out[k] = b[k]!;
  return out;
}

class Sfx {
  private ac: AudioContext | null = null;
  private bufs = new Map<SfxKey, AudioBuffer>();
  private last = new Map<SfxKey, number>();
  private unlocked = false;
  enabled = true;

  /** 사용자 제스처 안에서 부른다. 이후 play() 가 실제로 소리를 낸다. */
  unlock(): void {
    this.unlocked = true;
    if (!this.enabled) return;
    this.ctx();
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v && this.ac && this.ac.state === 'running') void this.ac.suspend().catch(() => {});
    if (v && this.ac && this.ac.state === 'suspended') void this.ac.resume().catch(() => {});
  }

  /** 앱이 백그라운드로 가면 컨텍스트를 재운다(배터리·브릿지 부담). */
  suspend(): void {
    if (this.ac && this.ac.state === 'running') void this.ac.suspend().catch(() => {});
  }
  resume(): void {
    if (this.enabled && this.ac && this.ac.state === 'suspended') void this.ac.resume().catch(() => {});
  }

  private ctx(): AudioContext | null {
    if (this.ac) return this.ac;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ac = new AC();
    } catch {
      this.ac = null;
    }
    return this.ac;
  }

  play(key: SfxKey, gain = 1): void {
    if (!this.enabled || !this.unlocked) return;
    const ac = this.ctx();
    if (!ac) return;
    const now = performance.now();
    if (now - (this.last.get(key) ?? -1e9) < 90) return;
    this.last.set(key, now);
    try {
      if (ac.state === 'suspended') void ac.resume().catch(() => {});
      let buf = this.bufs.get(key);
      if (!buf) {
        const data = zzfxG(...(TABLE[key] as [number]));
        buf = ac.createBuffer(1, data.length, RATE);
        buf.getChannelData(0).set(data);
        this.bufs.set(key, buf);
      }
      const src = ac.createBufferSource();
      src.buffer = buf;
      if (gain !== 1) {
        const g = ac.createGain();
        g.gain.value = gain;
        src.connect(g);
        g.connect(ac.destination);
      } else {
        src.connect(ac.destination);
      }
      src.start();
    } catch {
      /* 오디오 실패는 게임과 무관 — 조용히 넘어간다 */
    }
  }
}

export const sfx = new Sfx();
/** 테스트 전용: 버퍼가 유한한지(NaN 0) 검사할 때 쓴다. */
export const _zzfxG = zzfxG;
export const SFX_KEYS = Object.keys(TABLE) as SfxKey[];
