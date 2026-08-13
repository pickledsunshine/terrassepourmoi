/**
 * Forecast window + timezone helpers.
 *
 * Open-Meteo's forecast endpoint only serves a moving window around today.
 * These helpers are pure so the picker, the request layer and the tests all
 * agree on what "today" and "in range" mean for a given venue timezone.
 */

/** Open-Meteo forecast endpoint defaults: ~92 days of past, 16 days ahead. */
export const FORECAST_PAST_DAYS = 92;
export const FORECAST_FUTURE_DAYS = 15;

/** Calendar day (never UTC-shifted) as YYYY-MM-DD. */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Parse a YYYY-MM-DD string into a local-midnight Date. */
export function fromIsoDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/**
 * The calendar day it currently is *at the venue*, returned as a local-midnight
 * Date so it can be compared with the date picker's values.
 * Falls back to the browser/server day when no timezone is known.
 */
export function zonedToday(timeZone?: string | undefined, at: Date = new Date()): Date {
  if (!timeZone) return startOfDay(at);
  try {
    // en-CA formats as YYYY-MM-DD.
    return fromIsoDay(new Intl.DateTimeFormat("en-CA", { timeZone }).format(at));
  } catch {
    return startOfDay(at);
  }
}

/** Current decimal hour at the venue, e.g. 18.5 for 18:30. */
export function zonedHour(timeZone?: string | undefined, at: Date = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      ...(timeZone ? { timeZone } : {}),
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(at);
    const [h, m] = parts.split(":").map(Number);
    return (h ?? 0) + (m ?? 0) / 60;
  } catch {
    return at.getHours() + at.getMinutes() / 60;
  }
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  const next = startOfDay(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** Selectable date range, anchored on the venue's today. */
export function forecastRange(today: Date): { min: Date; max: Date } {
  return { min: addDays(today, -FORECAST_PAST_DAYS), max: addDays(today, FORECAST_FUTURE_DAYS) };
}

export function isWithinForecastRange(day: Date, today: Date): boolean {
  const { min, max } = forecastRange(today);
  const d = startOfDay(day).getTime();
  return d >= min.getTime() && d <= max.getTime();
}

/**
 * Open-Meteo states the authoritative window in its 400 body, e.g.
 * "Parameter 'start_date' is out of allowed range from 2026-05-12 to 2026-08-28".
 */
export function parseRangeFromReason(reason: string): { min: string; max: string } | null {
  const m = /from (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/.exec(reason);
  return m && m[1] && m[2] ? { min: m[1], max: m[2] } : null;
}
