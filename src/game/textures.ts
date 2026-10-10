/**
 * 절차적 텍스처 타일.
 *
 * ART_DIRECTION §4 L0-3 / L2-e / L6-4.
 * "노이즈는 값싼 프리미엄의 1순위" — 이 두 장(NOISE, HAIR)이 캔버스 게임의
 * 플라스틱 느낌을 제거하는 최소 비용 수단이다. 절대 빼지 마라.
 *
 * 둘 다 모듈 로드 시 1회만 생성한다(128x128 / 12x12 = 총 65KB 미만).
 */

function mkc(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w | 0);
  c.height = Math.max(1, h | 0);
  return c;
}

/** 128x128 그레이 노이즈. film grain(L6-4) + 배경 오버레이(L0-3) 겸용. */
export const NOISE: HTMLCanvasElement = (() => {
  const c = mkc(128, 128);
  const x = c.getContext('2d')!;
  const d = x.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    d.data[i] = v;
    d.data[i + 1] = v;
    d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  return c;
})();

/** 45° 헤어라인(L2-e). 영토 내부 마이크로 텍스처 — 큰 단색 면의 "죽은 느낌" 제거. */
export const HAIR: HTMLCanvasElement = (() => {
  const s = 12;
  const c = mkc(s, s);
  const x = c.getContext('2d')!;
  x.strokeStyle = 'rgba(255,255,255,.32)';
  x.lineWidth = 1;
  x.beginPath();
  x.moveTo(-s, s);
  x.lineTo(s, -s);
  x.moveTo(0, 2 * s);
  x.lineTo(2 * s, 0);
  x.stroke();
  return c;
})();

export { mkc };
