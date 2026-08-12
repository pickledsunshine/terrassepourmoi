import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Google Places API (New) access. The API key lives only on the server
 * (TERASSE_GOOGLEMAPS); the browser talks to these server functions.
 */

export type GooglePlaceSuggestion = {
  id: string;
  primary: string;
  secondary: string;
};

export type GooglePlacePoint = {
  displayName: string;
  latitude: number;
  longitude: number;
};

const PLACES = "https://places.googleapis.com/v1";
const PARIS = { latitude: 48.8566, longitude: 2.3522 };

function apiKey(): string {
  const key = process.env["TERASSE_GOOGLEMAPS"];
  if (!key) throw new Error("Missing TERASSE_GOOGLEMAPS secret on the server.");
  return key;
}

async function callPlaces(path: string, init: RequestInit & { fieldMask?: string }) {
  const { fieldMask, ...rest } = init;
  const res = await fetch(`${PLACES}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
      ...(fieldMask ? { "X-Goog-FieldMask": fieldMask } : {}),
      ...(rest.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Places request failed [${res.status}]: ${body}`);
    throw new Error(`Google Places request failed [${res.status}]: ${body}`);
  }
  return res.json() as Promise<any>;
}

export const autocompletePlaces = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ input: z.string().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }): Promise<GooglePlaceSuggestion[]> => {
    const json = await callPlaces("/places:autocomplete", {
      method: "POST",
      body: JSON.stringify({
        input: data.input,
        includedRegionCodes: ["fr"],
        locationBias: { circle: { center: PARIS, radius: 20000 } },
      }),
    });
    const suggestions = (json.suggestions ?? []) as any[];
    return suggestions
      .filter((s) => s.placePrediction)
      .slice(0, 5)
      .map((s) => {
        const p = s.placePrediction;
        return {
          id: p.placeId as string,
          primary: (p.structuredFormat?.mainText?.text ?? p.text?.text ?? "") as string,
          secondary: (p.structuredFormat?.secondaryText?.text ?? "") as string,
        };
      });
  });

export const getPlaceDetails = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ placeId: z.string().min(1).max(500) }).parse(data))
  .handler(async ({ data }): Promise<GooglePlacePoint | null> => {
    const json = await callPlaces(`/places/${encodeURIComponent(data.placeId)}`, {
      method: "GET",
      fieldMask: "id,displayName,formattedAddress,location",
    });
    if (!json?.location) return null;
    return {
      displayName: json.displayName?.text
        ? `${json.displayName.text}${json.formattedAddress ? `, ${json.formattedAddress}` : ""}`
        : (json.formattedAddress ?? "Paris"),
      latitude: json.location.latitude,
      longitude: json.location.longitude,
    };
  });

async function textSearch(query: string): Promise<GooglePlacePoint | null> {
  const json = await callPlaces("/places:searchText", {
    method: "POST",
    fieldMask: "places.displayName,places.formattedAddress,places.location",
    body: JSON.stringify({
      textQuery: query,
      locationBias: { circle: { center: PARIS, radius: 20000 } },
      maxResultCount: 1,
    }),
  });
  const place = json.places?.[0];
  if (!place?.location) return null;
  return {
    displayName: place.displayName?.text
      ? `${place.displayName.text}${place.formattedAddress ? `, ${place.formattedAddress}` : ""}`
      : (place.formattedAddress ?? query),
    latitude: place.location.latitude,
    longitude: place.location.longitude,
  };
}

/** Free-text lookup used when the user hits Check without picking a suggestion. */
export const searchPlaceText = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ query: z.string().min(1).max(300) }).parse(data))
  .handler(async ({ data }) => textSearch(data.query));

/** Resolve a Google Maps link (including short links) to a point. */
export const resolveMapsLink = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ url: z.string().url().max(2048) }).parse(data))
  .handler(async ({ data }): Promise<GooglePlacePoint | null> => {
    let target = data.url;
    if (!/^https?:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(target)) {
      return null;
    }
    try {
      const res = await fetch(target, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
      if (res.url) target = res.url;
    } catch (err) {
      console.error("Failed to expand Maps link", err);
    }
    const decoded = decodeURIComponent(target);
    const at = decoded.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    const q = decoded.match(/[?&]q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    const bang = decoded.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    const hit = at ?? q ?? bang;
    if (hit) {
      const latitude = Number(hit[1]);
      const longitude = Number(hit[2]);
      const named = decoded.match(/\/place\/([^/@?]+)/);
      return {
        displayName: named
          ? decodeURIComponent(named[1]!.replace(/\+/g, " "))
          : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        latitude,
        longitude,
      };
    }
    const place = decoded.match(/\/place\/([^/@?]+)/);
    if (place) return textSearch(place[1]!.replace(/\+/g, " "));
    return null;
  });
