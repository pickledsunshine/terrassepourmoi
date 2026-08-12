import { hash01 } from "./location";
import type { HourlyWeather, ResolvedLocation, WeatherForecast, WeatherProvider } from "./types";

/**
 * Mock stand-in for a weather API (Meteo-France / Open-Meteo).
 * Deterministic per location + date so results are stable and testable.
 */
export const mockWeather: WeatherProvider = {
  async getForecast(location: ResolvedLocation, date: Date): Promise<WeatherForecast> {
    const key = `${location.label}|${date.toDateString()}`;
    const s = hash01(key);
    const s2 = hash01(key + "w");

    const seasonal = 14 + 10 * Math.sin(((date.getMonth() + 9) / 12) * Math.PI * 2);
    const dayHigh = seasonal + s * 8;
    const wetDay = s2 > 0.72;
    const baseWind = 5 + s2 * 22;

    const hourly: HourlyWeather[] = Array.from({ length: 24 }, (_, hour) => {
      const diurnal = Math.sin(((hour - 9) / 24) * Math.PI * 2);
      const temperatureC = Math.round((dayHigh - 6 + diurnal * 5) * 10) / 10;
      const rainSeed = hash01(`${key}-${hour}`);
      const precipitationProbability = wetDay
        ? Math.min(0.95, 0.35 + rainSeed * 0.6)
        : Math.max(0, rainSeed * 0.3 - 0.05);
      return {
        hour,
        temperatureC,
        precipitationProbability,
        precipitationMm: precipitationProbability > 0.5 ? (precipitationProbability - 0.5) * 6 : 0,
        cloudCover: Math.min(1, 0.2 + rainSeed * (wetDay ? 0.8 : 0.5)),
        windKph: Math.round(baseWind + Math.sin(hour / 3) * 6),
      };
    });

    const midday = hourly[14]!;
    const summary = wetDay
      ? "showers passing through"
      : midday.cloudCover > 0.6
        ? "grey but dry"
        : "clear and settled";

    return { hourly, summary };
  },
};

export function weatherAt(forecast: WeatherForecast, hour: number): HourlyWeather {
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  return forecast.hourly[h]!;
}
