import { useCallback, useEffect, useMemo, useRef } from "react";
import type { KarstController, UseKarstOptions } from "./types.js";

const UNIT_MS = {
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
} as const;

const UNIT_WIDTH = { hour: 96, day: 120, week: 160 } as const;

export function pixelsPerMillisecond(
  view: keyof typeof UNIT_MS,
  zoom: number,
): number {
  return (UNIT_WIDTH[view] * zoom) / UNIT_MS[view];
}

export function useKarst<TRowData = unknown, TItemData = unknown>(
  options: UseKarstOptions<TRowData, TItemData>,
): KarstController<TRowData, TItemData> {
  const scrollRef = useRef<HTMLDivElement>(null);
  const anchorsRef = useRef(new Map<string, DOMRect>());
  const listenersRef = useRef(new Set<() => void>());
  const latestOptions = useRef(options);
  latestOptions.current = options;

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
      behavior: "smooth",
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
    const selected = new Set(
      options.rows.flatMap((row) => row.items.map((i) => i.id)),
    );
    const nextIds = options.selectedItemIds.filter((id) => selected.has(id));
    const nextActive =
      options.activeItemId && selected.has(options.activeItemId)
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
    options.onSelectionChange,
    options.rows,
    options.selectedItemIds,
  ]);
  /* eslint-enable react-hooks/exhaustive-deps */

  return controller;
}
