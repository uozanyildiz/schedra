import { SchedraViewport } from "./schedra-viewport.js";
import type { SchedraTimelineProps } from "./types.js";
import { useSchedra } from "./use-schedra.js";

export function SchedraTimeline<TRowData = unknown, TItemData = unknown>(
  props: SchedraTimelineProps<TRowData, TItemData>,
) {
  const {
    className,
    style,
    labelWidth,
    horizontalCanvasOverscan,
    verticalCanvasOverscan,
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
  const schedra = useSchedra(options);
  return (
    <SchedraViewport
      schedra={schedra}
      {...(className === undefined ? {} : { className })}
      {...(style === undefined ? {} : { style })}
      {...(labelWidth === undefined ? {} : { labelWidth })}
      {...(horizontalCanvasOverscan === undefined
        ? {}
        : { horizontalCanvasOverscan })}
      {...(verticalCanvasOverscan === undefined
        ? {}
        : { verticalCanvasOverscan })}
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
