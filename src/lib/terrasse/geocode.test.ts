import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEARCH_RADIUS_M,
  fromSuggestion,
  parseCoordinates,
  resolveInput,
  resolveMapsUrl,
  searchPlaces,
} from "./geocode";

describe("location layer", () => {
  it("autocompletes 'Rivoli' and stores coordinates on selection", () => {
    const hits = searchPlaces("Rivoli");
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits.every((h) => h.primary.includes("Rivoli"))).toBe(true);
    const loc = fromSuggestion(hits[0]!);
    expect(loc.displayName).toMatch(/Rivoli/);
    expect(loc.latitude).toBeCloseTo(48.86, 1);
    expect(loc.longitude).toBeCloseTo(2.34, 1);
    expect(loc.radiusM).toBe(DEFAULT_SEARCH_RADIUS_M);
  });

  it("suggests areas and streets for the other mock places", () => {
    for (const q of ["Marais", "Saint-Germain", "Canal", "Montmartre", "Bastille", "Vosges", "Bretagne", "Oberkampf"]) {
      expect(searchPlaces(q).length, q).toBeGreaterThan(0);
    }
  });

  it("resolves a Google Maps URL with coordinates", async () => {
    const loc = await resolveMapsUrl(
      "https://www.google.com/maps/place/Rue+de+Rivoli/@48.8558,2.3568,17z",
    );
    expect(loc).not.toBeNull();
    expect(loc!.latitude).toBeCloseTo(48.8558, 4);
    expect(loc!.longitude).toBeCloseTo(2.3568, 4);
    expect(loc!.area).toBe("Le Marais");
  });

  it("resolves a Google Maps URL by place name", async () => {
    const loc = await resolveMapsUrl("https://maps.google.com/maps/place/Place+des+Vosges/");
    expect(loc?.displayName).toMatch(/Place des Vosges/);
  });

  it("accepts raw coordinates", async () => {
    expect(parseCoordinates("48.855, 2.357")).toEqual({ latitude: 48.855, longitude: 2.357 });
    expect(parseCoordinates("not coords")).toBeNull();
    const loc = await resolveInput("48.855, 2.357");
    expect(loc!.latitude).toBe(48.855);
    expect(loc!.longitude).toBe(2.357);
    expect(loc!.area).toBe("Le Marais");
  });

  it("falls back to the best match for a typed address", async () => {
    const loc = await resolveInput("15 Rue de Rivoli, Paris");
    expect(loc?.displayName).toMatch(/Rue de Rivoli/);
    expect(loc?.radiusM).toBe(500);
  });
});
