import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
  type Placement,
  type UseFloatingReturn,
} from "@floating-ui/react";
import type { KarstController } from "@karst/react";
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef } from "react";

export interface UseKarstPopoverOptions {
  karst: KarstController<any, any>;
  activeItemId: string | null;
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  offset?: number;
}

export interface KarstPopover {
  open: boolean;
  activeItemId: string | null;
  floatingStyles: UseFloatingReturn["floatingStyles"];
  floatingRef: UseFloatingReturn["refs"]["setFloating"];
  update(): void;
}

/**
 * Positions one consumer-rendered popover against the active canvas item.
 * No popover DOM is created per item.
 */
export function useKarstPopover({
  karst,
  activeItemId,
  open,
  onOpenChange,
  placement = "top",
  offset: offsetValue = 8,
}: UseKarstPopoverOptions): KarstPopover {
  const [, forceAnchorUpdate] = useReducer((value) => value + 1, 0);
  const latestState = useRef({ activeItemId, open, onOpenChange });
  latestState.current = { activeItemId, open, onOpenChange };
  const floating = useFloating({
    open,
    onOpenChange,
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [offset(offsetValue), flip(), shift({ padding: 8 })],
  });

  const virtualElement = useMemo(
    () => ({
      getBoundingClientRect: () =>
        activeItemId
          ? (karst.getItemAnchorRect(activeItemId) ?? new DOMRect())
          : new DOMRect(),
      getClientRects: () => {
        const rect = activeItemId
          ? (karst.getItemAnchorRect(activeItemId) ?? new DOMRect())
          : new DOMRect();
        return {
          0: rect,
          length: 1,
          item: (index: number) => (index === 0 ? rect : null),
          [Symbol.iterator]: function* () {
            yield rect;
          },
        } as DOMRectList;
      },
    }),
    [activeItemId, karst],
  );

  useLayoutEffect(() => {
    floating.refs.setPositionReference(virtualElement);
  }, [floating.refs, virtualElement]);

  useEffect(
    () =>
      karst.subscribeAnchors(() => {
        const current = latestState.current;
        if (
          current.open &&
          current.activeItemId &&
          !karst.getItemAnchorRect(current.activeItemId)
        ) {
          current.onOpenChange?.(false);
          return;
        }
        forceAnchorUpdate();
        void floating.update();
      }),
    [floating, karst],
  );

  useEffect(() => {
    if (open && !activeItemId) {
      onOpenChange?.(false);
    }
  }, [activeItemId, onOpenChange, open]);

  useEffect(() => {
    const scroller = karst.scrollRef.current;
    if (!scroller || !open) return;
    const closeOnScroll = () => onOpenChange?.(false);
    scroller.addEventListener("scroll", closeOnScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", closeOnScroll);
  }, [karst, onOpenChange, open]);

  return {
    open: open && activeItemId !== null,
    activeItemId,
    floatingStyles: {
      ...floating.floatingStyles,
      visibility: floating.isPositioned ? "visible" : "hidden",
    },
    floatingRef: floating.refs.setFloating,
    update: floating.update,
  };
}
