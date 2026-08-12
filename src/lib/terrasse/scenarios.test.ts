import { describe, expect, it } from "vitest";
import { estimateTerrasse, weatherSuitability, type EngineDeps } from "./engine";
import { mockPlaces } from "./places.mock";
import { resolveLocation } from "./location";
import type { HourlyWeather, WeatherForecast, WeatherProvider } from "./types";

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
const deps = (weather: WeatherProvider): EngineDeps => ({ places: mockPlaces, weather });
const MARAIS = resolveLocation("Le Marais");

// August 2026: 11th = Tuesday, 14th = Friday, 15th = Saturday.
const TUESDAY = new Date(2026, 7, 11);
const FRIDAY = new Date(2026, 7, 14);
const SATURDAY = new Date(2026, 7, 15);

function run(date: Date, from: number, party: number, weather: WeatherProvider = pleasant) {
  return estimateTerrasse(
    { location: MARAIS, date, from, to: from + 1, party },
    deps(weather),
  ).then((r) => r.probability);
}

describe("supply / demand ordering", () => {
  it("orders the four reference scenarios correctly", async () => {
    const tueAfternoon = await run(TUESDAY, 14, 2);
    const friDinner = await run(FRIDAY, 20, 2);
    const friDinnerSix = await run(FRIDAY, 20, 6);
    const satLunch = await run(SATURDAY, 13, 2);

    expect(tueAfternoon).toBeGreaterThan(satLunch);
    expect(satLunch).toBeGreaterThan(friDinner);
    expect(friDinner).toBeGreaterThan(friDinnerSix);

    expect(tueAfternoon).toBeGreaterThan(60); // quiet weekday afternoon: high
    expect(friDinner).toBeLessThan(40); // peak Friday dinner: low
    expect(friDinnerSix).toBeLessThan(friDinner - 5); // big group: lower again
  });

  it("good weather raises demand, so it does not automatically mean high availability", async () => {
    const nicePeak = await run(FRIDAY, 20, 2, stubWeather({ temperatureC: 24 }));
    const coolPeak = await run(FRIDAY, 20, 2, stubWeather({ temperatureC: 15, cloudCover: 0.8 }));
    // cooler, greyer evening is less contested → not worse than the perfect one
    expect(coolPeak).toBeGreaterThanOrEqual(nicePeak);
    expect(nicePeak).toBeLessThan(45);
  });

  it("rain reduces demand but materially reduces availability", async () => {
    const dry = await run(TUESDAY, 14, 2);
    const wet = await run(TUESDAY, 14, 2, stubWeather({ precipitationProbability: 0.85, precipitationMm: 3 }));
    expect(wet).toBeLessThan(dry - 25);
  });

  it("weather suitability is a separate concept from availability", async () => {
    const nice = weatherSuitability({
      temperatureC: 23,
      precipitationProbability: 0,
      precipitationMm: 0,
      windKph: 8,
      cloudCover: 0.1,
    });
    const grim = weatherSuitability({
      temperatureC: 9,
      precipitationProbability: 0.8,
      precipitationMm: 3,
      windKph: 40,
      cloudCover: 0.9,
    });
    expect(nice).toBeGreaterThan(0.8);
    expect(grim).toBeLessThan(0.15);

    // ...yet the nicest weather at peak time is worse than a quiet grey afternoon.
    const nicePeak = await run(FRIDAY, 20, 2);
    const quietAfternoon = await run(TUESDAY, 14, 2, stubWeather({ temperatureC: 18, cloudCover: 0.7 }));
    expect(quietAfternoon).toBeGreaterThan(nicePeak);
  });

  it("weekend evenings are worse than the same hour midweek", async () => {
    expect(await run(FRIDAY, 20, 2)).toBeLessThan(await run(TUESDAY, 20, 2));
  });
});
