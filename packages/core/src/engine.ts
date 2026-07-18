import { detectConflicts } from "./conflicts.js";
import { calculateTimelineTicks } from "./calendar.js";
import { HitTestIndex, ItemIndex } from "./item-index.js";
import {
  clearLayer,
  defaultRenderItem,
  defaultTheme,
  resizeCanvasLayers,
} from "./renderer.js";
import { createTimeScale, visibleTimeRange } from "./time-scale.js";
import type {
  CanvasLayerName,
  CanvasLayers,
  ConflictResult,
  ConflictVisibility,
  DataIssue,
  HitRegion,
  ItemRect,
  ItemLayout,
  SchedraRow,
  SchedraSelection,
  SchedraTheme,
  SchedraView,
  SchedraViewport,
  RenderItem,
  RenderItems,
  ResolveItemLayouts,
  TimeRange,
} from "./types.js";
import { validateRows } from "./validation.js";
import { getVisibleRowRange } from "./virtualization.js";

export interface SchedraEngineOptions<TRowData = unknown, TItemData = unknown> {
  rows?: readonly SchedraRow<TRowData, TItemData>[];
  view?: SchedraView;
  origin: number;
  zoom?: number;
  timeZone?: string;
  weekStartsOn?: number;
  rowHeight?: number;
  overscan?: number;
  conflictVisibility?: ConflictVisibility;
  selection?: SchedraSelection;
  hoveredItemId?: string | null;
  theme?: Partial<SchedraTheme>;
  renderItem?: RenderItem<TItemData>;
  renderItems?: RenderItems<TRowData, TItemData>;
  resolveItemLayouts?: ResolveItemLayouts<TRowData, TItemData>;
  layoutOverflow?: number;
  onDataIssues?: (issues: readonly DataIssue[]) => void;
  onConflictsChange?: (result: ConflictResult) => void;
  onVisibleRangeChange?: (range: TimeRange) => void;
  onItemLayoutsChange?: () => void;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
}

export class SchedraEngine<TRowData = unknown, TItemData = unknown> {
  private layers: CanvasLayers | null = null;
  private rows: readonly SchedraRow<TRowData, TItemData>[] = [];
  private itemIndex = new ItemIndex<TItemData>([]);
  private readonly hitIndex = new HitTestIndex<TItemData>();
  private conflicts: ConflictResult = emptyConflicts();
  private conflictKey = "";
  private dataIssues: DataIssue[] = [];
  private issueKey = "";
  private viewport: SchedraViewport = {
    width: 0,
    height: 0,
    scrollLeft: 0,
    scrollTop: 0,
  };
  private selection: SchedraSelection;
  private hoveredItemId: string | null;
  private selectionBox: ItemRect | null = null;
  private view: SchedraView;
  private zoom: number;
  private origin: number;
  private readonly timeZone: string;
  private readonly weekStartsOn: number;
  private frameId: number | null = null;
  private invalidLayers = new Set<CanvasLayerName>([
    "grid",
    "items",
    "interaction",
  ]);
  private readonly rowHeight: number;
  private readonly overscan: number;
  private conflictVisibility: ConflictVisibility;
  private readonly theme: SchedraTheme;
  private readonly renderItem: RenderItem<TItemData>;
  private readonly renderItems: RenderItems<TRowData, TItemData> | undefined;
  private readonly resolveItemLayouts:
    ResolveItemLayouts<TRowData, TItemData> | undefined;
  private readonly layoutOverflow: number;
  private lastVisibleRange = "";

  constructor(
    private readonly options: SchedraEngineOptions<TRowData, TItemData>,
  ) {
    this.origin = options.origin;
    this.view = options.view ?? "hour";
    this.zoom = options.zoom ?? 1;
    this.timeZone = options.timeZone ?? "UTC";
    this.weekStartsOn = options.weekStartsOn ?? 1;
    this.rowHeight = options.rowHeight ?? 36;
    this.overscan = options.overscan ?? 2;
    this.conflictVisibility = options.conflictVisibility ?? "show";
    this.selection = options.selection ?? {
      selectedItemIds: [],
      activeItemId: null,
    };
    this.hoveredItemId = options.hoveredItemId ?? null;
    this.theme = { ...defaultTheme, ...options.theme };
    this.renderItem =
      options.renderItem ?? (defaultRenderItem as RenderItem<TItemData>);
    this.renderItems = options.renderItems;
    this.resolveItemLayouts = options.resolveItemLayouts;
    this.layoutOverflow = Math.max(0, options.layoutOverflow ?? 0);
    this.setRows(options.rows ?? []);
  }

  attach(layers: CanvasLayers): void {
    this.layers = layers;
    this.invalidate();
  }

  detach(): void {
    if (this.frameId !== null) this.cancelFrame(this.frameId);
    this.frameId = null;
    this.layers = null;
    this.hitIndex.clear();
  }

  destroy(): void {
    this.detach();
  }

  setRows(rows: readonly SchedraRow<TRowData, TItemData>[]): void {
    const validated = validateRows(rows);
    this.rows = validated.rows;
    this.itemIndex = new ItemIndex(validated.rows);
    this.conflicts = detectConflicts(validated.rows, this.conflictVisibility);
    this.dataIssues = validated.issues;
    const nextIssueKey = JSON.stringify(validated.issues);
    if (nextIssueKey !== this.issueKey) {
      this.issueKey = nextIssueKey;
      this.options.onDataIssues?.(validated.issues);
    }
    this.reportConflictsIfChanged();
    this.invalidate("items", "interaction");
  }

  setConflictVisibility(visibility: ConflictVisibility): void {
    if (visibility === this.conflictVisibility) return;
    this.conflictVisibility = visibility;
    this.conflicts = detectConflicts(this.rows, visibility);
    this.reportConflictsIfChanged();
    this.invalidate("items", "interaction");
  }

  setViewport(viewport: SchedraViewport): void {
    this.viewport = {
      width: Math.max(0, viewport.width),
      height: Math.max(0, viewport.height),
      scrollLeft: Math.max(0, viewport.scrollLeft),
      scrollTop: Math.max(0, viewport.scrollTop),
    };
    this.invalidate();
  }

  setTimeScale(view: SchedraView, zoom: number, origin = this.origin): void {
    this.view = view;
    this.zoom = zoom;
    this.origin = origin;
    this.invalidate();
  }

  setSelection(selection: SchedraSelection): void {
    this.selection = selection;
    this.invalidate("interaction");
  }

  setHoveredItem(itemId: string | null): void {
    this.hoveredItemId = itemId;
    this.invalidate("interaction");
  }

  setSelectionBox(rect: ItemRect | null): void {
    this.selectionBox = rect;
    this.invalidate("interaction");
  }

  getConflicts(): ConflictResult {
    return this.conflicts;
  }

  getDataIssues(): readonly DataIssue[] {
    return this.dataIssues;
  }

  getItemAnchorRect(itemId: string): ItemRect | null {
    return this.hitIndex.getByItemId(itemId)?.visualRect ?? null;
  }

  getDataItem(itemId: string) {
    return this.itemIndex.itemsById.get(itemId) ?? null;
  }

  hitTest(x: number, y: number): HitRegion<TItemData> | null {
    return this.hitIndex.hitTest(x, y, this.rowHeight);
  }

  getItemsInRect(
    rect: ItemRect,
    match: "intersect" | "contained" = "intersect",
  ): readonly HitRegion<TItemData>[] {
    return this.hitIndex.queryRect(rect, match);
  }

  invalidate(...layers: CanvasLayerName[]): void {
    if (layers.length) layers.forEach((layer) => this.invalidLayers.add(layer));
    else
      ["grid", "items", "interaction"].forEach((layer) =>
        this.invalidLayers.add(layer as CanvasLayerName),
      );
    if (this.frameId !== null) return;
    this.frameId = this.requestFrame(() => {
      this.frameId = null;
      this.draw();
    });
  }

  draw(): void {
    if (!this.layers) return;
    const { width, height } = this.viewport;
    resizeCanvasLayers(this.layers, width, height);
    const scale = createTimeScale({
      view: this.view,
      origin: this.origin,
      zoom: this.zoom,
    });
    const timeRange = visibleTimeRange(scale, this.viewport.scrollLeft, width);
    const rowRange = getVisibleRowRange(
      this.rows.length,
      this.rowHeight,
      this.viewport.scrollTop,
      height,
      this.overscan,
    );
    const visibleKey = `${timeRange.start}:${timeRange.end}`;
    if (visibleKey !== this.lastVisibleRange) {
      this.lastVisibleRange = visibleKey;
      this.options.onVisibleRangeChange?.(timeRange);
    }
    if (this.invalidLayers.has("grid")) {
      const context = clearLayer(this.layers, "grid", width, height);
      if (context)
        this.drawGrid(context, rowRange.startIndex, rowRange.endIndex);
    }
    if (this.invalidLayers.has("items")) {
      const context = clearLayer(this.layers, "items", width, height);
      if (context) {
        this.drawItems(
          context,
          scale,
          timeRange,
          rowRange.startIndex,
          rowRange.endIndex,
        );
        this.options.onItemLayoutsChange?.();
      }
    }
    if (this.invalidLayers.has("interaction")) {
      const context = clearLayer(this.layers, "interaction", width, height);
      if (context) this.drawInteraction(context);
    }
    this.invalidLayers.clear();
  }

  private drawGrid(
    context: CanvasRenderingContext2D,
    start: number,
    end: number,
  ): void {
    context.fillStyle = this.theme.background;
    context.fillRect(0, 0, this.viewport.width, this.viewport.height);
    for (let index = start; index < end; index++) {
      const y = index * this.rowHeight - this.viewport.scrollTop;
      context.fillStyle =
        index % 2
          ? this.theme.alternateRowBackground
          : this.theme.rowBackground;
      context.fillRect(0, y, this.viewport.width, this.rowHeight);
      context.fillStyle = this.theme.gridLine;
      context.fillRect(0, y + this.rowHeight - 1, this.viewport.width, 1);
    }
    const scale = createTimeScale({
      view: this.view,
      origin: this.origin,
      zoom: this.zoom,
    });
    const timeRange = visibleTimeRange(
      scale,
      this.viewport.scrollLeft,
      this.viewport.width,
    );
    const ticks = calculateTimelineTicks({
      range: timeRange,
      view: this.view,
      timeZone: this.timeZone,
      weekStartsOn: this.weekStartsOn,
    });
    for (const tick of ticks) {
      const x = scale.timestampToX(tick.timestamp) - this.viewport.scrollLeft;
      context.fillStyle = tick.major
        ? this.theme.majorGridLine
        : this.theme.gridLine;
      context.fillRect(Math.round(x), 0, 1, this.viewport.height);
    }
  }

  private drawItems(
    context: CanvasRenderingContext2D,
    scale: ReturnType<typeof createTimeScale>,
    range: TimeRange,
    start: number,
    end: number,
  ): void {
    this.hitIndex.clear();
    let order = 0;
    for (let rowIndex = start; rowIndex < end; rowIndex++) {
      const row = this.rows[rowIndex]!;
      const layouts = this.createItemLayouts(row, rowIndex, scale, range);
      const renderedItems = layouts.map(
        ({ item, timeRect, visualRect, renderOrder }) => {
          const resolvedRenderOrder = renderOrder ?? 0;
          const milestone = item.start === item.end;
          return {
            item,
            timeRect,
            visualRect,
            renderOrder: resolvedRenderOrder,
            state: {
              selected: this.selection.selectedItemIds.includes(item.id),
              active: this.selection.activeItemId === item.id,
              hovered: this.hoveredItemId === item.id,
              conflicted: this.conflicts.conflictedItemIds.has(item.id),
              hiddenByConflict: false,
              milestone,
            },
          };
        },
      );
      if (this.renderItems) {
        this.renderItems({
          context,
          row,
          items: renderedItems,
          theme: this.theme,
        });
      } else {
        for (const renderedItem of renderedItems) {
          this.renderItem({
            context,
            ...renderedItem,
            theme: this.theme,
          });
        }
      }
      for (const { item, visualRect } of layouts) {
        this.hitIndex.add(
          Math.floor(visualRect.y / this.rowHeight),
          { item, rowId: row.id, visualRect, order: order++ },
          this.rowHeight,
        );
      }
    }
  }

  private createItemLayouts(
    row: SchedraRow<TRowData, TItemData>,
    rowIndex: number,
    scale: ReturnType<typeof createTimeScale>,
    range: TimeRange,
  ): readonly ItemLayout<TItemData>[] {
    const overflowTime =
      this.layoutOverflow /
      Math.max(scale.pixelsPerMillisecond, Number.EPSILON);
    const queryRange = {
      start: range.start - overflowTime,
      end: range.end + overflowTime,
    };
    const layouts = this.itemIndex
      .queryRow(row.id, queryRange)
      .filter((item) => !this.conflicts.hiddenItemIds.has(item.id))
      .map((item) => {
        const milestone = item.start === item.end;
        const timeRect: Readonly<ItemRect> = Object.freeze({
          x: scale.timestampToX(item.start) - this.viewport.scrollLeft,
          y:
            rowIndex * this.rowHeight -
            this.viewport.scrollTop +
            (this.rowHeight - this.theme.itemHeight) / 2,
          width: milestone ? this.theme.itemHeight : scale.rangeToWidth(item),
          height: this.theme.itemHeight,
        });
        return {
          item,
          timeRect,
          visualRect: { ...timeRect },
          renderOrder: 0,
        };
      });
    const baselineById = new Map(
      layouts.map((layout) => [
        layout.item.id,
        {
          timeRect: layout.timeRect,
          visualRect: { ...layout.visualRect },
        },
      ]),
    );
    const resolved = this.resolveItemLayouts?.({ row, layouts });
    if (!resolved) return layouts;

    const resolvedById = new Map(
      resolved
        .filter(({ item, visualRect }) => isValidRect(visualRect) && item.id)
        .map(({ item, visualRect, renderOrder }) => [
          item.id,
          {
            visualRect: { ...visualRect },
            renderOrder: Number.isFinite(renderOrder) ? renderOrder : 0,
          },
        ]),
    );
    return layouts
      .map((layout, sourceIndex) => {
        const resolvedLayout = resolvedById.get(layout.item.id);
        const baseline = baselineById.get(layout.item.id)!;
        return {
          item: layout.item,
          timeRect: baseline.timeRect,
          visualRect: resolvedLayout?.visualRect ?? baseline.visualRect,
          renderOrder: resolvedLayout?.renderOrder ?? 0,
          sourceIndex,
        };
      })
      .sort(
        (first, second) =>
          first.renderOrder - second.renderOrder ||
          first.sourceIndex - second.sourceIndex,
      );
  }

  private drawInteraction(context: CanvasRenderingContext2D): void {
    for (const id of this.selection.selectedItemIds)
      this.strokeRegion(context, id, this.theme.selectionColor, 2);
    if (this.hoveredItemId)
      this.strokeRegion(context, this.hoveredItemId, this.theme.hoverColor, 1);
    if (this.selectionBox) {
      context.save();
      context.fillStyle = this.theme.selectionColor;
      context.globalAlpha = 0.12;
      context.fillRect(
        this.selectionBox.x,
        this.selectionBox.y,
        this.selectionBox.width,
        this.selectionBox.height,
      );
      context.globalAlpha = 1;
      context.strokeStyle = this.theme.selectionColor;
      context.lineWidth = 1;
      context.setLineDash([4, 3]);
      context.strokeRect(
        this.selectionBox.x + 0.5,
        this.selectionBox.y + 0.5,
        Math.max(0, this.selectionBox.width - 1),
        Math.max(0, this.selectionBox.height - 1),
      );
      context.restore();
    }
  }

  private strokeRegion(
    context: CanvasRenderingContext2D,
    itemId: string,
    color: string,
    width: number,
  ): void {
    const rect = this.hitIndex.getByItemId(itemId)?.visualRect;
    if (!rect) return;
    context.save();
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    context.roundRect(
      rect.x - 1,
      rect.y - 1,
      rect.width + 2,
      rect.height + 2,
      Math.min(this.theme.itemRadius + 1, (rect.height + 2) / 2),
    );
    context.stroke();
    context.restore();
  }

  private requestFrame(callback: FrameRequestCallback): number {
    if (this.options.requestFrame) return this.options.requestFrame(callback);
    if (typeof globalThis.requestAnimationFrame === "function") {
      return globalThis.requestAnimationFrame(callback);
    }
    return Number(globalThis.setTimeout(() => callback(performance.now()), 0));
  }

  private cancelFrame(id: number): void {
    if (this.options.cancelFrame) this.options.cancelFrame(id);
    else if (typeof globalThis.cancelAnimationFrame === "function") {
      globalThis.cancelAnimationFrame(id);
    } else {
      globalThis.clearTimeout(id);
    }
  }

  private reportConflictsIfChanged(): void {
    const nextKey = JSON.stringify({
      conflicts: this.conflicts.conflicts,
      hiddenItemIds: [...this.conflicts.hiddenItemIds],
    });
    if (nextKey === this.conflictKey) return;
    this.conflictKey = nextKey;
    this.options.onConflictsChange?.(this.conflicts);
  }
}

function isValidRect(rect: ItemRect): boolean {
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width >= 0 &&
    rect.height >= 0
  );
}

export function createSchedraEngine<TRowData = unknown, TItemData = unknown>(
  options: SchedraEngineOptions<TRowData, TItemData>,
): SchedraEngine<TRowData, TItemData> {
  return new SchedraEngine(options);
}

function emptyConflicts(): ConflictResult {
  return {
    conflicts: [],
    conflictedItemIds: new Set(),
    hiddenItemIds: new Set(),
  };
}
