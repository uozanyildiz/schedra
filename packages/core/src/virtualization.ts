import type { VisibleRowRange } from "./types.js";

export function getVisibleRowRange(
  rowCount: number,
  rowHeight: number,
  scrollTop: number,
  viewportHeight: number,
  overscan = 2,
): VisibleRowRange {
  if (rowHeight <= 0) throw new RangeError("rowHeight must be positive.");
  const safeCount = Math.max(0, Math.trunc(rowCount));
  const startIndex = Math.max(
    0,
    Math.floor(Math.max(0, scrollTop) / rowHeight) - overscan,
  );
  const endIndex = Math.min(
    safeCount,
    Math.ceil(
      (Math.max(0, scrollTop) + Math.max(0, viewportHeight)) / rowHeight,
    ) + overscan,
  );
  return { startIndex: Math.min(startIndex, safeCount), endIndex };
}
