import {
  createKarstEngine,
  createTimeScale,
  getVisibleRowRange,
  type CanvasLayers,
  type KarstEngine,
} from "@karst/core";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";
import type {
  KarstController,
  KarstViewportProps,
  KarstVisibleRange,
} from "./types.js";
import { pixelsPerMillisecond } from "./use-karst.js";

type InternalController = KarstController & {
  _anchors: RefObject<Map<string, DOMRect>>;
  _notifyAnchors(): void;
};

export function KarstViewport<TRowData = unknown, TItemData = unknown>({
  karst,
  className,
  style,
  labelWidth = 180,
  renderRowLabel,
}: KarstViewportProps<TRowData, TItemData>) {
  const gridRef = useRef<HTMLCanvasElement>(null);
  const itemsRef = useRef<HTMLCanvasElement>(null);
  const interactionRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<KarstEngine<TRowData, TItemData> | null>(null);
  const frameRef = useRef<number | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const firstVisibleRowRef = useRef<string | null>(null);
  const visibleTimeRef = useRef({ start: 0, end: 0 });
  const [visibleTime, setVisibleTime] = useState({ start: 0, end: 0 });
  const [visibleRows, setVisibleRows] = useState({ start: 0, end: 0 });
  const [viewport, setViewport] = useState({
    width: 1,
    height: 1,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const scrollRef = karst.scrollRef;
  const headerHeight = 32;

  /* eslint-disable react-hooks/exhaustive-deps -- The controller exposes current
     options through a stable getter. These fields intentionally recreate the
     engine when construction-only configuration changes. */
  const engine = useMemo(() => {
    const options = karst.options;
    let isConstructing = true;
    const nextEngine = createKarstEngine<TRowData, TItemData>({
      rows: options.rows,
      view: options.view,
      origin: options.range.start,
      zoom: options.zoom,
      ...(options.rowHeight === undefined
        ? {}
        : { rowHeight: options.rowHeight }),
      ...(options.overscan === undefined ? {} : { overscan: options.overscan }),
      ...(options.conflictVisibility === undefined
        ? {}
        : { conflictVisibility: options.conflictVisibility }),
      selection: {
        selectedItemIds: options.selectedItemIds,
        activeItemId: options.activeItemId,
      },
      hoveredItemId: hoveredRef.current,
      ...(options.theme === undefined ? {} : { theme: options.theme }),
      ...(options.renderItem === undefined
        ? {}
        : {
            renderItem: (
              args: Parameters<NonNullable<typeof options.renderItem>>[0],
            ) => karst.options.renderItem?.(args),
          }),
      ...(options.onDataIssues === undefined
        ? {}
        : { onDataIssues: options.onDataIssues }),
      onConflictsChange: (result) => {
        if (!isConstructing) {
          options.onConflictsChange?.(result.conflicts);
        }
      },
      onVisibleRangeChange: (range) => {
        visibleTimeRef.current = range;
      },
    });
    isConstructing = false;
    return nextEngine;
  }, [
    karst,
    karst.options.conflictVisibility,
    karst.options.overscan,
    Boolean(karst.options.renderItem),
    karst.options.rowHeight,
    karst.options.theme,
  ]);
  /* eslint-enable react-hooks/exhaustive-deps */
  engineRef.current = engine;

  useEffect(() => {
    engine.setRows(karst.options.rows);
  }, [engine, karst.options.rows]);
  useEffect(() => {
    engine.setSelection({
      selectedItemIds: karst.options.selectedItemIds,
      activeItemId: karst.options.activeItemId,
    });
  }, [engine, karst.options.activeItemId, karst.options.selectedItemIds]);
  useEffect(() => {
    engine.setTimeScale(
      karst.options.view,
      karst.options.zoom,
      karst.options.range.start,
    );
  }, [
    engine,
    karst.options.range.start,
    karst.options.view,
    karst.options.zoom,
  ]);

  const updateAnchor = useCallback(() => {
    const options = karst.options;
    const activeId = options.activeItemId;
    const controller = karst as InternalController;
    const scroller = scrollRef.current;
    const canvas = interactionRef.current;
    if (!activeId || !scroller || !canvas) {
      controller._anchors.current = new Map();
      controller._notifyAnchors();
      return;
    }
    let rowIndex = -1;
    let activeItem: (typeof options.rows)[number]["items"][number] | undefined;
    for (let index = 0; index < options.rows.length; index++) {
      const item = options.rows[index]!.items.find(
        (candidate) => candidate.id === activeId,
      );
      if (item) {
        rowIndex = index;
        activeItem = item;
        break;
      }
    }
    if (!activeItem) return;
    const scale = createTimeScale({
      view: options.view,
      origin: options.range.start,
      zoom: options.zoom,
    });
    const rowHeight = options.rowHeight ?? 36;
    const itemHeight = options.theme?.itemHeight ?? 22;
    const canvasRect = canvas.getBoundingClientRect();
    const x = scale.timestampToX(activeItem.start) - scroller.scrollLeft;
    const y =
      rowIndex * rowHeight - scroller.scrollTop + (rowHeight - itemHeight) / 2;
    const width =
      activeItem.start === activeItem.end
        ? itemHeight
        : scale.rangeToWidth(activeItem);
    controller._anchors.current = new Map([
      [
        activeId,
        new DOMRect(canvasRect.left + x, canvasRect.top + y, width, itemHeight),
      ],
    ]);
    controller._notifyAnchors();
  }, [karst, scrollRef]);

  useLayoutEffect(() => {
    updateAnchor();
  }, [karst.options.activeItemId, updateAnchor]);

  const syncViewport = useCallback(() => {
    frameRef.current = null;
    const scroller = scrollRef.current;
    const grid = gridRef.current;
    const items = itemsRef.current;
    const interaction = interactionRef.current;
    if (!scroller || !grid || !items || !interaction) return;
    const options = karst.options;
    const width = Math.max(1, scroller.clientWidth - labelWidth);
    const height = Math.max(1, scroller.clientHeight - headerHeight);
    const timelineScrollLeft = scroller.scrollLeft;
    const timelineScrollTop = scroller.scrollTop;
    setViewport((current) =>
      current.width === width &&
      current.height === height &&
      current.scrollLeft === timelineScrollLeft &&
      current.scrollTop === timelineScrollTop
        ? current
        : {
            width,
            height,
            scrollLeft: timelineScrollLeft,
            scrollTop: timelineScrollTop,
          },
    );
    for (const canvas of [grid, items, interaction]) {
      canvas.style.transform = `translate(${scroller.scrollLeft}px, ${scroller.scrollTop}px)`;
    }
    engine.setViewport({
      width,
      height,
      scrollLeft: timelineScrollLeft,
      scrollTop: timelineScrollTop,
    });
    const range = getVisibleRowRange(
      options.rows.length,
      options.rowHeight ?? 36,
      timelineScrollTop,
      height,
      options.overscan ?? 2,
    );
    setVisibleRows((current) =>
      current.start === range.startIndex && current.end === range.endIndex
        ? current
        : { start: range.startIndex, end: range.endIndex },
    );
    firstVisibleRowRef.current = options.rows[range.startIndex]?.id ?? null;
    const scale = createTimeScale({
      view: options.view,
      origin: options.range.start,
      zoom: options.zoom,
    });
    const timeRange = {
      start: scale.xToTimestamp(timelineScrollLeft),
      end: scale.xToTimestamp(timelineScrollLeft + width),
    };
    visibleTimeRef.current = timeRange;
    setVisibleTime((current) =>
      current.start === timeRange.start && current.end === timeRange.end
        ? current
        : timeRange,
    );
    options.onVisibleRangeChange?.({
      ...timeRange,
      rowStartIndex: range.startIndex,
      rowEndIndex: range.endIndex,
    } satisfies KarstVisibleRange);
    updateAnchor();
  }, [engine, karst, labelWidth, scrollRef, updateAnchor]);

  const scheduleSync = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(syncViewport);
  }, [syncViewport]);

  useLayoutEffect(() => {
    const layers = {
      grid: gridRef.current,
      items: itemsRef.current,
      interaction: interactionRef.current,
    };
    if (!layers.grid || !layers.items || !layers.interaction) return;
    engine.attach(layers as CanvasLayers);
    syncViewport();
    return () => engine.detach();
  }, [engine, syncViewport]);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const observer = new ResizeObserver(scheduleSync);
    observer.observe(scroller);
    scroller.addEventListener("scroll", scheduleSync, { passive: true });
    return () => {
      observer.disconnect();
      scroller.removeEventListener("scroll", scheduleSync);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [scheduleSync, scrollRef]);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const rowId = firstVisibleRowRef.current;
    if (scroller && rowId) {
      const nextIndex = karst.options.rows.findIndex((row) => row.id === rowId);
      if (nextIndex >= 0) {
        const rowHeight = karst.options.rowHeight ?? 36;
        const currentTimelineTop = scroller.scrollTop;
        scroller.scrollTop =
          nextIndex * rowHeight + (currentTimelineTop % rowHeight);
      }
    }
    scheduleSync();
  }, [karst.options.rowHeight, karst.options.rows, scheduleSync, scrollRef]);

  const findHit = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return (
      engineRef.current?.hitTest(
        event.clientX - rect.left,
        event.clientY - rect.top,
      ) ?? null
    );
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const next = findHit(event)?.item.id ?? null;
      if (next === hoveredRef.current) return;
      hoveredRef.current = next;
      engine.setHoveredItem(next);
      karst.options.onHoverChange?.(next);
    },
    [engine, findHit, karst],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const itemId = findHit(event)?.item.id ?? null;
      if (!itemId) {
        karst.options.onSelectionChange({
          selectedItemIds: [],
          activeItemId: null,
        });
        return;
      }
      const additive = event.shiftKey || event.ctrlKey || event.metaKey;
      if (!additive && karst.options.activeItemId === itemId) {
        karst.options.onSelectionChange({
          selectedItemIds: [...karst.options.selectedItemIds],
          activeItemId: null,
        });
        return;
      }
      const selected = new Set(
        additive ? karst.options.selectedItemIds : ([] as string[]),
      );
      if (additive && selected.has(itemId)) selected.delete(itemId);
      else selected.add(itemId);
      karst.options.onSelectionChange({
        selectedItemIds: [...selected],
        activeItemId: selected.has(itemId) ? itemId : null,
      });
    },
    [findHit, karst],
  );

  const rowHeight = karst.options.rowHeight ?? 36;
  const timelineWidth = Math.max(
    1,
    (karst.options.range.end - karst.options.range.start) *
      pixelsPerMillisecond(karst.options.view, karst.options.zoom),
  );
  const unitWidth =
    pixelsPerMillisecond(karst.options.view, karst.options.zoom) *
    (karst.options.view === "hour"
      ? 3_600_000
      : karst.options.view === "day"
        ? 86_400_000
        : 604_800_000);
  const unitMs =
    karst.options.view === "hour"
      ? 3_600_000
      : karst.options.view === "day"
        ? 86_400_000
        : 604_800_000;
  const firstTick =
    Math.floor((visibleTime.start - karst.options.range.start) / unitMs) *
      unitMs +
    karst.options.range.start;
  const ticks: number[] = [];
  for (
    let timestamp = firstTick;
    timestamp <= visibleTime.end + unitMs;
    timestamp += unitMs
  ) {
    ticks.push(timestamp);
  }
  const formatter = new Intl.DateTimeFormat(undefined, {
    timeZone: karst.options.timeZone,
    ...(karst.options.view === "hour"
      ? { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }
      : karst.options.view === "day"
        ? { day: "2-digit", month: "short" }
        : { day: "2-digit", month: "short", year: "numeric" }),
  });

  return (
    <div
      ref={scrollRef}
      className={className}
      style={{ position: "relative", overflow: "auto", ...style }}
    >
      <div
        style={{
          position: "relative",
          width: labelWidth + timelineWidth,
          height: headerHeight + karst.options.rows.length * rowHeight,
          minWidth: "100%",
        }}
      >
        <div
          style={{
            position: "absolute",
            zIndex: 6,
            left: 0,
            top: 0,
            width: labelWidth,
            height: headerHeight,
            transform: `translate(${viewport.scrollLeft}px, ${viewport.scrollTop}px)`,
            boxSizing: "border-box",
            padding: "8px 10px",
            background: "#f8fafc",
            borderRight: "1px solid #cbd5e1",
            borderBottom: "1px solid #cbd5e1",
            font: "12px system-ui, sans-serif",
          }}
        >
          Rows
        </div>
        <div
          style={{
            position: "absolute",
            zIndex: 5,
            left: labelWidth,
            top: 0,
            width: viewport.width,
            height: headerHeight,
            overflow: "hidden",
            transform: `translate(${viewport.scrollLeft}px, ${viewport.scrollTop}px)`,
            background: "#f8fafc",
            borderBottom: "1px solid #cbd5e1",
            font: "11px system-ui, sans-serif",
          }}
        >
          {ticks.map((timestamp) => (
            <span
              key={timestamp}
              style={{
                position: "absolute",
                left:
                  (timestamp - visibleTime.start) *
                  pixelsPerMillisecond(karst.options.view, karst.options.zoom),
                top: 8,
                whiteSpace: "nowrap",
              }}
            >
              {formatter.format(timestamp)}
            </span>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            zIndex: 2,
            pointerEvents: "none",
            left: labelWidth,
            top: headerHeight,
            width: viewport.width,
            height: viewport.height,
            transform: `translate(${viewport.scrollLeft}px, ${viewport.scrollTop}px)`,
            backgroundImage:
              "linear-gradient(to right, rgba(100,116,139,.28) 1px, transparent 1px)",
            backgroundSize: `${unitWidth}px 100%`,
            backgroundPositionX: `${-(
              (visibleTime.start - karst.options.range.start) *
              pixelsPerMillisecond(karst.options.view, karst.options.zoom)
            )}px`,
          }}
        />
        {karst.options.rows
          .slice(visibleRows.start, visibleRows.end)
          .map((row, offset) => {
            const index = visibleRows.start + offset;
            return (
              <div
                key={row.id}
                style={{
                  position: "absolute",
                  zIndex: 4,
                  left: 0,
                  top: headerHeight + index * rowHeight,
                  width: labelWidth,
                  height: rowHeight,
                  boxSizing: "border-box",
                  overflow: "hidden",
                  background: "white",
                  borderBottom: "1px solid #e2e8f0",
                  transform: `translateX(${viewport.scrollLeft}px)`,
                }}
              >
                {renderRowLabel?.({ row, index }) ?? row.id}
              </div>
            );
          })}
        {[gridRef, itemsRef, interactionRef].map((ref, index) => (
          <canvas
            key={index}
            ref={ref}
            onPointerMove={index === 2 ? onPointerMove : undefined}
            onPointerLeave={
              index === 2
                ? () => {
                    hoveredRef.current = null;
                    engine.setHoveredItem(null);
                    karst.options.onHoverChange?.(null);
                  }
                : undefined
            }
            onPointerDown={index === 2 ? onPointerDown : undefined}
            style={{
              position: "absolute",
              zIndex: index + 1,
              left: labelWidth,
              top: headerHeight,
              pointerEvents: index === 2 ? "auto" : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}
