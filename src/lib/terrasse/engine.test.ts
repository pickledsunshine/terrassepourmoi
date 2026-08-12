import { describe, expect, it } from "vitest";
import { estimateTerrasse, type EngineDeps } from "./engine";
import { mockPlaces } from "./places.mock";
import { resolveLocation } from "./location";
import {
  countSuitableVenues,
  isOpenDuring,
  suitableVenues,
  venuesInArea,
  type MockVenue,
} from "./venues.dataset";
import type { HourlyWeather, ResolvedLocation, WeatherForecast, WeatherProvider } from "./types";

/** Flat, fully controllable weather so engine behaviour is isolated. */
function stubWeather(o: {
  temperatureC?: number;
  rainProb?: number;
  rainMm?: number;
  windKph?: number;
  cloud?: number;
  summary?: string;
}): WeatherProvider {
  const hourly: HourlyWeather[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    temperatureC: o.temperatureC ?? 22,
    precipitationProbability: o.rainProb ?? 0,
    precipitationMm: o.rainMm ?? 0,
    cloudCover: o.cloud ?? 0.2,
    windKph: o.windKph ?? 8,
  }));
  return {
    async getForecast(): Promise<WeatherForecast> {
      return { hourly, summary: o.summary ?? "clear" };
    },
  };
}

const pleasant = stubWeather({});
const deps = (weather: WeatherProvider): EngineDeps => ({ places: mockPlaces, weather });

const MARAIS: ResolvedLocation = resolveLocation("Le Marais");
// A Wednesday (no dataset closedDays hits 3) for stable venue sets.
const WEDNESDAY = new Date(2026, 7, 12);

function run(
  overrides: Partial<{ location: ResolvedLocation; date: Date; from: number; to: number; party: number }> = {},
  weather: WeatherProvider = pleasant,
) {
  return estimateTerrasse(
    {
      location: overrides.location ?? MARAIS,
      date: overrides.date ?? WEDNESDAY,
      from: overrides.from ?? 15,
      to: overrides.to ?? 16,
      party: overrides.party ?? 2,
    },
    deps(weather),
  );
}

const marais = venuesInArea("Le Marais");
const byName = (n: string) => marais.find((v) => v.name === n) as MockVenue;

describe("venue filtering", () => {
  it("1. excludes venues without outdoor seating", () => {
    const indoorOnly = byName("Maison Lila");
    expect(indoorOnly.outdoorSeating).toBe(false);
    const suitable = suitableVenues("Le Marais", 15, 16, 3, 2);
    expect(suitable.some((v) => v.id === indoorOnly.id)).toBe(false);
    expect(suitable.every((v) => v.outdoorSeating)).toBe(true);
  });

  it("2. excludes venues closed during the selected window", () => {
    const early = byName("Les Oliviers du Temple"); // 09:00–19:30
    expect(isOpenDuring(early, 15, 16, 3)).toBe(true);
    expect(isOpenDuring(early, 21, 22, 3)).toBe(false);
    expect(suitableVenues("Le Marais", 21, 22, 3, 2).some((v) => v.id === early.id)).toBe(false);

    const closedMonday = byName("Chez Mireille"); // closedDays: [1]
    expect(isOpenDuring(closedMonday, 20, 21, 1)).toBe(false);
    expect(isOpenDuring(closedMonday, 20, 21, 3)).toBe(true);
  });

  it("3. keeps venues whose terrace capacity fits the party, drops those that don't", () => {
    const small = byName("Le Petit Comptoir"); // 14 seats
    const big = byName("Brasserie Pastis"); // 54 seats
    const forTwo = suitableVenues("Le Marais", 15, 16, 3, 2).map((v) => v.id);
    expect(forTwo).toContain(small.id);
    expect(forTwo).toContain(big.id);

    const forTen = suitableVenues("Le Marais", 15, 16, 3, 10).map((v) => v.id);
    expect(forTen).not.toContain(small.id);
    expect(forTen).toContain(big.id);

    expect(countSuitableVenues("Le Marais", 15, 16, 3, 10)).toBeLessThan(
      countSuitableVenues("Le Marais", 15, 16, 3, 2),
    );
  });
});

describe("probability inputs", () => {
  it("4. increasing party size never increases the probability", async () => {
    const results = [];
    for (const party of [1, 2, 4, 6, 8, 10]) {
      results.push((await run({ party })).probability);
    }
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!).toBeLessThanOrEqual(results[i - 1]!);
    }
  });

  it("5. peak lunch and dinner hours are worse than quiet hours", async () => {
    const quiet = (await run({ from: 15, to: 15.5 })).probability;
    const lunch = (await run({ from: 12.75, to: 13.25 })).probability;
    const dinner = (await run({ from: 18.75, to: 19.25 })).probability;
    expect(lunch).toBeLessThan(quiet);
    expect(dinner).toBeLessThan(quiet);
  });

  it("6. pleasant weather beats cold, grey weather", async () => {
    const nice = (await run({}, stubWeather({ temperatureC: 22 }))).probability;
    const cold = (await run({}, stubWeather({ temperatureC: 4 }))).probability;
    expect(nice).toBeGreaterThan(cold);
  });

  it("7. rain materially reduces the probability", async () => {
    const dry = (await run({}, stubWeather({ rainProb: 0 }))).probability;
    const wet = (await run({}, stubWeather({ rainProb: 0.9, rainMm: 4 }))).probability;
    expect(wet).toBeLessThan(dry);
    expect(dry - wet).toBeGreaterThanOrEqual(10);
  });

  it("8. strong wind reduces the probability", async () => {
    const calm = (await run({}, stubWeather({ windKph: 5 }))).probability;
    const gusty = (await run({}, stubWeather({ windKph: 55 }))).probability;
    expect(gusty).toBeLessThan(calm);
  });

  it("9. different Paris areas produce different results", async () => {
    const areas = [
      "Le Marais",
      "Saint-Germain-des-Prés",
      "Canal Saint-Martin",
      "Montmartre",
      "Bastille",
    ];
    const results = await Promise.all(
      areas.map(async (a) => {
        const r = await run({ location: resolveLocation(a), party: 6, from: 19, to: 20 });
        return { a, p: r.probability, open: r.venuesOpen };
      }),
    );
    const distinct = new Set(results.map((r) => `${r.p}|${r.open}`));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it("10. identical inputs always produce identical results", async () => {
    const a = await run({ party: 3, from: 18, to: 20 });
    const b = await run({ party: 3, from: 18, to: 20 });
    expect(b).toEqual(a);
  });
});
