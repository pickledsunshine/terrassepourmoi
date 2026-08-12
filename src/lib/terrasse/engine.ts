import { mockPlaces } from "./places.mock";
import { mockWeather, weatherAt } from "./weather.mock";
import type {
  Factor,
  PlacesProvider,
  TerrasseQuery,
  TerrasseResult,
  Venue,
  WeatherProvider,
} from "./types";

/**
 * V1 probability engine — simple, deterministic and transparent.
 *
 * It estimates: "the probability that at least one suitable terrace option is
 * likely to be free for this party during this window". It never claims to
 * know real-time table availability.
 */

export type EngineDeps = { places: PlacesProvider; weather: WeatherProvider };

const defaultDeps: EngineDeps = { places: mockPlaces, weather: mockWeather };

/** Crowd pressure across the day: lunch, apéro and dinner peaks. */
function demandAt(hour: number, weekend: boolean): number {
  const peaks: Array<[number, number]> = [
    [12.75, 0.72],
    [18.75, 1],
    [20.75, 0.88],
  ];
  const base = peaks.reduce(
    (acc, [c, w]) => acc + w * Math.exp(-((hour - c) ** 2) / 3.0),
    0.1,
  );
  return base * (weekend ? 1.18 : 1);
}

/** 0..1 comfort of sitting outside at this hour. */
function comfortAt(temp: number, rainProb: number, rainMm: number, wind: number, shelter: number) {
  const tempScore = Math.exp(-((temp - 22) ** 2) / 70);
  const rainPenalty = (rainProb * 0.55 + Math.min(1, rainMm / 4) * 0.45) * (1 - shelter * 0.45);
  const windPenalty = Math.max(0, (wind - 18) / 45) * (1 - shelter * 0.5);
  return Math.max(0.03, Math.min(1, tempScore * (1 - rainPenalty) * (1 - windPenalty)));
}

function openDuring(v: Venue, from: number, to: number) {
  return v.opensAt <= to - 0.25 && v.closesAt >= from + 0.25;
}

/** Effective supply of terrace seats suitable for this party. */
function supplyScore(venues: Venue[], party: number, from: number, to: number) {
  return venues
    .filter((v) => v.terrace && openDuring(v, from, to))
    .reduce((acc, v) => {
      if (party > 4 && !v.acceptsGroups) return acc;
      const capacity = Math.max(0, v.terraceSeats - party + 1) / 40;
      const desirability = 0.6 + (v.rating - 3.5) * 0.25 + Math.min(0.25, v.reviewCount / 8000);
      return acc + capacity * desirability;
    }, 0);
}

export async function estimateTerrasse(
  query: TerrasseQuery,
  deps: EngineDeps = defaultDeps,
): Promise<TerrasseResult> {
  const { location, date, party } = query;
  const from = query.from;
  const to = Math.max(query.to, from + 0.25);

  const [venues, forecast] = await Promise.all([
    deps.places.findTerraceVenues(location, date),
    deps.weather.getForecast(location, date),
  ]);

  const day = date.getDay();
  const weekend = day === 0 || day === 5 || day === 6;
  // Suitable = has a terrace, open during the window, and roomy enough for the party.
  const openVenues = venues.filter(
    (v) =>
      v.terrace &&
      openDuring(v, from, to) &&
      v.terraceSeats >= party + 1 &&
      (party <= 4 || v.acceptsGroups),
  );
  const supply = supplyScore(venues, party, from, to);
  const avgShelter = openVenues.length
    ? openVenues.reduce((a, v) => a + v.shelter, 0) / openVenues.length
    : 0.3;

  // Sample the window every 15 minutes and keep the best slot.
  let best = { p: 0, t: from, comfort: 0.5, demand: 1 };
  for (let t = from; t <= to; t += 0.25) {
    const w = weatherAt(forecast, t);
    const comfort = comfortAt(w.temperatureC, w.precipitationProbability, w.precipitationMm, w.windKph, avgShelter);
    const demand = demandAt(t, weekend);
    // Crowd competes for a finite, weather-adjusted supply of seats.
    const effectiveSupply = supply * (0.45 + comfort * 0.55);
    const pressure = (demand * (0.9 + party * 0.16)) / Math.max(0.2, effectiveSupply);
    const p = Math.exp(-pressure * 0.85) * (0.35 + comfort * 0.65);
    if (p > best.p) best = { p, t, comfort, demand };
  }

  // A longer window means more chances at the good slot.
  const windowBonus = Math.min(0.14, (to - from) * 0.05);
  const probability = Math.round(Math.max(3, Math.min(96, (best.p + windowBonus) * 100)));

  const w = weatherAt(forecast, best.t);
  const factors: Factor[] = [
    { label: `${openVenues.length} terraces open nearby`, impact: Math.min(1, supply / 4) - 0.35 },
    {
      label:
        w.precipitationProbability > 0.5
          ? "high chance of rain"
          : w.precipitationProbability > 0.25
            ? "some rain about"
            : "dry skies",
      impact: 0.4 - w.precipitationProbability,
    },
    { label: `${Math.round(w.temperatureC)}°C outside`, impact: (best.comfort - 0.5) * 0.8 },
    { label: `party of ${party}`, impact: party <= 2 ? 0.2 : -Math.min(0.6, (party - 2) * 0.12) },
    { label: best.demand > 0.75 ? "peak hour" : "quieter hour", impact: 0.35 - best.demand * 0.5 },
  ];

  const worst = [...factors].sort((a, b) => a.impact - b.impact)[0]!;
  const helper = [...factors].sort((a, b) => b.impact - a.impact)[0]!;

  const verdict =
    probability >= 70
      ? "Good chance"
      : probability >= 45
        ? "Worth a walk"
        : probability >= 25
          ? "Tight"
          : "Plan a fallback";

  return {
    probability,
    verdict,
    bestWindow: (() => {
      const start = Math.max(from, Math.min(best.t, to - 0.5));
      return { from: start, to: Math.min(to, start + 0.5) };
    })(),
    weatherLine: `${Math.round(w.temperatureC)}°C · ${rainWord(w.precipitationProbability)} · ${Math.round(w.windKph)} km/h wind · ${forecast.summary}`,
    venuesConsidered: venues.length,
    venuesOpen: openVenues.length,
    factors,
    explanation:
      probability >= 45
        ? `${capitalize(helper.label)} helps; ${worst.label} is the limiting factor.`
        : `${capitalize(worst.label)} works against you — ${helper.label} is the one thing in your favour.`,
  };
}

function rainWord(p: number) {
  return p > 0.5 ? "likely rain" : p > 0.25 ? "showers possible" : "low rain probability";
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatHour(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function parseHour(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) + (m || 0) / 60;
}
