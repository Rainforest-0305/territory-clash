/**
 * 결정론적 난수.
 *
 * 왜 Math.random 이 아닌가: 고스트(USP-E)는 "동일 맵 시드"에서만 리플레이가
 * 유효하다. 맵 생성(지가 배치·시드 위치)은 반드시 시드 고정 PRNG 로 해야
 * 어제의 내 입력이 오늘 같은 맵 위에서 재생된다.
 * 연출용 난수(파티클 등)는 Math.random 을 그대로 써도 무방하다.
 */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rangeOf(r: Rng, a: number, b: number): number {
  return a + r() * (b - a);
}

export function intOf(r: Rng, a: number, b: number): number {
  return a + Math.floor(r() * (b - a + 1));
}

/** 하루 단위로 바뀌는 맵 시드. 같은 날 = 같은 맵 = 고스트 리플레이 유효. */
export function dailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
