/**
 * Shared domain types for Terrasse?.
 *
 * The providers below are intentionally interface-first: today they are backed
 * by deterministic mock data, later by Google Places, a weather API
 * (Meteo-France / Open-Meteo) and a database of user observations.
 */

export type ResolvedLocation = {
  /** Human label shown in the result line, e.g. "Le Marais". */
  label: string;
  lat: number;
  lng: number;
  /** How the raw input was interpreted. */
  source: "maps-link" | "coordinates" | "address" | "area";
};

/**
 * Outdoor seating as reported by the data source.
 * "unknown" is a first-class value: it is never silently promoted to "yes"
 * nor demoted to "no".
 */
export type OutdoorSeating = "yes" | "no" | "unknown";

export type Venue = {
  id: string;
  name: string;
  /** Confirmed by the data source, denied, or simply not published. */
  outdoor: OutdoorSeating;
  /** How sheltered the terrace is from rain/wind, 0..1 (modelled, not data). */
  shelter: number;
  rating: number;
  reviewCount: number;
  /** Opening hours in decimal hours, local time. */
  opensAt: number;
  closesAt: number;
  /** Whether groups above 4 are usually accommodated. */
  acceptsGroups: boolean;
  /**
   * Mock-dataset only, and NEVER used by the probability model.
   * No real source publishes terrace capacity.
   */
  estimatedTerraceSeats?: number | null;
};


export type HourlyWeather = {
  hour: number;
  temperatureC: number;
  precipitationProbability: number; // 0..1
  precipitationMm: number;
  cloudCover: number; // 0..1
  windKph: number;
  /** Optional richer fields supplied by the real forecast provider. */
  apparentTemperatureC?: number | undefined;
  rainMm?: number | undefined;
  windGustKph?: number | undefined;
  weatherCode?: number | undefined;
};

export type WeatherForecast = {
  hourly: HourlyWeather[];
  summary: string;
};

export type TerrasseQuery = {
  location: ResolvedLocation;
  date: Date;
  /** Decimal hours, e.g. 18.5 for 18:30. */
  from: number;
  to: number;
  party: number;
};

export type Factor = {
  label: string;
  /** Positive helps, negative hurts. Roughly -1..1. */
  impact: number;
};

/** Where the venue list came from. Mock is a fallback, never real data. */
export type VenueSource = "google" | "mock-fallback";

/** Factual, countable supply signals — no invented capacity or inventory. */
export type VenueSupply = {
  /** Venues returned by the source near the location. */
  considered: number;
  /** Of those, open during the selected window (unknown hours count as open). */
  openDuringWindow: number;
  /** Open AND the source explicitly confirms outdoor seating. */
  outdoorConfirmed: number;
  /** Open, but the source publishes nothing about outdoor seating. */
  outdoorUnknown: number;
  /** Open, and the source explicitly says there is no outdoor seating. */
  outdoorNone: number;
  source: VenueSource;
};

export type TerrasseResult = {
  /**
   * TERRACE SUITABILITY, 0..100 — how favourable conditions are for finding
   * and enjoying an open terrace nearby during this window.
   * This is NOT a probability of getting a table.
   */
  probability: number;
  verdict: string;
  /** Best 30-minute slot inside the window. */
  bestWindow: { from: number; to: number };
  weatherLine: string;
  venuesConsidered: number;
  venuesOpen: number;
  supply: VenueSupply;
  /** No provider gives live table inventory today; always null for now. */
  tableAvailability: null;
  factors: Factor[];
  explanation: string;
};

export interface PlacesProvider {
  /** `date` lets a provider honour weekday-specific opening hours. */
  findTerraceVenues(location: ResolvedLocation, date?: Date): Promise<Venue[]>;
  /** Real data or fallback. Absent means mock fallback. */
  readonly source?: VenueSource;
}

export interface WeatherProvider {
  getForecast(location: ResolvedLocation, date: Date): Promise<WeatherForecast>;
}


export type Observation = "yes" | "waited" | "no";

export interface ObservationStore {
  record(query: TerrasseQuery, predicted: number, outcome: Observation): Promise<void>;
}
