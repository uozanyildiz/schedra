import { describe, expect, it } from "vitest";
import { pixelsPerMillisecond } from "./use-karst.js";

describe("pixelsPerMillisecond", () => {
  it("uses predictable base widths for each view", () => {
    expect(pixelsPerMillisecond("hour", 1) * 3_600_000).toBe(96);
    expect(pixelsPerMillisecond("day", 1) * 86_400_000).toBe(120);
    expect(pixelsPerMillisecond("week", 1) * 604_800_000).toBe(160);
  });

  it("scales with controlled zoom", () => {
    expect(pixelsPerMillisecond("hour", 2) * 3_600_000).toBe(192);
  });
});
