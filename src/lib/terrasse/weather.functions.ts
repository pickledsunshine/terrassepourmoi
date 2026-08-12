import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Open-Meteo forecast access (no API key required).
 * Returns hourly values for one local calendar day at the given coordinates.
 */

export type OpenMeteoHour = {
  hour: number;
  temperatureC: number;
  apparentTemperatureC: number;
  precipitationProbability: number; // 0..1
  precipitationMm: number;
  rainMm: number;
  cloudCover: number; // 0..1
  windKph: number;
  windGustKph: number;
  weatherCode: number;
};

export type OpenMeteoForecast = {
  timezone: string;
  hourly: OpenMeteoHour[];
};

const input = z.object({
  latitude: z.number(),
  longitude: z.number(),
  /** Local calendar day, YYYY-MM-DD. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const fetchForecast = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }): Promise<OpenMeteoForecast> => {
    const params = new URLSearchParams({
      latitude: String(data.latitude),
      longitude: String(data.longitude),
      hourly:
        "temperature_2m,apparent_temperature,precipitation_probability,precipitation,rain,cloud_cover,wind_speed_10m,wind_gusts_10m,weather_code",
      timezone: "auto",
      wind_speed_unit: "kmh",
      start_date: data.date,
      end_date: data.date,
    });

    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    if (!res.ok) throw new Error(`Open-Meteo request failed (${res.status})`);
    const json = (await res.json()) as {
      timezone?: string;
      hourly?: Record<string, unknown>;
    };
    const h = json.hourly;
    const times = (h?.["time"] as string[] | undefined) ?? [];
    if (times.length === 0) throw new Error("Open-Meteo returned no hourly data");

    const num = (key: string, i: number) => {
      const arr = h?.[key] as (number | null)[] | undefined;
      const v = arr?.[i];
      return typeof v === "number" ? v : 0;
    };

    const hourly: OpenMeteoHour[] = times.map((t, i) => ({
      hour: Number(t.slice(11, 13)),
      temperatureC: num("temperature_2m", i),
      apparentTemperatureC: num("apparent_temperature", i),
      precipitationProbability: Math.max(0, Math.min(1, num("precipitation_probability", i) / 100)),
      precipitationMm: num("precipitation", i),
      rainMm: num("rain", i),
      cloudCover: Math.max(0, Math.min(1, num("cloud_cover", i) / 100)),
      windKph: num("wind_speed_10m", i),
      windGustKph: num("wind_gusts_10m", i),
      weatherCode: num("weather_code", i),
    }));

    return { timezone: json.timezone ?? "auto", hourly };
  });
