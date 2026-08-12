import { hash01 } from "./location";
import { matchArea, venuesInArea, type MockVenue } from "./venues.dataset";
import type { PlacesProvider, ResolvedLocation, Venue } from "./types";

const NAMES = [
  "Café des Anges",
  "Le Petit Comptoir",
  "Chez Mireille",
  "Bar du Marché",
  "La Terrasse Bleue",
  "Aux Deux Citrons",
  "Le Grand Balcon",
  "Maison Lila",
  "Le Zinc",
  "Brasserie Pastis",
  "Café Jaune",
  "Les Oliviers",
];

/** Dataset venue → engine venue. Keeps the engine free of dataset details. */
function toVenue(v: MockVenue, weekday: number): Venue {
  const closedToday = v.openingHours.closedDays?.includes(weekday) ?? false;
  const s = hash01(v.id);
  return {
    id: v.id,
    name: v.name,
    outdoor: v.outdoorSeating ? "yes" : "no",
    estimatedTerraceSeats: v.estimatedTerraceCapacity,
    // pricier, busier places tend to invest in awnings and heaters
    shelter: Math.min(0.9, 0.2 + v.priceLevel * 0.13 + v.popularity * 0.2),
    rating: Math.round((3.5 + v.popularity * 1.4) * 10) / 10,
    reviewCount: Math.round(80 + v.popularity * 2600 + s * 400),
    opensAt: closedToday ? 99 : v.openingHours.open,
    closesAt: closedToday ? 99 : v.openingHours.close,
    acceptsGroups: v.estimatedTerraceCapacity >= 24,
  };
}


/**
 * Mock stand-in for the Google Places API.
 * Uses the structured Paris dataset when the area is known, and falls back to
 * deterministic synthetic venues for anywhere else.
 */
export const mockPlaces: PlacesProvider = {
  async findTerraceVenues(location: ResolvedLocation, date?: Date): Promise<Venue[]> {
    const area = matchArea(location.label, location.lat, location.lng);
    if (area) {
      const weekday = (date ?? new Date()).getDay();
      return venuesInArea(area).map((v) => toVenue(v, weekday));
    }

    const seed = hash01(`${location.label}|${location.lat.toFixed(3)}`);
    const count = 6 + Math.round(seed * 8);

    return Array.from({ length: count }, (_, i) => {
      const r = hash01(`${location.label}-${i}`);
      const r2 = hash01(`${location.label}-${i}-b`);
      return {
        id: `${location.label}-${i}`,
        name: NAMES[(i + Math.round(seed * 11)) % NAMES.length]!,
        terrace: r > 0.22,
        terraceSeats: 8 + Math.round(r2 * 40),
        shelter: 0.15 + r2 * 0.7,
        rating: 3.6 + r * 1.3,
        reviewCount: 40 + Math.round(r2 * 2400),
        opensAt: r < 0.35 ? 8 : 11.5,
        closesAt: r2 < 0.3 ? 20 : r2 < 0.7 ? 23 : 25.5 - 1.5,
        acceptsGroups: r2 > 0.35,
      } satisfies Venue;
    });
  },
};
