/** 导出/预览：在格数很多时自动抬高「每格像素」，避免整图过小、线号看不清 */

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export const EXPORT_CELL_MIN = 10;
export const EXPORT_CELL_MAX = 56;
/** PNG 长边至少约多少像素（在格子上限内尽量满足） */
export const PNG_TARGET_MIN_LONG = 2400;
/** 预览区里图案长边至少约多少 CSS 像素 */
export const PREVIEW_TARGET_MIN_LONG = 640;

export function effectiveCellPx(
  userPx: number,
  cols: number,
  rows: number,
  kind: "png" | "preview"
): number {
  const u = clamp(Math.round(userPx), EXPORT_CELL_MIN, EXPORT_CELL_MAX);
  const side = Math.max(cols, rows, 1);
  const target = kind === "png" ? PNG_TARGET_MIN_LONG : PREVIEW_TARGET_MIN_LONG;
  const need = Math.ceil(target / side);
  const cap = kind === "preview" ? Math.min(EXPORT_CELL_MAX, 40) : EXPORT_CELL_MAX;
  return clamp(Math.max(u, need), EXPORT_CELL_MIN, cap);
}
