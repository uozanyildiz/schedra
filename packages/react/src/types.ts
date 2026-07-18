import type {
  ConflictVisibility,
  DataIssue,
  ItemRect,
  SchedraConflict,
  SchedraRow,
  SchedraSelection,
  SchedraTheme,
  SchedraView,
  RenderItem,
  RenderItems,
  ResolveItemLayouts,
  SelectionChange,
  TimelineTick,
  TimeRange,
} from "@schedra/core";
import type { CSSProperties, ReactNode, RefObject } from "react";

export interface SchedraVisibleRange extends TimeRange {
  rowStartIndex: number;
  rowEndIndex: number;
}

export interface SchedraCornerHeaderRenderArgs {
  width: number;
  height: number;
}

export interface SchedraTimeHeaderRenderArgs {
  ticks: readonly TimelineTick[];
  visibleRange: TimeRange;
  width: number;
  height: number;
  view: SchedraView;
  timeZone: string;
  formatTick: (timestamp: number) => string;
  getTickOffset: (timestamp: number) => number;
}

export interface UseSchedraOptions<
  TRowData = unknown,
  TItemData = unknown,
> extends SchedraSelection {
  rows: readonly SchedraRow<TRowData, TItemData>[];
  range: TimeRange;
  view: SchedraView;
  zoom: number;
  rowHeight?: number;
  overscan?: number;
  timeZone?: string;
  weekStartsOn?: number;
  conflictVisibility?: ConflictVisibility;
  theme?: Partial<SchedraTheme>;
  renderItem?: RenderItem<TItemData>;
  renderItems?: RenderItems<TRowData, TItemData>;
  resolveItemLayouts?: ResolveItemLayouts<TRowData, TItemData>;
  layoutOverflow?: number;
  onSelectionChange: (selection: SelectionChange) => void;
  onHoverChange?: (itemId: string | null) => void;
  onVisibleRangeChange?: (range: SchedraVisibleRange) => void;
  onDataIssues?: (issues: readonly DataIssue[]) => void;
  onConflictsChange?: (conflicts: readonly SchedraConflict[]) => void;
}

export interface SchedraController<TRowData = unknown, TItemData = unknown> {
  readonly options: UseSchedraOptions<TRowData, TItemData>;
  readonly scrollRef: RefObject<HTMLDivElement | null>;
  getConflicts(): readonly SchedraConflict[];
  getDataIssues(): readonly DataIssue[];
  getItemAnchorRect(itemId: string): DOMRect | null;
  subscribeAnchors(listener: () => void): () => void;
  scrollToTime(timestamp: number): void;
  scrollToRow(rowId: string): void;
  scrollToItem(itemId: string): void;
}

export interface SchedraViewportProps<TRowData = unknown, TItemData = unknown> {
  schedra: SchedraController<TRowData, TItemData>;
  className?: string;
  style?: CSSProperties;
  labelWidth?: number;
  verticalCanvasOverscan?: number;
  headerHeight?: number;
  headerStyle?: CSSProperties;
  cornerHeaderStyle?: CSSProperties;
  timeHeaderStyle?: CSSProperties;
  stickyHeader?: boolean;
  stickyRowLabels?: boolean;
  interactionMode?: "default" | "box-select";
  boxSelection?: {
    match?: "intersect" | "contained";
    activationDistance?: number;
  };
  renderCornerHeader?: (args: SchedraCornerHeaderRenderArgs) => ReactNode;
  renderTimeHeader?: (args: SchedraTimeHeaderRenderArgs) => ReactNode;
  renderRowLabel?: (args: {
    row: SchedraRow<TRowData, TItemData>;
    index: number;
  }) => ReactNode;
}

export interface SchedraTimelineProps<
  TRowData = unknown,
  TItemData = unknown,
> extends UseSchedraOptions<TRowData, TItemData> {
  className?: string;
  style?: CSSProperties;
  labelWidth?: number;
  verticalCanvasOverscan?: number;
  headerHeight?: number;
  headerStyle?: CSSProperties;
  cornerHeaderStyle?: CSSProperties;
  timeHeaderStyle?: CSSProperties;
  stickyHeader?: boolean;
  stickyRowLabels?: boolean;
  interactionMode?: SchedraViewportProps["interactionMode"];
  boxSelection?: SchedraViewportProps["boxSelection"];
  renderCornerHeader?: SchedraViewportProps["renderCornerHeader"];
  renderTimeHeader?: SchedraViewportProps["renderTimeHeader"];
  renderRowLabel?: SchedraViewportProps<TRowData, TItemData>["renderRowLabel"];
}

export interface ItemAnchorSnapshot {
  itemId: string;
  rect: ItemRect;
}
