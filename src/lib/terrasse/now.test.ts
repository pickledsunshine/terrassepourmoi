import { describe, expect, it, vi } from "vitest";
import { BUSY, NowRefresher, formatFreshness, type RefreshFn } from "./now";
import { ForecastCache, refreshTerrasse, type RefreshDeps } from "./refresh";
import type { ForecastResult, OpenMeteoForecast } from "./weather.functions";
import type { GoogleVenue } from "./venues.functions";

const LOCATION = {
  displayName: "Le Marais, Paris, France",
  latitude: 48.8612327,
  longitude: 2.3581892,
  radiusM: 500,
};

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
    fetchForecast: vi.fn(async (): Promise<ForecastResult> => ({ ok: true, forecast: rawForecast() })),
    nearbyVenues: vi.fn(async () => [venue("a"), venue("b"), venue("c")]),
    cache: new ForecastCache(),
    timeZone: "Europe/Paris" as string | undefined,
  };
  return { ...base, ...overrides } as typeof base & RefreshDeps;
}

const input = () => ({
  location: LOCATION,
  date: soon(),
  from: 18.5,
  to: 20,
  party: 2,
  mode: "full" as const,
});

describe("Now action", () => {
  it("calls refreshTerrasse with force: true", async () => {
    const spy = vi.fn<RefreshFn>(async () => ({ status: "incomplete" }));
    const now = new NowRefresher(spy);
    await now.run(input(), deps());
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ force: true });
  });

  it("bypasses a fresh cached forecast", async () => {
    const d = deps();
    // Warm the cache through the normal path.
    await refreshTerrasse({ ...input(), mode: "weather" }, d);
    expect(d.fetchForecast).toHaveBeenCalledTimes(1);

    const out = await new NowRefresher().run(input(), d);
    expect(d.fetchForecast).toHaveBeenCalledTimes(2);
    if (out === BUSY || out.status !== "ok") throw new Error("expected ok");
    expect(out.fromCache).toBe(false);
  });

  it("uses the provider fetchedAt, not the click time, as the freshness stamp", async () => {
    const stamp = 1_700_000_000_000;
    const d = deps();
    const out = await new NowRefresher().run(input(), { ...d, now: () => stamp });
    if (out === BUSY || out.status !== "ok") throw new Error("expected ok");
    expect(out.fetchedAt).toBe(stamp);
    // Clicked 90 s later than the data was produced: the line reflects the data.
    expect(formatFreshness(out.fetchedAt, stamp + 90_000)).toBe("Updated 1 min ago");
    expect(formatFreshness(out.fetchedAt, stamp + 5_000)).toBe("Updated just now");
  });

  it("prevents duplicate Now runs while one is pending", async () => {
    let release: (() => void) | null = null;
    const gate = new Promise<void>((r) => (release = r));
    const d = deps({
      fetchForecast: vi.fn(async (): Promise<ForecastResult> => {
        await gate;
        return { ok: true, forecast: rawForecast() };
      }),
    });
    const now = new NowRefresher();
    const first = now.run(input(), d);
    const second = await now.run(input(), d);
    expect(second).toBe(BUSY);
    expect(now.isPending).toBe(true);
    release!();
    await first;
    expect(now.isPending).toBe(false);
    expect(d.fetchForecast).toHaveBeenCalledTimes(1);
  });

  it("reports a failed forced refresh without producing a result to overwrite with", async () => {
    const d = deps();
    const good = await new NowRefresher().run(input(), d);
    if (good === BUSY || good.status !== "ok") throw new Error("expected ok");
    expect(good.result).toBeDefined();

    const failing = deps({
      cache: d.cache,
      fetchForecast: vi.fn(async (): Promise<ForecastResult> => ({
        ok: false,
        kind: "upstream",
        message: "Open-Meteo responded 500",
      })),
    });
    const bad = await new NowRefresher().run(input(), failing);
    if (bad === BUSY) throw new Error("unexpected busy");
    // Discriminated error preserved, and it carries no result: the caller keeps
    // the previous one.
    expect(bad).toMatchObject({ status: "weather-error", kind: "upstream" });
    expect("result" in bad).toBe(false);
  });
});
