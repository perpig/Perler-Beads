/** sRGB 8bit 0–255 → 线性光 0–1 */
export function srgbByteToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function srgbChannelToLinear(c: number): number {
  return srgbByteToLinear(c);
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** 线性光 0–1 → sRGB 8bit */
export function linearToSrgbByte(lin: number): number {
  const c = lin <= 0.0031308 ? 12.92 * lin : 1.055 * Math.pow(lin, 1 / 2.4) - 0.055;
  return clampByte(c * 255);
}

/** 线性 RGB 0–1 → #RRGGBB */
export function linearRgbToHex(lr: number, lg: number, lb: number): string {
  const r = linearToSrgbByte(lr);
  const g = linearToSrgbByte(lg);
  const b = linearToSrgbByte(lb);
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return [r, g, b];
  }
  if (h.length !== 6) return [0, 0, 0];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** D65 sRGB → XYZ (0–100 scale for Y) */
export function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const R = srgbChannelToLinear(r);
  const G = srgbChannelToLinear(g);
  const B = srgbChannelToLinear(b);
  const X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const Z = R * 0.0193339 + G * 0.119192 + B * 0.9503041;
  return [X * 100, Y * 100, Z * 100];
}

const XN = 95.047;
const YN = 100.0;
const ZN = 108.883;

export function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  const fx = fLab(x / XN);
  const fy = fLab(y / YN);
  const fz = fLab(z / ZN);
  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);
  return [L, a, b];
}

function fLab(t: number): number {
  const delta = 6 / 29;
  return t > Math.pow(delta, 3) ? Math.cbrt(t) : t / (3 * delta * delta) + 4 / 29;
}

export function hexToLab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  const [x, y, z] = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

/** CIE76 ΔE */
export function deltaE76(lab1: [number, number, number], lab2: [number, number, number]): number {
  const dL = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

/** 线性 sRGB 0–1 → Oklab（Björn Ottosson），人眼均匀性优于 Lab 上的欧氏距离 */
export function linearRgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

export function hexToOklab(hex: string): [number, number, number] {
  const [r8, g8, b8] = hexToRgb(hex);
  return linearRgbToOklab(srgbByteToLinear(r8), srgbByteToLinear(g8), srgbByteToLinear(b8));
}

/** Oklab 中欧氏距离，数值越小越接近人眼感知的色差 */
export function deltaEoklab(a: [number, number, number], b: [number, number, number]): number {
  const d0 = a[0] - b[0];
  const d1 = a[1] - b[1];
  const d2 = a[2] - b[2];
  return Math.sqrt(d0 * d0 + d1 * d1 + d2 * d2);
}

export function luminance(r: number, g: number, b: number): number {
  const R = srgbChannelToLinear(r);
  const G = srgbChannelToLinear(g);
  const B = srgbChannelToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** 在浅色格子上用深字，反之亦然 */
export function pickLabelColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return luminance(r, g, b) > 0.55 ? "#111827" : "#f9fafb";
}
