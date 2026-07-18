# Shared popovers

Canvas items are pixels, not DOM elements. Schedra therefore uses one shared DOM
popover and positions it against the active item's canvas rectangle.

Do not render one popover for every item. A single shared popover keeps DOM and
memory use stable even when the timeline contains 100,000 items.

## Install

`schedra/react-popover` has a peer dependency on Floating UI:

```bash
pnpm add @floating-ui/react
```

Until Schedra is published, follow the local linking steps in
[Getting started](GETTING_STARTED.md).

## Example

The popover hook needs a controller, so use the hook-first React API.

```tsx
import type { SelectionChange } from "schedra/core";
import { SchedraViewport, useSchedra } from "schedra/react";
import { useSchedraPopover } from "schedra/react-popover";
import { useMemo, useState } from "react";

function Schedule() {
  const [selection, setSelection] = useState<SelectionChange>({
    selectedItemIds: [],
    activeItemId: null,
  });

  const activeEntry = useMemo(() => {
    for (const row of rows) {
      const item = row.items.find(
        (candidate) => candidate.id === selection.activeItemId,
      );

      if (item) return { row, item };
    }

    return null;
  }, [rows, selection.activeItemId]);

  const schedra = useSchedra({
    rows,
    range,
    view: "hour",
    zoom: 1,
    selectedItemIds: selection.selectedItemIds,
    activeItemId: selection.activeItemId,
    onSelectionChange: setSelection,
  });

  const popover = useSchedraPopover({
    schedra,
    activeItemId: selection.activeItemId,
    open: activeEntry !== null,
    placement: "top",
    offset: 8,
    onOpenChange(open) {
      if (!open) {
        setSelection((current) => ({
          selectedItemIds: current.selectedItemIds,
          activeItemId: null,
        }));
      }
    },
  });

  return (
    <>
      <SchedraViewport schedra={schedra} style={{ height: 600 }} />

      {activeEntry && popover.open ? (
        <aside
          ref={popover.floatingRef}
          style={popover.floatingStyles}
          className="item-popover"
        >
          <strong>{activeEntry.item.data.title}</strong>
          <p>
            {new Date(activeEntry.item.start).toLocaleTimeString()}–
            {new Date(activeEntry.item.end).toLocaleTimeString()}
          </p>
          <small>{selection.selectedItemIds.length} selected</small>
        </aside>
      ) : null}
    </>
  );
}
```

The consumer supplies:

- Popover open state
- Active item lookup
- Markup
- Content
- Styling
- Close behavior

The hook supplies:

- Virtual canvas anchor
- Floating styles
- Floating element ref
- Placement offset
- Collision shifting
- Placement flipping
- Anchor updates

## API

```ts
useSchedraPopover({
  schedra,
  activeItemId,
  open,
  onOpenChange,
  placement,
  offset,
});
```

Returned fields:

| Field            | Purpose                                       |
| ---------------- | --------------------------------------------- |
| `open`           | Whether the popover has a usable active item. |
| `activeItemId`   | Current item ID.                              |
| `floatingStyles` | Floating UI position styles.                  |
| `floatingRef`    | Attach this to the popover element.           |
| `update()`       | Request a manual position update.             |

The popover remains hidden until Floating UI has a real item anchor, avoiding a
flash at the page origin. Any timeline scroll calls `onOpenChange(false)`.
Because open state is controlled, the application decides how to clear
`activeItemId` while preserving multi-selection.

## Multi-selection behavior

The popover points to `activeItemId`, not every selected item. Use
`selectedItemIds.length` to show the total selection count or offer bulk
actions.
