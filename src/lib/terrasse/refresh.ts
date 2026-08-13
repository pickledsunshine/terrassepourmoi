/**
 * Central refresh orchestration for Terrasse?.
 *
 * Every refresh trigger — today the manual Check, later a "Now" button or an
 * hourly scheduler — goes through `refreshTerrasse()`. Nothing else fetches
 * weather or venues, so there is exactly one place where caching, request
 * de-duplication and error mapping live.
 *
 * This module contains NO scoring: it calls the existing engine unchanged.
 */

import { estimateTerrasse, IncompleteWeatherError } from "./engine";
import { googlePlacesProvider, summarise as summariseVenues, type VenueSignals } from "./places.google";
import { mockPlaces } from "./places.mock";
import type { ResolvedLocation, TerrasseResult, WeatherForecast } from "./types";
import type { GoogleVenue } from "./venues.functions";
import type { ForecastResult, OpenMeteoForecast, WeatherErrorKind } from "./weather.functions";
import { knownHoursInWindow, staticWeatherProvider, toForecast } from "./weather.openmeteo";
import { isWithinForecastRange, isoDay, zonedToday } from "./weather.range";

/* ------------------------------------------------------------------ cache */

/**
 * Freshness policy for live weather.
 *
 * Open-Meteo publishes hourly values and refreshes its model runs a few times
 * a day, so a forecast is materially stable for minutes, not hours. Ten
 * minutes keeps repeated checks instant while never showing sky data that is
 * meaningfully behind reality. A forced refresh ignores this entirely.
 */
export const FORECAST_TTL_MS = 10 * 60 * 1000;

/** Coordinate precision of the cache key: 3 decimals ≈ 110 m. */
const KEY_PRECISION = 3;

/**
 * Cache identity = the inputs the forecast actually depends on: the point on
 * the map (rounded, so tiny pin nudges reuse the same sky) and the venue-local
 * calendar day. The time window is deliberately absent — one request covers
 * the whole day, so from/to changes are always cache hits.
 */
export function forecastCacheKey(latitude: number, longitude: number, day: string): string {
  return `${latitude.toFixed(KEY_PRECISION)},${longitude.toFixed(KEY_PRECISION)}@${day}`;
}

export type CacheEntry = {
  forecast: OpenMeteoForecast;
  /** Epoch ms at which this forecast was received from the provider. */
  fetchedAt: number;
};

/**
 * Tiny in-memory forecast cache with in-flight de-duplication.
 * Both concerns belong together: without the in-flight map, two checks fired
 * before the first response would race and both hit the network.
 */
export class ForecastCache {
  private entries = new Map<string, CacheEntry>();
  private inflight = new Map<string, Promise<ForecastResult>>();

  /** Fresh entry for `key`, or undefined when absent or stale. */
  get(key: string, now: number, ttlMs: number = FORECAST_TTL_MS): CacheEntry | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (now - entry.fetchedAt >= ttlMs) return undefined;
    return entry;
  }

  set(key: string, forecast: OpenMeteoForecast, fetchedAt: number): CacheEntry {
    const entry = { forecast, fetchedAt };
    this.entries.set(key, entry);
    return entry;
  }

  /** Only for tests and future manual invalidation. */
  peek(key: string): CacheEntry | undefined {
    return this.entries.get(key);
  }

  delete(key: string) {
    this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
    this.inflight.clear();
  }

  /**
   * Runs `fetcher` at most once per key at a time. Concurrent callers for the
   * same key share the single in-flight promise instead of issuing a second
   * request.
   */
  async dedupe(key: string, fetcher: () => Promise<ForecastResult>): Promise<ForecastResult> {
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const promise = fetcher().finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, promise);
    return promise;
  }

  get inflightCount(): number {
    return this.inflight.size;
  }
}

/** Process-wide cache used by the app; tests inject their own. */
export const forecastCache = new ForecastCache();

/* ------------------------------------------------------------- orchestrator */

export type ForecastFetcher = (args: {
  data: { latitude: number; longitude: number; date: string };
}) => Promise<ForecastResult>;

export type VenueFetcher = (args: {
  data: { latitude: number; longitude: number; radiusM: number };
}) => Promise<GoogleVenue[]>;

export type RefreshInput = {
  location: { displayName: string; latitude: number; longitude: number; radiusM?: number | undefined };
  date: Date;
  /** Decimal hours; only used in "full" mode. */
  from: number;
  to: number;
  party: number;
  /**
   * "weather" warms the forecast for the current location/day (used when the
   * location or date changes); "full" also scores the window.
   */
  mode?: "weather" | "full";
  /** Bypass the cache and refetch from the provider (future Now button). */
  force?: boolean;
};

export type RefreshDeps = {
  fetchForecast: ForecastFetcher;
  nearbyVenues: VenueFetcher;
  cache?: ForecastCache;
  /** Clock seam for tests. */
  now?: () => number;
  /** Venue timezone already learned, if any; anchors the range check. */
  timeZone?: string | undefined;
  ttlMs?: number;
};

export type RefreshOutcome =
  | {
      status: "ok";
      forecast: WeatherForecast;
      raw: OpenMeteoForecast;
      timeZone: string;
      fetchedAt: number;
      fromCache: boolean;
      /** Present in "full" mode only. */
      result?: TerrasseResult;
      signals?: VenueSignals | { source: "mock-fallback" };
    }
  | {
      status: "weather-error";
      kind: WeatherErrorKind;
      range?: { min: string; max: string } | undefined;
      message?: string;
    }
  | { status: "incomplete" };

function toResolved(loc: RefreshInput["location"]): ResolvedLocation {
  return { label: loc.displayName, lat: loc.latitude, lng: loc.longitude, source: "address" };
}

/**
 * The single refresh path.
 *
 * 1. Range guard (venue-local today) — no request is made for a day the
 *    provider cannot serve.
 * 2. Forecast: fresh cache entry, unless `force`; otherwise one de-duplicated
 *    request, stored with its `fetchedAt` timestamp.
 * 3. "weather" mode stops here. "full" mode then checks the window has real
 *    hours, loads nearby venues (Google, mock only on failure) and calls the
 *    unchanged engine.
 */
export async function refreshTerrasse(
  input: RefreshInput,
  deps: RefreshDeps,
): Promise<RefreshOutcome> {
  const cache = deps.cache ?? forecastCache;
  const now = deps.now ?? (() => Date.now());
  const ttlMs = deps.ttlMs ?? FORECAST_TTL_MS;
  const { location, date } = input;

  if (!isWithinForecastRange(date, zonedToday(deps.timeZone))) {
    return { status: "weather-error", kind: "out-of-range" };
  }

  const day = isoDay(date);
  const key = forecastCacheKey(location.latitude, location.longitude, day);

  let entry = input.force ? undefined : cache.get(key, now(), ttlMs);
  let fromCache = entry !== undefined;

  if (!entry) {
    let res: ForecastResult;
    try {
      res = await cache.dedupe(key, () =>
        deps.fetchForecast({
          data: { latitude: location.latitude, longitude: location.longitude, date: day },
        }),
      );
    } catch (err) {
      console.error(err);
      return {
        status: "weather-error",
        kind: "network",
        message: err instanceof Error ? err.message : "network error",
      };
    }
    if (!res.ok) {
      return { status: "weather-error", kind: res.kind, range: res.range, message: res.message };
    }
    entry = cache.set(key, res.forecast, now());
    fromCache = false;
  }

  const forecast = toForecast(entry.forecast);
  const base = {
    status: "ok" as const,
    forecast,
    raw: entry.forecast,
    timeZone: entry.forecast.timezone,
    fetchedAt: entry.fetchedAt,
    fromCache,
  };

  if (input.mode === "weather") return base;

  if (knownHoursInWindow(forecast, input.from, input.to) === 0) {
    return { status: "incomplete" };
  }

  let places = mockPlaces;
  let signals: VenueSignals | { source: "mock-fallback" };
  try {
    const found = await deps.nearbyVenues({
      data: {
        latitude: location.latitude,
        longitude: location.longitude,
        radiusM: location.radiusM ?? 500,
      },
    });
    places = googlePlacesProvider(found);
    signals = summariseVenues(found, date.getDay(), input.from, input.to, "google");
  } catch (err) {
    console.error("Google nearby search failed — falling back to mock venues", err);
    signals = { source: "mock-fallback" as const };
  }

  try {
    const result = await estimateTerrasse(
      {
        location: toResolved(location),
        date,
        from: input.from,
        to: input.to,
        party: input.party,
      },
      { places, weather: staticWeatherProvider(forecast) },
    );
    return { ...base, result, signals };
  } catch (err) {
    if (err instanceof IncompleteWeatherError) return { status: "incomplete" };
    throw err;
  }
}
