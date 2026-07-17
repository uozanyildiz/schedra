import type { KarstController } from "@karst/react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useKarstPopover } from "./use-karst-popover.js";

function createController(scroller: HTMLDivElement | null = null) {
  const anchors = new Map<string, DOMRect>();
  const listeners = new Set<() => void>();
  const controller = {
    scrollRef: { current: scroller },
    getItemAnchorRect: (itemId: string) => anchors.get(itemId) ?? null,
    subscribeAnchors: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  } as unknown as KarstController;

  return {
    controller,
    setAnchor(itemId: string, rect: DOMRect | null) {
      if (rect) anchors.set(itemId, rect);
      else anchors.delete(itemId);
      for (const listener of listeners) listener();
    },
  };
}

describe("useKarstPopover", () => {
  it("stays open but hidden until the first anchor is ready", async () => {
    const source = createController();
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useKarstPopover({
        karst: source.controller,
        activeItemId: "item-1",
        open: true,
        onOpenChange,
      }),
    );

    expect(result.current.open).toBe(true);
    expect(result.current.floatingStyles.visibility).toBe("hidden");
    expect(onOpenChange).not.toHaveBeenCalled();

    const floatingElement = document.createElement("div");
    document.body.append(floatingElement);
    act(() => result.current.floatingRef(floatingElement));
    act(() => source.setAnchor("item-1", new DOMRect(120, 80, 60, 20)));

    await waitFor(() =>
      expect(result.current.floatingStyles.visibility).toBe("visible"),
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    floatingElement.remove();
  });

  it("requests close when open without an active item", async () => {
    const source = createController();
    const onOpenChange = vi.fn();
    renderHook(() =>
      useKarstPopover({
        karst: source.controller,
        activeItemId: null,
        open: true,
        onOpenChange,
      }),
    );

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("requests close when an anchor disappears after positioning", async () => {
    const source = createController();
    const onOpenChange = vi.fn();
    source.setAnchor("item-1", new DOMRect(40, 50, 80, 24));
    const { result } = renderHook(() =>
      useKarstPopover({
        karst: source.controller,
        activeItemId: "item-1",
        open: true,
        onOpenChange,
      }),
    );
    const floatingElement = document.createElement("div");
    document.body.append(floatingElement);
    act(() => result.current.floatingRef(floatingElement));

    await waitFor(() =>
      expect(result.current.floatingStyles.visibility).toBe("visible"),
    );
    act(() => source.setAnchor("item-1", null));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    floatingElement.remove();
  });

  it("repositions when the active anchor changes", async () => {
    const source = createController();
    source.setAnchor("item-1", new DOMRect(20, 30, 40, 20));
    const { result } = renderHook(() =>
      useKarstPopover({
        karst: source.controller,
        activeItemId: "item-1",
        open: true,
        onOpenChange: vi.fn(),
      }),
    );
    const floatingElement = document.createElement("div");
    document.body.append(floatingElement);
    act(() => result.current.floatingRef(floatingElement));
    await waitFor(() =>
      expect(result.current.floatingStyles.visibility).toBe("visible"),
    );

    const before = result.current.floatingStyles.transform;
    act(() => source.setAnchor("item-1", new DOMRect(220, 130, 40, 20)));
    await waitFor(() =>
      expect(result.current.floatingStyles.transform).not.toBe(before),
    );
    floatingElement.remove();
  });

  it("requests close when the timeline scrolls", () => {
    const scroller = document.createElement("div");
    const source = createController(scroller);
    const onOpenChange = vi.fn();
    source.setAnchor("item-1", new DOMRect(20, 30, 40, 20));
    renderHook(() =>
      useKarstPopover({
        karst: source.controller,
        activeItemId: "item-1",
        open: true,
        onOpenChange,
      }),
    );

    act(() => scroller.dispatchEvent(new Event("scroll")));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
