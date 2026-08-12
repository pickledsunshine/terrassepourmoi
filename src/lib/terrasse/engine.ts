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

/**
 * Demand curve: share of terrace seats typically taken at this hour,
 * before day-of-week and weather effects. Lunch, apéro and dinner peaks.
 */
function demandCurve(hour: number): number {
  return (
    0.16 +
    0.5 * Math.exp(-((hour - 13) ** 2) / 1.2) +
    0.3 * Math.exp(-((hour - 18.5) ** 2) / 1.6) +
    0.72 * Math.exp(-((hour - 20.3) ** 2) / 2.2)
  );
}

/** Friday and Saturday carry a real demand premium; Mondays are sleepy. */
export function dayDemandMultiplier(day: number): number {
  // 0 = Sunday
  return [0.98, 0.82, 0.86, 0.9, 1.0, 1.26, 1.24][day] ?? 1;
}

/**
 * WEATHER SUITABILITY — how attractive it is to sit outside (0..1).
 * This drives DEMAND: nice weather means more people want a terrace.
 */
export function weatherSuitability(w: {
  temperatureC: number;
  precipitationProbability: number;
  precipitationMm: number;
  windKph: number;
  cloudCover: number;
}): number {
  const temp = Math.exp(-((w.temperatureC - 23) ** 2) / 80);
  const rain = 1 - Math.min(1, w.precipitationProbability * 0.85 + Math.min(1, w.precipitationMm / 4) * 0.4);
  const wind = 1 - Math.min(0.8, Math.max(0, (w.windKph - 16) / 45));
  const cloud = 1 - w.cloudCover * 0.22;
  return Math.max(0, Math.min(1, temp * rain * wind * cloud));
}

/**
 * USABILITY — whether a terrace seat is actually sittable, given shelter.
 * Rain and cold reduce demand, but they also make the seats unpleasant, so
 * they must reduce the final availability answer too.
 */
function usability(
  w: { temperatureC: number; precipitationProbability: number; precipitationMm: number; windKph: number },
  shelter: number,
) {
  const rain = (w.precipitationProbability * 0.7 + Math.min(1, w.precipitationMm / 4) * 0.3) * (1 - shelter * 0.4);
  const cold = Math.max(0, (11 - w.temperatureC) / 22);
  const heat = Math.max(0, (w.temperatureC - 33) / 14);
  const wind = Math.max(0, (w.windKph - 22) / 50) * (1 - shelter * 0.5);
  return Math.max(0.04, Math.min(1, (1 - rain) * (1 - cold) * (1 - heat) * (1 - wind)));
}

function openDuring(v: Venue, from: number, to: number) {
  return v.opensAt <= to - 0.25 && v.closesAt >= from + 0.25;
}

/** Venues that could physically seat this party outside during the window. */
function suitable(venues: Venue[], party: number, from: number, to: number) {
  return venues.filter(
    (v) =>
      v.terrace &&
      openDuring(v, from, to) &&
      v.terraceSeats >= party + 1 &&
      (party <= 4 || v.acceptsGroups),
  );
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
  const dayMult = dayDemandMultiplier(day);

  // BASE SUPPLY — open, outdoor, big enough for this party.
  const openVenues = suitable(venues, party, from, to);
  const avgShelter = openVenues.length
    ? openVenues.reduce((a, v) => a + v.shelter, 0) / openVenues.length
    : 0.3;

  // Sample the window every 15 minutes and keep the best slot.
  let best = { p: 0, t: from, suitability: 0.5, demand: 1, occupancy: 0.5 };
  for (let t = from; t <= to; t += 0.25) {
    const w = weatherAt(forecast, t);
    const attractiveness = weatherSuitability(w);
    const sittable = usability(w, avgShelter);

    // DEMAND — time of day × day of week × weather appetite × party friction.
    const demand = demandCurve(t) * dayMult * (0.55 + 0.7 * attractiveness);
    const occupancy = Math.max(0.03, Math.min(1, demand));

    // Free seats per venue, then the chance of at least one table for the party.
    let expectedTables = 0;
    for (const v of openVenues) {
      const free = v.terraceSeats * (1 - occupancy);
      // A group needs adjacent seats: harder than the raw seat count suggests.
      const groupFriction = party <= 2 ? 1 : 1 / (1 + (party - 2) * 0.28);
      expectedTables += (free / (party + 1)) * groupFriction * (0.75 + (v.rating - 4) * 0.15);
    }

    const p = (1 - Math.exp(-0.22 * Math.max(0, expectedTables))) * sittable;
    if (p > best.p) best = { p, t, suitability: attractiveness, demand, occupancy };
  }

  // A longer window means more chances at the good slot.
  const windowBonus = Math.min(0.08, (to - from) * 0.03) * best.p;
  const probability = Math.round(Math.max(2, Math.min(95, (best.p + windowBonus) * 100)));

  const w = weatherAt(forecast, best.t);
  const factors: Factor[] = [
    { label: `${openVenues.length} terraces open nearby`, impact: Math.min(1, openVenues.length / 8) - 0.35 },
    {
      label:
        w.precipitationProbability > 0.5
          ? "high chance of rain"
          : w.precipitationProbability > 0.25
            ? "some rain about"
            : "dry skies",
      impact: 0.4 - w.precipitationProbability,
    },
    { label: `${Math.round(w.temperatureC)}°C outside`, impact: (best.suitability - 0.5) * 0.8 },
    { label: `party of ${party}`, impact: party <= 2 ? 0.2 : -Math.min(0.6, (party - 2) * 0.12) },
    { label: best.occupancy > 0.7 ? "peak hour" : "quieter hour", impact: 0.35 - best.occupancy * 0.5 },
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
