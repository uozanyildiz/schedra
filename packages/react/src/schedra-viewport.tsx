import {
  calculateTimelineTicks,
  createSchedraEngine,
  createTimeScale,
  getVisibleRowRange,
  type CanvasLayers,
  type SchedraEngine,
} from "@schedra/core";
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
  SchedraController,
  SchedraViewportProps,
  SchedraVisibleRange,
} from "./types.js";
import { pixelsPerMillisecond } from "./use-schedra.js";

type InternalController = SchedraController & {
  _anchors: RefObject<Map<string, DOMRect>>;
  _notifyAnchors(): void;
};

export function calculatePointerCenteredScroll({
  origin,
  view,
  previousZoom,
  nextZoom,
  scrollLeft,
  pointerX,
}: {
  origin: number;
  view: "hour" | "day" | "week";
  previousZoom: number;
  nextZoom: number;
  scrollLeft: number;
  pointerX: number;
}): number {
  const previousScale = createTimeScale({
    view,
    origin,
    zoom: previousZoom,
  });
  const nextScale = createTimeScale({ view, origin, zoom: nextZoom });
  const timestamp = previousScale.xToTimestamp(scrollLeft + pointerX);
  return Math.max(0, nextScale.timestampToX(timestamp) - pointerX);
}

export function calculateVerticalCanvasBuffer({
  scrollTop,
  viewportHeight,
  contentHeight,
  rowHeight,
  overscanRows,
}: {
  scrollTop: number;
  viewportHeight: number;
  contentHeight: number;
  rowHeight: number;
  overscanRows: number;
}) {
  const overscan =
    Math.max(0, Math.floor(overscanRows)) * Math.max(1, rowHeight);
  const before = Math.min(Math.max(0, scrollTop), overscan);
  const remaining = Math.max(
    0,
    contentHeight - Math.max(0, scrollTop) - Math.max(1, viewportHeight),
  );
  const after = Math.min(remaining, overscan);
  return {
    before,
    after,
    scrollTop: Math.max(0, scrollTop - before),
    height: Math.max(1, viewportHeight) + before + after,
  };
}

export function calculateHorizontalCanvasBuffer({
  scrollLeft,
  viewportWidth,
  contentWidth,
  overscanPixels,
}: {
  scrollLeft: number;
  viewportWidth: number;
  contentWidth: number;
  overscanPixels: number;
}) {
  const overscan = Math.max(0, overscanPixels);
  const width = Math.max(1, viewportWidth);
  const before = Math.min(Math.max(0, scrollLeft), overscan);
  const remaining = Math.max(0, contentWidth - Math.max(0, scrollLeft) - width);
  const after = Math.min(remaining, overscan);

  return {
    before,
    after,
    scrollLeft: Math.max(0, scrollLeft - before),
    width: width + before + after,
  };
}

export function SchedraViewport<TRowData = unknown, TItemData = unknown>({
  schedra,
  className,
  style,
  labelWidth = 180,
  horizontalCanvasOverscan = 200,
  verticalCanvasOverscan = 3,
  headerHeight = 32,
  headerStyle,
  cornerHeaderStyle,
  timeHeaderStyle,
  stickyHeader = true,
  stickyRowLabels = true,
  interactionMode = "default",
  boxSelection,
  renderCornerHeader,
  renderTimeHeader,
  renderRowLabel,
}: SchedraViewportProps<TRowData, TItemData>) {
  const gridRef = useRef<HTMLCanvasElement>(null);
  const itemsRef = useRef<HTMLCanvasElement>(null);
  const interactionRef = useRef<HTMLCanvasElement>(null);
  const gridOverlayRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SchedraEngine<TRowData, TItemData> | null>(null);
  const updateAnchorRef = useRef<() => void>(() => {});
  const frameRef = useRef<number | null>(null);
  const horizontalCanvasBufferBeforeRef = useRef(0);
  const horizontalCanvasScrollLeftRef = useRef(0);
  const verticalCanvasScrollTopRef = useRef(0);
  const hoveredRef = useRef<string | null>(null);
  const boxDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    additive: boolean;
    initialIds: readonly string[];
    active: boolean;
  } | null>(null);
  const reportingRef = useRef({
    onConflictsChange: schedra.options.onConflictsChange,
    onDataIssues: schedra.options.onDataIssues,
  });
  reportingRef.current = {
    onConflictsChange: schedra.options.onConflictsChange,
    onDataIssues: schedra.options.onDataIssues,
  };
  const lastPointerXRef = useRef<number | null>(null);
  const previousZoomRef = useRef({
    zoom: schedra.options.zoom,
    view: schedra.options.view,
    origin: schedra.options.range.start,
  });
  const firstVisibleRowRef = useRef<string | null>(null);
  const visibleTimeRef = useRef({ start: 0, end: 0 });
  const [visibleTime, setVisibleTime] = useState({ start: 0, end: 0 });
  const [visibleRows, setVisibleRows] = useState({ start: 0, end: 0 });
  const [viewport, setViewport] = useState({
    width: 1,
    height: 1,
  });
  const [canvasBufferBefore, setCanvasBufferBefore] = useState(0);
  const scrollRef = schedra.scrollRef;
  const resolvedHeaderHeight = Math.max(1, headerHeight);

  /* eslint-disable react-hooks/exhaustive-deps -- The controller exposes current
     options through a stable getter. These fields intentionally recreate the
     engine when construction-only configuration changes. */
  const engine = useMemo(() => {
    const options = schedra.options;
    return createSchedraEngine<TRowData, TItemData>({
      rows: options.rows,
      view: options.view,
      origin: options.range.start,
      zoom: options.zoom,
      timeZone: options.timeZone ?? "UTC",
      weekStartsOn: options.weekStartsOn ?? 1,
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
            ) => schedra.options.renderItem?.(args),
          }),
      ...(options.renderItems === undefined
        ? {}
        : {
            renderItems: (
              args: Parameters<NonNullable<typeof options.renderItems>>[0],
            ) => schedra.options.renderItems?.(args),
          }),
      ...(options.resolveItemLayouts === undefined
        ? {}
        : {
            resolveItemLayouts: (
              args: Parameters<
                NonNullable<typeof options.resolveItemLayouts>
              >[0],
            ) => schedra.options.resolveItemLayouts?.(args) ?? args.layouts,
          }),
      ...(options.layoutOverflow === undefined
        ? {}
        : { layoutOverflow: options.layoutOverflow }),
      onVisibleRangeChange: (range) => {
        visibleTimeRef.current = range;
      },
      onItemLayoutsChange: () => updateAnchorRef.current(),
    });
  }, [
    schedra,
    schedra.options.conflictVisibility,
    schedra.options.overscan,
    Boolean(schedra.options.renderItem),
    Boolean(schedra.options.renderItems),
    Boolean(schedra.options.resolveItemLayouts),
    schedra.options.layoutOverflow,
    schedra.options.rowHeight,
    schedra.options.theme,
    schedra.options.timeZone,
    schedra.options.weekStartsOn,
  ]);
  /* eslint-enable react-hooks/exhaustive-deps */
  engineRef.current = engine;

  useEffect(() => {
    engine.setRows(schedra.options.rows);
    reportingRef.current.onConflictsChange?.(engine.getConflicts().conflicts);
    reportingRef.current.onDataIssues?.(engine.getDataIssues());
  }, [engine, schedra.options.rows]);
  useEffect(() => {
    engine.setSelection({
      selectedItemIds: schedra.options.selectedItemIds,
      activeItemId: schedra.options.activeItemId,
    });
  }, [engine, schedra.options.activeItemId, schedra.options.selectedItemIds]);
  useEffect(() => {
    engine.setTimeScale(
      schedra.options.view,
      schedra.options.zoom,
      schedra.options.range.start,
    );
  }, [
    engine,
    schedra.options.range.start,
    schedra.options.view,
    schedra.options.zoom,
  ]);

  const updateAnchor = useCallback(() => {
    const options = schedra.options;
    const activeId = options.activeItemId;
    const controller = schedra as InternalController;
    const scroller = scrollRef.current;
    const canvas = interactionRef.current;
    if (!activeId || !scroller || !canvas) {
      controller._anchors.current = new Map();
      controller._notifyAnchors();
      return;
    }
    let activeItem: (typeof options.rows)[number]["items"][number] | undefined;
    for (let index = 0; index < options.rows.length; index++) {
      const item = options.rows[index]!.items.find(
        (candidate) => candidate.id === activeId,
      );
      if (item) {
        activeItem = item;
        break;
      }
    }
    if (!activeItem) {
      controller._anchors.current = new Map();
      controller._notifyAnchors();
      return;
    }
    const canvasRect = canvas.getBoundingClientRect();
    const anchorRect = engine.getItemAnchorRect(activeItem.id);
    if (!anchorRect) {
      controller._anchors.current = new Map();
      controller._notifyAnchors();
      return;
    }
    controller._anchors.current = new Map([
      [
        activeId,
        new DOMRect(
          canvasRect.left + anchorRect.x,
          canvasRect.top + anchorRect.y,
          anchorRect.width,
          anchorRect.height,
        ),
      ],
    ]);
    controller._notifyAnchors();
  }, [engine, schedra, scrollRef]);
  updateAnchorRef.current = updateAnchor;

  useLayoutEffect(() => {
    updateAnchor();
  }, [schedra.options.activeItemId, updateAnchor]);

  const pinViewportLayers = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const canvasTransform = `translate(${
      horizontalCanvasScrollLeftRef.current -
      horizontalCanvasBufferBeforeRef.current
    }px, ${verticalCanvasScrollTopRef.current}px)`;
    for (const layer of [
      gridRef.current,
      itemsRef.current,
      interactionRef.current,
      gridOverlayRef.current,
    ]) {
      if (layer) layer.style.transform = canvasTransform;
    }
  }, [scrollRef]);

  const syncViewport = useCallback(() => {
    frameRef.current = null;
    const scroller = scrollRef.current;
    const grid = gridRef.current;
    const items = itemsRef.current;
    const interaction = interactionRef.current;
    if (!scroller || !grid || !items || !interaction) return;
    const options = schedra.options;
    const width = Math.max(1, scroller.clientWidth - labelWidth);
    const height = Math.max(1, scroller.clientHeight - resolvedHeaderHeight);
    const timelineScrollLeft = scroller.scrollLeft;
    const timelineScrollTop = scroller.scrollTop;
    const rowHeight = options.rowHeight ?? 36;
    const timelineWidth = Math.max(
      1,
      (options.range.end - options.range.start) *
        pixelsPerMillisecond(options.view, options.zoom),
    );
    const nextHorizontalBuffer = calculateHorizontalCanvasBuffer({
      scrollLeft: timelineScrollLeft,
      viewportWidth: width,
      contentWidth: timelineWidth,
      overscanPixels: horizontalCanvasOverscan,
    });
    const nextCanvasBuffer = calculateVerticalCanvasBuffer({
      scrollTop: timelineScrollTop,
      viewportHeight: height,
      contentHeight: options.rows.length * rowHeight,
      rowHeight,
      overscanRows: verticalCanvasOverscan,
    });
    horizontalCanvasBufferBeforeRef.current = nextHorizontalBuffer.before;
    horizontalCanvasScrollLeftRef.current = timelineScrollLeft;
    verticalCanvasScrollTopRef.current = timelineScrollTop;
    if (gridOverlayRef.current) {
      gridOverlayRef.current.style.width = `${nextHorizontalBuffer.width}px`;
      gridOverlayRef.current.style.setProperty(
        "--schedra-horizontal-buffer-before",
        `${nextHorizontalBuffer.before}px`,
      );
    }
    setViewport((current) =>
      current.width === width && current.height === height
        ? current
        : { width, height },
    );
    setCanvasBufferBefore((current) =>
      current === nextCanvasBuffer.before ? current : nextCanvasBuffer.before,
    );
    for (const canvas of [grid, items, interaction]) {
      canvas.style.top = `${resolvedHeaderHeight - nextCanvasBuffer.before}px`;
    }
    pinViewportLayers();
    engine.setViewport({
      width: nextHorizontalBuffer.width,
      height: nextCanvasBuffer.height,
      scrollLeft: nextHorizontalBuffer.scrollLeft,
      scrollTop: nextCanvasBuffer.scrollTop,
    });
    const range = getVisibleRowRange(
      options.rows.length,
      rowHeight,
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
    } satisfies SchedraVisibleRange);
    updateAnchor();
  }, [
    engine,
    horizontalCanvasOverscan,
    schedra,
    labelWidth,
    pinViewportLayers,
    resolvedHeaderHeight,
    scrollRef,
    updateAnchor,
    verticalCanvasOverscan,
  ]);

  const scheduleSync = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(syncViewport);
  }, [syncViewport]);

  const currentZoom = schedra.options.zoom;
  const currentView = schedra.options.view;
  const currentOrigin = schedra.options.range.start;
  useLayoutEffect(() => {
    const previous = previousZoomRef.current;
    const scroller = scrollRef.current;
    if (
      scroller &&
      previous.zoom !== currentZoom &&
      previous.view === currentView &&
      previous.origin === currentOrigin
    ) {
      const pointerX =
        lastPointerXRef.current ??
        Math.max(0, (scroller.clientWidth - labelWidth) / 2);
      scroller.scrollLeft = calculatePointerCenteredScroll({
        origin: currentOrigin,
        view: currentView,
        previousZoom: previous.zoom,
        nextZoom: currentZoom,
        scrollLeft: scroller.scrollLeft,
        pointerX,
      });
      syncViewport();
    }
    previousZoomRef.current = {
      zoom: currentZoom,
      view: currentView,
      origin: currentOrigin,
    };
  }, [
    currentOrigin,
    currentView,
    currentZoom,
    labelWidth,
    scrollRef,
    syncViewport,
  ]);

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
    const onScroll = () => {
      pinViewportLayers();
      scheduleSync();
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      scroller.removeEventListener("scroll", onScroll);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [pinViewportLayers, scheduleSync, scrollRef]);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const rowId = firstVisibleRowRef.current;
    if (scroller && rowId) {
      const nextIndex = schedra.options.rows.findIndex(
        (row) => row.id === rowId,
      );
      if (nextIndex >= 0) {
        const rowHeight = schedra.options.rowHeight ?? 36;
        const currentTimelineTop = scroller.scrollTop;
        scroller.scrollTop =
          nextIndex * rowHeight + (currentTimelineTop % rowHeight);
      }
    }
    scheduleSync();
  }, [
    schedra.options.rowHeight,
    schedra.options.rows,
    scheduleSync,
    scrollRef,
  ]);

  const findHit = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return (
      engineRef.current?.hitTest(
        event.clientX - rect.left,
        event.clientY - rect.top,
      ) ?? null
    );
  }, []);

  const pointerPosition = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
        y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
      };
    },
    [],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const drag = boxDragRef.current;
      if (drag) {
        const point = pointerPosition(event);
        const distance = Math.hypot(
          point.x - drag.startX,
          point.y - drag.startY,
        );
        if (
          !drag.active &&
          distance >= (boxSelection?.activationDistance ?? 4)
        ) {
          drag.active = true;
        }
        if (drag.active) {
          engine.setSelectionBox(
            normalizeRect(drag.startX, drag.startY, point),
          );
        }
        return;
      }
      const canvasRect = event.currentTarget.getBoundingClientRect();
      lastPointerXRef.current = Math.max(
        0,
        Math.min(canvasRect.width, event.clientX - canvasRect.left),
      );
      const next = findHit(event)?.item.id ?? null;
      if (next === hoveredRef.current) return;
      hoveredRef.current = next;
      engine.setHoveredItem(next);
      schedra.options.onHoverChange?.(next);
    },
    [
      boxSelection?.activationDistance,
      engine,
      findHit,
      schedra,
      pointerPosition,
    ],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const itemId = findHit(event)?.item.id ?? null;
      if (interactionMode === "box-select" && !itemId) {
        const point = pointerPosition(event);
        event.currentTarget.setPointerCapture(event.pointerId);
        boxDragRef.current = {
          pointerId: event.pointerId,
          startX: point.x,
          startY: point.y,
          additive: event.shiftKey || event.ctrlKey || event.metaKey,
          initialIds: [...schedra.options.selectedItemIds],
          active: false,
        };
        return;
      }
      if (!itemId) {
        schedra.options.onSelectionChange({
          selectedItemIds: [],
          activeItemId: null,
        });
        return;
      }
      const additive = event.shiftKey || event.ctrlKey || event.metaKey;
      if (!additive && schedra.options.activeItemId === itemId) {
        schedra.options.onSelectionChange({
          selectedItemIds: [...schedra.options.selectedItemIds],
          activeItemId: null,
        });
        return;
      }
      const selected = new Set(
        additive ? schedra.options.selectedItemIds : ([] as string[]),
      );
      if (additive && selected.has(itemId)) selected.delete(itemId);
      else selected.add(itemId);
      schedra.options.onSelectionChange({
        selectedItemIds: [...selected],
        activeItemId: selected.has(itemId) ? itemId : null,
      });
    },
    [findHit, interactionMode, schedra, pointerPosition],
  );

  const finishBoxSelection = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const drag = boxDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      boxDragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (!drag.active) {
        engine.setSelectionBox(null);
        if (!drag.additive) {
          schedra.options.onSelectionChange({
            selectedItemIds: [],
            activeItemId: null,
          });
        }
        return;
      }
      const point = pointerPosition(event);
      const rect = normalizeRect(drag.startX, drag.startY, point);
      const matches = engine.getItemsInRect(
        rect,
        boxSelection?.match ?? "intersect",
      );
      const selected = new Set(drag.additive ? drag.initialIds : []);
      for (const match of matches) selected.add(match.item.id);
      engine.setSelectionBox(null);
      schedra.options.onSelectionChange({
        selectedItemIds: [...selected],
        activeItemId: null,
      });
    },
    [boxSelection?.match, engine, schedra, pointerPosition],
  );

  const cancelBoxSelection = useCallback(() => {
    boxDragRef.current = null;
    engine.setSelectionBox(null);
  }, [engine]);

  useEffect(() => {
    if (interactionMode !== "box-select") cancelBoxSelection();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelBoxSelection();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelBoxSelection, interactionMode]);

  const rowHeight = schedra.options.rowHeight ?? 36;
  const timelineWidth = Math.max(
    1,
    (schedra.options.range.end - schedra.options.range.start) *
      pixelsPerMillisecond(schedra.options.view, schedra.options.zoom),
  );
  const timeScale = createTimeScale({
    view: schedra.options.view,
    origin: schedra.options.range.start,
    zoom: schedra.options.zoom,
  });
  const ticks = calculateTimelineTicks({
    range: visibleTime,
    view: schedra.options.view,
    timeZone: schedra.options.timeZone ?? "UTC",
    weekStartsOn: schedra.options.weekStartsOn ?? 1,
    pixelsPerMillisecond: timeScale.pixelsPerMillisecond,
  });
  const tickLeft = (timestamp: number) =>
    timeScale.timestampToX(timestamp) -
    timeScale.timestampToX(visibleTime.start);
  const formatter = new Intl.DateTimeFormat(undefined, {
    timeZone: schedra.options.timeZone ?? "UTC",
    ...(schedra.options.view === "hour"
      ? { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }
      : schedra.options.view === "day"
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
          height:
            resolvedHeaderHeight + schedra.options.rows.length * rowHeight,
          minWidth: "100%",
        }}
      >
        <div
          data-schedra-header=""
          style={{
            position: stickyHeader ? "sticky" : "absolute",
            zIndex: 6,
            left: 0,
            top: 0,
            width: labelWidth + viewport.width,
            height: resolvedHeaderHeight,
            pointerEvents: "none",
            background: "#f8fafc",
            isolation: "isolate",
            ...headerStyle,
          }}
        >
          <div
            data-schedra-corner-header=""
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: labelWidth,
              height: resolvedHeaderHeight,
              boxSizing: "border-box",
              padding: "8px 10px",
              background: "#f8fafc",
              borderRight: "1px solid #cbd5e1",
              borderBottom: "1px solid #cbd5e1",
              font: "12px system-ui, sans-serif",
              ...cornerHeaderStyle,
            }}
          >
            {renderCornerHeader?.({
              width: labelWidth,
              height: resolvedHeaderHeight,
            }) ?? "Rows"}
          </div>
          <div
            data-schedra-time-header=""
            style={{
              position: "absolute",
              left: labelWidth,
              top: 0,
              width: viewport.width,
              height: resolvedHeaderHeight,
              overflow: "hidden",
              background: "#f8fafc",
              borderBottom: "1px solid #cbd5e1",
              font: "11px system-ui, sans-serif",
              ...timeHeaderStyle,
            }}
          >
            {renderTimeHeader?.({
              ticks,
              visibleRange: visibleTime,
              width: viewport.width,
              height: resolvedHeaderHeight,
              view: schedra.options.view,
              timeZone: schedra.options.timeZone ?? "UTC",
              formatTick: (timestamp) => formatter.format(timestamp),
              getTickOffset: tickLeft,
            }) ??
              ticks.map((tick) => (
                <span
                  key={tick.timestamp}
                  style={{
                    position: "absolute",
                    left: tickLeft(tick.timestamp),
                    top: 8,
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatter.format(tick.timestamp)}
                </span>
              ))}
          </div>
        </div>
        <div
          ref={gridOverlayRef}
          style={{
            position: "absolute",
            zIndex: 2,
            pointerEvents: "none",
            left: labelWidth,
            top: resolvedHeaderHeight,
            width: viewport.width,
            height: viewport.height,
          }}
        >
          {ticks.map((tick) => (
            <span
              key={tick.timestamp}
              style={{
                position: "absolute",
                insetBlock: 0,
                left: `calc(${tickLeft(
                  tick.timestamp,
                )}px + var(--schedra-horizontal-buffer-before, 0px))`,
                width: 1,
                background: tick.major
                  ? "rgba(100,116,139,.36)"
                  : "rgba(100,116,139,.18)",
              }}
            />
          ))}
        </div>
        {schedra.options.rows
          .slice(visibleRows.start, visibleRows.end)
          .map((row, offset) => {
            const index = visibleRows.start + offset;
            return (
              <div
                key={row.id}
                style={{
                  position: "absolute",
                  left: 0,
                  top: resolvedHeaderHeight + index * rowHeight,
                  width: labelWidth + timelineWidth,
                  height: rowHeight,
                  pointerEvents: "none",
                }}
              >
                <div
                  data-schedra-row-label=""
                  style={{
                    position: stickyRowLabels ? "sticky" : "absolute",
                    zIndex: 4,
                    left: 0,
                    width: labelWidth,
                    height: rowHeight,
                    pointerEvents: "auto",
                    boxSizing: "border-box",
                    overflow: "hidden",
                    background: "white",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  {renderRowLabel?.({ row, index }) ?? row.id}
                </div>
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
                    schedra.options.onHoverChange?.(null);
                  }
                : undefined
            }
            onPointerDown={index === 2 ? onPointerDown : undefined}
            onPointerUp={index === 2 ? finishBoxSelection : undefined}
            onPointerCancel={index === 2 ? cancelBoxSelection : undefined}
            style={{
              position: "absolute",
              zIndex: index + 1,
              left: labelWidth,
              top: resolvedHeaderHeight - canvasBufferBefore,
              pointerEvents: index === 2 ? "auto" : "none",
              cursor:
                index === 2 && interactionMode === "box-select"
                  ? "crosshair"
                  : undefined,
              touchAction:
                index === 2 && interactionMode === "box-select"
                  ? "none"
                  : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function normalizeRect(
  startX: number,
  startY: number,
  end: { x: number; y: number },
) {
  return {
    x: Math.min(startX, end.x),
    y: Math.min(startY, end.y),
    width: Math.abs(end.x - startX),
    height: Math.abs(end.y - startY),
  };
}
