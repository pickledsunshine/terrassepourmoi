import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parseRangeFromReason } from "./weather.range";

/**
 * Open-Meteo forecast access (no API key required).
 * Returns hourly values for one calendar day at the given coordinates,
 * resolved in the venue's own timezone (timezone=auto).
 *
 * Missing values stay `null`: the provider not publishing a number is not the
 * same as the number being zero.
 */

export type OpenMeteoHour = {
  hour: number;
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  precipitationProbability: number | null; // 0..1
  precipitationMm: number | null;
  rainMm: number | null;
  cloudCover: number | null; // 0..1
  windKph: number | null;
  windGustKph: number | null;
  weatherCode: number | null;
};

export type OpenMeteoForecast = {
  /** IANA timezone of the coordinates, e.g. "Europe/Paris". */
  timezone: string;
  /** Offset of that timezone on the requested day, in seconds. */
  utcOffsetSeconds: number;
  /** The calendar day actually returned, in venue-local time. */
  date: string;
  hourly: OpenMeteoHour[];
};

/** Why a forecast could not be produced. Each maps to distinct user copy. */
export type WeatherErrorKind = "out-of-range" | "network" | "upstream" | "malformed";

export type ForecastResult =
  | { ok: true; forecast: OpenMeteoForecast }
  | {
      ok: false;
      kind: WeatherErrorKind;
      message: string;
      /** Supplied for "out-of-range": the window the provider does serve. */
      range?: { min: string; max: string } | undefined;
    };

const input = z.object({
  latitude: z.number(),
  longitude: z.number(),
  /** Venue-local calendar day, YYYY-MM-DD. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const HOURLY_FIELDS =
  "temperature_2m,apparent_temperature,precipitation_probability,precipitation,rain,cloud_cover,wind_speed_10m,wind_gusts_10m,weather_code";

/** Null-preserving read: absent, null or non-finite all mean "unknown". */
function numOrNull(hourly: Record<string, unknown> | undefined, key: string, i: number): number | null {
  const arr = hourly?.[key] as unknown;
  if (!Array.isArray(arr)) return null;
  const v = arr[i];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function ratio(v: number | null): number | null {
  return v === null ? null : Math.max(0, Math.min(1, v / 100));
}

/** Shapes a raw Open-Meteo JSON body; returns null when it is unusable. */
export function parseOpenMeteoBody(json: unknown, requestedDate: string): OpenMeteoForecast | null {
  const body = json as {
    timezone?: unknown;
    utc_offset_seconds?: unknown;
    hourly?: Record<string, unknown>;
  } | null;
  const h = body?.hourly;
  const times = h?.["time"];
  if (!Array.isArray(times) || times.length === 0) return null;

  const hourly: OpenMeteoHour[] = times.map((t, i) => ({
    hour: Number(String(t).slice(11, 13)),
    temperatureC: numOrNull(h, "temperature_2m", i),
    apparentTemperatureC: numOrNull(h, "apparent_temperature", i),
    precipitationProbability: ratio(numOrNull(h, "precipitation_probability", i)),
    precipitationMm: numOrNull(h, "precipitation", i),
    rainMm: numOrNull(h, "rain", i),
    cloudCover: ratio(numOrNull(h, "cloud_cover", i)),
    windKph: numOrNull(h, "wind_speed_10m", i),
    windGustKph: numOrNull(h, "wind_gusts_10m", i),
    weatherCode: numOrNull(h, "weather_code", i),
  })).filter((x) => Number.isFinite(x.hour));

  if (hourly.length === 0) return null;

  return {
    timezone: typeof body?.timezone === "string" ? body.timezone : "UTC",
    utcOffsetSeconds:
      typeof body?.utc_offset_seconds === "number" ? body.utc_offset_seconds : 0,
    date: String(times[0]).slice(0, 10) || requestedDate,
    hourly,
  };
}

export const fetchForecast = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }): Promise<ForecastResult> => {
    const params = new URLSearchParams({
      latitude: String(data.latitude),
      longitude: String(data.longitude),
      hourly: HOURLY_FIELDS,
      // Resolve the day and its hours in the venue's timezone, not the caller's.
      timezone: "auto",
      wind_speed_unit: "kmh",
      start_date: data.date,
      end_date: data.date,
    });

    let res: Response;
    try {
      res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
        signal: AbortSignal.timeout(8000),
      });
    } catch (err) {
      return {
        ok: false,
        kind: "network",
        message: err instanceof Error ? err.message : "Could not reach the weather service",
      };
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let reason = text;
      try {
        const parsed = JSON.parse(text) as { reason?: string };
        if (typeof parsed.reason === "string") reason = parsed.reason;
      } catch {
        /* non-JSON error body; keep the raw text */
      }
      const range = parseRangeFromReason(reason);
      if (res.status === 400 && range) {
        return { ok: false, kind: "out-of-range", message: reason, range };
      }
      return { ok: false, kind: "upstream", message: `Open-Meteo responded ${res.status}: ${reason}` };
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { ok: false, kind: "malformed", message: "Weather response was not valid JSON" };
    }

    const forecast = parseOpenMeteoBody(json, data.date);
    if (!forecast) {
      return { ok: false, kind: "malformed", message: "Weather response contained no hourly data" };
    }
    return { ok: true, forecast };
  });
