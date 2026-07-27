import { describe, expect, it, vi } from "vitest";
import {
  DAY_MS,
  HitTestIndex,
  ItemIndex,
  cleanSelection,
  createSchedraEngine,
  createTimeScale,
  detectConflicts,
  getVisibleRowRange,
  proposeSelection,
  validateRows,
  visibleTimeRange,
  type CanvasLayers,
  type ItemRect,
  type SchedraRow,
} from "../src/index.js";

const row = (
  id: string,
  items: Array<{ id: string; start: number; end: number }>,
): SchedraRow => ({
  id,
  data: null,
  items: items.map((item) => ({ ...item, data: null })),
});

function canvasLayers(
  overrides: Partial<CanvasRenderingContext2D> = {},
): CanvasLayers {
  const context = new Proxy(
    { ...overrides },
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
  const canvas = {
    width: 0,
    height: 0,
    style: {},
    getContext: () => context,
  } as unknown as HTMLCanvasElement;
  return { grid: canvas, items: canvas, interaction: canvas };
}

describe("validateRows", () => {
  it("reports and skips invalid and duplicate data without dropping valid items", () => {
    const result = validateRows([
      row("a", [
        { id: "good", start: 1, end: 2 },
        { id: "backwards", start: 3, end: 2 },
      ]),
      row("b", [{ id: "good", start: 4, end: 5 }]),
      row("a", [{ id: "other", start: 1, end: 2 }]),
    ]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]!.items.map((item) => item.id)).toEqual(["good"]);
    expect(result.rows[1]!.items).toHaveLength(0);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "INVALID_TIME_RANGE",
      "DUPLICATE_ITEM_ID",
      "DUPLICATE_ROW_ID",
    ]);
  });
});

describe("detectConflicts", () => {
  it("uses half-open ranges and ignores milestones", () => {
    const result = detectConflicts([
      row("a", [
        { id: "a", start: 0, end: 10 },
        { id: "touches", start: 10, end: 20 },
        { id: "milestone", start: 5, end: 5 },
        { id: "overlaps", start: 15, end: 25 },
      ]),
    ]);
    expect(result.conflicts).toEqual([
      {
        rowId: "a",
        earlierItemId: "touches",
        laterItemId: "overlaps",
        overlapStart: 15,
        overlapEnd: 20,
      },
    ]);
  });

  it("hide-later keeps earliest start, then first input item", () => {
    const result = detectConflicts(
      [
        row("a", [
          { id: "first", start: 0, end: 20 },
          { id: "same-start", start: 0, end: 5 },
          { id: "later", start: 10, end: 15 },
          { id: "after", start: 20, end: 30 },
        ]),
      ],
      "hide-later",
    );
    expect([...result.hiddenItemIds]).toEqual(["same-start", "later"]);
  });
});

describe("time scale", () => {
  it.each(["hour", "day", "week"] as const)(
    "round trips timestamps in %s view",
    (view) => {
      const scale = createTimeScale({ view, origin: 1_000, zoom: 1.5 });
      const timestamp = 1_000 + DAY_MS * 2.25;
      expect(scale.xToTimestamp(scale.timestampToX(timestamp))).toBeCloseTo(
        timestamp,
        5,
      );
    },
  );

  it("calculates visible time", () => {
    const scale = createTimeScale({ view: "day", origin: 0, dayWidth: 100 });
    expect(visibleTimeRange(scale, 50, 100)).toEqual({
      start: DAY_MS / 2,
      end: DAY_MS * 1.5,
    });
  });
});

describe("virtualization", () => {
  it("returns an overscanned exclusive range", () => {
    expect(getVisibleRowRange(100, 40, 400, 120, 1)).toEqual({
      startIndex: 9,
      endIndex: 14,
    });
  });
});

describe("controlled selection proposals", () => {
  it("supports replacement, additive toggle, and cleanup", () => {
    expect(
      proposeSelection({ selectedItemIds: ["a"], activeItemId: "a" }, "b"),
    ).toEqual({ selectedItemIds: ["b"], activeItemId: "b" });
    expect(
      proposeSelection(
        { selectedItemIds: ["a", "b"], activeItemId: "b" },
        "b",
        true,
      ),
    ).toEqual({ selectedItemIds: ["a"], activeItemId: "a" });
    expect(
      cleanSelection(
        { selectedItemIds: ["a", "missing"], activeItemId: "missing" },
        new Set(["a"]),
      ),
    ).toEqual({ selectedItemIds: ["a"], activeItemId: "a" });
  });
});

describe("indexes", () => {
  it("queries visible row items and resolves top-most hit regions", () => {
    const rows = [
      row("a", [
        { id: "one", start: 0, end: 10 },
        { id: "milestone", start: 10, end: 10 },
      ]),
    ];
    const index = new ItemIndex(rows);
    expect(
      index.queryRow("a", { start: 5, end: 6 }).map((item) => item.id),
    ).toEqual(["one"]);
    expect(
      index.queryRow("a", { start: 10, end: 11 }).map((item) => item.id),
    ).toEqual(["milestone"]);
    const hits = new HitTestIndex();
    hits.add(
      0,
      {
        item: rows[0]!.items[0]!,
        rowId: "a",
        visualRect: { x: 0, y: 0, width: 10, height: 10 },
        order: 0,
      },
      20,
    );
    hits.add(
      0,
      {
        item: { id: "two", start: 0, end: 1, data: null },
        rowId: "a",
        visualRect: { x: 0, y: 0, width: 10, height: 10 },
        order: 1,
      },
      20,
    );
    expect(hits.hitTest(5, 5, 20)?.item.id).toBe("two");
    const box = { x: -5, y: -5, width: 17, height: 20 };
    expect(hits.queryRect(box).map((hit) => hit.item.id)).toEqual([
      "one",
      "two",
    ]);
    expect(hits.queryRect(box, "contained").map((hit) => hit.item.id)).toEqual([
      "one",
      "two",
    ]);
  });

  it("uses the supplied visual rectangle as the exact hit area", () => {
    const hits = new HitTestIndex();
    const items = [
      { id: "trip", start: 0, end: 10, data: null },
      { id: "terminal", start: 10, end: 11, data: null },
    ];
    hits.add(0, {
      item: items[0]!,
      rowId: "a",
      visualRect: { x: 0, y: 0, width: 100, height: 20 },
      order: 0,
    });
    hits.add(0, {
      item: items[1]!,
      rowId: "a",
      visualRect: { x: 90, y: 0, width: 12, height: 20 },
      order: 1,
    });

    expect(hits.hitTest(97, 10, 20)?.item.id).toBe("terminal");
    expect(hits.hitTest(89, 10, 20)?.item.id).toBe("trip");
    expect(hits.getByItemId("terminal")?.visualRect.width).toBe(12);
  });

  it("uses an optional visual shape after the rectangle hit check", () => {
    const hits = new HitTestIndex();
    const shape = {} as Path2D;
    hits.add(0, {
      item: { id: "background", start: 0, end: 1, data: null },
      rowId: "a",
      visualRect: { x: 0, y: 0, width: 20, height: 20 },
      order: 0,
    });
    hits.add(0, {
      item: { id: "arrow", start: 0, end: 1, data: null },
      rowId: "a",
      visualRect: { x: 0, y: 0, width: 20, height: 20 },
      visualShape: shape,
      order: 1,
    });

    expect(
      hits.hitTest(5, 10, 20, (candidate) => candidate === shape && false)?.item
        .id,
    ).toBe("background");
    expect(
      hits.hitTest(15, 10, 20, (candidate, x) => candidate === shape && x > 10)
        ?.item.id,
    ).toBe("arrow");
  });
});

describe("engine", () => {
  it("keeps exact time geometry separate and renders and hits by visual order", () => {
    const rendered: Array<{
      id: string;
      timeRect: Readonly<ItemRect>;
      visualRect: ItemRect;
      renderOrder: number;
    }> = [];
    const layoutsChanged = vi.fn();
    const engine = createSchedraEngine({
      origin: 0,
      rows: [
        row("a", [
          { id: "badge", start: 0, end: 3_600_000 },
          { id: "trip", start: 0, end: 3_600_000 },
        ]),
      ],
      resolveItemLayouts: ({ layouts }) =>
        layouts.map((layout) => {
          if (layout.item.id === "badge") {
            layout.visualRect.x = 10;
            return {
              ...layout,
              visualRect: {
                ...layout.visualRect,
                y: 7,
                width: 30,
                height: 18,
              },
              renderOrder: 10,
            };
          }
          return {
            ...layout,
            visualRect: { x: 0, y: 7, width: 100, height: 18 },
            renderOrder: 0,
          };
        }),
      renderItem: ({ item, timeRect, visualRect, renderOrder }) => {
        rendered.push({ id: item.id, timeRect, visualRect, renderOrder });
      },
      onItemLayoutsChange: layoutsChanged,
      requestFrame: () => 1,
    });
    engine.attach(canvasLayers());
    engine.setViewport({
      width: 200,
      height: 36,
      scrollLeft: 0,
      scrollTop: 0,
    });
    engine.draw();

    expect(rendered.map(({ id }) => id)).toEqual(["trip", "badge"]);
    expect(rendered[1]!.timeRect.x).toBe(0);
    expect(rendered[1]!.visualRect.x).toBe(10);
    expect(engine.getItemAnchorRect("badge")).toEqual({
      x: 10,
      y: 7,
      width: 30,
      height: 18,
    });
    expect(engine.hitTest(20, 10)?.item.id).toBe("badge");
    expect(layoutsChanged).toHaveBeenCalledOnce();
  });

  it("uses layout overflow to resolve items outside the exact time viewport", () => {
    const rendered = vi.fn();
    const engine = createSchedraEngine({
      origin: 0,
      rows: [row("a", [{ id: "before", start: -60_000, end: -30_000 }])],
      layoutOverflow: 100,
      resolveItemLayouts: ({ layouts }) =>
        layouts.map((layout) => ({
          ...layout,
          visualRect: { ...layout.visualRect, x: 4 },
        })),
      renderItem: rendered,
      requestFrame: () => 1,
    });
    engine.attach(canvasLayers());
    engine.setViewport({
      width: 100,
      height: 36,
      scrollLeft: 0,
      scrollTop: 0,
    });
    engine.draw();

    expect(rendered).toHaveBeenCalledOnce();
    expect(rendered.mock.calls[0]![0].visualRect.x).toBe(4);
  });

  it("reuses a visual shape for precise hits and the selection outline", () => {
    const shape = {} as Path2D;
    const stroke = vi.fn();
    const isPointInPath = vi.fn(
      (candidate: Path2D, x: number) => candidate === shape && x >= 20,
    );
    const engine = createSchedraEngine({
      origin: 0,
      rows: [row("a", [{ id: "arrow", start: 0, end: 3_600_000 }])],
      selection: { selectedItemIds: ["arrow"], activeItemId: "arrow" },
      resolveItemLayouts: ({ layouts }) =>
        layouts.map((layout) => ({
          ...layout,
          visualShape: shape,
        })),
      requestFrame: () => 1,
    });
    engine.attach(
      canvasLayers({
        getTransform: () =>
          ({
            a: 2,
            b: 0,
            c: 0,
            d: 2,
            e: 0,
            f: 0,
          }) as DOMMatrix,
        stroke,
        isPointInPath:
          isPointInPath as unknown as CanvasRenderingContext2D["isPointInPath"],
      }),
    );
    engine.setViewport({
      width: 200,
      height: 36,
      scrollLeft: 0,
      scrollTop: 0,
    });
    engine.draw();

    expect(stroke).toHaveBeenCalledWith(shape);
    expect(engine.hitTest(5, 18)).toBeNull();
    expect(engine.hitTest(15, 18)?.item.id).toBe("arrow");
  });

  it("strokes the selection ring with the themed width just outside the item", () => {
    const roundRect = vi.fn();
    const layers = canvasLayers({ roundRect });
    const engine = createSchedraEngine({
      origin: 0,
      rows: [row("a", [{ id: "trip", start: 0, end: 3_600_000 }])],
      selection: { selectedItemIds: ["trip"], activeItemId: "trip" },
      theme: { selectionWidth: 1, itemRadius: 4 },
      requestFrame: () => 1,
    });
    engine.attach(layers);
    engine.setViewport({
      width: 200,
      height: 36,
      scrollLeft: 0,
      scrollTop: 0,
    });
    engine.draw();

    const context = layers.interaction.getContext("2d")!;
    const anchor = engine.getItemAnchorRect("trip")!;
    const [x, y, width, height, radius] = roundRect.mock.lastCall!;
    expect(context.lineWidth).toBe(1);
    expect(radius).toBe(4.5);
    expect(x).toBe(anchor.x - 0.5);
    expect(y).toBe(anchor.y - 0.5);
    expect(x + width).toBe(anchor.x + anchor.width + 0.5);
    expect(y + height).toBe(anchor.y + anchor.height + 0.5);
  });

  it("can render a row as one batch while preserving item hit regions", () => {
    const renderItems = vi.fn();
    const engine = createSchedraEngine({
      origin: 0,
      rows: [
        row("a", [
          { id: "before", start: 0, end: 1_800_000 },
          { id: "trip", start: 1_800_000, end: 3_600_000 },
        ]),
      ],
      renderItems,
      requestFrame: () => 1,
    });
    engine.attach(canvasLayers());
    engine.setViewport({
      width: 200,
      height: 36,
      scrollLeft: 0,
      scrollTop: 0,
    });
    engine.draw();

    expect(renderItems).toHaveBeenCalledOnce();
    expect(renderItems.mock.calls[0]![0].row.id).toBe("a");
    expect(renderItems.mock.calls[0]![0].items).toHaveLength(2);
    expect(engine.hitTest(25, 18)?.item.id).toBe("before");
    expect(engine.hitTest(75, 18)?.item.id).toBe("trip");
  });

  it("batches invalidations and reports data state", () => {
    const callbacks: FrameRequestCallback[] = [];
    const issues = vi.fn();
    const conflicts = vi.fn();
    const engine = createSchedraEngine({
      origin: 0,
      rows: [row("a", [{ id: "bad", start: 2, end: 1 }])],
      onDataIssues: issues,
      onConflictsChange: conflicts,
      requestFrame(callback) {
        callbacks.push(callback);
        return callbacks.length;
      },
    });
    engine.setViewport({
      width: 100,
      height: 100,
      scrollLeft: 0,
      scrollTop: 0,
    });
    engine.setHoveredItem("missing");
    expect(callbacks).toHaveLength(1);
    expect(issues).toHaveBeenCalledWith([
      expect.objectContaining({ code: "INVALID_TIME_RANGE", itemId: "bad" }),
    ]);
    expect(conflicts).toHaveBeenCalledOnce();
    engine.setRows([row("a", [{ id: "bad", start: 2, end: 1 }])]);
    expect(conflicts).toHaveBeenCalledOnce();
    engine.destroy();
  });

  it("updates conflict visibility without recreating the engine", () => {
    const callbacks: FrameRequestCallback[] = [];
    const conflicts = vi.fn();
    const rows = [
      row("a", [
        { id: "first", start: 0, end: 10 },
        { id: "later", start: 5, end: 15 },
      ]),
    ];
    const engine = createSchedraEngine({
      origin: 0,
      rows,
      conflictVisibility: "show",
      onConflictsChange: conflicts,
      requestFrame(callback) {
        callbacks.push(callback);
        return callbacks.length;
      },
    });
    expect(engine.getConflicts().hiddenItemIds.size).toBe(0);
    engine.setConflictVisibility("hide-later");
    expect(engine.getConflicts().hiddenItemIds).toEqual(new Set(["later"]));
    expect(conflicts).toHaveBeenCalledTimes(2);
    engine.setConflictVisibility("hide-later");
    expect(conflicts).toHaveBeenCalledTimes(2);
    engine.destroy();
  });
});
