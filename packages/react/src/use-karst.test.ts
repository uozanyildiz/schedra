import { describe, expect, it } from "vitest";
import { pixelsPerMillisecond } from "./use-karst.js";

describe("pixelsPerMillisecond", () => {
  it("uses the core time scale widths for each view", () => {
    expect(pixelsPerMillisecond("hour", 1) * 3_600_000).toBe(80);
    expect(pixelsPerMillisecond("day", 1) * 86_400_000).toBe(120);
    expect(pixelsPerMillisecond("week", 1) * 604_800_000).toBeCloseTo(180);
  });

  it("scales with controlled zoom", () => {
    expect(pixelsPerMillisecond("hour", 2) * 3_600_000).toBe(160);
  });
});
