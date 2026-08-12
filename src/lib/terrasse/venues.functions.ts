import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Nearby venue discovery via Google Places API (New) — Nearby Search.
 *
 * Google does NOT expose live table availability, terrace capacity or free
 * seats. Anything Google does not return is reported as null/"unknown" here;
 * the adapter layer is responsible for any modelling assumptions.
 */

export type OutdoorSeatingFlag = "yes" | "no" | "unknown";

export type GooglePeriod = {
  /** 0 = Sunday. */
  day: number;
  /** Decimal local hours; close may exceed 24 for after-midnight closing. */
  open: number;
  close: number;
};

export type GoogleVenue = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  primaryType: string | null;
  types: string[];
  /** Regular weekly opening periods, or null when Google has none. */
  periods: GooglePeriod[] | null;
  outdoorSeating: OutdoorSeatingFlag;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: string | null;
  businessStatus: string | null;
};

const PLACES = "https://places.googleapis.com/v1";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.primaryType",
  "places.types",
  "places.regularOpeningHours",
  "places.outdoorSeating",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.businessStatus",
].join(",");

const INCLUDED_TYPES = ["restaurant", "cafe", "bar", "coffee_shop", "wine_bar", "bistro"];

function apiKey(): string {
  const key = process.env["TERASSE_GOOGLEMAPS"];
  if (!key) throw new Error("Missing TERASSE_GOOGLEMAPS secret on the server.");
  return key;
}

function toDecimal(point: { hour?: number; minute?: number } | undefined): number | null {
  if (!point || typeof point.hour !== "number") return null;
  return point.hour + (point.minute ?? 0) / 60;
}

function mapPeriods(raw: any): GooglePeriod[] | null {
  const periods = raw?.periods as any[] | undefined;
  if (!Array.isArray(periods) || periods.length === 0) return null;
  const out: GooglePeriod[] = [];
  for (const p of periods) {
    const open = toDecimal(p?.open);
    if (open === null || typeof p?.open?.day !== "number") continue;
    let close = toDecimal(p?.close);
    if (close === null) close = 24; // open-ended (24h) period
    // Closing after midnight is reported on the next day.
    if (typeof p?.close?.day === "number" && p.close.day !== p.open.day) close += 24;
    else if (close <= open) close += 24;
    out.push({ day: p.open.day, open, close });
  }
  return out.length ? out : null;
}

function outdoorFlag(value: unknown): OutdoorSeatingFlag {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "unknown";
}

export const nearbyVenues = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        latitude: z.number(),
        longitude: z.number(),
        radiusM: z.number().min(50).max(5000).default(500),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<GoogleVenue[]> => {
    const res = await fetch(`${PLACES}/places:searchNearby`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey(),
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        includedTypes: INCLUDED_TYPES,
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: data.latitude, longitude: data.longitude },
            radius: data.radiusM,
          },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Nearby search failed [${res.status}]: ${body}`);
      throw new Error(`Google Places nearby search failed [${res.status}]`);
    }

    const json = (await res.json()) as { places?: any[] };
    const places = json.places ?? [];

    return places
      .filter((p) => p?.id && p?.location)
      .map((p): GoogleVenue => ({
        id: p.id,
        name: p.displayName?.text ?? "Unnamed venue",
        latitude: p.location.latitude,
        longitude: p.location.longitude,
        primaryType: p.primaryType ?? null,
        types: Array.isArray(p.types) ? p.types : [],
        periods: mapPeriods(p.regularOpeningHours),
        outdoorSeating: outdoorFlag(p.outdoorSeating),
        rating: typeof p.rating === "number" ? p.rating : null,
        reviewCount: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
        priceLevel: p.priceLevel ?? null,
        businessStatus: p.businessStatus ?? null,
      }));
  });
