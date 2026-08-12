// Mock data layer: realistic Paris terrace supply + hourly weather.
// Swap these functions for real APIs later; the engine only sees these types.

export type Area = {
  id: string;
  name: string;
  /** terrace seats available in the area */
  seats: number;
  /** relative demand pressure, 1 = city average */
  popularity: number;
  /** share of terraces that are heated / covered */
  sheltered: number;
  /** how touristy: raises weekend + evening demand */
  tourist: number;
};

export const AREAS: Area[] = [
  { id: "marais", name: "Le Marais", seats: 1450, popularity: 1.35, sheltered: 0.45, tourist: 0.8 },
  { id: "canal", name: "Canal Saint-Martin", seats: 980, popularity: 1.4, sheltered: 0.2, tourist: 0.45 },
  { id: "bastille", name: "Bastille", seats: 1220, popularity: 1.15, sheltered: 0.4, tourist: 0.5 },
  { id: "montmartre", name: "Montmartre", seats: 860, popularity: 1.25, sheltered: 0.35, tourist: 0.95 },
  { id: "belleville", name: "Belleville", seats: 700, popularity: 0.95, sheltered: 0.25, tourist: 0.3 },
  { id: "saint-germain", name: "Saint-Germain", seats: 1100, popularity: 1.3, sheltered: 0.6, tourist: 0.85 },
  { id: "batignolles", name: "Batignolles", seats: 540, popularity: 0.85, sheltered: 0.3, tourist: 0.2 },
  { id: "butte-aux-cailles", name: "Butte-aux-Cailles", seats: 420, popularity: 1.05, sheltered: 0.3, tourist: 0.35 },
];

export type Weather = {
  tempC: number;
  rainChance: number; // 0..1
  windKph: number;
  cloud: number; // 0..1
};

/** Deterministic pseudo-random so a given area/date/hour always looks the same. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** Mock hourly forecast — seasonal curve + daily noise, Paris-ish. */
export function getWeather(dateISO: string, hour: number): Weather {
  const d = new Date(`${dateISO}T00:00:00`);
  const doy = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
  const season = Math.sin(((doy - 105) / 365) * Math.PI * 2); // peak ~mid July
  const dayNoise = hash(dateISO) - 0.5;
  const diurnal = Math.sin(((hour - 9) / 24) * Math.PI * 2);

  const tempC = 12.5 + season * 9 + diurnal * 4.5 + dayNoise * 5;
  const rainBase = 0.34 - season * 0.12 + (hash(dateISO + "r") - 0.5) * 0.4;
  const rainChance = Math.min(0.95, Math.max(0.02, rainBase + (hash(dateISO + hour + "h") - 0.5) * 0.15));
  const windKph = 6 + hash(dateISO + "w") * 22;
  const cloud = Math.min(1, Math.max(0, 0.45 - season * 0.15 + (hash(dateISO + "c") - 0.5) * 0.6));

  return { tempC: Math.round(tempC * 10) / 10, rainChance, windKph: Math.round(windKph), cloud };
}

/** Mock "live" occupancy signal, as if scraped from booking platforms. */
export function baseOccupancySignal(areaId: string, dateISO: string, hour: number): number {
  return hash(`${areaId}|${dateISO}|${hour}`) * 0.18 - 0.09;
}
