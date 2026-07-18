import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SchedraController } from "./types.js";
import { SchedraTimeline } from "./schedra-timeline.js";
import {
  SchedraViewport,
  calculatePointerCenteredScroll,
  calculateVerticalCanvasBuffer,
} from "./schedra-viewport.js";
import { useSchedra } from "./use-schedra.js";

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

describe("calculateVerticalCanvasBuffer", () => {
  it("adds full row buffers above and below a middle viewport", () => {
    expect(
      calculateVerticalCanvasBuffer({
        scrollTop: 720,
        viewportHeight: 360,
        contentHeight: 3_600,
        rowHeight: 36,
        overscanRows: 4,
      }),
    ).toEqual({
      before: 144,
      after: 144,
      scrollTop: 576,
      height: 648,
    });
  });

  it("clamps bitmap padding at the content boundaries", () => {
    expect(
      calculateVerticalCanvasBuffer({
        scrollTop: 18,
        viewportHeight: 360,
        contentHeight: 400,
        rowHeight: 36,
        overscanRows: 4,
      }),
    ).toEqual({
      before: 18,
      after: 22,
      scrollTop: 0,
      height: 400,
    });
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
    const { container } = render(<SchedraTimeline {...timelineProps} />);

    const header = container.querySelector(
      "[data-schedra-header]",
    ) as HTMLElement;
    expect(header.style.position).toBe("sticky");
    expect(header.style.height).toBe("32px");
    expect(
      container.querySelector("[data-schedra-corner-header]")?.textContent,
    ).toBe("Rows");
    await waitFor(() =>
      expect(
        (container.querySelector("[data-schedra-row-label]") as HTMLElement)
          .style.position,
      ).toBe("sticky"),
    );
  });

  it("forwards disabled sticky options through SchedraTimeline", async () => {
    const { container } = render(
      <SchedraTimeline
        {...timelineProps}
        stickyHeader={false}
        stickyRowLabels={false}
      />,
    );

    expect(
      (container.querySelector("[data-schedra-header]") as HTMLElement).style
        .position,
    ).toBe("absolute");
    await waitFor(() =>
      expect(
        (container.querySelector("[data-schedra-row-label]") as HTMLElement)
          .style.position,
      ).toBe("absolute"),
    );
  });

  it("forwards custom header layout, styles, and renderers", () => {
    const { container } = render(
      <SchedraTimeline
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
      "[data-schedra-header]",
    ) as HTMLElement;
    const corner = container.querySelector(
      "[data-schedra-corner-header]",
    ) as HTMLElement;
    const time = container.querySelector(
      "[data-schedra-time-header]",
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

describe("item anchors", () => {
  it("publishes the visual anchor after the initial asynchronous layout", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    const context = new Proxy(
      {},
      {
        get(target, property) {
          if (!(property in target)) {
            Object.assign(target, { [property]: () => {} });
          }
          return Reflect.get(target, property);
        },
        set(target, property, value) {
          return Reflect.set(target, property, value);
        },
      },
    ) as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context,
    );
    vi.spyOn(
      HTMLCanvasElement.prototype,
      "getBoundingClientRect",
    ).mockReturnValue({
      x: 100,
      y: 50,
      left: 100,
      top: 50,
      right: 500,
      bottom: 250,
      width: 400,
      height: 200,
      toJSON: () => ({}),
    });
    let controller: SchedraController<null, null> | null = null;

    function Harness() {
      const schedra = useSchedra({
        rows: [
          {
            id: "row",
            data: null,
            items: [{ id: "item", start: 0, end: 60_000, data: null }],
          },
        ],
        range: { start: 0, end: 86_400_000 },
        view: "hour",
        zoom: 1,
        selectedItemIds: ["item"],
        activeItemId: "item",
        onSelectionChange: vi.fn(),
        resolveItemLayouts: ({ layouts }) =>
          layouts.map((layout) => ({
            ...layout,
            visualRect: { ...layout.visualRect, x: 25, y: 8 },
          })),
      });
      controller = schedra;
      return <SchedraViewport schedra={schedra} />;
    }

    render(<Harness />);
    expect(controller!.getItemAnchorRect("item")).toBeNull();
    act(() => {
      while (frames.length) frames.shift()!(0);
    });

    expect(controller!.getItemAnchorRect("item")).toEqual(
      expect.objectContaining({
        x: 125,
        y: 58,
      }),
    );
  });
});
