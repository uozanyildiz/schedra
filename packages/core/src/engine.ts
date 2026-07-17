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
  KarstRow,
  KarstSelection,
  KarstTheme,
  KarstView,
  KarstViewport,
  RenderItem,
  TimeRange,
} from "./types.js";
import { validateRows } from "./validation.js";
import { getVisibleRowRange } from "./virtualization.js";

export interface KarstEngineOptions<TRowData = unknown, TItemData = unknown> {
  rows?: readonly KarstRow<TRowData, TItemData>[];
  view?: KarstView;
  origin: number;
  zoom?: number;
  timeZone?: string;
  weekStartsOn?: number;
  rowHeight?: number;
  overscan?: number;
  conflictVisibility?: ConflictVisibility;
  selection?: KarstSelection;
  hoveredItemId?: string | null;
  theme?: Partial<KarstTheme>;
  renderItem?: RenderItem<TItemData>;
  onDataIssues?: (issues: readonly DataIssue[]) => void;
  onConflictsChange?: (result: ConflictResult) => void;
  onVisibleRangeChange?: (range: TimeRange) => void;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
}

export class KarstEngine<TRowData = unknown, TItemData = unknown> {
  private layers: CanvasLayers | null = null;
  private rows: readonly KarstRow<TRowData, TItemData>[] = [];
  private itemIndex = new ItemIndex<TItemData>([]);
  private readonly hitIndex = new HitTestIndex<TItemData>();
  private conflicts: ConflictResult = emptyConflicts();
  private conflictKey = "";
  private dataIssues: DataIssue[] = [];
  private issueKey = "";
  private viewport: KarstViewport = {
    width: 0,
    height: 0,
    scrollLeft: 0,
    scrollTop: 0,
  };
  private selection: KarstSelection;
  private hoveredItemId: string | null;
  private view: KarstView;
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
  private readonly theme: KarstTheme;
  private readonly renderItem: RenderItem<TItemData>;
  private lastVisibleRange = "";

  constructor(
    private readonly options: KarstEngineOptions<TRowData, TItemData>,
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

  setRows(rows: readonly KarstRow<TRowData, TItemData>[]): void {
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

  setViewport(viewport: KarstViewport): void {
    this.viewport = {
      width: Math.max(0, viewport.width),
      height: Math.max(0, viewport.height),
      scrollLeft: Math.max(0, viewport.scrollLeft),
      scrollTop: Math.max(0, viewport.scrollTop),
    };
    this.invalidate();
  }

  setTimeScale(view: KarstView, zoom: number, origin = this.origin): void {
    this.view = view;
    this.zoom = zoom;
    this.origin = origin;
    this.invalidate();
  }

  setSelection(selection: KarstSelection): void {
    this.selection = selection;
    this.invalidate("interaction");
  }

  setHoveredItem(itemId: string | null): void {
    this.hoveredItemId = itemId;
    this.invalidate("interaction");
  }

  getConflicts(): ConflictResult {
    return this.conflicts;
  }

  getDataIssues(): readonly DataIssue[] {
    return this.dataIssues;
  }

  getItemAnchorRect(itemId: string): ItemRect | null {
    return this.hitIndex.getByItemId(itemId)?.rect ?? null;
  }

  getDataItem(itemId: string) {
    return this.itemIndex.itemsById.get(itemId) ?? null;
  }

  hitTest(x: number, y: number): HitRegion<TItemData> | null {
    return this.hitIndex.hitTest(x, y, this.rowHeight);
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
      if (context)
        this.drawItems(
          context,
          scale,
          timeRange,
          rowRange.startIndex,
          rowRange.endIndex,
        );
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
      for (const item of this.itemIndex.queryRow(row.id, range)) {
        if (this.conflicts.hiddenItemIds.has(item.id)) continue;
        const milestone = item.start === item.end;
        const width = milestone
          ? this.theme.itemHeight
          : scale.rangeToWidth(item);
        const rect: ItemRect = {
          x: scale.timestampToX(item.start) - this.viewport.scrollLeft,
          y:
            rowIndex * this.rowHeight -
            this.viewport.scrollTop +
            (this.rowHeight - this.theme.itemHeight) / 2,
          width,
          height: this.theme.itemHeight,
        };
        this.renderItem({
          context,
          item,
          rect,
          state: {
            selected: this.selection.selectedItemIds.includes(item.id),
            active: this.selection.activeItemId === item.id,
            hovered: this.hoveredItemId === item.id,
            conflicted: this.conflicts.conflictedItemIds.has(item.id),
            hiddenByConflict: false,
            milestone,
          },
          theme: this.theme,
        });
        this.hitIndex.add(
          Math.floor(rect.y / this.rowHeight),
          { item, rowId: row.id, rect, order: order++ },
          this.rowHeight,
        );
      }
    }
  }

  private drawInteraction(context: CanvasRenderingContext2D): void {
    for (const id of this.selection.selectedItemIds)
      this.strokeRegion(context, id, this.theme.selectionColor, 2);
    if (this.hoveredItemId)
      this.strokeRegion(context, this.hoveredItemId, this.theme.hoverColor, 1);
  }

  private strokeRegion(
    context: CanvasRenderingContext2D,
    itemId: string,
    color: string,
    width: number,
  ): void {
    const rect = this.hitIndex.getByItemId(itemId)?.rect;
    if (!rect) return;
    context.save();
    context.strokeStyle = color;
    context.lineWidth = width;
    context.strokeRect(rect.x - 1, rect.y - 1, rect.width + 2, rect.height + 2);
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

export function createKarstEngine<TRowData = unknown, TItemData = unknown>(
  options: KarstEngineOptions<TRowData, TItemData>,
): KarstEngine<TRowData, TItemData> {
  return new KarstEngine(options);
}

function emptyConflicts(): ConflictResult {
  return {
    conflicts: [],
    conflictedItemIds: new Set(),
    hiddenItemIds: new Set(),
  };
}
