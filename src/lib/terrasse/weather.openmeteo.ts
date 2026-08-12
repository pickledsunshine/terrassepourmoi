import type { HourlyWeather, WeatherForecast, WeatherProvider } from "./types";
import type { OpenMeteoForecast } from "./weather.functions";

/** Short, plain-language sky summary, keeping the existing result wording. */
export function summarise(hours: HourlyWeather[], codes: number[]): string {
  const wet = hours.some((h, i) => h.precipitationMm > 0.1 || (codes[i] ?? 0) >= 51);
  const stormy = codes.some((c) => c >= 95);
  const snow = codes.some((c) => c >= 71 && c <= 77);
  const avgCloud = hours.length ? hours.reduce((a, h) => a + h.cloudCover, 0) / hours.length : 0;
  const fog = codes.some((c) => c === 45 || c === 48);

  if (stormy) return "thunder about";
  if (snow) return "snow about";
  if (wet) return "showers passing through";
  if (fog) return "misty but dry";
  if (avgCloud > 0.6) return "grey but dry";
  if (avgCloud > 0.3) return "some cloud, dry";
  return "clear and settled";
}

/** Adapts a raw Open-Meteo payload into the engine's weather provider shape. */
export function toForecast(raw: OpenMeteoForecast): WeatherForecast {
  const byHour = new Map<number, (typeof raw.hourly)[number]>();
  for (const h of raw.hourly) byHour.set(h.hour, h);

  const hourly: HourlyWeather[] = Array.from({ length: 24 }, (_, hour) => {
    const h = byHour.get(hour);
    return {
      hour,
      temperatureC: h?.temperatureC ?? 15,
      apparentTemperatureC: h?.apparentTemperatureC,
      precipitationProbability: h?.precipitationProbability ?? 0,
      precipitationMm: h?.precipitationMm ?? 0,
      rainMm: h?.rainMm,
      cloudCover: h?.cloudCover ?? 0.5,
      windKph: h?.windKph ?? 8,
      windGustKph: h?.windGustKph,
      weatherCode: h?.weatherCode,
    };
  });

  const present = raw.hourly.map((h) => h.hour);
  const window = hourly.filter((h) => present.includes(h.hour));
  const codes = window.map((h) => h.weatherCode ?? 0);

  return { hourly, summary: summarise(window.length ? window : hourly, codes) };
}

/** A provider backed by an already-fetched forecast (the UI does the fetching). */
export function staticWeatherProvider(forecast: WeatherForecast): WeatherProvider {
  return { async getForecast() { return forecast; } };
}
