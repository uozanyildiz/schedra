# Karst

Karst is a headless, canvas-based Gantt timeline for large React schedules.

It keeps React responsible for application state and UI while a small,
framework-independent engine handles time calculations, virtualization, hit
testing, conflicts, and layered canvas rendering.

> Karst is in early development and is not published to npm yet.

## Why Karst?

- Render thousands of rows and up to 100,000 in-memory items.
- Keep item, selection, view, and zoom state inside your application.
- Display hour, day, and week timelines.
- Scroll continuously across time boundaries.
- Select multiple canvas items without creating one DOM node per item.
- Position one shared popover against the active canvas item.
- Detect overlapping items and optionally hide later conflicts.
- Replace the default canvas item renderer and theme.

## Packages

| Package                | Purpose                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `@karst/core`          | Framework-independent engine, validation, conflicts, scales, virtualization, hit testing, and rendering. |
| `@karst/react`         | Controlled React hook and timeline components.                                                           |
| `@karst/react-popover` | Optional Floating UI integration for one shared popover.                                                 |
| `@karst/demo`          | Reference application and performance playground.                                                        |

## Quick example

```tsx
import type { KarstRow, SelectionChange } from "@karst/core";
import { KarstTimeline } from "@karst/react";
import { useState } from "react";

type RowData = {
  name: string;
};

type ItemData = {
  title: string;
  color: string;
};

const rows: KarstRow<RowData, ItemData>[] = [
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
    <KarstTimeline
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

Karst treats item times as half-open intervals: `[start, end)`. An item ending
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

## Current scope

Version one includes:

- Immutable, application-owned row data
- Controlled view, zoom, multi-selection, and active item
- Fixed-height virtualized rows
- Hour, day, and week views
- Layered canvas rendering
- Optional hover events
- Shared popover positioning
- Conflict detection
- Structured invalid-data reporting
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

No license has been selected yet. Do not assume permission to redistribute Karst
until a license file is added.
