import { describe, expect, it } from "vitest";
import { estimateTerrasse, summariseSupply, type EngineDeps } from "./engine";
import { mockPlaces } from "./places.mock";
import { googlePlacesProvider, toEngineVenue } from "./places.google";
import { resolveLocation } from "./location";
import { noAvailabilityProvider } from "./availability";
import type { GoogleVenue } from "./venues.functions";
import type {
  HourlyWeather,
  PlacesProvider,
  Venue,
  WeatherForecast,
  WeatherProvider,
} from "./types";

function stubWeather(o: Partial<Omit<HourlyWeather, "hour">> = {}): WeatherProvider {
  const hourly: HourlyWeather[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    temperatureC: 23,
    precipitationProbability: 0,
    precipitationMm: 0,
    cloudCover: 0.15,
    windKph: 8,
    ...o,
  }));
  return {
    async getForecast(): Promise<WeatherForecast> {
      return { hourly, summary: "clear" };
    },
  };
}

const pleasant = stubWeather();
const MARAIS = resolveLocation("Le Marais");
const TUESDAY = new Date(2026, 7, 11);

function googleVenue(id: string, outdoor: GoogleVenue["outdoorSeating"]): GoogleVenue {
  return {
    id,
    name: `Venue ${id}`,
    latitude: 48.86,
    longitude: 2.36,
    primaryType: "cafe",
    types: ["cafe"],
    periods: [{ day: 2, open: 8, close: 23 }],
    outdoorSeating: outdoor,
    rating: 4.3,
    reviewCount: 500,
    priceLevel: null,
    businessStatus: "OPERATIONAL",
  };
}

function provider(venues: Venue[], source: "google" | "mock-fallback"): PlacesProvider {
  return { source, async findTerraceVenues() { return venues; } };
}

const engine = (places: PlacesProvider, weather: WeatherProvider = pleasant): EngineDeps => ({
  places,
  weather,
});

describe("outdoor seating is YES / NO / UNKNOWN", () => {
  it("keeps the three states distinct through the adapter", () => {
    expect(toEngineVenue(googleVenue("a", "yes"), 2).outdoor).toBe("yes");
    expect(toEngineVenue(googleVenue("b", "no"), 2).outdoor).toBe("no");
    expect(toEngineVenue(googleVenue("c", "unknown"), 2).outdoor).toBe("unknown");
  });

  it("never invents terrace capacity from Google data", () => {
    expect(toEngineVenue(googleVenue("a", "yes"), 2).estimatedTerraceSeats).toBeNull();
  });

  it("counts confirmed, unknown and none separately", () => {
    const venues = ["yes", "yes", "no", "unknown"].map((f, i) =>
      toEngineVenue(googleVenue(String(i), f as GoogleVenue["outdoorSeating"]), 2),
    );
    const s = summariseSupply(venues, 18, 20, "google");
    expect(s).toMatchObject({
      considered: 4,
      openDuringWindow: 4,
      outdoorConfirmed: 2,
      outdoorUnknown: 1,
      outdoorNone: 1,
      source: "google",
    });
  });

  it("scores UNKNOWN like NO for the score, but reports it as unknown", async () => {
    const q = { location: MARAIS, date: TUESDAY, from: 18, to: 20, party: 2 };
    const yes = await estimateTerrasse(
      q,
      engine(provider([toEngineVenue(googleVenue("a", "yes"), 2)], "google")),
    );
    const unknown = await estimateTerrasse(
      q,
      engine(provider([toEngineVenue(googleVenue("a", "unknown"), 2)], "google")),
    );
    const no = await estimateTerrasse(
      q,
      engine(provider([toEngineVenue(googleVenue("a", "no"), 2)], "google")),
    );
    expect(yes.probability).toBeGreaterThan(unknown.probability);
    expect(unknown.probability).toBe(no.probability);
    expect(unknown.supply.outdoorUnknown).toBe(1);
    expect(unknown.supply.outdoorConfirmed).toBe(0);
    expect(no.supply.outdoorNone).toBe(1);
  });
});

describe("assumed capacity never affects the user-facing score", () => {
  it("ignores estimatedTerraceSeats entirely", async () => {
    const base = toEngineVenue(googleVenue("a", "yes"), 2);
    const q = { location: MARAIS, date: TUESDAY, from: 18, to: 20, party: 2 };
    const tiny = await estimateTerrasse(
      q,
      engine(provider([{ ...base, estimatedTerraceSeats: 2 }], "google")),
    );
    const huge = await estimateTerrasse(
      q,
      engine(provider([{ ...base, estimatedTerraceSeats: 400 }], "google")),
    );
    expect(tiny.probability).toBe(huge.probability);
  });

  it("scales with the NUMBER of confirmed terraces, not their size", async () => {
    const q = { location: MARAIS, date: TUESDAY, from: 18, to: 20, party: 2 };
    const one = await estimateTerrasse(
      q,
      engine(provider([toEngineVenue(googleVenue("a", "yes"), 2)], "google")),
    );
    const many = await estimateTerrasse(
      q,
      engine(
        provider(
          ["a", "b", "c", "d", "e"].map((id) => toEngineVenue(googleVenue(id, "yes"), 2)),
          "google",
        ),
      ),
    );
    expect(many.probability).toBeGreaterThan(one.probability);
  });
});

describe("data source provenance", () => {
  it("marks Google-backed results as google", async () => {
    const google = googlePlacesProvider([googleVenue("a", "yes"), googleVenue("b", "unknown")]);
    expect(google.source).toBe("google");
    const res = await estimateTerrasse(
      { location: MARAIS, date: TUESDAY, from: 18, to: 20, party: 2 },
      engine(google),
    );
    expect(res.supply.source).toBe("google");
  });

  it("marks mock venues as a fallback", async () => {
    expect(mockPlaces.source).toBe("mock-fallback");
    const res = await estimateTerrasse(
      { location: MARAIS, date: TUESDAY, from: 18, to: 20, party: 2 },
      engine(mockPlaces),
    );
    expect(res.supply.source).toBe("mock-fallback");
  });
});

describe("no table availability is claimed", () => {
  it("always returns tableAvailability = null", async () => {
    const res = await estimateTerrasse(
      { location: MARAIS, date: TUESDAY, from: 18, to: 20, party: 2 },
      engine(mockPlaces),
    );
    expect(res.tableAvailability).toBeNull();
  });

  it("has no availability provider wired yet", async () => {
    expect(await noAvailabilityProvider.checkTables({} as never, ["a"])).toEqual([]);
  });
});

describe("weather still drives suitability", () => {
  it("rain lowers the score for the same venues", async () => {
    const places = provider(
      ["a", "b", "c"].map((id) => toEngineVenue(googleVenue(id, "yes"), 2)),
      "google",
    );
    const q = { location: MARAIS, date: TUESDAY, from: 18, to: 20, party: 2 };
    const dry = await estimateTerrasse(q, engine(places));
    const wet = await estimateTerrasse(
      q,
      engine(places, stubWeather({ precipitationProbability: 0.9, precipitationMm: 3 })),
    );
    expect(wet.probability).toBeLessThan(dry.probability);
  });

  it("closed venues contribute nothing", async () => {
    const closed = { ...toEngineVenue(googleVenue("a", "yes"), 2), opensAt: 99, closesAt: 99 };
    const res = await estimateTerrasse(
      { location: MARAIS, date: TUESDAY, from: 18, to: 20, party: 2 },
      engine(provider([closed], "google")),
    );
    expect(res.supply.openDuringWindow).toBe(0);
    expect(res.supply.outdoorConfirmed).toBe(0);
  });
});
