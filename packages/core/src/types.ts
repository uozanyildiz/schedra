export type SchedraView = "hour" | "day" | "week";

export type ConflictVisibility = "show" | "hide-later";

export interface SchedraItem<TData = unknown> {
  id: string;
  start: number;
  end: number;
  data: TData;
}

export interface SchedraRow<TRowData = unknown, TItemData = unknown> {
  id: string;
  data: TRowData;
  items: readonly SchedraItem<TItemData>[];
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

export interface SchedraViewport {
  width: number;
  height: number;
  scrollLeft: number;
  scrollTop: number;
}

export interface SchedraSelection {
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

export interface SchedraConflict {
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
  rows: SchedraRow<TRowData, TItemData>[];
  issues: DataIssue[];
}

export interface ConflictResult {
  conflicts: SchedraConflict[];
  conflictedItemIds: Set<string>;
  hiddenItemIds: Set<string>;
}

export interface TimeScaleOptions {
  view: SchedraView;
  origin: number;
  zoom?: number;
  hourWidth?: number;
  dayWidth?: number;
  weekWidth?: number;
}

export interface TimeScale {
  readonly view: SchedraView;
  readonly origin: number;
  readonly pixelsPerMillisecond: number;
  timestampToX(timestamp: number): number;
  xToTimestamp(x: number): number;
  rangeToWidth(range: TimeRange): number;
}

export interface HitRegion<TData = unknown> {
  item: SchedraItem<TData>;
  rowId: string;
  visualRect: ItemRect;
  visualShape?: Path2D;
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

export interface SchedraTheme {
  background: string;
  rowBackground: string;
  alternateRowBackground: string;
  gridLine: string;
  majorGridLine: string;
  itemFill: string;
  itemText: string;
  selectionColor: string;
  selectionWidth: number;
  hoverColor: string;
  conflictColor: string;
  milestoneFill: string;
  font: string;
  itemHeight: number;
  itemRadius: number;
}

export interface RenderItemArgs<TItemData = unknown> {
  context: CanvasRenderingContext2D;
  item: SchedraItem<TItemData>;
  timeRect: Readonly<ItemRect>;
  visualRect: ItemRect;
  visualShape?: Path2D;
  renderOrder: number;
  state: RenderItemState;
  theme: SchedraTheme;
}

export type RenderItem<TItemData = unknown> = (
  args: RenderItemArgs<TItemData>,
) => void;

export interface RenderItemsArgs<TRowData = unknown, TItemData = unknown> {
  context: CanvasRenderingContext2D;
  row: SchedraRow<TRowData, TItemData>;
  items: readonly Omit<RenderItemArgs<TItemData>, "context" | "theme">[];
  theme: SchedraTheme;
}

export type RenderItems<TRowData = unknown, TItemData = unknown> = (
  args: RenderItemsArgs<TRowData, TItemData>,
) => void;

export interface ItemLayout<TItemData = unknown> {
  item: SchedraItem<TItemData>;
  timeRect: Readonly<ItemRect>;
  visualRect: ItemRect;
  visualShape?: Path2D;
  renderOrder?: number;
}

export interface ResolveItemLayoutsArgs<
  TRowData = unknown,
  TItemData = unknown,
> {
  row: SchedraRow<TRowData, TItemData>;
  layouts: readonly ItemLayout<TItemData>[];
}

export type ResolveItemLayouts<TRowData = unknown, TItemData = unknown> = (
  args: ResolveItemLayoutsArgs<TRowData, TItemData>,
) => readonly ItemLayout<TItemData>[];
