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

export type Venue = {
  id: string;
  name: string;
  /** Has an actual terrace / outdoor seating. */
  terrace: boolean;
  /** Approximate number of outdoor seats. */
  terraceSeats: number;
  /** How sheltered the terrace is from rain/wind, 0..1. */
  shelter: number;
  rating: number;
  reviewCount: number;
  /** Opening hours in decimal hours, local time. */
  opensAt: number;
  closesAt: number;
  /** Whether groups above 4 are usually accommodated. */
  acceptsGroups: boolean;
};

export type HourlyWeather = {
  hour: number;
  temperatureC: number;
  precipitationProbability: number; // 0..1
  precipitationMm: number;
  cloudCover: number; // 0..1
  windKph: number;
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

export type TerrasseResult = {
  probability: number; // 0..100
  verdict: string;
  /** Best 30-minute slot inside the window. */
  bestWindow: { from: number; to: number };
  weatherLine: string;
  venuesConsidered: number;
  venuesOpen: number;
  factors: Factor[];
  explanation: string;
};

export interface PlacesProvider {
  findTerraceVenues(location: ResolvedLocation): Promise<Venue[]>;
}

export interface WeatherProvider {
  getForecast(location: ResolvedLocation, date: Date): Promise<WeatherForecast>;
}

export type Observation = "yes" | "waited" | "no";

export interface ObservationStore {
  record(query: TerrasseQuery, predicted: number, outcome: Observation): Promise<void>;
}
