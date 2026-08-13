import { describe, expect, it } from "vitest";
import {
  FORECAST_FUTURE_DAYS,
  FORECAST_PAST_DAYS,
  forecastRange,
  fromIsoDay,
  isoDay,
  isWithinForecastRange,
  parseRangeFromReason,
  zonedHour,
  zonedToday,
} from "./weather.range";

const AUG_13 = new Date(2026, 7, 13, 12, 0, 0);

describe("forecast range", () => {
  it("spans the provider's supported past and future window", () => {
    const { min, max } = forecastRange(AUG_13);
    expect(isoDay(min)).toBe(isoDay(new Date(2026, 7, 13 - FORECAST_PAST_DAYS)));
    expect(isoDay(max)).toBe(isoDay(new Date(2026, 7, 13 + FORECAST_FUTURE_DAYS)));
  });

  it("accepts today, the first and the last supported day", () => {
    const { min, max } = forecastRange(AUG_13);
    expect(isWithinForecastRange(AUG_13, AUG_13)).toBe(true);
    expect(isWithinForecastRange(min, AUG_13)).toBe(true);
    expect(isWithinForecastRange(max, AUG_13)).toBe(true);
  });

  it("rejects dates beyond the supported window in both directions", () => {
    expect(isWithinForecastRange(new Date(2026, 9, 1), AUG_13)).toBe(false); // too far ahead
    expect(isWithinForecastRange(new Date(2026, 0, 1), AUG_13)).toBe(false); // too far back
  });

  it("ignores the time of day when comparing calendar days", () => {
    const lateMax = new Date(2026, 7, 13 + FORECAST_FUTURE_DAYS, 23, 59);
    expect(isWithinForecastRange(lateMax, AUG_13)).toBe(true);
  });

  it("reads the authoritative window out of the provider's 400 reason", () => {
    expect(
      parseRangeFromReason(
        "Parameter 'start_date' is out of allowed range from 2026-05-12 to 2026-08-28",
      ),
    ).toEqual({ min: "2026-05-12", max: "2026-08-28" });
    expect(parseRangeFromReason("Something else went wrong")).toBeNull();
  });
});

describe("timezone resolution", () => {
  it("uses the venue's calendar day, not the caller's", () => {
    // 2026-08-13 23:30 UTC: still the 13th in Paris, already the 14th in Tokyo.
    const at = new Date("2026-08-13T23:30:00Z");
    expect(isoDay(zonedToday("Europe/Paris", at))).toBe("2026-08-14"); // Paris is UTC+2
    expect(isoDay(zonedToday("Asia/Tokyo", at))).toBe("2026-08-14");
    expect(isoDay(zonedToday("America/New_York", at))).toBe("2026-08-13");
  });

  it("resolves the current hour in the venue's zone", () => {
    const at = new Date("2026-08-13T16:30:00Z");
    expect(zonedHour("Europe/Paris", at)).toBeCloseTo(18.5, 5);
    expect(zonedHour("UTC", at)).toBeCloseTo(16.5, 5);
  });

  it("falls back to the runtime day when the zone is unknown or invalid", () => {
    expect(isoDay(zonedToday(undefined, AUG_13))).toBe("2026-08-13");
    expect(isoDay(zonedToday("Not/AZone", AUG_13))).toBe("2026-08-13");
  });

  it("round-trips iso days without UTC drift", () => {
    expect(isoDay(fromIsoDay("2026-01-01"))).toBe("2026-01-01");
    expect(isoDay(fromIsoDay("2026-12-31"))).toBe("2026-12-31");
  });
});
