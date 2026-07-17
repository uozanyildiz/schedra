import { createTimeScale, detectConflicts, validateRows } from "@karst/core";
import type { DataIssue, KarstConflict } from "@karst/core";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { KarstController, UseKarstOptions } from "./types.js";

export function pixelsPerMillisecond(
  view: "hour" | "day" | "week",
  zoom: number,
): number {
  return createTimeScale({ view, origin: 0, zoom }).pixelsPerMillisecond;
}

export function useKarst<TRowData = unknown, TItemData = unknown>(
  options: UseKarstOptions<TRowData, TItemData>,
): KarstController<TRowData, TItemData> {
  const scrollRef = useRef<HTMLDivElement>(null);
  const anchorsRef = useRef(new Map<string, DOMRect>());
  const listenersRef = useRef(new Set<() => void>());
  const latestOptions = useRef(options);
  latestOptions.current = options;
  const itemIds = useMemo(
    () =>
      new Set(
        options.rows.flatMap((row) => row.items.map((item) => item.id)),
      ),
    [options.rows],
  );
  const inspectionRef = useRef<{
    rows: UseKarstOptions<TRowData, TItemData>["rows"] | null;
    conflictVisibility: UseKarstOptions<
      TRowData,
      TItemData
    >["conflictVisibility"];
    conflicts: readonly KarstConflict[];
    dataIssues: readonly DataIssue[];
  }>({
    rows: null,
    conflictVisibility: undefined,
    conflicts: [],
    dataIssues: [],
  });

  const inspectData = useCallback(() => {
    const current = latestOptions.current;
    const cached = inspectionRef.current;
    if (
      cached.rows === current.rows &&
      cached.conflictVisibility === current.conflictVisibility
    ) {
      return cached;
    }
    const validated = validateRows(current.rows);
    const next = {
      rows: current.rows,
      conflictVisibility: current.conflictVisibility,
      conflicts: detectConflicts(
        validated.rows,
        current.conflictVisibility ?? "show",
      ).conflicts,
      dataIssues: validated.issues,
    };
    inspectionRef.current = next;
    return next;
  }, []);

  const getConflicts = useCallback(
    () => inspectData().conflicts,
    [inspectData],
  );
  const getDataIssues = useCallback(
    () => inspectData().dataIssues,
    [inspectData],
  );

  const subscribeAnchors = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  const getItemAnchorRect = useCallback(
    (itemId: string) => anchorsRef.current.get(itemId) ?? null,
    [],
  );

  const scrollToTime = useCallback((timestamp: number) => {
    const current = latestOptions.current;
    const target =
      (timestamp - current.range.start) *
      pixelsPerMillisecond(current.view, current.zoom);
    scrollRef.current?.scrollTo({
      left: Math.max(0, target),
      behavior: "auto",
    });
  }, []);

  const scrollToRow = useCallback((rowId: string) => {
    const current = latestOptions.current;
    const index = current.rows.findIndex((row) => row.id === rowId);
    if (index < 0) return;
    scrollRef.current?.scrollTo({
      top: index * (current.rowHeight ?? 40),
      behavior: "smooth",
    });
  }, []);

  const scrollToItem = useCallback((itemId: string) => {
    const current = latestOptions.current;
    const rowIndex = current.rows.findIndex((row) =>
      row.items.some((item) => item.id === itemId),
    );
    if (rowIndex < 0) return;
    const item = current.rows[rowIndex]?.items.find(
      (candidate) => candidate.id === itemId,
    );
    if (!item) return;
    scrollRef.current?.scrollTo({
      left: Math.max(
        0,
        (item.start - current.range.start) *
          pixelsPerMillisecond(current.view, current.zoom),
      ),
      top: rowIndex * (current.rowHeight ?? 40),
      behavior: "smooth",
    });
  }, []);

  const controller = useMemo(
    () => ({
      get options() {
        return latestOptions.current;
      },
      scrollRef,
      getConflicts,
      getDataIssues,
      getItemAnchorRect,
      subscribeAnchors,
      scrollToTime,
      scrollToRow,
      scrollToItem,
      /** @internal */
      _anchors: anchorsRef,
      /** @internal */
      _notifyAnchors() {
        for (const listener of listenersRef.current) listener();
      },
    }),
    [
      getItemAnchorRect,
      getConflicts,
      getDataIssues,
      scrollToItem,
      scrollToRow,
      scrollToTime,
      subscribeAnchors,
    ],
  );

  /* eslint-disable react-hooks/exhaustive-deps -- Depending on the complete
     options object would repeat the 100k-item cleanup scan on every consumer
     render. Only selection-relevant fields belong here. */
  useEffect(() => {
    const nextIds = options.selectedItemIds.filter((id) => itemIds.has(id));
    const nextActive =
      options.activeItemId && itemIds.has(options.activeItemId)
        ? options.activeItemId
        : null;
    if (
      nextIds.length !== options.selectedItemIds.length ||
      nextActive !== options.activeItemId
    ) {
      options.onSelectionChange({
        selectedItemIds: nextIds,
        activeItemId: nextActive,
      });
    }
  }, [
    options.activeItemId,
    itemIds,
    options.onSelectionChange,
    options.selectedItemIds,
  ]);
  /* eslint-enable react-hooks/exhaustive-deps */

  return controller;
}
