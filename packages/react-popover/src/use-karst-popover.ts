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
import { useEffect, useMemo, useReducer } from "react";

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

  useEffect(() => {
    floating.refs.setPositionReference(virtualElement);
  }, [floating.refs, virtualElement]);

  useEffect(
    () =>
      karst.subscribeAnchors(() => {
        forceAnchorUpdate();
        void floating.update();
      }),
    [floating, karst],
  );

  useEffect(() => {
    if (open && (!activeItemId || !karst.getItemAnchorRect(activeItemId))) {
      onOpenChange?.(false);
    }
  }, [activeItemId, karst, onOpenChange, open]);

  return {
    open: open && activeItemId !== null,
    activeItemId,
    floatingStyles: floating.floatingStyles,
    floatingRef: floating.refs.setFloating,
    update: floating.update,
  };
}
