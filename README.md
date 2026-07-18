# Schedra

Schedra is a headless, canvas-based Gantt timeline for large React schedules.

It keeps React responsible for application state and UI while a small,
framework-independent engine handles time calculations, virtualization, hit
testing, conflicts, and layered canvas rendering.

> Schedra is in early development. The public API may change before version 1.0.

## Why Schedra?

- Render thousands of rows and up to 100,000 in-memory items.
- Keep item, selection, view, and zoom state inside your application.
- Display hour, day, and week timelines.
- Scroll continuously across time boundaries.
- Select multiple canvas items without creating one DOM node per item.
- Position one shared popover against the active canvas item.
- Detect overlapping items and optionally hide later conflicts.
- Replace the default canvas item renderer and theme.

## Packages

Schedra is published as one package with three entry points:

| Import path              | Purpose                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `schedra/core`           | Framework-independent engine, validation, conflicts, scales, virtualization, hit testing, and rendering. |
| `schedra/react`          | Controlled React hook and timeline components.                                                           |
| `schedra/react-popover`  | Optional Floating UI integration for one shared popover.                                                 |
| Internal `@schedra/demo` | Reference application and performance playground.                                                        |

## Quick example

```tsx
import type { SchedraRow, SelectionChange } from "schedra/core";
import { SchedraTimeline } from "schedra/react";
import { useState } from "react";

type RowData = {
  name: string;
};

type ItemData = {
  title: string;
  color: string;
};

const rows: SchedraRow<RowData, ItemData>[] = [
  {
    id: "team-design",
    data: { name: "Design" },
    items: [
      {
        id: "design-review",
        start: new Date("2026-07-17T09:00:00Z").getTime(),
        end: new Date("2026-07-17T10:30:00Z").getTime(),
        data: {
          title: "Design review",
          color: "#ff5c35",
        },
      },
    ],
  },
];

export function Schedule() {
  const [selection, setSelection] = useState<SelectionChange>({
    selectedItemIds: [],
    activeItemId: null,
  });

  return (
    <SchedraTimeline
      rows={rows}
      range={{
        start: new Date("2026-07-17T00:00:00Z").getTime(),
        end: new Date("2026-07-19T00:00:00Z").getTime(),
      }}
      view="hour"
      zoom={1}
      rowHeight={42}
      timeZone="UTC"
      selectedItemIds={selection.selectedItemIds}
      activeItemId={selection.activeItemId}
      onSelectionChange={setSelection}
      renderRowLabel={({ row }) => row.data.name}
      style={{ width: "100%", height: 520 }}
    />
  );
}
```

Schedra treats item times as half-open intervals: `[start, end)`. An item ending
at `10:00` does not conflict with another item starting at `10:00`.

## Documentation

- [Getting started](docs/GETTING_STARTED.md)
- [React guide](docs/REACT_GUIDE.md)
- [Shared popovers](docs/POPOVERS.md)
- [Conflicts and validation](docs/CONFLICTS_AND_VALIDATION.md)
- [Custom rendering and themes](docs/CUSTOM_RENDERING.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Full project definition](PROEJCT.md)

## Run the repository

Requirements:

- Node.js 20 or newer
- pnpm 10

```bash
pnpm install
pnpm dev
```

The development command starts the React demo.

## Verify the workspace

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
pnpm format:check
```

## Publishing

See [RELEASING.md](RELEASING.md) for npm login, scope setup, verification, and
the ordered release command.

## Current scope

Version one includes:

- Immutable, application-owned row data
- Controlled view, pointer-centered zoom, click and box multi-selection, and
  active item
- Fixed-height virtualized rows
- Vertically overscanned canvas buffers for smooth scrolling
- Sticky time headers and row labels with configurable size, styles, and
  renderers
- Timezone-aware hour, day, and week views
- Configurable Monday-aligned week ticks
- Layered canvas rendering
- Optional hover events
- Shared popover positioning
- Popovers that close when timeline navigation starts
- Conflict detection
- Structured invalid-data reporting
- Direct conflict and data-issue inspection
- Milestones where `start === end`

Deferred:

- Dragging and resizing
- Dependency lines
- Gap calculation
- Lazy data loading
- Web Workers
- Touch optimization
- Accessibility and keyboard navigation

## License

Schedra is available under the [MIT License](LICENSE).
