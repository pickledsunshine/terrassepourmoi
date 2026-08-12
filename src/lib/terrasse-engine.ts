import { AREAS, getWeather, baseOccupancySignal, type Area, type Weather } from "./terrasse-data";

export type Query = {
  areaId: string;
  dateISO: string;
  startHour: number;
  endHour: number;
  party: number;
};

export type Factor = { label: string; effect: number; note: string };

export type Prediction = {
  probability: number; // 0..1 chance of finding a seat within the window
  bestHour: number;
  bestHourProbability: number;
  hourly: { hour: number; probability: number }[];
  weather: Weather;
  factors: Factor[];
  area: Area;
  verdict: string;
};

const clamp01 = (v: number) => Math.min(0.99, Math.max(0.01, v));

/** Base demand curve across the day (0..1 of peak). */
function demandCurve(hour: number): number {
  const lunch = Math.exp(-((hour - 13) ** 2) / 2.2) * 0.85;
  const apero = Math.exp(-((hour - 19) ** 2) / 4.5) * 1.0;
  const dinner = Math.exp(-((hour - 21) ** 2) / 3.5) * 0.8;
  const late = Math.exp(-((hour - 23.5) ** 2) / 5) * 0.4;
  return Math.min(1, lunch + apero + dinner + late);
}

/** How pleasant it is to sit outside, 0..1. */
function comfort(w: Weather, sheltered: number): number {
  const tempScore = Math.exp(-((w.tempC - 23) ** 2) / 90);
  const rainPenalty = 1 - w.rainChance * (1 - sheltered * 0.55);
  const windPenalty = 1 - Math.max(0, (w.windKph - 18) / 45);
  return Math.max(0.03, tempScore * rainPenalty * windPenalty);
}

function partyPenalty(party: number): number {
  // Tables for 2 are everywhere; 6+ is a different game.
  return Math.min(1, 1.08 / (1 + Math.exp((party - 4.4) / 1.35)) + 0.12);
}

function hourProbability(area: Area, q: Query, hour: number) {
  const w = getWeather(q.dateISO, hour);
  const day = new Date(`${q.dateISO}T00:00:00`).getDay();
  const weekend = day === 5 || day === 6 ? 1.28 : day === 0 ? 1.05 : 1;

  const c = comfort(w, area.sheltered);
  // Everyone wants outside when it's nice -> demand scales with comfort.
  const demand =
    demandCurve(hour) *
    area.popularity *
    weekend *
    (0.45 + 0.75 * c) *
    (1 + area.tourist * 0.18 * (weekend - 0.85));

  const capacityPerDemand = 1 / Math.max(0.05, demand);
  const supplyFactor = Math.min(1.6, (area.seats / 950) * capacityPerDemand * 0.62);

  // Terraces literally close when it's miserable.
  const openFactor = 0.25 + 0.75 * Math.min(1, c * 1.6 + area.sheltered * 0.35);

  let p = supplyFactor * openFactor * partyPenalty(q.party);
  p += baseOccupancySignal(area.id, q.dateISO, hour);
  return { p: clamp01(p), w, c, demand, weekend };
}

export function predict(q: Query): Prediction {
  const area = AREAS.find((a) => a.id === q.areaId) ?? AREAS[0];
  const start = Math.min(q.startHour, q.endHour);
  const end = Math.max(q.startHour, q.endHour);
  const hours: number[] = [];
  for (let h = start; h <= end; h++) hours.push(h);

  const hourly = hours.map((hour) => ({ hour, probability: hourProbability(area, q, hour).p }));
  const best = hourly.reduce((a, b) => (b.probability > a.probability ? b : a));

  // Probability of succeeding at least once, with correlation between hours.
  const failAll = hourly.reduce((acc, h) => acc * (1 - h.probability), 1);
  const independent = 1 - failAll;
  const rho = 0.72; // conditions persist across the window
  const probability = clamp01(best.probability * rho + independent * (1 - rho));

  const mid = hourly[Math.floor(hourly.length / 2)].hour;
  const detail = hourProbability(area, q, mid);
  const w = detail.w;

  const factors: Factor[] = [
    {
      label: "Weather",
      effect: detail.c - 0.5,
      note: `${Math.round(w.tempC)}°C, ${Math.round(w.rainChance * 100)}% rain, ${w.windKph} km/h wind`,
    },
    {
      label: "Crowd pressure",
      effect: 0.5 - Math.min(1, detail.demand / 1.6),
      note: detail.weekend > 1.1 ? "Weekend peak in this area" : "Ordinary weekday flow",
    },
    {
      label: "Terrace supply",
      effect: (area.seats - 900) / 2000,
      note: `~${area.seats} outdoor seats, ${Math.round(area.sheltered * 100)}% covered`,
    },
    {
      label: "Party of " + q.party,
      effect: partyPenalty(q.party) - 0.62,
      note: q.party <= 2 ? "Easy to squeeze in" : q.party <= 4 ? "Standard table" : "Big tables are rare outside",
    },
  ];

  const verdict =
    probability > 0.75
      ? "Just walk over, you'll be fine."
      : probability > 0.5
        ? "Decent odds — have a backup street in mind."
        : probability > 0.28
          ? "Tight. Arrive early or split the group."
          : "Honestly? Book a table inside.";

  return { probability, bestHour: best.hour, bestHourProbability: best.probability, hourly, weather: w, factors, area, verdict };
}

export { AREAS };
