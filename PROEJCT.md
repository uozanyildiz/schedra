# Karst project definition

## Summary

Karst is a fast, headless Gantt timeline library for React. It uses layered
canvas rendering and fixed-height row virtualization to display large schedules.
The initial target is 1,000–5,000 rows and up to 100,000 items in memory.

The first consumer is the included React demo. Karst is being built for a small
real project first, but its boundaries and public APIs should be reusable and
public-package quality.

## Packages

```text
karst/
├── packages/
│   ├── core/             @karst/core
│   ├── react/            @karst/react
│   └── react-popover/    @karst/react-popover
├── apps/
│   └── demo/             @karst/demo
├── benchmarks/
├── docs/
├── PROEJCT.md
└── README.md
```

### `@karst/core`

Framework-independent TypeScript. It must not import React or own visual UI.

Responsibilities:

- Validate row and item snapshots.
- Build item indexes.
- Detect overlaps and calculate conflict visibility.
- Convert timestamps to and from pixels.
- Calculate visible rows and time ranges.
- Perform canvas item hit testing.
- Schedule layered canvas drawing.
- Expose item anchor rectangles for overlays.
- Propose controlled selection changes.

### `@karst/react`

React 18 and React 19 adapter.

Responsibilities:

- `useKarst` hook-first API.
- `KarstViewport` for custom layouts.
- `KarstTimeline` as a thin convenience component.
- Attach and clean up the core engine.
- Own DOM and canvas refs.
- Use one scroll owner.
- Observe viewport resizing.
- Virtualize row-label DOM.
- Synchronize controlled props and callbacks.

### `@karst/react-popover`

Optional Floating UI integration.

Responsibilities:

- Manage one shared popover.
- Use the active canvas item's rectangle as a virtual anchor.
- Handle collision, flipping, positioning, and repositioning.
- Leave all markup, content, and visual styling to the consumer.

### `@karst/demo`

React reference application and performance playground.

It should demonstrate:

- Roughly 1,000 rows and 15,000+ items.
- Hour, day, and week views.
- Continuous horizontal time scrolling.
- Controlled zoom and multi-selection.
- A shared item popover.
- Conflict visibility modes.
- Runtime data additions and removals.
- Canvas render statistics where practical.

## Data model

The application owns all persistent data. Karst receives immutable snapshots.

```ts
interface KarstItem<TData = unknown> {
  id: string;
  start: number;
  end: number;
  data: TData;
}

interface KarstRow<TRowData = unknown, TItemData = unknown> {
  id: string;
  data: TRowData;
  items: readonly KarstItem<TItemData>[];
}
```

Rules:

- Row IDs are globally unique.
- Item IDs are globally unique across the full chart.
- Times are Unix timestamps in milliseconds.
- Consumers replace changed arrays and objects instead of mutating them.
- Karst does not provide add, update, or remove data helpers in version one.
- The consumer can store any business fields inside generic `data`.

## Controlled state

The application controls:

- `rows`
- `view`
- `zoom`
- `selectedItemIds`
- `activeItemId`
- Popover open state and content

The engine owns only transient state:

- Pixel scroll offsets
- Visible indexes and time bounds
- Canvas caches
- Hover state
- Hit regions
- Validation and conflict indexes

The active item is separate from the selected ID list. It is the primary item
whose popover is shown.

When selected items disappear from new row data, Karst proposes a cleaned
selection through `onSelectionChange`. If the active item disappears, the
popover closes.

## Selection

- Normal click selects one item and makes it active.
- `Shift`, `Ctrl`, or `Cmd` click adds or removes an item.
- Multi-selection is fully controlled by the consumer.
- The shared popover shows the active, most recently selected item.
- Empty canvas click clears selection and closes the popover.
- Scrolling closes the popover but preserves selection.

Dragging and resizing are not part of version one.

## Time and views

The time scale is continuous and based on exact timestamps.

Views:

- `hour`: one major unit per hour.
- `day`: one major unit per day.
- `week`: one major unit per week.

Horizontal scrolling continues across day, week, and month boundaries. Karst
does not use an infinite-width canvas. It draws the visible portion of the
complete in-memory schedule.

Other rules:

- Display time zone is configurable.
- Weeks begin on Monday by default.
- `weekStartsOn` is configurable.
- Karst uses `Intl.DateTimeFormat`.
- Karst does not depend on a date library.
- Zoom is controlled.
- Zoom is centered on the timestamp under the pointer.
- Zoom never changes the selected view automatically.
- `onVisibleRangeChange` is optional and reports visible timestamps and rows.
- Programmatic navigation supports time, item, and row targets.

Lazy data loading is not included initially.

## Intervals and milestones

Normal items use half-open intervals:

```text
[start, end)
```

Therefore, `09:00–10:00` and `10:00–11:00` touch but do not conflict.

A milestone has `start === end`. Milestones have their own default drawing style
and do not create overlap conflicts.

An item with `end < start` is invalid.

## Conflicts

Rows remain fixed-height. Conflicting items are never placed in extra lanes.

Conflict visibility modes:

```ts
type ConflictVisibility = "show" | "hide-later";
```

- `show`: draw all valid items and mark conflicting state.
- `hide-later`: keep the earliest item visible and hide later overlapping items.

Winner rules:

1. Earlier start time wins.
2. When starts match, the item appearing first in the row array wins.
3. IDs provide a final deterministic tie-breaker if needed.

Hidden items remain in the data and conflict reports.

Conflict results contain:

- Row ID
- Earlier and later item IDs
- Overlap start
- Overlap end

Consumers receive conflicts through a callback and direct inspection API. They
decide whether to show a badge, fault list, warning panel, or other UI.

Gap calculation is deferred.

## Validation and fault reporting

Invalid data must not stop the full chart from rendering.

Karst reports structured issues for:

- Duplicate row IDs
- Duplicate item IDs
- Non-finite start values
- Non-finite end values
- End values earlier than start

Invalid items or rows are skipped. Valid content continues rendering.

`onDataIssues` is called only when the issue list changes, not on each canvas
draw. A direct `getDataIssues()` API is also available.

Overlaps are conflicts, not invalid-data issues.

## Popover management

Karst uses one global popover, never one DOM popover per item.

The core exposes the active item's viewport rectangle. The optional React
popover package turns it into a Floating UI virtual anchor.

The consumer controls:

- Open state
- Active item
- Popover markup
- Displayed fields
- Visual style

The popover package controls:

- Placement
- Flipping
- Viewport collision
- Repositioning

The popover can display exact start and end timestamps, duration, row, progress,
conflict state, and multi-selection count using consumer data.

## Rendering

Karst uses three stacked, viewport-sized canvases:

1. Grid layer — time grid, row backgrounds, and major boundaries.
2. Item layer — bars, milestones, labels, and normal item visuals.
3. Interaction layer — hover, selection, active item, and conflict decoration.

Benefits:

- Hover and selection can redraw without repainting the grid.
- The DOM remains small.
- Canvas size follows the viewport rather than the full schedule.

Only visible rows and visible timestamps are queried and drawn. Drawing is
batched through `requestAnimationFrame`.

The React tree should not update for every raw scroll event unless the consumer
subscribes to visible range changes.

## Styling

Karst provides a configurable default renderer and theme.

The theme controls:

- Backgrounds
- Grid lines
- Item fills and text
- Selection and hover colors
- Conflict color
- Milestone style
- Font
- Item height and radius

Consumers can replace individual render functions such as item, grid, milestone,
and conflict drawing.

`@karst/core` ships no Tailwind CSS or application-specific styling.

## Row labels

- Karst supports consumer-rendered DOM row labels.
- Labels are virtualized so only visible labels are mounted.
- Labels and canvas share one vertical scroll position.
- All rows use one configurable fixed height in version one.
- If no row-label renderer is provided, the row ID is shown.

## Hover

Hover is transient engine state.

- Default renderer can show hover feedback.
- `onItemHoverChange` is optional.
- Hover does not alter controlled selection.
- Popovers open from selection, not hover.

## Performance

Initial target:

- 1,000–5,000 rows.
- Up to 100,000 items in memory.
- Hundreds of visible items.
- Normal visible redraw under 16 ms on a modern desktop browser.

Conflict detection remains on the main thread initially. It is cached per
immutable row. A Web Worker will be considered only if benchmarks show a real
problem.

Rows inserted or removed above the viewport should preserve the visible row by
stable row ID.

## Browser and framework support

- React 18 and React 19.
- Current Chrome, Edge, Firefox, and Safari.
- Desktop mouse and trackpad first.
- Pointer Events are used so touch can be added later.
- Imports are safe in server environments, but canvas mounts only in browsers.
- Mobile and touch optimization are deferred.
- Accessibility, keyboard navigation, and ARIA are not included in version one.

## Testing

Initial tests cover:

- Timestamp and pixel conversion.
- Hour, day, and week scales.
- Visible row range calculation.
- Data validation.
- Half-open conflict detection.
- Milestone behavior.
- `show` and `hide-later` conflict modes.
- Equal-start ordering.
- Controlled multi-selection proposals and cleanup.
- Hit testing.
- React prop synchronization and cleanup.
- A benchmark around 100,000 items.

Browser screenshot testing is not required initially.

## Tooling

- pnpm workspaces
- TypeScript
- Vite
- Vitest
- tsup or TypeScript package builds
- ESLint
- Prettier
- Changesets only if publishing becomes likely

## Deferred work

- Dragging and resizing
- Dependency lines
- Gap calculations
- Lazy data loading
- Web Worker conflict detection
- Touch and mobile optimization
- Accessibility and keyboard support
- Automatic view switching during zoom
- Package publishing and Changesets

## Implementation sequence

1. Define shared types and package contracts.
2. Build and test core validation, conflicts, scales, virtualization, indexing,
   and selection.
3. Build the layered core renderer and engine lifecycle.
4. Build the controlled React adapter.
5. Build optional Floating UI popover integration.
6. Convert the demo to React and consume only public Karst APIs.
7. Run unit tests, type checks, package builds, and the 100,000-item benchmark.
8. Review API consistency and remove demo-specific assumptions from packages.
