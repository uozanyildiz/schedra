import type {
  SchedraView,
  TimeRange,
  TimeScale,
  TimeScaleOptions,
} from "./types.js";

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;

const durationByView: Record<SchedraView, number> = {
  hour: HOUR_MS,
  day: DAY_MS,
  week: WEEK_MS,
};

export function createTimeScale(options: TimeScaleOptions): TimeScale {
  const zoom = options.zoom ?? 1;
  if (!(zoom > 0) || !Number.isFinite(options.origin)) {
    throw new RangeError(
      "Time scale origin must be finite and zoom must be positive.",
    );
  }
  const baseWidth =
    options.view === "hour"
      ? (options.hourWidth ?? 80)
      : options.view === "day"
        ? (options.dayWidth ?? 120)
        : (options.weekWidth ?? 180);
  const pixelsPerMillisecond =
    (baseWidth * zoom) / durationByView[options.view];
  return {
    view: options.view,
    origin: options.origin,
    pixelsPerMillisecond,
    timestampToX: (timestamp) =>
      (timestamp - options.origin) * pixelsPerMillisecond,
    xToTimestamp: (x) => options.origin + x / pixelsPerMillisecond,
    rangeToWidth: (range: TimeRange) =>
      Math.max(0, range.end - range.start) * pixelsPerMillisecond,
  };
}

export function visibleTimeRange(
  scale: TimeScale,
  scrollLeft: number,
  width: number,
): TimeRange {
  return {
    start: scale.xToTimestamp(scrollLeft),
    end: scale.xToTimestamp(scrollLeft + Math.max(0, width)),
  };
}
