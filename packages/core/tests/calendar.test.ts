import { describe, expect, it } from "vitest";
import {
  HOUR_MS,
  addZonedDays,
  calculateTimelineTicks,
  getZonedDateParts,
  startOfZonedDay,
  startOfZonedWeek,
} from "../src/index.js";

describe("timezone calendar boundaries", () => {
  it("finds midnight in zones on either side of UTC", () => {
    const instant = Date.parse("2026-07-17T12:00:00Z");
    expect(startOfZonedDay(instant, "Europe/Istanbul")).toBe(
      Date.parse("2026-07-16T21:00:00Z"),
    );
    expect(startOfZonedDay(instant, "America/New_York")).toBe(
      Date.parse("2026-07-17T04:00:00Z"),
    );
  });

  it("advances by calendar days across 23-hour spring DST days", () => {
    const march8 = startOfZonedDay(
      Date.parse("2026-03-08T12:00:00Z"),
      "America/New_York",
    );
    const march9 = addZonedDays(march8, 1, "America/New_York");
    expect(march9 - march8).toBe(23 * HOUR_MS);
    expect(getZonedDateParts(march9, "America/New_York")).toMatchObject({
      year: 2026,
      month: 3,
      day: 9,
      hour: 0,
    });
  });

  it("advances by calendar days across 25-hour autumn DST days", () => {
    const november1 = startOfZonedDay(
      Date.parse("2026-11-01T12:00:00Z"),
      "America/New_York",
    );
    const november2 = addZonedDays(november1, 1, "America/New_York");
    expect(november2 - november1).toBe(25 * HOUR_MS);
  });

  it("starts weeks on configurable Monday or Sunday", () => {
    const wednesday = Date.parse("2026-07-15T12:00:00Z");
    expect(
      getZonedDateParts(
        startOfZonedWeek(wednesday, "Europe/Istanbul"),
        "Europe/Istanbul",
      ),
    ).toMatchObject({ year: 2026, month: 7, day: 13 });
    expect(
      getZonedDateParts(
        startOfZonedWeek(wednesday, "Europe/Istanbul", 0),
        "Europe/Istanbul",
      ),
    ).toMatchObject({ year: 2026, month: 7, day: 12 });
  });

  it("rejects invalid weekStartsOn values", () => {
    expect(() => startOfZonedWeek(Date.now(), "UTC", 7)).toThrow(RangeError);
  });
});

describe("timezone-aware ticks", () => {
  it("creates day ticks at local midnight across DST", () => {
    const start = startOfZonedDay(
      Date.parse("2026-03-07T12:00:00Z"),
      "America/New_York",
    );
    const end = addZonedDays(start, 4, "America/New_York");
    const ticks = calculateTimelineTicks({
      range: { start, end },
      view: "day",
      timeZone: "America/New_York",
    });
    expect(ticks).toHaveLength(4);
    expect(
      ticks.map(
        (tick) => getZonedDateParts(tick.timestamp, "America/New_York").hour,
      ),
    ).toEqual([0, 0, 0, 0]);
    expect(ticks[2]!.timestamp - ticks[1]!.timestamp).toBe(23 * HOUR_MS);
  });

  it("creates weekly ticks on the configured weekday", () => {
    const ticks = calculateTimelineTicks({
      range: {
        start: Date.parse("2026-07-01T00:00:00Z"),
        end: Date.parse("2026-08-01T00:00:00Z"),
      },
      view: "week",
      timeZone: "Europe/Istanbul",
      weekStartsOn: 1,
    });
    expect(ticks.length).toBeGreaterThan(3);
    for (const tick of ticks) {
      const parts = getZonedDateParts(tick.timestamp, "Europe/Istanbul");
      expect(
        new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay(),
      ).toBe(1);
      expect(parts.hour).toBe(0);
    }
  });

  it("hour ticks represent 23 real hours on a spring transition day", () => {
    const start = startOfZonedDay(
      Date.parse("2026-03-08T12:00:00Z"),
      "America/New_York",
    );
    const end = addZonedDays(start, 1, "America/New_York");
    const ticks = calculateTimelineTicks({
      range: { start, end },
      view: "hour",
      timeZone: "America/New_York",
    });
    expect(ticks).toHaveLength(23);
    expect(
      ticks.map(
        (tick) => getZonedDateParts(tick.timestamp, "America/New_York").hour,
      ),
    ).not.toContain(2);
  });

  it("hour ticks represent 25 real hours and repeat 01:00 in autumn", () => {
    const start = startOfZonedDay(
      Date.parse("2026-11-01T12:00:00Z"),
      "America/New_York",
    );
    const end = addZonedDays(start, 1, "America/New_York");
    const hours = calculateTimelineTicks({
      range: { start, end },
      view: "hour",
      timeZone: "America/New_York",
    }).map(
      (tick) => getZonedDateParts(tick.timestamp, "America/New_York").hour,
    );
    expect(hours).toHaveLength(25);
    expect(hours.filter((hour) => hour === 1)).toHaveLength(2);
  });
});

describe("hour tick subdivision", () => {
  const start = Date.parse("2026-07-17T00:00:00Z");
  const minutesOf = (pixelsPerMillisecond?: number) =>
    calculateTimelineTicks({
      range: { start, end: start + 2 * HOUR_MS },
      view: "hour",
      timeZone: "UTC",
      ...(pixelsPerMillisecond === undefined ? {} : { pixelsPerMillisecond }),
    }).map((tick) => getZonedDateParts(tick.timestamp, "UTC").minute);

  it("keeps whole hours when the scale is omitted", () => {
    expect(minutesOf()).toEqual([0, 0]);
  });

  it("keeps whole hours while an hour is narrower than two labels", () => {
    // 111px per hour leaves a half hour under the 56px minimum.
    expect(minutesOf(111 / HOUR_MS)).toEqual([0, 0]);
  });

  it("halves the step once a half hour clears the minimum spacing", () => {
    expect(minutesOf(112 / HOUR_MS)).toEqual([0, 30, 0, 30]);
  });

  it("quarters the step once a quarter hour clears the minimum spacing", () => {
    expect(minutesOf(224 / HOUR_MS)).toEqual([0, 15, 30, 45, 0, 15, 30, 45]);
  });

  it("marks whole hours as major once subdivided", () => {
    const ticks = calculateTimelineTicks({
      range: { start, end: start + HOUR_MS },
      view: "hour",
      timeZone: "UTC",
      pixelsPerMillisecond: 224 / HOUR_MS,
    });
    expect(ticks.map((tick) => tick.major)).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it("subdivides from local midnight in offset timezones", () => {
    const istanbulNoon = Date.parse("2026-07-17T09:00:00Z");
    const minutes = calculateTimelineTicks({
      range: { start: istanbulNoon, end: istanbulNoon + HOUR_MS },
      view: "hour",
      timeZone: "Europe/Istanbul",
      pixelsPerMillisecond: 224 / HOUR_MS,
    }).map((tick) => getZonedDateParts(tick.timestamp, "Europe/Istanbul"));
    expect(minutes.map((parts) => parts.minute)).toEqual([0, 15, 30, 45]);
    expect(minutes.every((parts) => parts.hour === 12)).toBe(true);
  });
});
