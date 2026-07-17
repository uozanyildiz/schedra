export type KarstView = "hour" | "day" | "week";

export type ConflictVisibility = "show" | "hide-later";

export interface KarstItem<TData = unknown> {
  id: string;
  start: number;
  end: number;
  data: TData;
}

export interface KarstRow<TRowData = unknown, TItemData = unknown> {
  id: string;
  data: TRowData;
  items: readonly KarstItem<TItemData>[];
}

export interface TimeRange {
  start: number;
  end: number;
}

export interface VisibleRowRange {
  startIndex: number;
  /** Exclusive. */
  endIndex: number;
}

export interface KarstViewport {
  width: number;
  height: number;
  scrollLeft: number;
  scrollTop: number;
}

export interface KarstSelection {
  selectedItemIds: readonly string[];
  activeItemId: string | null;
}

export interface SelectionChange {
  selectedItemIds: string[];
  activeItemId: string | null;
}

export type DataIssueCode =
  | "DUPLICATE_ROW_ID"
  | "DUPLICATE_ITEM_ID"
  | "INVALID_ITEM_START"
  | "INVALID_ITEM_END"
  | "INVALID_TIME_RANGE";

export interface DataIssue {
  code: DataIssueCode;
  message: string;
  rowId?: string;
  itemId?: string;
}

export interface KarstConflict {
  rowId: string;
  earlierItemId: string;
  laterItemId: string;
  overlapStart: number;
  overlapEnd: number;
}

export interface ItemRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ValidatedData<TRowData = unknown, TItemData = unknown> {
  rows: KarstRow<TRowData, TItemData>[];
  issues: DataIssue[];
}

export interface ConflictResult {
  conflicts: KarstConflict[];
  conflictedItemIds: Set<string>;
  hiddenItemIds: Set<string>;
}

export interface TimeScaleOptions {
  view: KarstView;
  origin: number;
  zoom?: number;
  hourWidth?: number;
  dayWidth?: number;
  weekWidth?: number;
}

export interface TimeScale {
  readonly view: KarstView;
  readonly origin: number;
  readonly pixelsPerMillisecond: number;
  timestampToX(timestamp: number): number;
  xToTimestamp(x: number): number;
  rangeToWidth(range: TimeRange): number;
}

export interface HitRegion<TData = unknown> {
  item: KarstItem<TData>;
  rowId: string;
  visualRect: ItemRect;
  order: number;
}

export interface CanvasLayers {
  grid: HTMLCanvasElement;
  items: HTMLCanvasElement;
  interaction: HTMLCanvasElement;
}

export type CanvasLayerName = keyof CanvasLayers;

export interface RenderItemState {
  selected: boolean;
  active: boolean;
  hovered: boolean;
  conflicted: boolean;
  hiddenByConflict: boolean;
  milestone: boolean;
}

export interface KarstTheme {
  background: string;
  rowBackground: string;
  alternateRowBackground: string;
  gridLine: string;
  majorGridLine: string;
  itemFill: string;
  itemText: string;
  selectionColor: string;
  hoverColor: string;
  conflictColor: string;
  milestoneFill: string;
  font: string;
  itemHeight: number;
  itemRadius: number;
}

export interface RenderItemArgs<TItemData = unknown> {
  context: CanvasRenderingContext2D;
  item: KarstItem<TItemData>;
  timeRect: Readonly<ItemRect>;
  visualRect: ItemRect;
  renderOrder: number;
  state: RenderItemState;
  theme: KarstTheme;
}

export type RenderItem<TItemData = unknown> = (
  args: RenderItemArgs<TItemData>,
) => void;

export interface ItemLayout<TItemData = unknown> {
  item: KarstItem<TItemData>;
  timeRect: Readonly<ItemRect>;
  visualRect: ItemRect;
  renderOrder?: number;
}

export interface ResolveItemLayoutsArgs<
  TRowData = unknown,
  TItemData = unknown,
> {
  row: KarstRow<TRowData, TItemData>;
  layouts: readonly ItemLayout<TItemData>[];
}

export type ResolveItemLayouts<TRowData = unknown, TItemData = unknown> = (
  args: ResolveItemLayoutsArgs<TRowData, TItemData>,
) => readonly ItemLayout<TItemData>[];
