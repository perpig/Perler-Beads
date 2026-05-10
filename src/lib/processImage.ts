import { linearRgbToHex, srgbByteToLinear } from "./colorMath";

export type GridCell = {
  r: number;
  g: number;
  b: number;
  a: number;
};

/** 将任意图片采样为 w×h 网格；每格为覆盖区域内像素的算术平均（含透明则预乘 alpha） */
export function sampleImageToGrid(
  source: HTMLImageElement | HTMLCanvasElement,
  w: number,
  h: number
): GridCell[][] {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("无法创建 Canvas 上下文");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const grid: GridCell[][] = [];
  for (let y = 0; y < h; y++) {
    const row: GridCell[] = [];
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3] / 255;
      row.push({
        r: data[i],
        g: data[i + 1],
        b: data[i + 2],
        a,
      });
    }
    grid.push(row);
  }
  return grid;
}

/** 与透明混合、再转 hex：在「线性光」下混合再编码回 sRGB，避免直接在 8bit 上平均带来的色相偏移 */
export function cellToHex(c: GridCell): string {
  const a = c.a <= 0 ? 1 : Math.min(1, c.a);
  const rL = srgbByteToLinear(c.r);
  const gL = srgbByteToLinear(c.g);
  const bL = srgbByteToLinear(c.b);
  const mix = (v: number) => v * a + 1 * (1 - a);
  return linearRgbToHex(mix(rL), mix(gL), mix(bL));
}

export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片加载失败"));
    };
    img.src = url;
  });
}
