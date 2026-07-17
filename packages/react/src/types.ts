import type {
  ConflictVisibility,
  DataIssue,
  ItemRect,
  KarstConflict,
  KarstRow,
  KarstSelection,
  KarstTheme,
  KarstView,
  RenderItem,
  SelectionChange,
  TimeRange,
} from "@karst/core";
import type { CSSProperties, ReactNode, RefObject } from "react";

export interface KarstVisibleRange extends TimeRange {
  rowStartIndex: number;
  rowEndIndex: number;
}

export interface UseKarstOptions<
  TRowData = unknown,
  TItemData = unknown,
> extends KarstSelection {
  rows: readonly KarstRow<TRowData, TItemData>[];
  range: TimeRange;
  view: KarstView;
  zoom: number;
  rowHeight?: number;
  overscan?: number;
  timeZone?: string;
  weekStartsOn?: number;
  conflictVisibility?: ConflictVisibility;
  theme?: Partial<KarstTheme>;
  renderItem?: RenderItem<TItemData>;
  onSelectionChange: (selection: SelectionChange) => void;
  onHoverChange?: (itemId: string | null) => void;
  onVisibleRangeChange?: (range: KarstVisibleRange) => void;
  onDataIssues?: (issues: readonly DataIssue[]) => void;
  onConflictsChange?: (conflicts: readonly KarstConflict[]) => void;
}

export interface KarstController<TRowData = unknown, TItemData = unknown> {
  readonly options: UseKarstOptions<TRowData, TItemData>;
  readonly scrollRef: RefObject<HTMLDivElement | null>;
  getConflicts(): readonly KarstConflict[];
  getDataIssues(): readonly DataIssue[];
  getItemAnchorRect(itemId: string): DOMRect | null;
  subscribeAnchors(listener: () => void): () => void;
  scrollToTime(timestamp: number): void;
  scrollToRow(rowId: string): void;
  scrollToItem(itemId: string): void;
}

export interface KarstViewportProps<TRowData = unknown, TItemData = unknown> {
  karst: KarstController<TRowData, TItemData>;
  className?: string;
  style?: CSSProperties;
  labelWidth?: number;
  renderRowLabel?: (args: {
    row: KarstRow<TRowData, TItemData>;
    index: number;
  }) => ReactNode;
}

export interface KarstTimelineProps<
  TRowData = unknown,
  TItemData = unknown,
> extends UseKarstOptions<TRowData, TItemData> {
  className?: string;
  style?: CSSProperties;
  labelWidth?: number;
  renderRowLabel?: KarstViewportProps<TRowData, TItemData>["renderRowLabel"];
}

export interface ItemAnchorSnapshot {
  itemId: string;
  rect: ItemRect;
}
