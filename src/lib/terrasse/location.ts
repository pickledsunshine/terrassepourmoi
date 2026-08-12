import type { ResolvedLocation } from "./types";

/** Deterministic 0..1 hash so mock data is stable per input. */
export function hash01(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** A few known Paris areas — later replaced by a Places/Geocoding lookup. */
const KNOWN_AREAS: Array<{ match: string[]; label: string; lat: number; lng: number }> = [
  { match: ["marais", "3e", "4e"], label: "Le Marais", lat: 48.8595, lng: 2.3617 },
  { match: ["canal", "saint-martin", "st martin"], label: "Canal Saint-Martin", lat: 48.8717, lng: 2.3646 },
  { match: ["montmartre", "18e", "abbesses"], label: "Montmartre", lat: 48.8867, lng: 2.3431 },
  { match: ["bastille", "11e", "oberkampf"], label: "Oberkampf", lat: 48.8657, lng: 2.3777 },
  { match: ["saint-germain", "st germain", "6e", "odeon"], label: "Saint-Germain", lat: 48.8539, lng: 2.3336 },
  { match: ["belleville", "20e"], label: "Belleville", lat: 48.8721, lng: 2.3844 },
  { match: ["batignolles", "17e"], label: "Batignolles", lat: 48.8875, lng: 2.3199 },
  { match: ["butte", "aux cailles", "13e"], label: "Butte-aux-Cailles", lat: 48.8277, lng: 2.3494 },
];

const COORD_RE = /(-?\d{1,3}\.\d{3,})[,\s]+(-?\d{1,3}\.\d{3,})/;

/**
 * Resolves a Maps link, address, neighbourhood or coordinate pair into an area.
 * Swap this for a real geocoding call without touching the engine.
 */
export function resolveLocation(raw: string): ResolvedLocation {
  const input = raw.trim();
  if (!input) return { label: "Paris", lat: 48.8566, lng: 2.3522, source: "area" };

  const isMapsLink = /https?:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(input);

  const coords = input.match(COORD_RE);
  if (coords) {
    const lat = Number(coords[1]);
    const lng = Number(coords[2]);
    return {
      label: nearestAreaLabel(lat, lng),
      lat,
      lng,
      source: isMapsLink ? "maps-link" : "coordinates",
    };
  }

  const haystack = decodeURIComponent(input).toLowerCase();
  const area = KNOWN_AREAS.find((a) => a.match.some((m) => haystack.includes(m)));
  if (area) {
    return { label: area.label, lat: area.lat, lng: area.lng, source: isMapsLink ? "maps-link" : "area" };
  }

  // Unknown address / link: keep the user's own wording, place it in Paris.
  const jitter = hash01(haystack);
  const pretty = titleCase(cleanLabel(input));
  return {
    label: pretty || "Paris",
    lat: 48.8566 + (jitter - 0.5) * 0.06,
    lng: 2.3522 + (hash01(haystack + "x") - 0.5) * 0.08,
    source: isMapsLink ? "maps-link" : "address",
  };
}

function nearestAreaLabel(lat: number, lng: number): string {
  let best = KNOWN_AREAS[0];
  let bestD = Infinity;
  for (const a of KNOWN_AREAS) {
    const d = (a.lat - lat) ** 2 + (a.lng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return bestD < 0.0009 ? best.label : `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}

function cleanLabel(input: string): string {
  if (/^https?:/i.test(input)) {
    const place = decodeURIComponent(input).match(/place\/([^/@?]+)/i);
    if (place) return place[1].replace(/\+/g, " ");
    return "Dropped pin";
  }
  return input.split(",")[0].slice(0, 40);
}

function titleCase(s: string): string {
  return s.replace(/\b[a-zà-ÿ]/g, (c) => c.toUpperCase());
}
