import { describe, expect, it } from "vitest";
import { calculatePointerCenteredScroll } from "./karst-viewport.js";

describe("calculatePointerCenteredScroll", () => {
  it("keeps the time under the pointer fixed when zooming in", () => {
    const nextScroll = calculatePointerCenteredScroll({
      origin: 0,
      view: "hour",
      previousZoom: 1,
      nextZoom: 2,
      scrollLeft: 240,
      pointerX: 160,
    });

    // At 1x, x=400 is the same timestamp as x=800 at 2x.
    // Subtracting the unchanged pointer position gives the new scroll.
    expect(nextScroll).toBeCloseTo(640);
  });

  it("clamps zoomed-out scroll at the start of the range", () => {
    expect(
      calculatePointerCenteredScroll({
        origin: 0,
        view: "hour",
        previousZoom: 2,
        nextZoom: 0.5,
        scrollLeft: 0,
        pointerX: 100,
      }),
    ).toBe(0);
  });
});
