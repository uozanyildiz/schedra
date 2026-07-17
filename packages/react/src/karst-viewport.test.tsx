import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KarstTimeline } from "./karst-timeline.js";
import { calculatePointerCenteredScroll } from "./karst-viewport.js";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe("sticky viewport layers", () => {
  const timelineProps = {
    rows: [
      {
        id: "row-1",
        data: null,
        items: [],
      },
    ],
    range: { start: 0, end: 86_400_000 },
    view: "hour" as const,
    zoom: 1,
    selectedItemIds: [] as string[],
    activeItemId: null,
    onSelectionChange: vi.fn(),
  };

  it("keeps the header and row labels sticky by default", async () => {
    const { container } = render(<KarstTimeline {...timelineProps} />);

    const header = container.querySelector(
      "[data-karst-header]",
    ) as HTMLElement;
    expect(header.style.position).toBe("sticky");
    expect(header.style.height).toBe("32px");
    expect(
      container.querySelector("[data-karst-corner-header]")?.textContent,
    ).toBe("Rows");
    await waitFor(() =>
      expect(
        (container.querySelector("[data-karst-row-label]") as HTMLElement).style
          .position,
      ).toBe("sticky"),
    );
  });

  it("forwards disabled sticky options through KarstTimeline", async () => {
    const { container } = render(
      <KarstTimeline
        {...timelineProps}
        stickyHeader={false}
        stickyRowLabels={false}
      />,
    );

    expect(
      (container.querySelector("[data-karst-header]") as HTMLElement).style
        .position,
    ).toBe("absolute");
    await waitFor(() =>
      expect(
        (container.querySelector("[data-karst-row-label]") as HTMLElement).style
          .position,
      ).toBe("absolute"),
    );
  });

  it("forwards custom header layout, styles, and renderers", () => {
    const { container } = render(
      <KarstTimeline
        {...timelineProps}
        headerHeight={48}
        headerStyle={{ background: "rgb(1, 2, 3)" }}
        cornerHeaderStyle={{ color: "rgb(4, 5, 6)" }}
        timeHeaderStyle={{ fontWeight: 700 }}
        renderCornerHeader={({ width, height }) => (
          <span>
            Corner {width}×{height}
          </span>
        )}
        renderTimeHeader={({ height, view }) => (
          <span>
            Time {height} {view}
          </span>
        )}
      />,
    );

    const header = container.querySelector(
      "[data-karst-header]",
    ) as HTMLElement;
    const corner = container.querySelector(
      "[data-karst-corner-header]",
    ) as HTMLElement;
    const time = container.querySelector(
      "[data-karst-time-header]",
    ) as HTMLElement;
    expect(header.style.height).toBe("48px");
    expect(header.style.background).toBe("rgb(1, 2, 3)");
    expect(corner.style.color).toBe("rgb(4, 5, 6)");
    expect(corner.textContent).toBe("Corner 180×48");
    expect(time.style.fontWeight).toBe("700");
    expect(time.textContent).toBe("Time 48 hour");
    expect((container.querySelector("canvas") as HTMLElement).style.top).toBe(
      "48px",
    );
  });
});
