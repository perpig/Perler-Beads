import type { BeadColor } from "./palettes";
import { pickLabelColor } from "./colorMath";

export type MatchedGrid = BeadColor[][];

export type RenderOptions = {
  cellSize: number;
  /** 普通网格线宽度 */
  gridLineWidth: number;
  gridLineColor: string;
  /** 每多少格画一条「主网格线」（更粗/更显眼），便于五颗一数 */
  majorGridEvery: number;
  majorGridLineWidth: number;
  majorGridLineColor: string;
  showCode: boolean;
  /**
   * 字号不低于此比例时再画字（已弃用为主条件）；现主要用 `alwaysLabelCodes`。
   * @deprecated 使用 alwaysLabelCodes
   */
  minCellForLabel?: number;
  /** 为 true 时每个格子都尝试画色号（字号随格子缩小） */
  alwaysLabelCodes: boolean;
};

const defaultOpts: RenderOptions = {
  cellSize: 14,
  gridLineWidth: 1,
  gridLineColor: "rgba(15,18,24,0.38)",
  majorGridEvery: 5,
  majorGridLineWidth: 2,
  majorGridLineColor: "rgba(220, 55, 55, 0.92)",
  showCode: true,
  alwaysLabelCodes: true,
};

export function gridPixelSize(
  cols: number,
  rows: number,
  opts: Partial<RenderOptions> = {}
): { width: number; height: number } {
  const o = { ...defaultOpts, ...opts };
  return {
    width: cols * o.cellSize,
    height: rows * o.cellSize,
  };
}

function drawCodeInCell(
  ctx: CanvasRenderingContext2D,
  code: string,
  cellHex: string,
  cx: number,
  cy: number,
  cs: number
): void {
  if (cs < 3) return;
  const fill = pickLabelColor(cellHex);
  const fontPx = Math.max(6, Math.min(Math.floor(cs * 0.5), cs - 2));
  ctx.save();
  ctx.font = `700 ${fontPx}px JetBrains Mono, ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const x = cx + cs / 2;
  const y = cy + cs / 2;
  const outline = fill === "#111827" ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.62)";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(1.1, fontPx * 0.2);
  ctx.strokeStyle = outline;
  ctx.strokeText(code, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(code, x, y);
  ctx.restore();
}

function isMajorGridIndex(i: number, max: number, every: number): boolean {
  if (i === 0 || i === max) return true;
  return i > 0 && i < max && i % every === 0;
}

export function renderMatchedGridToCanvas(
  grid: MatchedGrid,
  opts: Partial<RenderOptions> = {}
): HTMLCanvasElement {
  const o = { ...defaultOpts, ...opts };
  const every = Math.max(1, Math.round(o.majorGridEvery));
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const cs = o.cellSize;
  const minorLineW = Math.max(1.25, Math.min(2.6, cs * 0.078));
  const majorLineW = Math.max(2.3, Math.min(5.2, cs * 0.13));
  const width = cols * cs;
  const height = rows * cs;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建 Canvas");

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const bead = grid[y][x];
      ctx.fillStyle = bead.hex;
      ctx.fillRect(x * cs, y * cs, cs, cs);
    }
  }

  const drawVLine = (i: number, lineW: number, color: string) => {
    const x = i * cs;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();
  };

  const drawHLine = (j: number, lineW: number, color: string) => {
    const y = j * cs;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
    ctx.stroke();
  };

  for (let i = 1; i < cols; i++) {
    if (!isMajorGridIndex(i, cols, every)) {
      drawVLine(i, Math.max(o.gridLineWidth, minorLineW), o.gridLineColor);
    }
  }
  for (let j = 1; j < rows; j++) {
    if (!isMajorGridIndex(j, rows, every)) {
      drawHLine(j, Math.max(o.gridLineWidth, minorLineW), o.gridLineColor);
    }
  }

  for (let i = 0; i <= cols; i++) {
    if (isMajorGridIndex(i, cols, every)) {
      drawVLine(i, Math.max(o.majorGridLineWidth, majorLineW), o.majorGridLineColor);
    }
  }
  for (let j = 0; j <= rows; j++) {
    if (isMajorGridIndex(j, rows, every)) {
      drawHLine(j, Math.max(o.majorGridLineWidth, majorLineW), o.majorGridLineColor);
    }
  }

  const minLegacy = o.minCellForLabel ?? 14;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const bead = grid[y][x];
      const showThis =
        o.showCode && (o.alwaysLabelCodes || cs >= minLegacy);
      if (showThis) {
        drawCodeInCell(ctx, bead.code, bead.hex, x * cs, y * cs, cs);
      }
    }
  }

  return canvas;
}
