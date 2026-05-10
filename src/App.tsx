import { useCallback, useMemo, useState } from "react";
import "./App.css";
import {
  PALETTES,
  PALETTE_META,
  type PaletteId,
  matchToBead,
} from "./lib/palettes";
import { loadImageFile, sampleImageToGrid, cellToHex } from "./lib/processImage";
import type { MatchedGrid } from "./lib/renderPattern";
import { renderMatchedGridToCanvas } from "./lib/renderPattern";
import { buildMaterialCounts } from "./lib/counts";
import { exportPatternPdf } from "./lib/pdfExport";
import {
  effectiveCellPx,
  EXPORT_CELL_MAX,
  EXPORT_CELL_MIN,
  PNG_TARGET_MIN_LONG,
} from "./lib/exportSizing";

const GRID_MIN = 4;
const GRID_MAX = 128;
/** 新图默认「最长边」格数：避免一上来就 128×… 豆子过密 */
const DEFAULT_LONG_SIDE = 40;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** 按原图宽高比，把较长边设为 `maxSide` 格（另一轴按比例取整并夹在范围内） */
function gridFromMaxSide(maxSide: number, iw: number, ih: number): { cols: number; rows: number } {
  const s = clamp(Math.round(maxSide), GRID_MIN, GRID_MAX);
  if (iw <= 0 || ih <= 0) return { cols: s, rows: s };
  if (iw >= ih) {
    const cols = s;
    const rows = clamp(Math.round((s * ih) / iw), GRID_MIN, GRID_MAX);
    return { cols, rows };
  }
  const rows = s;
  const cols = clamp(Math.round((s * iw) / ih), GRID_MIN, GRID_MAX);
  return { cols, rows };
}

function buildMatchedGrid(
  grid: ReturnType<typeof sampleImageToGrid>,
  paletteId: PaletteId
): MatchedGrid {
  const palette = PALETTES[paletteId];
  return grid.map((row) =>
    row.map((cell) => matchToBead(cellToHex(cell), palette))
  );
}

export default function App() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paletteId, setPaletteId] = useState<PaletteId>("perler");
  const [cols, setCols] = useState(32);
  const [rows, setRows] = useState(32);
  /** 与「最长边格数」滑块一致：长边 = 横图用列数，竖图用行数 */
  const [lockAspect, setLockAspect] = useState(true);
  /** 导出 PNG / 预览里每个格子的像素边长；越大格子越粗、总像素越大 */
  const [exportCellPx, setExportCellPx] = useState(20);
  const [matched, setMatched] = useState<MatchedGrid | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  const meta = PALETTE_META[paletteId];
  const palette = PALETTES[paletteId];

  const onFile = useCallback(async (file: File | null) => {
    setError(null);
    setMatched(null);
    setPreviewDataUrl(null);
    if (!file || !file.type.startsWith("image/")) {
      setSource(null);
      setFileName(null);
      if (file) setError("请选择图片文件（PNG / JPEG / WebP 等）。");
      return;
    }
    try {
      const img = await loadImageFile(file);
      setSource(img);
      setFileName(file.name);
      const g = gridFromMaxSide(DEFAULT_LONG_SIDE, img.naturalWidth, img.naturalHeight);
      setCols(g.cols);
      setRows(g.rows);
      setLockAspect(true);
    } catch (e) {
      setSource(null);
      setFileName(null);
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }, []);

  const runMatch = useCallback(() => {
    if (!source) return;
    setError(null);
    try {
      const c = clamp(Math.round(cols), GRID_MIN, GRID_MAX);
      const r = clamp(Math.round(rows), GRID_MIN, GRID_MAX);
      setCols(c);
      setRows(r);
      const sampled = sampleImageToGrid(source, c, r);
      const m = buildMatchedGrid(sampled, paletteId);
      setMatched(m);
      const cellPx = clamp(Math.round(exportCellPx), EXPORT_CELL_MIN, EXPORT_CELL_MAX);
      setExportCellPx(cellPx);
      const previewCell = effectiveCellPx(cellPx, c, r, "preview");
      const canvas = renderMatchedGridToCanvas(m, {
        cellSize: previewCell,
        showCode: true,
        alwaysLabelCodes: true,
      });
      setPreviewDataUrl(canvas.toDataURL("image/png"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "处理失败");
    }
  }, [source, cols, rows, paletteId, exportCellPx]);

  const counts = useMemo(() => (matched ? buildMaterialCounts(matched) : null), [matched]);

  const downloadPng = useCallback(() => {
    if (!matched) return;
    const w = matched[0]?.length ?? 0;
    const h = matched.length;
    const cell = effectiveCellPx(
      clamp(Math.round(exportCellPx), EXPORT_CELL_MIN, EXPORT_CELL_MAX),
      w,
      h,
      "png"
    );
    const canvas = renderMatchedGridToCanvas(matched, {
      cellSize: cell,
      showCode: true,
      alwaysLabelCodes: true,
    });
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${(fileName ?? "pattern").replace(/\.[^.]+$/, "")}_拼豆图纸.png`;
    a.click();
  }, [matched, fileName, exportCellPx]);

  const downloadPdf = useCallback(() => {
    if (!matched || !counts) return;
    const w = matched[0]?.length ?? 0;
    const h = matched.length;
    const eff = effectiveCellPx(
      clamp(Math.round(exportCellPx), EXPORT_CELL_MIN, EXPORT_CELL_MAX),
      w,
      h,
      "png"
    );
    exportPatternPdf(
      matched,
      (fileName ?? "pattern").replace(/\.[^.]+$/, ""),
      paletteId,
      counts,
      Math.min(eff, 24)
    );
  }, [matched, counts, fileName, paletteId, exportCellPx]);

  const useOriginalAspect = useCallback(() => {
    if (!source) return;
    const iw = source.naturalWidth;
    const ih = source.naturalHeight;
    const g = gridFromMaxSide(GRID_MAX, iw, ih);
    setCols(g.cols);
    setRows(g.rows);
  }, [source]);

  const longSideCells = source
    ? source.naturalWidth >= source.naturalHeight
      ? cols
      : rows
    : Math.max(cols, rows);

  const gridCols = matched?.[0]?.length ?? cols;
  const gridRows = matched?.length ?? rows;
  const effPngCell = effectiveCellPx(
    clamp(Math.round(exportCellPx), EXPORT_CELL_MIN, EXPORT_CELL_MAX),
    gridCols,
    gridRows,
    "png"
  );
  const pngW = gridCols * effPngCell;
  const pngH = gridRows * effPngCell;
  const beadTotal = cols * rows;

  const setColsLocked = useCallback(
    (next: number) => {
      const c = clamp(Math.round(next), GRID_MIN, GRID_MAX);
      if (lockAspect && source) {
        const iw = source.naturalWidth;
        const ih = source.naturalHeight;
        const r = clamp(Math.round((c * ih) / iw), GRID_MIN, GRID_MAX);
        setCols(c);
        setRows(r);
      } else {
        setCols(c);
      }
    },
    [lockAspect, source]
  );

  const setRowsLocked = useCallback(
    (next: number) => {
      const r = clamp(Math.round(next), GRID_MIN, GRID_MAX);
      if (lockAspect && source) {
        const iw = source.naturalWidth;
        const ih = source.naturalHeight;
        const c = clamp(Math.round((r * iw) / ih), GRID_MIN, GRID_MAX);
        setCols(c);
        setRows(r);
      } else {
        setRows(r);
      }
    },
    [lockAspect, source]
  );

  const onLongSideSlider = useCallback(
    (v: number) => {
      const s = clamp(Math.round(v), GRID_MIN, GRID_MAX);
      if (!source) {
        setCols(s);
        setRows(s);
        return;
      }
      if (!lockAspect) return;
      const g = gridFromMaxSide(s, source.naturalWidth, source.naturalHeight);
      setCols(g.cols);
      setRows(g.rows);
    },
    [source, lockAspect]
  );

  /** 快捷边长：有原图时一律按原图比例套长边格数（与是否勾选锁定无关） */
  const applyPresetLongSide = useCallback(
    (n: number) => {
      if (source) {
        const g = gridFromMaxSide(n, source.naturalWidth, source.naturalHeight);
        setCols(g.cols);
        setRows(g.rows);
      } else {
        const s = clamp(Math.round(n), GRID_MIN, GRID_MAX);
        setCols(s);
        setRows(s);
      }
    },
    [source]
  );

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">拼豆图纸工作室</h1>
        <p className="app__subtitle">
          上传图片 → 选定品牌色盘与网格尺寸 → 生成带色号与网格的实体图纸，并导出 PNG / PDF 与材料清单。
        </p>
      </header>

      <div className="layout">
        <aside className="panel">
          <h2>1. 图片</h2>
          <label className="drop">
            <span className="drop__text">
              {fileName ? (
                <>
                  <span className="drop__label">已选择</span>
                  <strong className="drop__filename" title={fileName}>
                    {fileName}
                  </strong>
                  <span className="hint drop__hint">点击可重新选择</span>
                </>
              ) : (
                <>
                  点击或拖拽到此（浏览器需支持选择文件）
                  <span className="hint drop__hint">普通照片也会按网格做「马赛克」采样</span>
                </>
              )}
            </span>
            <input
              type="file"
              className="drop__input"
              accept="image/*"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {source && (
            <p className="hint" style={{ marginTop: 12 }}>
              原图尺寸 {source.naturalWidth} × {source.naturalHeight} px
            </p>
          )}
          {error && <div className="err">{error}</div>}

          <h2 style={{ marginTop: 22 }}>2. 色盘</h2>
          <div className="field">
            <label htmlFor="pal">品牌套系</label>
            <select
              id="pal"
              value={paletteId}
              onChange={(e) => setPaletteId(e.target.value as PaletteId)}
            >
              <option value="perler">Perler（全色卡 JSON）</option>
              <option value="artkal">Artkal S 5mm（全色卡 JSON）</option>
              <option value="hama">Hama Midi（全色卡 JSON）</option>
            </select>
            <div className="hint">{meta.note}</div>
          </div>

          <h2>3. 网格（豆子数量）</h2>
          <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
            格数越少豆子越少、越大颗；导出像素见下一节，可单独加粗图纸。
          </p>
          <label className="field field--inline">
            <input
              type="checkbox"
              checked={lockAspect}
              onChange={(e) => {
                const on = e.target.checked;
                setLockAspect(on);
                if (on && source) {
                  const g = gridFromMaxSide(Math.max(cols, rows), source.naturalWidth, source.naturalHeight);
                  setCols(g.cols);
                  setRows(g.rows);
                }
              }}
            />
            <span>锁定原图比例（推荐）</span>
          </label>
          {lockAspect ? (
            <div className="field">
              <label htmlFor="longSide" className="field__labelRow">
                <span>最长边格数</span>
                <span className="field__value">{longSideCells}</span>
              </label>
              <input
                id="longSide"
                type="range"
                min={GRID_MIN}
                max={GRID_MAX}
                value={longSideCells}
                onChange={(e) => onLongSideSlider(Number(e.target.value))}
              />
              <div className="hint">
                当前 {cols} × {rows}，约 <strong>{beadTotal.toLocaleString()}</strong> 颗豆
                {source ? "（随原图横竖自动分配长边）" : "（未上传时两轴相同）"}
              </div>
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="colsR" className="field__labelRow">
                  <span>列数</span>
                  <span className="field__value">{cols}</span>
                </label>
                <input
                  id="colsR"
                  type="range"
                  min={GRID_MIN}
                  max={GRID_MAX}
                  value={cols}
                  onChange={(e) => setCols(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="rowsR" className="field__labelRow">
                  <span>行数</span>
                  <span className="field__value">{rows}</span>
                </label>
                <input
                  id="rowsR"
                  type="range"
                  min={GRID_MIN}
                  max={GRID_MAX}
                  value={rows}
                  onChange={(e) => setRows(Number(e.target.value))}
                />
              </div>
            </>
          )}
          <div className="row2 row2--presets">
            <button type="button" className="btn btn--small" onClick={() => applyPresetLongSide(24)}>
              24 格边
            </button>
            <button type="button" className="btn btn--small" onClick={() => applyPresetLongSide(40)}>
              40 格边
            </button>
            <button type="button" className="btn btn--small" onClick={() => applyPresetLongSide(56)}>
              56 格边
            </button>
            <button type="button" className="btn btn--small" onClick={() => applyPresetLongSide(80)}>
              80 格边
            </button>
          </div>
          <div className="row2">
            <div className="field">
              <label htmlFor="cols">宽（列）精确</label>
              <input
                id="cols"
                type="number"
                min={GRID_MIN}
                max={GRID_MAX}
                value={cols}
                onChange={(e) => setColsLocked(Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="rows">高（行）精确</label>
              <input
                id="rows"
                type="number"
                min={GRID_MIN}
                max={GRID_MAX}
                value={rows}
                onChange={(e) => setRowsLocked(Number(e.target.value))}
              />
            </div>
          </div>
          {source && (
            <button type="button" className="btn" style={{ width: "100%" }} onClick={useOriginalAspect}>
              按原图比例：长边拉满（{GRID_MAX} 格上限）
            </button>
          )}

          <h2 style={{ marginTop: 22 }}>4. 导出格子大小</h2>
          <div className="field">
            <label htmlFor="cellPx" className="field__labelRow">
              <span>每格像素（下限偏好）</span>
              <span className="field__value">{exportCellPx}px</span>
            </label>
            <input
              id="cellPx"
              type="range"
              min={EXPORT_CELL_MIN}
              max={EXPORT_CELL_MAX}
              value={exportCellPx}
              onChange={(e) => setExportCellPx(Number(e.target.value))}
            />
            <div className="hint">
              格数多时会<strong>自动抬高</strong>每格像素，使 PNG 长边约 ≥ {PNG_TARGET_MIN_LONG}px（上限{" "}
              {EXPORT_CELL_MAX}px/格），线号更易辨认。当前估算 PNG{" "}
              <strong>
                {pngW.toLocaleString()} × {pngH.toLocaleString()} px
              </strong>
              （改后请再点「生成」刷新预览）
            </div>
          </div>

          <div className="actions">
            <button type="button" className="btn btn--primary" disabled={!source} onClick={runMatch}>
              生成拼豆图纸
            </button>
          </div>
          <div className="actions">
            <button type="button" className="btn" disabled={!matched} onClick={downloadPng}>
              下载 PNG
            </button>
            <button type="button" className="btn" disabled={!matched} onClick={downloadPdf}>
              下载 PDF
            </button>
          </div>
          <p className="hint">
            PDF 使用内置英文字体，清单中以色号 + HEX 标识颜色（避免中文乱码）。网页内表格仍显示中文名称。
          </p>
        </aside>

        <main>
          <div className="previews">
            <div className="preview-card">
              <h3>原图预览</h3>
              <div className="preview-card__body">
                {source ? (
                  <img src={source.src} alt="上传预览" width={source.naturalWidth} height={source.naturalHeight} />
                ) : (
                  <span className="hint">尚未上传</span>
                )}
              </div>
            </div>
            <div className="preview-card preview-card--pattern">
              <h3>匹配结果（示意）</h3>
              <div className="preview-card__body preview-card__body--pattern">
                {previewDataUrl ? (
                  <img src={previewDataUrl} alt="拼豆网格预览" />
                ) : (
                  <span className="hint">生成后显示</span>
                )}
              </div>
            </div>
          </div>

          {matched && counts && (
            <>
              <h2 style={{ margin: "20px 0 8px", fontSize: "0.85rem", color: "var(--muted)" }}>
                材料消耗清单（共 {matched.length * (matched[0]?.length ?? 0)} 格）
              </h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>色块</th>
                      <th>色号</th>
                      <th>名称</th>
                      <th>颗数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...counts.values()]
                      .sort((a, b) => b.n - a.n)
                      .map(({ bead, n }) => (
                        <tr key={bead.code}>
                          <td>
                            <div className="swatch" style={{ background: bead.hex }} title={bead.hex} />
                          </td>
                          <td style={{ fontFamily: "var(--font-mono)" }}>{bead.code}</td>
                          <td>{bead.name}</td>
                          <td>{n}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="hint" style={{ marginTop: 12 }}>
                色盘共 {palette.length} 色：格子颜色在<strong>线性光</strong>下混合再匹配；色差用{" "}
                <strong>CIEDE2000</strong>（ΔE₀₀）选最近豆色。屏幕/烫压与实物仍有差异，以实物为准。
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
