import type { KarstRow } from "@karst/core";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useKarst } from "./use-karst.js";

const baseOptions = {
  range: { start: 0, end: 100 },
  view: "hour" as const,
  zoom: 1,
  selectedItemIds: [] as string[],
  activeItemId: null,
  onSelectionChange: vi.fn(),
};

describe("useKarst inspection", () => {
  it("exposes current conflicts and data issues directly", () => {
    const rows: KarstRow[] = [
      {
        id: "row-1",
        data: null,
        items: [
          { id: "a", start: 10, end: 30, data: null },
          { id: "b", start: 20, end: 40, data: null },
          { id: "invalid", start: 50, end: 45, data: null },
        ],
      },
    ];
    const { result } = renderHook(() => useKarst({ ...baseOptions, rows }));

    expect(result.current.getConflicts()).toEqual([
      expect.objectContaining({
        rowId: "row-1",
        earlierItemId: "a",
        laterItemId: "b",
      }),
    ]);
    expect(result.current.getDataIssues()).toEqual([
      expect.objectContaining({
        code: "INVALID_TIME_RANGE",
        itemId: "invalid",
      }),
    ]);
  });

  it("keeps controller methods stable while returning the latest inspection", () => {
    const initialRows: KarstRow[] = [
      {
        id: "row-1",
        data: null,
        items: [
          { id: "a", start: 10, end: 30, data: null },
          { id: "b", start: 20, end: 40, data: null },
        ],
      },
    ];
    const { result, rerender } = renderHook(
      ({ rows }: { rows: readonly KarstRow[] }) =>
        useKarst({ ...baseOptions, rows }),
      { initialProps: { rows: initialRows } },
    );
    const controller = result.current;
    const getConflicts = controller.getConflicts;

    rerender({
      rows: [
        {
          id: "row-1",
          data: null,
          items: [{ id: "a", start: 10, end: 30, data: null }],
        },
      ],
    });

    expect(result.current).toBe(controller);
    expect(result.current.getConflicts).toBe(getConflicts);
    expect(result.current.getConflicts()).toEqual([]);
  });
});
