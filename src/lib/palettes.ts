import { deltaE00 } from "./ciede2000";
import { hexToLab } from "./colorMath";
import artkalRaw from "../data/palettes/artkal-s-5mm.json";
import hamaRaw from "../data/palettes/hama-midi.json";
import perlerRaw from "../data/palettes/perler.json";

export type BeadColor = {
  code: string;
  name: string;
  hex: string;
};

export type PaletteId = "perler" | "artkal" | "hama";

type RawBead = {
  code: string;
  name: string;
  hex?: string;
  rgb?: { r: number; g: number; b: number };
};

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const t = (x: number) => clampByte(x).toString(16).padStart(2, "0").toUpperCase();
  return `#${t(rgb.r)}${t(rgb.g)}${t(rgb.b)}`;
}

/** 统一为 #RRGGBB 大写，供缓存与画布一致 */
function normalizeHex(hex: string): string {
  const h = hex.replace("#", "").trim();
  if (h.length === 6 && /^[0-9a-fA-F]+$/.test(h)) {
    return `#${h.toUpperCase()}`;
  }
  return hex.startsWith("#") ? hex : `#${hex}`;
}

function rawToBeadColor(r: RawBead): BeadColor {
  let hex = r.hex?.trim();
  if (!hex || hex.length < 4) {
    if (r.rgb) hex = rgbToHex(r.rgb);
    else hex = "#000000";
  } else {
    hex = normalizeHex(hex);
  }
  return {
    code: String(r.code),
    name: String(r.name),
    hex,
  };
}

function mapPalette(raw: unknown): BeadColor[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => rawToBeadColor(x as RawBead));
}

export const PALETTE_META: Record<
  PaletteId,
  { label: string; labelEn: string; note: string }
> = {
  perler: {
    label: "Perler（色卡 JSON）",
    labelEn: "Perler palette",
    note: "数据来自项目内 perler.json；实物以包装为准。",
  },
  artkal: {
    label: "Artkal S 5mm（色卡 JSON）",
    labelEn: "Artkal S 5mm palette",
    note: "数据来自项目内 artkal-s-5mm.json；S 系列软豆 5mm。",
  },
  hama: {
    label: "Hama Midi（色卡 JSON）",
    labelEn: "Hama Midi palette",
    note: "数据来自项目内 hama-midi.json；请以实物为准。",
  },
};

/** 与 `PaletteId` 对应的全量色卡（由 JSON 构建） */
export const PALETTES: Record<PaletteId, BeadColor[]> = {
  perler: mapPalette(perlerRaw),
  artkal: mapPalette(artkalRaw),
  hama: mapPalette(hamaRaw),
};

const labCache = new Map<string, [number, number, number]>();

function labForHex(hex: string): [number, number, number] {
  const key = hex.toLowerCase();
  let v = labCache.get(key);
  if (!v) {
    v = hexToLab(hex);
    labCache.set(key, v);
  }
  return v;
}

export function matchToBead(hex: string, palette: BeadColor[]): BeadColor {
  if (palette.length === 0) {
    return { code: "?", name: "Empty palette", hex: "#000000" };
  }
  const target = labForHex(hex);
  let best = palette[0];
  let bestD = Infinity;
  for (const bead of palette) {
    const d = deltaE00(target, labForHex(bead.hex));
    if (d < bestD) {
      bestD = d;
      best = bead;
    }
  }
  return best;
}
