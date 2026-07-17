import { KarstViewport } from "./karst-viewport.js";
import type { KarstTimelineProps } from "./types.js";
import { useKarst } from "./use-karst.js";

export function KarstTimeline<TRowData = unknown, TItemData = unknown>(
  props: KarstTimelineProps<TRowData, TItemData>,
) {
  const {
    className,
    style,
    labelWidth,
    headerHeight,
    headerStyle,
    cornerHeaderStyle,
    timeHeaderStyle,
    stickyHeader,
    stickyRowLabels,
    interactionMode,
    boxSelection,
    renderCornerHeader,
    renderTimeHeader,
    renderRowLabel,
    ...options
  } = props;
  const karst = useKarst(options);
  return (
    <KarstViewport
      karst={karst}
      {...(className === undefined ? {} : { className })}
      {...(style === undefined ? {} : { style })}
      {...(labelWidth === undefined ? {} : { labelWidth })}
      {...(headerHeight === undefined ? {} : { headerHeight })}
      {...(headerStyle === undefined ? {} : { headerStyle })}
      {...(cornerHeaderStyle === undefined ? {} : { cornerHeaderStyle })}
      {...(timeHeaderStyle === undefined ? {} : { timeHeaderStyle })}
      {...(stickyHeader === undefined ? {} : { stickyHeader })}
      {...(stickyRowLabels === undefined ? {} : { stickyRowLabels })}
      {...(interactionMode === undefined ? {} : { interactionMode })}
      {...(boxSelection === undefined ? {} : { boxSelection })}
      {...(renderCornerHeader === undefined ? {} : { renderCornerHeader })}
      {...(renderTimeHeader === undefined ? {} : { renderTimeHeader })}
      {...(renderRowLabel === undefined ? {} : { renderRowLabel })}
    />
  );
}
