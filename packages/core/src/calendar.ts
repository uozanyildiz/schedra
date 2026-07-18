import { HOUR_MS } from "./time-scale.js";
import type { SchedraView, TimeRange } from "./types.js";

export interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface TimelineTick {
  timestamp: number;
  major: boolean;
}

export interface CalculateTicksOptions {
  range: TimeRange;
  view: SchedraView;
  timeZone: string;
  /** Sunday is 0, Monday is 1. Defaults to Monday. */
  weekStartsOn?: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

/**
 * Returns calendar fields as displayed in `timeZone`.
 *
 * The `en-CA` hour cycle is explicit to avoid implementations formatting
 * midnight as hour 24.
 */
export function getZonedDateParts(
  timestamp: number,
  timeZone: string,
): ZonedDateParts {
  assertTimestamp(timestamp);
  const formatter = getFormatter(timeZone);
  const values = Object.fromEntries(
    formatter
      .formatToParts(timestamp)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year!,
    month: values.month!,
    day: values.day!,
    hour: values.hour!,
    minute: values.minute!,
    second: values.second!,
  };
}

/**
 * Finds the first real instant belonging to the timestamp's local calendar
 * date. It remains correct when a DST transition makes that day 23 or 25 hours.
 */
export function startOfZonedDay(timestamp: number, timeZone: string): number {
  const parts = getZonedDateParts(timestamp, timeZone);
  return findStartOfLocalDate(parts.year, parts.month, parts.day, timeZone);
}

export function addZonedDays(
  dayTimestamp: number,
  amount: number,
  timeZone: string,
): number {
  if (!Number.isInteger(amount))
    throw new RangeError("Day amount must be an integer.");
  const parts = getZonedDateParts(dayTimestamp, timeZone);
  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + amount),
  );
  return findStartOfLocalDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    timeZone,
  );
}

export function startOfZonedWeek(
  timestamp: number,
  timeZone: string,
  weekStartsOn = 1,
): number {
  assertWeekStartsOn(weekStartsOn);
  const dayStart = startOfZonedDay(timestamp, timeZone);
  const parts = getZonedDateParts(dayStart, timeZone);
  const weekday = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day),
  ).getUTCDay();
  const daysSinceStart = (weekday - weekStartsOn + 7) % 7;
  return addZonedDays(dayStart, -daysSinceStart, timeZone);
}

/**
 * Produces ticks intersecting a visible timestamp range.
 *
 * Day and week ticks advance by local calendar dates, never fixed 24-hour
 * durations. Hour ticks advance on the real-time axis and mark local midnight
 * as major, correctly showing a missing/repeated hour on DST transition days.
 */
export function calculateTimelineTicks(
  options: CalculateTicksOptions,
): TimelineTick[] {
  const { range, view, timeZone } = options;
  if (range.end <= range.start) return [];
  const ticks: TimelineTick[] = [];

  if (view === "hour") {
    let dayStart = startOfZonedDay(range.start, timeZone);
    while (addZonedDays(dayStart, 1, timeZone) <= range.start) {
      dayStart = addZonedDays(dayStart, 1, timeZone);
    }
    let tick = dayStart;
    while (tick < range.start) tick += HOUR_MS;
    while (tick < range.end) {
      const parts = getZonedDateParts(tick, timeZone);
      ticks.push({
        timestamp: tick,
        major: parts.hour === 0 && parts.minute === 0,
      });
      tick += HOUR_MS;
    }
    return ticks;
  }

  if (view === "day") {
    let tick = startOfZonedDay(range.start, timeZone);
    if (tick < range.start) tick = addZonedDays(tick, 1, timeZone);
    while (tick < range.end) {
      ticks.push({ timestamp: tick, major: true });
      tick = addZonedDays(tick, 1, timeZone);
    }
    return ticks;
  }

  const weekStartsOn = options.weekStartsOn ?? 1;
  let tick = startOfZonedWeek(range.start, timeZone, weekStartsOn);
  if (tick < range.start) tick = addZonedDays(tick, 7, timeZone);
  while (tick < range.end) {
    ticks.push({ timestamp: tick, major: true });
    tick = addZonedDays(tick, 7, timeZone);
  }
  return ticks;
}

function findStartOfLocalDate(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): number {
  const target = year * 10_000 + month * 100 + day;
  const approximate = Date.UTC(year, month - 1, day);
  let low = approximate - 48 * HOUR_MS;
  let high = approximate + 48 * HOUR_MS;

  // Lower-bound search for the first millisecond whose local date is target.
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    const parts = getZonedDateParts(middle, timeZone);
    const key = parts.year * 10_000 + parts.month * 100 + parts.day;
    if (key < target) low = middle + 1;
    else high = middle;
  }
  const found = getZonedDateParts(low, timeZone);
  if (found.year * 10_000 + found.month * 100 + found.day !== target) {
    throw new RangeError(
      `Local date ${year}-${month}-${day} does not exist in ${timeZone}.`,
    );
  }
  return low;
}

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  // Force eager time-zone validation.
  formatter.format(0);
  formatterCache.set(timeZone, formatter);
  return formatter;
}

function assertTimestamp(timestamp: number): void {
  if (!Number.isFinite(timestamp))
    throw new RangeError("Timestamp must be finite.");
}

function assertWeekStartsOn(weekStartsOn: number): void {
  if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) {
    throw new RangeError("weekStartsOn must be an integer from 0 to 6.");
  }
}
