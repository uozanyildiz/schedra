import type {
  CanvasLayerName,
  CanvasLayers,
  ItemRect,
  KarstItem,
  KarstTheme,
  RenderItem,
} from "./types.js";

export const defaultTheme: KarstTheme = {
  background: "#ffffff",
  rowBackground: "#ffffff",
  alternateRowBackground: "#f8fafc",
  gridLine: "#e2e8f0",
  majorGridLine: "#94a3b8",
  itemFill: "#2563eb",
  itemText: "#ffffff",
  selectionColor: "#0f172a",
  hoverColor: "#38bdf8",
  conflictColor: "#dc2626",
  milestoneFill: "#7c3aed",
  font: "12px sans-serif",
  itemHeight: 22,
  itemRadius: 4,
};

export function resizeCanvasLayers(
  layers: CanvasLayers,
  width: number,
  height: number,
  pixelRatio = globalThis.devicePixelRatio ?? 1,
): void {
  const ratio = Math.max(1, Math.min(2, pixelRatio));
  for (const canvas of Object.values(layers)) {
    const physicalWidth = Math.max(1, Math.round(width * ratio));
    const physicalHeight = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== physicalWidth) canvas.width = physicalWidth;
    if (canvas.height !== physicalHeight) canvas.height = physicalHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.getContext("2d")?.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
}

export function clearLayer(
  layers: CanvasLayers,
  layer: CanvasLayerName,
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  const context = layers[layer].getContext("2d");
  context?.clearRect(0, 0, width, height);
  return context;
}

export const defaultRenderItem: RenderItem = ({
  context,
  item,
  visualRect,
  state,
  theme,
}) => {
  context.save();
  context.fillStyle = state.conflicted ? theme.conflictColor : theme.itemFill;
  if (state.milestone) {
    const size = Math.min(visualRect.height, 12);
    context.translate(visualRect.x, visualRect.y + visualRect.height / 2);
    context.rotate(Math.PI / 4);
    context.fillStyle = theme.milestoneFill;
    context.fillRect(-size / 2, -size / 2, size, size);
  } else {
    roundedRect(context, visualRect, theme.itemRadius);
    context.fill();
    const label = labelFor(item);
    if (label && visualRect.width > 18) {
      context.beginPath();
      context.rect(
        visualRect.x + 4,
        visualRect.y,
        Math.max(0, visualRect.width - 8),
        visualRect.height,
      );
      context.clip();
      context.fillStyle = theme.itemText;
      context.font = theme.font;
      context.textBaseline = "middle";
      context.fillText(
        label,
        visualRect.x + 6,
        visualRect.y + visualRect.height / 2,
      );
    }
  }
  context.restore();
};

function labelFor(item: KarstItem): string {
  const data = item.data;
  if (typeof data === "string") return data;
  if (data && typeof data === "object" && "label" in data)
    return String(data.label);
  return item.id;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  rect: ItemRect,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, rect.height / 2, rect.width / 2));
  context.beginPath();
  context.roundRect(rect.x, rect.y, rect.width, rect.height, r);
}
