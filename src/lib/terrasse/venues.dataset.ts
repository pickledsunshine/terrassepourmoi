/**
 * Structured mock dataset of Paris terrace venues.
 *
 * Shape mirrors what a Google Places response would give us (name, geo,
 * outdoor seating, opening hours, popularity, price level), so this file can
 * later be replaced by a real fetch without touching the engine.
 */

export type OpeningHours = {
  /** Decimal local hours, e.g. 11.5 = 11:30. Close may exceed 24 for after-midnight. */
  open: number;
  close: number;
  /** Weekday numbers (0 = Sunday) on which the venue is closed. */
  closedDays?: number[];
};

export type MockVenue = {
  id: string;
  name: string;
  area: ParisArea;
  latitude: number;
  longitude: number;
  outdoorSeating: boolean;
  estimatedTerraceCapacity: number;
  openingHours: OpeningHours;
  /** 0..1 — how busy/sought-after the place usually is. */
  popularity: number;
  /** 1 (cheap) .. 4 (expensive). */
  priceLevel: 1 | 2 | 3 | 4;
};

export type ParisArea =
  | "Le Marais"
  | "Saint-Germain-des-Prés"
  | "Canal Saint-Martin"
  | "Montmartre"
  | "Bastille";

/** Aliases used to map a free-form location label onto a dataset area. */
export const AREA_ALIASES: Record<ParisArea, string[]> = {
  "Le Marais": ["marais", "3e", "4e", "rambuteau", "saint-paul"],
  "Saint-Germain-des-Prés": ["saint-germain", "st germain", "st-germain", "6e", "odeon", "odéon"],
  "Canal Saint-Martin": ["canal", "saint-martin", "st martin", "10e", "jemmapes", "république"],
  Montmartre: ["montmartre", "18e", "abbesses", "pigalle", "lamarck"],
  Bastille: ["bastille", "11e", "12e", "oberkampf", "charonne", "aligre", "roquette"],
};

export const PARIS_VENUES: MockVenue[] = [
  // ————— Le Marais —————
  { id: "mar-1", name: "Café des Anges", area: "Le Marais", latitude: 48.8592, longitude: 2.3625, outdoorSeating: true, estimatedTerraceCapacity: 28, openingHours: { open: 8, close: 24 }, popularity: 0.82, priceLevel: 2 },
  { id: "mar-2", name: "Le Petit Comptoir", area: "Le Marais", latitude: 48.8578, longitude: 2.3601, outdoorSeating: true, estimatedTerraceCapacity: 14, openingHours: { open: 11.5, close: 23 }, popularity: 0.68, priceLevel: 2 },
  { id: "mar-3", name: "Chez Mireille", area: "Le Marais", latitude: 48.8605, longitude: 2.3648, outdoorSeating: true, estimatedTerraceCapacity: 36, openingHours: { open: 12, close: 22.5, closedDays: [1] }, popularity: 0.74, priceLevel: 3 },
  { id: "mar-4", name: "Bar du Marché Vieille", area: "Le Marais", latitude: 48.8588, longitude: 2.3572, outdoorSeating: true, estimatedTerraceCapacity: 42, openingHours: { open: 10, close: 25.5 }, popularity: 0.9, priceLevel: 2 },
  { id: "mar-5", name: "Maison Lila", area: "Le Marais", latitude: 48.8619, longitude: 2.3617, outdoorSeating: false, estimatedTerraceCapacity: 0, openingHours: { open: 12, close: 23 }, popularity: 0.6, priceLevel: 3 },
  { id: "mar-6", name: "Les Oliviers du Temple", area: "Le Marais", latitude: 48.8631, longitude: 2.3603, outdoorSeating: true, estimatedTerraceCapacity: 20, openingHours: { open: 9, close: 19.5 }, popularity: 0.55, priceLevel: 1 },
  { id: "mar-7", name: "Brasserie Pastis", area: "Le Marais", latitude: 48.8564, longitude: 2.3639, outdoorSeating: true, estimatedTerraceCapacity: 54, openingHours: { open: 7.5, close: 24 }, popularity: 0.86, priceLevel: 3 },

  // ————— Saint-Germain-des-Prés —————
  { id: "sgp-1", name: "Le Zinc d'Odéon", area: "Saint-Germain-des-Prés", latitude: 48.8521, longitude: 2.3387, outdoorSeating: true, estimatedTerraceCapacity: 32, openingHours: { open: 8, close: 24 }, popularity: 0.88, priceLevel: 3 },
  { id: "sgp-2", name: "Café Jaune", area: "Saint-Germain-des-Prés", latitude: 48.8546, longitude: 2.3331, outdoorSeating: true, estimatedTerraceCapacity: 46, openingHours: { open: 7, close: 25 }, popularity: 0.93, priceLevel: 4 },
  { id: "sgp-3", name: "Aux Deux Citrons", area: "Saint-Germain-des-Prés", latitude: 48.8533, longitude: 2.3357, outdoorSeating: true, estimatedTerraceCapacity: 18, openingHours: { open: 11.5, close: 22.5, closedDays: [0] }, popularity: 0.7, priceLevel: 3 },
  { id: "sgp-4", name: "La Terrasse Bleue", area: "Saint-Germain-des-Prés", latitude: 48.8558, longitude: 2.3312, outdoorSeating: true, estimatedTerraceCapacity: 26, openingHours: { open: 12, close: 23 }, popularity: 0.76, priceLevel: 3 },
  { id: "sgp-5", name: "Le Grand Balcon", area: "Saint-Germain-des-Prés", latitude: 48.8512, longitude: 2.3344, outdoorSeating: false, estimatedTerraceCapacity: 0, openingHours: { open: 12, close: 22 }, popularity: 0.64, priceLevel: 4 },
  { id: "sgp-6", name: "Comptoir Saint-Sulpice", area: "Saint-Germain-des-Prés", latitude: 48.8508, longitude: 2.3323, outdoorSeating: true, estimatedTerraceCapacity: 22, openingHours: { open: 9, close: 20 }, popularity: 0.58, priceLevel: 2 },

  // ————— Canal Saint-Martin —————
  { id: "csm-1", name: "Chez Jemmapes", area: "Canal Saint-Martin", latitude: 48.8724, longitude: 2.3663, outdoorSeating: true, estimatedTerraceCapacity: 48, openingHours: { open: 11, close: 25.5 }, popularity: 0.91, priceLevel: 2 },
  { id: "csm-2", name: "Le Quai Vert", area: "Canal Saint-Martin", latitude: 48.8703, longitude: 2.3641, outdoorSeating: true, estimatedTerraceCapacity: 30, openingHours: { open: 10, close: 23.5 }, popularity: 0.79, priceLevel: 2 },
  { id: "csm-3", name: "Café des Écluses", area: "Canal Saint-Martin", latitude: 48.8747, longitude: 2.3672, outdoorSeating: true, estimatedTerraceCapacity: 16, openingHours: { open: 8, close: 19, closedDays: [1, 2] }, popularity: 0.52, priceLevel: 1 },
  { id: "csm-4", name: "La Guinguette Rouge", area: "Canal Saint-Martin", latitude: 48.8689, longitude: 2.3628, outdoorSeating: true, estimatedTerraceCapacity: 60, openingHours: { open: 16, close: 25.5, closedDays: [0, 1] }, popularity: 0.84, priceLevel: 2 },
  { id: "csm-5", name: "Maison Villemin", area: "Canal Saint-Martin", latitude: 48.8756, longitude: 2.3609, outdoorSeating: false, estimatedTerraceCapacity: 0, openingHours: { open: 12, close: 22 }, popularity: 0.61, priceLevel: 2 },
  { id: "csm-6", name: "Le Petit Pont Tournant", area: "Canal Saint-Martin", latitude: 48.8712, longitude: 2.3657, outdoorSeating: true, estimatedTerraceCapacity: 24, openingHours: { open: 12, close: 23 }, popularity: 0.72, priceLevel: 3 },

  // ————— Montmartre —————
  { id: "mtm-1", name: "Le Balcon des Abbesses", area: "Montmartre", latitude: 48.8845, longitude: 2.3382, outdoorSeating: true, estimatedTerraceCapacity: 34, openingHours: { open: 9, close: 24 }, popularity: 0.89, priceLevel: 3 },
  { id: "mtm-2", name: "Café Lamarck", area: "Montmartre", latitude: 48.8894, longitude: 2.3395, outdoorSeating: true, estimatedTerraceCapacity: 20, openingHours: { open: 8, close: 22 }, popularity: 0.66, priceLevel: 2 },
  { id: "mtm-3", name: "Chez Colette", area: "Montmartre", latitude: 48.8863, longitude: 2.3441, outdoorSeating: true, estimatedTerraceCapacity: 12, openingHours: { open: 11.5, close: 21.5, closedDays: [2] }, popularity: 0.57, priceLevel: 2 },
  { id: "mtm-4", name: "La Butte Dorée", area: "Montmartre", latitude: 48.8877, longitude: 2.3417, outdoorSeating: true, estimatedTerraceCapacity: 44, openingHours: { open: 10, close: 24 }, popularity: 0.83, priceLevel: 3 },
  { id: "mtm-5", name: "Le Moulin Gris", area: "Montmartre", latitude: 48.8858, longitude: 2.3363, outdoorSeating: false, estimatedTerraceCapacity: 0, openingHours: { open: 12, close: 23 }, popularity: 0.6, priceLevel: 4 },
  { id: "mtm-6", name: "Bar des Deux Moulins", area: "Montmartre", latitude: 48.8836, longitude: 2.3339, outdoorSeating: true, estimatedTerraceCapacity: 18, openingHours: { open: 7.5, close: 20 }, popularity: 0.75, priceLevel: 1 },

  // ————— Bastille —————
  { id: "bas-1", name: "Café de l'Aligre", area: "Bastille", latitude: 48.8501, longitude: 2.3776, outdoorSeating: true, estimatedTerraceCapacity: 26, openingHours: { open: 8, close: 21, closedDays: [1] }, popularity: 0.71, priceLevel: 1 },
  { id: "bas-2", name: "Le Comptoir Roquette", area: "Bastille", latitude: 48.8562, longitude: 2.3792, outdoorSeating: true, estimatedTerraceCapacity: 38, openingHours: { open: 11, close: 25 }, popularity: 0.85, priceLevel: 2 },
  { id: "bas-3", name: "Brasserie Faubourg", area: "Bastille", latitude: 48.8531, longitude: 2.3701, outdoorSeating: true, estimatedTerraceCapacity: 58, openingHours: { open: 7, close: 25.5 }, popularity: 0.9, priceLevel: 3 },
  { id: "bas-4", name: "Chez Charonne", area: "Bastille", latitude: 48.8558, longitude: 2.3849, outdoorSeating: true, estimatedTerraceCapacity: 16, openingHours: { open: 12, close: 23 }, popularity: 0.63, priceLevel: 2 },
  { id: "bas-5", name: "Le Bistrot Vert", area: "Bastille", latitude: 48.8544, longitude: 2.3733, outdoorSeating: false, estimatedTerraceCapacity: 0, openingHours: { open: 12, close: 22.5 }, popularity: 0.55, priceLevel: 2 },
  { id: "bas-6", name: "La Rotonde Ledru", area: "Bastille", latitude: 48.8519, longitude: 2.3761, outdoorSeating: true, estimatedTerraceCapacity: 32, openingHours: { open: 10, close: 24, closedDays: [0] }, popularity: 0.78, priceLevel: 2 },
];

/** Matches a free-form label (or nearest coordinates) to a dataset area. */
export function matchArea(label: string, lat?: number, lng?: number): ParisArea | null {
  const haystack = label.toLowerCase();
  for (const [area, aliases] of Object.entries(AREA_ALIASES) as Array<[ParisArea, string[]]>) {
    if (aliases.some((a) => haystack.includes(a))) return area;
  }
  if (typeof lat === "number" && typeof lng === "number") {
    let best: ParisArea | null = null;
    let bestD = Infinity;
    for (const v of PARIS_VENUES) {
      const d = (v.latitude - lat) ** 2 + (v.longitude - lng) ** 2;
      if (d < bestD) {
        bestD = d;
        best = v.area;
      }
    }
    // ~2.5 km radius in squared degrees.
    if (bestD < 0.0008) return best;
  }
  return null;
}

export function venuesInArea(area: ParisArea): MockVenue[] {
  return PARIS_VENUES.filter((v) => v.area === area);
}

/** True when the venue is open for a meaningful part of [from, to]. */
export function isOpenDuring(v: MockVenue, from: number, to: number, weekday: number): boolean {
  if (v.openingHours.closedDays?.includes(weekday)) return false;
  return v.openingHours.open <= to - 0.25 && v.openingHours.close >= from + 0.25;
}

/**
 * Steps 1–6: venues in the area, with outdoor seating, open during the window
 * and with enough terrace capacity for the party.
 */
export function suitableVenues(
  area: ParisArea,
  from: number,
  to: number,
  weekday: number,
  party: number,
): MockVenue[] {
  return venuesInArea(area)
    .filter((v) => v.outdoorSeating)
    .filter((v) => isOpenDuring(v, from, to, weekday))
    .filter((v) => v.estimatedTerraceCapacity >= party + 1)
    // large parties realistically need a roomier terrace
    .filter((v) => (party > 4 ? v.estimatedTerraceCapacity >= party * 4 : true));
}

export function countSuitableVenues(
  area: ParisArea,
  from: number,
  to: number,
  weekday: number,
  party: number,
): number {
  return suitableVenues(area, from, to, weekday, party).length;
}
