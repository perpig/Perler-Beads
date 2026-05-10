import { jsPDF } from "jspdf";
import type { MatchedGrid } from "./renderPattern";
import { gridPixelSize, renderMatchedGridToCanvas } from "./renderPattern";
import type { BeadColor } from "./palettes";

const MM_PER_PT = 25.4 / 72;

export function exportPatternPdf(
  grid: MatchedGrid,
  title: string,
  paletteId: "perler" | "artkal" | "hama",
  counts: Map<string, { bead: BeadColor; n: number }>,
  patternCellSize = 10
): void {
  const cellSize = Math.max(6, Math.min(28, Math.round(patternCellSize)));
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const cols = grid[0]?.length ?? 0;
  const rows = grid.length;
  const { width: pxW, height: pxH } = gridPixelSize(cols, rows, { cellSize });

  const maxImgW = pageW - margin * 2;
  const maxImgH = pageH - margin * 2 - 24;
  const scale = Math.min(maxImgW / (pxW * MM_PER_PT), maxImgH / (pxH * MM_PER_PT), 1);
  const drawW = pxW * MM_PER_PT * scale;
  const drawH = pxH * MM_PER_PT * scale;

  const patternCanvas = renderMatchedGridToCanvas(grid, {
    cellSize,
    showCode: true,
    alwaysLabelCodes: true,
  });
  const imgData = patternCanvas.toDataURL("image/png");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(title, margin, margin);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Palette: ${paletteId}`, margin, margin + 6);
  pdf.text(`Grid: ${cols} x ${rows}`, margin, margin + 11);
  pdf.addImage(imgData, "PNG", margin, margin + 16, drawW, drawH);

  pdf.addPage();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("Material list / counts", margin, margin);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);

  const sorted = [...counts.values()].sort((a, b) => b.n - a.n);
  let y = margin + 10;
  const lineH = 6;
  for (const { bead, n } of sorted) {
    if (y > pageH - margin) {
      pdf.addPage();
      y = margin + 6;
    }
    pdf.setFillColor(bead.hex);
    pdf.rect(margin, y - 4, 4, 4, "F");
    pdf.setTextColor(40, 40, 40);
    pdf.text(`${bead.code}  ${bead.hex}`, margin + 7, y);
    pdf.text(String(n), pageW - margin - 10, y, { align: "right" });
    y += lineH;
  }

  pdf.save(`${title.replace(/\s+/g, "_")}_perler.pdf`);
}
