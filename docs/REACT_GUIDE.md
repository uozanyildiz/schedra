# React guide

`@karst/react` provides two integration styles:

- `KarstTimeline` for a compact setup.
- `useKarst` with `KarstViewport` for custom layouts and popovers.

## Component-first usage

`KarstTimeline` creates the controller and viewport for you.

```tsx
<KarstTimeline
  rows={rows}
  range={range}
  view={view}
  zoom={zoom}
  selectedItemIds={selection.selectedItemIds}
  activeItemId={selection.activeItemId}
  onSelectionChange={setSelection}
  style={{ height: 600 }}
/>
```

Use this when the timeline does not need to share its controller with another
component.

## Hook-first usage

Use `useKarst` when you need custom layout, programmatic scrolling, or a shared
popover.

```tsx
import { KarstViewport, useKarst } from "@karst/react";

function Schedule() {
  const karst = useKarst({
    rows,
    range,
    view,
    zoom,
    rowHeight: 42,
    selectedItemIds: selection.selectedItemIds,
    activeItemId: selection.activeItemId,
    onSelectionChange: setSelection,
  });

  return (
    <>
      <button onClick={() => karst.scrollToTime(Date.now())}>Go to now</button>

      <button onClick={() => karst.scrollToItem("item-42")}>
        Find item 42
      </button>

      <KarstViewport
        karst={karst}
        labelWidth={280}
        renderRowLabel={({ row, index }) => (
          <div>
            {index + 1}. {row.data.name}
          </div>
        )}
        style={{ height: 600 }}
      />
    </>
  );
}
```

## Controlled state

Karst never owns your durable application state.

```tsx
const [view, setView] = useState<KarstView>("hour");
const [zoom, setZoom] = useState(1);
const [selection, setSelection] = useState<SelectionChange>({
  selectedItemIds: [],
  activeItemId: null,
});
```

Pass those values to Karst:

```tsx
const karst = useKarst({
  rows,
  range,
  view,
  zoom,
  selectedItemIds: selection.selectedItemIds,
  activeItemId: selection.activeItemId,
  onSelectionChange: setSelection,
});
```

A normal item click selects one item. Holding `Shift`, `Ctrl`, or `Cmd` toggles
an item inside the multi-selection.

`activeItemId` identifies the primary item. It is normally the item whose
popover or details panel is open.

When `zoom` changes, Karst preserves the timestamp under the most recent
timeline pointer position. If the pointer has not entered the timeline, the
viewport center is preserved instead. The browser may clamp this adjustment at
the configured range boundaries.

## Update data

Update your own row state and pass the new immutable value to Karst.

```tsx
setRows((currentRows) =>
  currentRows.map((row) =>
    row.id === targetRowId
      ? {
          ...row,
          items: [...row.items, newItem],
        }
      : row,
  ),
);
```

Do not mutate existing arrays:

```tsx
// Avoid this:
rows[0].items.push(newItem);
```

Immutable row references allow Karst to reuse cached work.

## Observe the viewport

```tsx
const karst = useKarst({
  // Other options...
  onVisibleRangeChange(visible) {
    console.log("Visible time", visible.start, visible.end);
    console.log("Visible rows", visible.rowStartIndex, visible.rowEndIndex);
  },
});
```

This callback is optional. It is useful for:

- Displaying the current time range.
- Synchronizing another timeline.
- Saving and restoring navigation.
- Adding lazy loading later.

## Hover events

```tsx
const karst = useKarst({
  // Other options...
  onHoverChange(itemId) {
    setHoveredItemId(itemId);
  },
});
```

Hover does not change controlled selection.

## Programmatic navigation

```ts
karst.scrollToTime(timestamp);
karst.scrollToRow("row-42");
karst.scrollToItem("item-99");
```

These methods are no-ops when their target does not exist.

## Inspect conflicts and invalid data

Callbacks are useful for notifications. The stable controller methods are
useful when another part of the application needs the current snapshot:

```ts
const conflicts = karst.getConflicts();
const issues = karst.getDataIssues();
```

Both methods return the latest result after immutable `rows` or
`conflictVisibility` changes.

## Calendar boundaries

Set an IANA timezone such as `"Europe/Istanbul"` or `"America/New_York"`.
Day and week ticks are calculated from calendar boundaries in that timezone,
including 23-hour and 25-hour daylight-saving days.

`weekStartsOn` accepts `0` through `6`. Use `1` for Monday, which is the
default.

## Main options

| Option                 | Type                        | Required | Purpose                                   |
| ---------------------- | --------------------------- | -------- | ----------------------------------------- |
| `rows`                 | `readonly KarstRow[]`       | Yes      | Complete immutable row snapshot.          |
| `range`                | `{ start; end }`            | Yes      | Loaded timeline boundary in milliseconds. |
| `view`                 | `"hour" \| "day" \| "week"` | Yes      | Current time scale.                       |
| `zoom`                 | `number`                    | Yes      | Current scale multiplier.                 |
| `selectedItemIds`      | `readonly string[]`         | Yes      | Controlled selection.                     |
| `activeItemId`         | `string \| null`            | Yes      | Primary item.                             |
| `onSelectionChange`    | `(selection) => void`       | Yes      | Receives proposed selection changes.      |
| `rowHeight`            | `number`                    | No       | Fixed height for all rows.                |
| `overscan`             | `number`                    | No       | Extra virtualized rows.                   |
| `timeZone`             | `string`                    | No       | Calendar and label timezone; UTC default. |
| `weekStartsOn`         | `number`                    | No       | First weekday; Monday is `1`.             |
| `conflictVisibility`   | `"show" \| "hide-later"`    | No       | Conflict rendering policy.                |
| `theme`                | `Partial<KarstTheme>`       | No       | Default renderer theme.                   |
| `renderItem`           | `RenderItem`                | No       | Custom canvas item renderer.              |
| `onHoverChange`        | callback                    | No       | Reports hovered item ID.                  |
| `onVisibleRangeChange` | callback                    | No       | Reports visible time and rows.            |
| `onDataIssues`         | callback                    | No       | Reports invalid data.                     |
| `onConflictsChange`    | callback                    | No       | Reports overlaps.                         |
