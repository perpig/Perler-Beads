import type { BeadColor } from "./palettes";
import type { MatchedGrid } from "./renderPattern";

export function buildMaterialCounts(grid: MatchedGrid): Map<string, { bead: BeadColor; n: number }> {
  const map = new Map<string, { bead: BeadColor; n: number }>();
  for (const row of grid) {
    for (const bead of row) {
      const key = bead.code;
      const cur = map.get(key);
      if (cur) cur.n += 1;
      else map.set(key, { bead, n: 1 });
    }
  }
  return map;
}
