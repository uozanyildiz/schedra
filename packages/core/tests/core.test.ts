import { describe, expect, it, vi } from "vitest";
import {
  DAY_MS,
  HitTestIndex,
  ItemIndex,
  cleanSelection,
  createKarstEngine,
  createTimeScale,
  detectConflicts,
  getVisibleRowRange,
  proposeSelection,
  validateRows,
  visibleTimeRange,
  type KarstRow,
} from "../src/index.js";

const row = (
  id: string,
  items: Array<{ id: string; start: number; end: number }>,
): KarstRow => ({
  id,
  data: null,
  items: items.map((item) => ({ ...item, data: null })),
});

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
        rect: { x: 0, y: 0, width: 10, height: 10 },
        order: 0,
      },
      20,
    );
    hits.add(
      0,
      {
        item: { id: "two", start: 0, end: 1, data: null },
        rowId: "a",
        rect: { x: 0, y: 0, width: 10, height: 10 },
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
});

describe("engine", () => {
  it("batches invalidations and reports data state", () => {
    const callbacks: FrameRequestCallback[] = [];
    const issues = vi.fn();
    const conflicts = vi.fn();
    const engine = createKarstEngine({
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
    const engine = createKarstEngine({
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
