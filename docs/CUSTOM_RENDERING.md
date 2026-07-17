# Custom rendering and themes

Karst ships a default canvas renderer. Consumers can adjust its theme or replace
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

<KarstTimeline theme={theme} {...props} />;
```

You may pass a partial theme. Missing properties use Karst defaults.

## Draw custom items

```tsx
import type { RenderItem } from "@karst/core";

type ItemData = {
  title: string;
  color: string;
  progress: number;
};

const renderItem: RenderItem<ItemData> = ({
  context,
  item,
  rect,
  state,
  theme,
}) => {
  context.save();

  context.beginPath();
  context.roundRect(rect.x, rect.y, rect.width, rect.height, theme.itemRadius);

  context.fillStyle = state.active
    ? theme.selectionColor
    : state.conflicted
      ? theme.conflictColor
      : item.data.color;

  context.fill();

  if (rect.width > 70) {
    context.clip();
    context.fillStyle = theme.itemText;
    context.font = theme.font;
    context.textBaseline = "middle";
    context.fillText(item.data.title, rect.x + 8, rect.y + rect.height / 2);
  }

  context.restore();
};

<KarstTimeline renderItem={renderItem} {...props} />;
```

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

Use this state only for drawing. Do not mutate application state or Karst from
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
<KarstTimeline
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

Karst mounts labels only for virtualized visible rows.
