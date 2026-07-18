# Schedra architecture

## Ownership

The application owns all persistent state:

- Rows and items
- View and zoom
- Selected item IDs
- Active item ID
- Popover open state and content

Schedra owns transient rendering state:

- Pixel scroll offsets
- Visible row and time ranges
- Canvas caches
- Hovered item
- Hit regions
- Validation and conflict indexes

## Packages

### `schedra/core`

No React or UI dependencies. It validates immutable row snapshots, indexes items,
calculates conflicts and visibility, converts timestamps to pixels, virtualizes
fixed-height rows, performs hit testing, and draws layered canvases.

### `schedra/react`

Connects controlled React props to the core engine. It owns DOM refs,
`ResizeObserver`, scroll events, canvas attachment, and virtualized row-label
mounting. It exposes a hook-first API plus thin convenience components.

### `schedra/react-popover`

Optional Floating UI integration. The core engine supplies a virtual anchor
rectangle for the active item. The consumer supplies all content and visual
markup. Only one popover instance exists regardless of item count.

## Time

Items use Unix timestamps in milliseconds. Intervals are half-open:
`[start, end)`. Adjacent items do not conflict. Items with `start === end` are
milestones and do not create conflicts.

The time axis is continuous. Hour, day, and week are display scales rather than
different data models. Week view starts on Monday by default and is configurable.

## Conflicts

Rows remain fixed-height. Conflicts never create lanes.

- `show`: draw all valid items and mark conflicting state.
- `hide-later`: keep the earliest item and hide later overlapping items.

When starts match, row-array order wins. All conflicts remain available through
structured results and callbacks even when an item is hidden.

## Rendering

Three viewport-sized, stacked canvases are used:

1. Grid and row backgrounds
2. Items and milestones
3. Hover, selection, active item, and conflict decoration

Only visible rows and visible time intervals are drawn. Scroll updates are
batched with `requestAnimationFrame`. React is not updated for every raw scroll
event unless a consumer subscribes to visible-range changes.

## Deferred work

- Dragging and resizing
- Dependency lines
- Gap calculations
- Lazy data loading
- Web Workers
- Mobile and touch optimization
- Accessibility and keyboard navigation
