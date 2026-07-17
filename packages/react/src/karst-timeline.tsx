import { KarstViewport } from "./karst-viewport.js";
import type { KarstTimelineProps } from "./types.js";
import { useKarst } from "./use-karst.js";

export function KarstTimeline<TRowData = unknown, TItemData = unknown>(
  props: KarstTimelineProps<TRowData, TItemData>,
) {
  const { className, style, labelWidth, renderRowLabel, ...options } = props;
  const karst = useKarst(options);
  return (
    <KarstViewport
      karst={karst}
      {...(className === undefined ? {} : { className })}
      {...(style === undefined ? {} : { style })}
      {...(labelWidth === undefined ? {} : { labelWidth })}
      {...(renderRowLabel === undefined ? {} : { renderRowLabel })}
    />
  );
}
