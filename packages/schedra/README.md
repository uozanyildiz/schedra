# schedra

Headless canvas-based Gantt timeline for large React schedules.

```bash
pnpm add schedra react react-dom
```

```tsx
import type { SchedraRow } from "schedra/core";
import { SchedraTimeline } from "schedra/react";
```

The optional popover integration also requires Floating UI:

```bash
pnpm add @floating-ui/react
```

```tsx
import { useSchedraPopover } from "schedra/react-popover";
```

See the [Schedra repository](https://github.com/uozanyildiz/schedra) for full
documentation and examples.
