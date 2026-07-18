# karst

Headless canvas-based Gantt timeline for large React schedules.

```bash
pnpm add karst react react-dom
```

```tsx
import type { KarstRow } from "karst/core";
import { KarstTimeline } from "karst/react";
```

The optional popover integration also requires Floating UI:

```bash
pnpm add @floating-ui/react
```

```tsx
import { useKarstPopover } from "karst/react-popover";
```

See the [Karst repository](https://github.com/uozanyildiz/karst) for full
documentation and examples.
