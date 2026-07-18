# Getting started

This guide shows how to add Karst to a React project and render a controlled
timeline.

## Status

Karst is not published to npm yet. Until packages are published, build the
repository and link the packages locally.

## Local installation

Build and pack Karst:

```bash
cd /path/to/karst
pnpm install
pnpm build
mkdir -p ./artifacts
pnpm --filter karst pack --pack-destination ./artifacts
```

Install the generated tarballs in another project:

```bash
pnpm add \
  /path/to/karst/artifacts/karst-core-0.1.0.tgz \
  /path/to/karst/artifacts/karst-react-0.1.0.tgz
```

For shared popovers, also install:

```bash
pnpm add \
  /path/to/karst/artifacts/karst-react-popover-0.1.0.tgz \
  @floating-ui/react
```

After Karst is published, the expected command will be:

```bash
pnpm add karst react react-dom
```

## Define rows and items

Karst only requires IDs, timestamps, and consumer-owned data.

```tsx
import type { KarstRow } from "karst/core";

type Resource = {
  name: string;
  color: string;
};

type Appointment = {
  title: string;
  status: "planned" | "active" | "complete";
};

const rows: KarstRow<Resource, Appointment>[] = [
  {
    id: "resource-1",
    data: {
      name: "Line 1",
      color: "#2d6cdf",
    },
    items: [
      {
        id: "appointment-1",
        start: new Date("2026-07-17T08:00:00Z").getTime(),
        end: new Date("2026-07-17T09:30:00Z").getTime(),
        data: {
          title: "Morning run",
          status: "planned",
        },
      },
    ],
  },
];
```

Requirements:

- Every row ID must be globally unique.
- Every item ID must be globally unique across the full timeline.
- `start` and `end` are Unix timestamps in milliseconds.
- `end` must be greater than or equal to `start`.
- Replace changed rows and arrays instead of mutating them.

## Add a controlled timeline

```tsx
import type { SelectionChange } from "karst/core";
import { KarstTimeline } from "karst/react";
import { useState } from "react";

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
        end: new Date("2026-07-20T00:00:00Z").getTime(),
      }}
      view="hour"
      zoom={1}
      rowHeight={42}
      overscan={6}
      timeZone="UTC"
      weekStartsOn={1}
      selectedItemIds={selection.selectedItemIds}
      activeItemId={selection.activeItemId}
      onSelectionChange={setSelection}
      renderRowLabel={({ row }) => row.data.name}
      style={{ width: "100%", height: 600 }}
    />
  );
}
```

The timeline needs an explicit height. Without one, its scroll viewport may
collapse.

## Choose a view

```tsx
<KarstTimeline view="hour" {...props} />
<KarstTimeline view="day" {...props} />
<KarstTimeline view="week" {...props} />
```

The view controls the time unit and base scale. It does not change item data.

## Use milestones

A milestone has the same start and end timestamp:

```ts
{
  id: "release",
  start: releaseTime,
  end: releaseTime,
  data: {
    title: "Release"
  }
}
```

Milestones do not create overlap conflicts.

## Next steps

- Use the hook-first API: [React guide](REACT_GUIDE.md)
- Add a shared popover: [Shared popovers](POPOVERS.md)
- Handle overlap conflicts: [Conflicts and validation](CONFLICTS_AND_VALIDATION.md)
- Draw custom bars: [Custom rendering](CUSTOM_RENDERING.md)
