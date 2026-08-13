import { describe, expect, it } from "vitest";
import { estimateTerrasse } from "./engine";
import { mockPlaces } from "./places.mock";
import { knownHoursInWindow, staticWeatherProvider, toForecast } from "./weather.openmeteo";
import { parseOpenMeteoBody, type OpenMeteoForecast, type OpenMeteoHour } from "./weather.functions";
import type { ResolvedLocation } from "./types";

function hour(h: number, over: Partial<OpenMeteoHour> = {}): OpenMeteoHour {
  return {
    hour: h,
    temperatureC: 22,
    apparentTemperatureC: 22,
    precipitationProbability: 0.1,
    precipitationMm: 0,
    rainMm: 0,
    cloudCover: 0.2,
    windKph: 8,
    windGustKph: 12,
    weatherCode: 0,
    ...over,
  };
}

function raw(hours: OpenMeteoHour[]): OpenMeteoForecast {
  return {
    timezone: "Europe/Paris",
    utcOffsetSeconds: 7200,
    date: "2026-08-13",
    hourly: hours,
  };
}

const location: ResolvedLocation = { label: "Le Marais", lat: 48.86, lng: 2.36, source: "address" };

describe("parsing raw Open-Meteo bodies", () => {
  it("preserves nulls instead of coercing them to zero", () => {
    const parsed = parseOpenMeteoBody(
      {
        timezone: "Europe/Paris",
        utc_offset_seconds: 7200,
        hourly: {
          time: ["2026-08-13T00:00", "2026-08-13T01:00"],
          temperature_2m: [21, null],
          precipitation: [null, 0],
          wind_speed_10m: [10, 10],
          cloud_cover: [50, null],
          precipitation_probability: [20, 20],
        },
      },
      "2026-08-13",
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.hourly[0]!.temperatureC).toBe(21);
    expect(parsed!.hourly[1]!.temperatureC).toBeNull();
    expect(parsed!.hourly[0]!.precipitationMm).toBeNull();
    expect(parsed!.hourly[1]!.precipitationMm).toBe(0);
    // Fields absent from the payload entirely are unknown, not zero.
    expect(parsed!.hourly[0]!.weatherCode).toBeNull();
    expect(parsed!.hourly[0]!.cloudCover).toBe(0.5);
    expect(parsed!.timezone).toBe("Europe/Paris");
  });

  it("treats a body with no hourly times as unusable", () => {
    expect(parseOpenMeteoBody({ hourly: { time: [] } }, "2026-08-13")).toBeNull();
    expect(parseOpenMeteoBody({}, "2026-08-13")).toBeNull();
    expect(parseOpenMeteoBody(null, "2026-08-13")).toBeNull();
  });
});

describe("adapting a forecast", () => {
  it("drops hours with unknown core values and reports them as missing", () => {
    const f = toForecast(
      raw([hour(18), hour(19, { temperatureC: null }), hour(20, { windKph: null })]),
    );
    expect(f.hourly.map((h) => h.hour)).toEqual([18]);
    expect(f.missingHours).toContain(19);
    expect(f.missingHours).toContain(20);
  });

  it("marks hours the provider never returned as missing", () => {
    const f = toForecast(raw([hour(12)]));
    expect(f.hourly).toHaveLength(1);
    expect(f.missingHours).toHaveLength(23);
    expect(f.missingHours).not.toContain(12);
  });

  it("carries the venue timezone through to the forecast", () => {
    expect(toForecast(raw([hour(12)])).timeZone).toBe("Europe/Paris");
  });

  it("never invents defaults for missing hours", () => {
    const f = toForecast(raw([hour(19, { temperatureC: null })]));
    expect(f.hourly.find((h) => h.hour === 19)).toBeUndefined();
  });

  it("counts only real hours inside a window", () => {
    const f = toForecast(raw([hour(18), hour(19, { cloudCover: null }), hour(20)]));
    expect(knownHoursInWindow(f, 18, 20)).toBe(2);
    expect(knownHoursInWindow(f, 19, 19.75)).toBe(0);
  });

  it("is deterministic across repeated adaptations of the same payload", () => {
    const payload = raw([hour(18), hour(19), hour(20)]);
    expect(toForecast(payload)).toEqual(toForecast(payload));
  });
});

describe("scoring with incomplete forecasts", () => {
  const hours = [hour(18), hour(19), hour(20), hour(21)];

  it("refuses to score a window with no known hours", async () => {
    const f = toForecast(raw([hour(12)]));
    await expect(
      estimateTerrasse(
        { location, date: new Date(2026, 7, 13), from: 18.5, to: 20, party: 2 },
        { places: mockPlaces, weather: staticWeatherProvider(f) },
      ),
    ).rejects.toThrow(/no weather data/i);
  });

  it("scores from the hours that are known, skipping the gaps", async () => {
    const complete = toForecast(raw(hours));
    const gappy = toForecast(raw([hour(18), hour(19, { temperatureC: null }), hour(20), hour(21)]));
    const query = { location, date: new Date(2026, 7, 13), from: 18.5, to: 21, party: 2 };
    const a = await estimateTerrasse(query, {
      places: mockPlaces,
      weather: staticWeatherProvider(complete),
    });
    const b = await estimateTerrasse(query, {
      places: mockPlaces,
      weather: staticWeatherProvider(gappy),
    });
    expect(b.probability).toBeGreaterThan(0);
    // Identical conditions in the known hours, so the answer stays in the same place.
    expect(Math.abs(a.probability - b.probability)).toBeLessThan(6);
  });

  it("gives the same answer for repeated checks of the same query", async () => {
    const f = toForecast(raw(hours));
    const query = { location, date: new Date(2026, 7, 13), from: 18.5, to: 20, party: 2 };
    const deps = { places: mockPlaces, weather: staticWeatherProvider(f) };
    const first = await estimateTerrasse(query, deps);
    const second = await estimateTerrasse(query, deps);
    const third = await estimateTerrasse(query, deps);
    expect(second.probability).toBe(first.probability);
    expect(third.weatherLine).toBe(first.weatherLine);
  });
});
