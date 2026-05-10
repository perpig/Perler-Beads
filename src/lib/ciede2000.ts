/**
 * CIEDE2000 色差（标量 Lab），与 colour-science 等实现一致。
 * 比 Lab 欧氏 ΔE76、比单纯 Oklab 欧氏更贴近「肉眼觉得差多少」。
 */

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export function deltaE00(
  Lab1: [number, number, number],
  Lab2: [number, number, number],
  kL = 1,
  kC = 1,
  kH = 1
): number {
  const L1 = Lab1[0];
  const a1 = Lab1[1];
  const b1 = Lab1[2];
  const L2 = Lab2[0];
  const a2 = Lab2[1];
  const b2 = Lab2[2];

  const C1ab = Math.hypot(a1, b1);
  const C2ab = Math.hypot(a2, b2);
  const Cab = (C1ab + C2ab) / 2;
  const Cab7 = Cab ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cab7 / (Cab7 + 25 ** 7)));

  const ap1 = (1 + G) * a1;
  const ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1);
  const Cp2 = Math.hypot(ap2, b2);
  const Cp12 = Cp1 * Cp2;

  const normHue = (ap: number, b: number) =>
    ap === 0 && b === 0 ? 0 : ((((Math.atan2(b, ap) * RAD2DEG) % 360) + 360) % 360);

  const hp1 = normHue(ap1, b1);
  const hp2 = normHue(ap2, b2);

  const dLp = L2 - L1;
  const dCp = Cp2 - Cp1;
  const dh = hp2 - hp1;

  let dhp: number;
  if (Cp12 === 0) dhp = 0;
  else if (Math.abs(dh) <= 180) dhp = dh;
  else if (dh > 180) dhp = dh - 360;
  else dhp = dh + 360;

  const dHp = 2 * Math.sqrt(Cp12) * Math.sin((dhp * DEG2RAD) / 2);

  const Lbar = (L1 + L2) / 2;
  const Cbar = (Cp1 + Cp2) / 2;
  const hsum = hp1 + hp2;
  const hdiff = Math.abs(hp1 - hp2);

  let hbar: number;
  if (Cp12 === 0) hbar = hsum;
  else if (hdiff <= 180) hbar = hsum / 2;
  else if (hdiff > 180 && hsum < 360) hbar = (hsum + 360) / 2;
  else hbar = (hsum - 360) / 2;

  const T =
    1 -
    0.17 * Math.cos((hbar - 30) * DEG2RAD) +
    0.24 * Math.cos(2 * hbar * DEG2RAD) +
    0.32 * Math.cos((3 * hbar + 6) * DEG2RAD) -
    0.2 * Math.cos((4 * hbar - 63) * DEG2RAD);

  const dTheta = 30 * Math.exp(-Math.pow((hbar - 275) / 25, 2));
  const Cbar7 = Cbar ** 7;
  const RC = 2 * Math.sqrt(Cbar7 / (Cbar7 + 25 ** 7));

  const Lbar2 = (Lbar - 50) ** 2;
  const SL = 1 + (0.015 * Lbar2) / Math.sqrt(20 + Lbar2);
  const SC = 1 + 0.045 * Cbar;
  const SH = 1 + 0.015 * Cbar * T;
  const RT = -Math.sin(2 * dTheta * DEG2RAD) * RC;

  const LL = dLp / (kL * SL);
  const CC = dCp / (kC * SC);
  const HH = dHp / (kH * SH);

  return Math.sqrt(LL * LL + CC * CC + HH * HH + RT * CC * HH);
}
