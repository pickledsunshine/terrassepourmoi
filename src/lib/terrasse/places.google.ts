import type { PlacesProvider, ResolvedLocation, Venue } from "./types";
import type { GooglePeriod, GoogleVenue, OutdoorSeatingFlag } from "./venues.functions";

/**
 * Adapter: real Google Places venues → the engine's Venue shape.
 *
 * Google provides no terrace capacity, no free-table count and no live
 * availability. Any number below that Google cannot supply is a clearly
 * labelled MODELLING ASSUMPTION, never presented as Google data.
 */

/**
 * Assumption, not Google data: typical shelter (awning/heaters) factor.
 * Used only to model weather comfort, never seat counts or availability.
 */
const ASSUMED_SHELTER = 0.35;

export type VenueSignals = {
  total: number;
  openDuringWindow: number;
  outdoorConfirmed: number;
  outdoorUnknown: number;
  outdoorNone: number;
  /** Venues fed to the engine: open in window AND confirmed outdoor seating. */
  usable: number;
  source: "google" | "mock-fallback";
};

function openDuring(periods: GooglePeriod[] | null, weekday: number, from: number, to: number) {
  if (!periods) return null; // unknown hours
  const yesterday = (weekday + 6) % 7;
  return periods.some((p) => {
    if (p.day === weekday) return p.open <= to - 0.25 && p.close >= from + 0.25;
    // A period starting yesterday can spill past midnight into today.
    if (p.day === yesterday && p.close > 24) return p.close - 24 >= from + 0.25 && from < p.close - 24;
    return false;
  });
}

/** Opening window for the engine, in decimal hours; 99 means "not open". */
function hoursFor(periods: GooglePeriod[] | null, weekday: number): { opensAt: number; closesAt: number } {
  if (!periods) return { opensAt: 0, closesAt: 24 }; // unknown → do not exclude on hours alone
  const today = periods.filter((p) => p.day === weekday);
  if (today.length === 0) return { opensAt: 99, closesAt: 99 }; // closed this weekday
  return {
    opensAt: Math.min(...today.map((p) => p.open)),
    closesAt: Math.max(...today.map((p) => p.close)),
  };
}

export function toEngineVenue(v: GoogleVenue, weekday: number): Venue {
  const { opensAt, closesAt } = hoursFor(v.periods, weekday);
  return {
    id: v.id,
    name: v.name,
    // Unknown is never treated as yes, and never as no.
    outdoor: v.outdoorSeating,
    // Google publishes no terrace capacity; the engine never uses seat counts.
    estimatedTerraceSeats: null,
    shelter: ASSUMED_SHELTER,
    rating: v.rating ?? 4,
    reviewCount: v.reviewCount ?? 0,
    opensAt,
    closesAt,
    acceptsGroups: true,
  };
}

/** Counts for inspection/debugging — never rendered in the production UI. */
export function summarise(
  venues: GoogleVenue[],
  weekday: number,
  from: number,
  to: number,
  source: VenueSignals["source"] = "google",
): VenueSignals {
  const open = venues.filter((v) => openDuring(v.periods, weekday, from, to) !== false);
  return {
    total: venues.length,
    openDuringWindow: open.length,
    outdoorConfirmed: venues.filter((v) => v.outdoorSeating === "yes").length,
    outdoorUnknown: venues.filter((v) => v.outdoorSeating === "unknown").length,
    outdoorNone: venues.filter((v) => v.outdoorSeating === "no").length,
    usable: open.filter((v) => v.outdoorSeating === "yes").length,
    source,
  };
}

/** A provider backed by already-fetched real Google venues. */
export function googlePlacesProvider(venues: GoogleVenue[]): PlacesProvider {
  return {
    source: "google",
    async findTerraceVenues(_location: ResolvedLocation, date?: Date): Promise<Venue[]> {
      const weekday = (date ?? new Date()).getDay();
      return venues.map((v) => toEngineVenue(v, weekday));
    },
  };
}
