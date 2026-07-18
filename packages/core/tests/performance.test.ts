import { describe, expect, it } from "vitest";
import {
  detectConflicts,
  ItemIndex,
  validateRows,
  type SchedraRow,
} from "../src/index.js";

describe("100k-item benchmark", () => {
  it("indexes, validates, and detects conflicts in a practical time budget", () => {
    const rows: SchedraRow[] = Array.from({ length: 1_000 }, (_, rowIndex) => ({
      id: `row-${rowIndex}`,
      data: null,
      items: Array.from({ length: 100 }, (_, itemIndex) => {
        const start = itemIndex * 20;
        return {
          id: `item-${rowIndex}-${itemIndex}`,
          start,
          end: start + 10,
          data: null,
        };
      }),
    }));
    const started = performance.now();
    const validated = validateRows(rows);
    const index = new ItemIndex(validated.rows);
    const conflicts = detectConflicts(validated.rows);
    const elapsed = performance.now() - started;
    expect(index.itemsById.size).toBe(100_000);
    expect(conflicts.conflicts).toHaveLength(0);
    // Generous enough for shared CI, while catching accidental quadratic behavior.
    expect(elapsed).toBeLessThan(5_000);
  });
});
