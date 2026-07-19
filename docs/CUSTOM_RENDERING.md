# Custom rendering and themes

Schedra ships a default canvas renderer. Consumers can adjust its theme or replace
item drawing completely.

## Theme the default renderer

```tsx
const theme = {
  background: "#f7f4ec",
  rowBackground: "#f7f4ec",
  alternateRowBackground: "#f0ece2",
  gridLine: "rgba(33, 31, 26, 0.08)",
  majorGridLine: "rgba(33, 31, 26, 0.18)",
  itemFill: "#2d6cdf",
  itemText: "#fffdf7",
  selectionColor: "#211f1a",
  hoverColor: "#ff5c35",
  conflictColor: "#d9432f",
  milestoneFill: "#9b6bce",
  font: "11px sans-serif",
  itemHeight: 22,
  itemRadius: 5,
};

<SchedraTimeline theme={theme} {...props} />;
```

You may pass a partial theme. Missing properties use Schedra defaults.

## Draw custom items

```tsx
import type { RenderItem } from "schedra/core";

type ItemData = {
  title: string;
  color: string;
  progress: number;
};

const renderItem: RenderItem<ItemData> = ({
  context,
  item,
  visualRect,
  state,
  theme,
}) => {
  context.save();

  context.beginPath();
  context.roundRect(
    visualRect.x,
    visualRect.y,
    visualRect.width,
    visualRect.height,
    theme.itemRadius,
  );

  context.fillStyle = state.active
    ? theme.selectionColor
    : state.conflicted
      ? theme.conflictColor
      : item.data.color;

  context.fill();

  if (visualRect.width > 70) {
    context.clip();
    context.fillStyle = theme.itemText;
    context.font = theme.font;
    context.textBaseline = "middle";
    context.fillText(
      item.data.title,
      visualRect.x + 8,
      visualRect.y + visualRect.height / 2,
    );
  }

  context.restore();
};

<SchedraTimeline renderItem={renderItem} {...props} />;
```

## Separate time and visual geometry

`timeRect` is the exact rectangle calculated from an item's timestamps. Schedra
keeps it immutable. `visualRect` is the rectangle used for drawing, hit testing,
box selection, selection outlines, and popover anchors.

Use `resolveItemLayouts` when a small marker or badge needs a different visual
size without changing its timestamp:

```tsx
<SchedraTimeline
  resolveItemLayouts={({ layouts }) =>
    layouts.map((layout) => ({
      ...layout,
      visualRect:
        layout.item.data.kind === "badge"
          ? {
              x: layout.timeRect.x - 5,
              y: layout.timeRect.y,
              width: 10,
              height: layout.timeRect.height,
            }
          : { ...layout.timeRect },
      renderOrder: layout.item.data.kind === "badge" ? 10 : 0,
    }))
  }
  layoutOverflow={10}
  {...props}
/>
```

Lower `renderOrder` values draw first. Higher values draw later and receive
pointer hits when visual rectangles overlap. Equal values keep the original
item order. `layoutOverflow` includes nearby time-based items that may be moved
into the viewport by the layout resolver.

### Non-rectangular interaction shapes

Add an optional `visualShape` when an item is not rectangular. Karst reuses the
same `Path2D` for precise pointer hits and hover or selection borders.

```tsx
resolveItemLayouts={({ layouts }) =>
  layouts.map((layout) => {
    if (layout.item.data.kind !== "arrow") return layout;

    const { x, y, width, height } = layout.visualRect;
    const path = new Path2D();
    path.moveTo(x + 16, y);
    path.lineTo(x + width, y);
    path.lineTo(x + width, y + height);
    path.lineTo(x + 16, y + height);
    path.lineTo(x, y + height / 2);
    path.closePath();

    return { ...layout, visualShape: path };
  })
}
```

Custom renderers receive `visualShape` and may fill it with
`context.fill(visualShape)`. If no shape is supplied, Karst keeps the existing
rectangle behavior. Box selection and popover placement continue to use
`visualRect`.

## Render state

The renderer receives:

```ts
interface RenderItemState {
  selected: boolean;
  active: boolean;
  hovered: boolean;
  conflicted: boolean;
  hiddenByConflict: boolean;
  milestone: boolean;
}
```

Use this state only for drawing. Do not mutate application state or Schedra from
inside a render function.

## Canvas safety

Always pair `context.save()` with `context.restore()`. Otherwise one item can
leak clipping, transforms, fonts, colors, or line styles into later items.

Avoid:

- DOM measurement inside `renderItem`
- React state updates inside `renderItem`
- Network requests inside `renderItem`
- Expensive text measurement for every frame
- Creating large images or gradients repeatedly

Cache reusable drawing resources outside the callback when needed.

## Row labels

Row labels are normal React DOM, not canvas:

```tsx
<SchedraTimeline
  renderRowLabel={({ row, index }) => (
    <div className="row-label">
      <span>{index + 1}</span>
      <strong>{row.data.name}</strong>
      <small>{row.items.length} items</small>
    </div>
  )}
  {...props}
/>
```

Schedra mounts labels only for virtualized visible rows.
