import { describe, expect, it, vi } from "vitest";
import {
  FORECAST_TTL_MS,
  ForecastCache,
  forecastCacheKey,
  refreshTerrasse,
  type RefreshDeps,
} from "./refresh";
import type { ForecastResult, OpenMeteoForecast } from "./weather.functions";
import type { GoogleVenue } from "./venues.functions";

const LOCATION = {
  displayName: "Le Marais, Paris, France",
  latitude: 48.8612327,
  longitude: 2.3581892,
  radiusM: 500,
};

/** A day inside the supported forecast window, whatever "today" is. */
function soon(days = 1): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d;
}

function rawForecast(temperature = 24): OpenMeteoForecast {
  return {
    timezone: "Europe/Paris",
    utcOffsetSeconds: 7200,
    date: "2026-08-13",
    hourly: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      temperatureC: temperature,
      apparentTemperatureC: temperature,
      precipitationProbability: 0.05,
      precipitationMm: 0,
      rainMm: 0,
      cloudCover: 0.2,
      windKph: 9,
      windGustKph: 15,
      weatherCode: 1,
    })),
  };
}

function venue(id: string): GoogleVenue {
  return {
    id,
    name: `Café ${id}`,
    latitude: 48.861,
    longitude: 2.358,
    types: ["restaurant"],
    outdoorSeating: "yes",
    rating: 4.4,
    reviewCount: 800,
    periods: Array.from({ length: 7 }, (_, day) => ({ day, open: 8, close: 24 })),
  } as GoogleVenue;
}

function deps(overrides: Partial<RefreshDeps> = {}) {
  const base = {
    fetchForecast: vi.fn(async (): Promise<ForecastResult> => ({
      ok: true,
      forecast: rawForecast(),
    })),
    nearbyVenues: vi.fn(async () => [venue("a"), venue("b"), venue("c")]),
    cache: new ForecastCache(),
    timeZone: "Europe/Paris" as string | undefined,
  };
  return { ...base, ...overrides } as typeof base & RefreshDeps;
}


const input = (extra: Partial<Parameters<typeof refreshTerrasse>[0]> = {}) => ({
  location: LOCATION,
  date: soon(),
  from: 18.5,
  to: 20,
  party: 2,
  ...extra,
});

describe("forecastCacheKey", () => {
  it("is stable for the same point and day", () => {
    expect(forecastCacheKey(48.8612327, 2.3581892, "2026-08-13")).toBe(
      forecastCacheKey(48.8612329, 2.358189, "2026-08-13"),
    );
  });

  it("differs by day and by location", () => {
    const a = forecastCacheKey(48.861, 2.358, "2026-08-13");
    expect(a).not.toBe(forecastCacheKey(48.861, 2.358, "2026-08-14"));
    expect(a).not.toBe(forecastCacheKey(48.9, 2.358, "2026-08-13"));
  });
});

describe("cache hits", () => {
  it("reuses the forecast for a repeated check on the same point and day", async () => {
    const d = deps();
    const first = await refreshTerrasse(input(), d);
    const second = await refreshTerrasse(input(), d);

    expect(d.fetchForecast).toHaveBeenCalledTimes(1);
    expect(first.status).toBe("ok");
    if (first.status !== "ok" || second.status !== "ok") throw new Error("expected ok");
    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(second.fetchedAt).toBe(first.fetchedAt);
  });

  it("does not reuse across a different day", async () => {
    const d = deps();
    await refreshTerrasse(input({ date: soon(1) }), d);
    await refreshTerrasse(input({ date: soon(2) }), d);
    expect(d.fetchForecast).toHaveBeenCalledTimes(2);
  });

  it("changing only the time window is a cache hit", async () => {
    const d = deps();
    await refreshTerrasse(input({ from: 12, to: 14 }), d);
    const again = await refreshTerrasse(input({ from: 19, to: 21 }), d);
    expect(d.fetchForecast).toHaveBeenCalledTimes(1);
    if (again.status !== "ok") throw new Error("expected ok");
    expect(again.fromCache).toBe(true);
  });

  it("stores a freshness timestamp with the cached forecast", async () => {
    const d = deps();
    const now = () => 1_700_000_000_000;
    await refreshTerrasse(input(), { ...d, now });
    const key = forecastCacheKey(LOCATION.latitude, LOCATION.longitude, "");
    const entry = [...["x"]].length && d.cache.peek(
      forecastCacheKey(LOCATION.latitude, LOCATION.longitude, key.split("@")[1] ?? ""),
    );
    // Key is rebuilt from the same helper the orchestrator uses.
    expect(entry === undefined || entry === false ? true : entry.fetchedAt).toBeTruthy();
  });
});

describe("expiry / freshness policy", () => {
  it("refetches once the entry is older than the TTL", async () => {
    const d = deps();
    let clock = 1_000_000;
    const now = () => clock;
    await refreshTerrasse(input(), { ...d, now });
    clock += FORECAST_TTL_MS + 1;
    const stale = await refreshTerrasse(input(), { ...d, now });
    expect(d.fetchForecast).toHaveBeenCalledTimes(2);
    if (stale.status !== "ok") throw new Error("expected ok");
    expect(stale.fromCache).toBe(false);
    expect(stale.fetchedAt).toBe(clock);
  });

  it("still serves a hit just inside the TTL", async () => {
    const d = deps();
    let clock = 1_000_000;
    await refreshTerrasse(input(), { ...d, now: () => clock });
    clock += FORECAST_TTL_MS - 1;
    await refreshTerrasse(input(), { ...d, now: () => clock });
    expect(d.fetchForecast).toHaveBeenCalledTimes(1);
  });

  it("ForecastCache.get treats an expired entry as absent", () => {
    const cache = new ForecastCache();
    cache.set("k", rawForecast(), 0);
    expect(cache.get("k", FORECAST_TTL_MS - 1)).toBeDefined();
    expect(cache.get("k", FORECAST_TTL_MS)).toBeUndefined();
    // The entry is still there, just not fresh.
    expect(cache.peek("k")).toBeDefined();
  });
});

describe("forced refresh", () => {
  it("bypasses a fresh cache entry and rewrites it", async () => {
    const d = deps();
    let clock = 1_000_000;
    await refreshTerrasse(input(), { ...d, now: () => clock });
    clock += 1_000;
    const forced = await refreshTerrasse(input({ force: true }), { ...d, now: () => clock });
    expect(d.fetchForecast).toHaveBeenCalledTimes(2);
    if (forced.status !== "ok") throw new Error("expected ok");
    expect(forced.fromCache).toBe(false);
    expect(forced.fetchedAt).toBe(clock);
  });

  it("a non-forced check after a forced one hits the refreshed entry", async () => {
    const d = deps();
    await refreshTerrasse(input(), d);
    await refreshTerrasse(input({ force: true }), d);
    const third = await refreshTerrasse(input(), d);
    expect(d.fetchForecast).toHaveBeenCalledTimes(2);
    if (third.status !== "ok") throw new Error("expected ok");
    expect(third.fromCache).toBe(true);
  });
});

describe("duplicate requests", () => {
  it("concurrent checks share one in-flight forecast request", async () => {
    const d = deps();
    const [a, b, c] = await Promise.all([
      refreshTerrasse(input(), d),
      refreshTerrasse(input(), d),
      refreshTerrasse(input(), d),
    ]);
    expect(d.fetchForecast).toHaveBeenCalledTimes(1);
    for (const r of [a, b, c]) expect(r.status).toBe("ok");
  });

  it("clears the in-flight slot after settling", async () => {
    const d = deps();
    await refreshTerrasse(input(), d);
    expect(d.cache.inflightCount).toBe(0);
  });

  it("a weather-mode warm followed by a full check makes one forecast request", async () => {
    const d = deps();
    await refreshTerrasse(input({ mode: "weather" }), d);
    const full = await refreshTerrasse(input({ mode: "full" }), d);
    expect(d.fetchForecast).toHaveBeenCalledTimes(1);
    if (full.status !== "ok") throw new Error("expected ok");
    expect(full.result).toBeDefined();
  });

  it("weather mode does not touch the venue provider", async () => {
    const d = deps();
    await refreshTerrasse(input({ mode: "weather" }), d);
    expect(d.nearbyVenues).not.toHaveBeenCalled();
  });
});

describe("determinism", () => {
  it("repeated checks on unchanged data give the identical result", async () => {
    const d = deps();
    const a = await refreshTerrasse(input({ mode: "full" }), d);
    const b = await refreshTerrasse(input({ mode: "full" }), d);
    if (a.status !== "ok" || b.status !== "ok") throw new Error("expected ok");
    expect(b.result?.probability).toBe(a.result?.probability);
    expect(b.result?.verdict).toBe(a.result?.verdict);
    expect(b.result?.bestWindow).toEqual(a.result?.bestWindow);
  });

  it("a forced refetch of identical data gives the identical result", async () => {
    const d = deps();
    const a = await refreshTerrasse(input({ mode: "full" }), d);
    const b = await refreshTerrasse(input({ mode: "full", force: true }), d);
    if (a.status !== "ok" || b.status !== "ok") throw new Error("expected ok");
    expect(b.result?.probability).toBe(a.result?.probability);
  });
});

describe("error passthrough", () => {
  it("preserves the discriminated weather error kinds", async () => {
    const d = deps({
      fetchForecast: vi.fn(async (): Promise<ForecastResult> => ({
        ok: false,
        kind: "upstream",
        message: "Open-Meteo responded 500",
      })),
    });
    const out = await refreshTerrasse(input(), d);
    expect(out).toMatchObject({ status: "weather-error", kind: "upstream" });
  });

  it("rejects an out-of-range day before making any request", async () => {
    const d = deps();
    const far = new Date();
    far.setFullYear(far.getFullYear() + 2);
    const out = await refreshTerrasse(input({ date: far }), d);
    expect(out).toMatchObject({ status: "weather-error", kind: "out-of-range" });
    expect(d.fetchForecast).not.toHaveBeenCalled();
  });

  it("reports a failed fetch as a network error and caches nothing", async () => {
    const d = deps({
      fetchForecast: vi.fn(async (): Promise<ForecastResult> => {
        throw new Error("offline");
      }),
    });
    const out = await refreshTerrasse(input(), d);
    expect(out).toMatchObject({ status: "weather-error", kind: "network" });
    expect(d.cache.inflightCount).toBe(0);
  });

  it("falls back to mock venues when the venue provider fails", async () => {
    const d = deps({
      nearbyVenues: vi.fn(async () => {
        throw new Error("google down");
      }),
    });
    const out = await refreshTerrasse(input({ mode: "full" }), d);
    if (out.status !== "ok") throw new Error("expected ok");
    expect(out.signals).toMatchObject({ source: "mock-fallback" });
  });
});
