import { hash01 } from "./location";
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

/**
 * Mock stand-in for the Google Places API.
 * Same shape as the real provider: swap the implementation, keep the engine.
 */
export const mockPlaces: PlacesProvider = {
  async findTerraceVenues(location: ResolvedLocation): Promise<Venue[]> {
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
