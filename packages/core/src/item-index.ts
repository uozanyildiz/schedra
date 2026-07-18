import type {
  HitRegion,
  ItemRect,
  SchedraItem,
  SchedraRow,
  TimeRange,
} from "./types.js";

export class ItemIndex<TData = unknown> {
  readonly itemsById = new Map<
    string,
    { item: SchedraItem<TData>; rowId: string }
  >();
  readonly itemsByRow = new Map<string, readonly SchedraItem<TData>[]>();

  constructor(rows: readonly SchedraRow<unknown, TData>[]) {
    for (const row of rows) {
      const sorted = [...row.items].sort((a, b) => a.start - b.start);
      this.itemsByRow.set(row.id, sorted);
      for (const item of sorted)
        this.itemsById.set(item.id, { item, rowId: row.id });
    }
  }

  queryRow(rowId: string, range: TimeRange): readonly SchedraItem<TData>[] {
    const items = this.itemsByRow.get(rowId) ?? [];
    const result: SchedraItem<TData>[] = [];
    for (const item of items) {
      if (item.start >= range.end) break;
      if (
        item.start === item.end
          ? item.start >= range.start
          : item.end > range.start
      ) {
        result.push(item);
      }
    }
    return result;
  }
}

export class HitTestIndex<TData = unknown> {
  private byRow = new Map<number, HitRegion<TData>[]>();
  private byItem = new Map<string, HitRegion<TData>>();
  clear(): void {
    this.byRow.clear();
    this.byItem.clear();
  }
  add(
    rowIndex: number,
    region: HitRegion<TData>,
    rowHeight = region.visualRect.height,
  ): void {
    const finalRow = Math.floor(
      (region.visualRect.y +
        Math.max(0, region.visualRect.height - Number.EPSILON)) /
        Math.max(1, rowHeight),
    );
    for (let index = rowIndex; index <= finalRow; index++) {
      const regions = this.byRow.get(index) ?? [];
      regions.push(region);
      this.byRow.set(index, regions);
    }
    this.byItem.set(region.item.id, region);
  }
  hitTest(x: number, y: number, rowHeight: number): HitRegion<TData> | null {
    const regions = this.byRow.get(Math.floor(y / rowHeight)) ?? [];
    for (let index = regions.length - 1; index >= 0; index--) {
      const region = regions[index]!;
      if (contains(region.visualRect, x, y)) return region;
    }
    return null;
  }
  getByItemId(itemId: string): HitRegion<TData> | null {
    return this.byItem.get(itemId) ?? null;
  }
  queryRect(
    rect: ItemRect,
    match: "intersect" | "contained" = "intersect",
  ): readonly HitRegion<TData>[] {
    const matches: HitRegion<TData>[] = [];
    for (const region of this.byItem.values()) {
      if (
        match === "contained"
          ? containsRect(rect, region.visualRect)
          : intersects(rect, region.visualRect)
      ) {
        matches.push(region);
      }
    }
    return matches.sort((a, b) => a.order - b.order);
  }
}

function contains(rect: ItemRect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
}

function intersects(a: ItemRect, b: ItemRect): boolean {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}

function containsRect(outer: ItemRect, inner: ItemRect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}
