import type { ParisArea } from "./venues.dataset";

/**
 * Location layer: autocomplete, Maps-link resolution, address and coordinate
 * parsing. All of it is mock today; the exported functions are the seam where
 * Google Places Autocomplete / Geocoding will plug in later.
 */

export type SelectedLocation = {
  displayName: string;
  latitude: number;
  longitude: number;
  /** Nearest known Paris area, used to pick the venue set. */
  area: ParisArea | string;
  /** Configurable search radius around the point, in metres. */
  radiusM: number;
};

export type PlaceSuggestion = {
  id: string;
  /** Main line, e.g. "Rue de Rivoli". */
  primary: string;
  /** Secondary line, e.g. "Paris 1er". */
  secondary: string;
  latitude: number;
  longitude: number;
  area: ParisArea;
  kind: "area" | "street" | "address" | "landmark";
};

/** Initial search radius around the selected point. */
export const DEFAULT_SEARCH_RADIUS_M = 500;

const SUGGESTIONS: PlaceSuggestion[] = [
  { id: "rivoli-1", primary: "Rue de Rivoli", secondary: "Paris 1er", latitude: 48.8607, longitude: 2.3376, area: "Le Marais", kind: "street" },
  { id: "rivoli-4", primary: "Rue de Rivoli", secondary: "Paris 4e", latitude: 48.8558, longitude: 2.3568, area: "Le Marais", kind: "street" },
  { id: "rivoli-15", primary: "15 Rue de Rivoli", secondary: "Paris 4e", latitude: 48.8555, longitude: 2.3583, area: "Le Marais", kind: "address" },
  { id: "marais", primary: "Le Marais", secondary: "Paris 3e / 4e", latitude: 48.8595, longitude: 2.3617, area: "Le Marais", kind: "area" },
  { id: "vosges", primary: "Place des Vosges", secondary: "Paris 4e", latitude: 48.8556, longitude: 2.3655, area: "Le Marais", kind: "landmark" },
  { id: "bretagne", primary: "Rue de Bretagne", secondary: "Paris 3e", latitude: 48.8632, longitude: 2.3623, area: "Le Marais", kind: "street" },
  { id: "sgp", primary: "Saint-Germain-des-Prés", secondary: "Paris 6e", latitude: 48.8539, longitude: 2.3336, area: "Saint-Germain-des-Prés", kind: "area" },
  { id: "odeon", primary: "Carrefour de l'Odéon", secondary: "Paris 6e", latitude: 48.8521, longitude: 2.3387, area: "Saint-Germain-des-Prés", kind: "landmark" },
  { id: "buci", primary: "Rue de Buci", secondary: "Paris 6e", latitude: 48.8534, longitude: 2.3357, area: "Saint-Germain-des-Prés", kind: "street" },
  { id: "canal", primary: "Canal Saint-Martin", secondary: "Paris 10e", latitude: 48.8717, longitude: 2.3646, area: "Canal Saint-Martin", kind: "area" },
  { id: "jemmapes", primary: "Quai de Jemmapes", secondary: "Paris 10e", latitude: 48.8724, longitude: 2.3663, area: "Canal Saint-Martin", kind: "street" },
  { id: "montmartre", primary: "Montmartre", secondary: "Paris 18e", latitude: 48.8867, longitude: 2.3431, area: "Montmartre", kind: "area" },
  { id: "abbesses", primary: "Place des Abbesses", secondary: "Paris 18e", latitude: 48.8845, longitude: 2.3382, area: "Montmartre", kind: "landmark" },
  { id: "lamarck", primary: "Rue Lamarck", secondary: "Paris 18e", latitude: 48.8894, longitude: 2.3395, area: "Montmartre", kind: "street" },
  { id: "bastille", primary: "Bastille", secondary: "Paris 11e / 12e", latitude: 48.8532, longitude: 2.3692, area: "Bastille", kind: "area" },
  { id: "oberkampf", primary: "Rue Oberkampf", secondary: "Paris 11e", latitude: 48.8654, longitude: 2.3769, area: "Bastille", kind: "street" },
  { id: "roquette", primary: "Rue de la Roquette", secondary: "Paris 11e", latitude: 48.8562, longitude: 2.3792, area: "Bastille", kind: "street" },
  { id: "aligre", primary: "Marché d'Aligre", secondary: "Paris 12e", latitude: 48.8501, longitude: 2.3776, area: "Bastille", kind: "landmark" },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Mock Places Autocomplete. Returns a few relevant Paris suggestions. */
export function searchPlaces(query: string, limit = 5): PlaceSuggestion[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const tokens = q.split(" ").filter(Boolean);
  return SUGGESTIONS.map((s) => {
    const hay = norm(`${s.primary} ${s.secondary}`);
    let score = 0;
    for (const t of tokens) {
      if (hay.startsWith(t)) score += 3;
      else if (hay.includes(t)) score += 2;
      else return { s, score: -1 };
    }
    if (s.kind === "area") score += 1;
    return { s, score };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.s);
}

export const COORD_PATTERN = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

export function parseCoordinates(input: string): { latitude: number; longitude: number } | null {
  const m = input.match(COORD_PATTERN);
  if (!m) return null;
  const latitude = Number(m[1]);
  const longitude = Number(m[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export function isMapsUrl(input: string): boolean {
  return /https?:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(
    input.trim(),
  );
}

/**
 * Mock resolver for Google Maps links.
 * Real implementation: follow short links, then call the Geocoding API.
 */
export async function resolveMapsUrl(url: string): Promise<SelectedLocation | null> {
  if (!isMapsUrl(url)) return null;
  const decoded = decodeURIComponent(url);

  // Coordinates embedded in the URL (@lat,lng or !3dlat!4dlng or ?q=lat,lng)
  const at = decoded.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const q = decoded.match(/[?&]q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  const bang = decoded.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  const hit = at ?? q ?? bang;
  if (hit) {
    return fromCoordinates(Number(hit[1]), Number(hit[2]));
  }

  // Place name in the path: /maps/place/Place+des+Vosges/...
  const place = decoded.match(/\/place\/([^/@?]+)/);
  if (place) {
    const name = (place[1] ?? "").replace(/\+/g, " ");
    const best = searchPlaces(name, 1)[0];
    if (best) return fromSuggestion(best);
    return null;
  }

  // Short link with no readable payload — a real resolver would expand it.
  return null;
}

export function fromSuggestion(s: PlaceSuggestion, radiusM = DEFAULT_SEARCH_RADIUS_M): SelectedLocation {
  return {
    displayName: `${s.primary}, ${s.secondary}`,
    latitude: s.latitude,
    longitude: s.longitude,
    area: s.area,
    radiusM,
  };
}

/** Nearest known suggestion decides the area label for raw coordinates. */
export function fromCoordinates(
  latitude: number,
  longitude: number,
  radiusM = DEFAULT_SEARCH_RADIUS_M,
): SelectedLocation {
  let best = SUGGESTIONS[0]!;
  let bestD = Infinity;
  for (const s of SUGGESTIONS) {
    const d = (s.latitude - latitude) ** 2 + (s.longitude - longitude) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  const near = bestD < 0.0008;
  return {
    displayName: near
      ? `${best.primary}, ${best.secondary}`
      : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    latitude,
    longitude,
    area: near ? best.area : "Paris",
    radiusM,
  };
}

/**
 * Best-effort interpretation of whatever is in the input when the user hits
 * Check without picking a suggestion.
 */
export async function resolveInput(raw: string): Promise<SelectedLocation | null> {
  const input = raw.trim();
  if (!input) return null;

  const coords = parseCoordinates(input);
  if (coords) return fromCoordinates(coords.latitude, coords.longitude);

  if (isMapsUrl(input)) return resolveMapsUrl(input);

  const best = searchPlaces(input, 1)[0];
  return best ? fromSuggestion(best) : null;
}
