import type { HourlyWeather, WeatherForecast, WeatherProvider } from "./types";
import type { OpenMeteoForecast } from "./weather.functions";

/** Short, plain-language sky summary, keeping the existing result wording. */
export function summarise(hours: HourlyWeather[], codes: number[]): string {
  if (hours.length === 0) return "weather unknown";
  const wet = hours.some((h, i) => h.precipitationMm > 0.1 || (codes[i] ?? 0) >= 51);
  const stormy = codes.some((c) => c >= 95);
  const snow = codes.some((c) => c >= 71 && c <= 77);
  const avgCloud = hours.reduce((a, h) => a + h.cloudCover, 0) / hours.length;
  const fog = codes.some((c) => c === 45 || c === 48);

  if (stormy) return "thunder about";
  if (snow) return "snow about";
  if (wet) return "showers passing through";
  if (fog) return "misty but dry";
  if (avgCloud > 0.6) return "grey but dry";
  if (avgCloud > 0.3) return "some cloud, dry";
  return "clear and settled";
}

/**
 * Adapts a raw Open-Meteo payload into the engine's weather provider shape.
 *
 * Hours whose core values are unknown are dropped and listed in `missingHours`
 * instead of being coerced to zero or to invented averages.
 */
export function toForecast(raw: OpenMeteoForecast): WeatherForecast {
  const hourly: HourlyWeather[] = [];
  const missingHours: number[] = [];
  const seen = new Set<number>();

  for (const h of raw.hourly) {
    if (seen.has(h.hour)) continue;
    seen.add(h.hour);
    const core =
      h.temperatureC !== null &&
      h.precipitationProbability !== null &&
      h.precipitationMm !== null &&
      h.cloudCover !== null &&
      h.windKph !== null;
    if (!core) {
      missingHours.push(h.hour);
      continue;
    }
    hourly.push({
      hour: h.hour,
      temperatureC: h.temperatureC as number,
      precipitationProbability: h.precipitationProbability as number,
      precipitationMm: h.precipitationMm as number,
      cloudCover: h.cloudCover as number,
      windKph: h.windKph as number,
      apparentTemperatureC: h.apparentTemperatureC,
      rainMm: h.rainMm,
      windGustKph: h.windGustKph,
      weatherCode: h.weatherCode,
    });
  }

  // Any hour of the day the provider never mentioned is unknown too.
  for (let hour = 0; hour < 24; hour++) if (!seen.has(hour)) missingHours.push(hour);

  hourly.sort((a, b) => a.hour - b.hour);
  missingHours.sort((a, b) => a - b);

  const codes = hourly.map((h) => h.weatherCode ?? 0);
  return {
    hourly,
    summary: summarise(hourly, codes),
    missingHours,
    timeZone: raw.timezone,
  };
}

/** Hours inside [from, to] for which real values exist. */
export function knownHoursInWindow(forecast: WeatherForecast, from: number, to: number): number {
  const lo = Math.floor(from);
  const hi = Math.floor(to);
  return forecast.hourly.filter((h) => h.hour >= lo && h.hour <= hi).length;
}

/** A provider backed by an already-fetched forecast (the UI does the fetching). */
export function staticWeatherProvider(forecast: WeatherForecast): WeatherProvider {
  return { async getForecast() { return forecast; } };
}
