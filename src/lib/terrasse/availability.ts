import type { TerrasseQuery } from "./types";

/**
 * TABLE AVAILABILITY — deliberately NOT implemented.
 *
 * Terrace suitability ("is this a good terrace moment?") is live today.
 * Table availability ("can I actually get a table?") requires a reservation /
 * inventory partner (TheFork, SevenRooms, Zenchef, a venue's own API…).
 * No such provider is connected, so nothing here simulates one.
 */

export type TableAvailability = {
  venueId: string;
  /** Free tables for the party during the window, as reported by a provider. */
  tablesFree: number;
  /** Earliest bookable slot inside the window, decimal hours. */
  earliestSlot: number | null;
  provider: string;
  checkedAt: string;
};

export interface AvailabilityProvider {
  readonly name: string;
  /** Returns [] when the provider covers none of the nearby venues. */
  checkTables(query: TerrasseQuery, venueIds: string[]): Promise<TableAvailability[]>;
}

/**
 * The only provider wired today: it knows nothing, and says so.
 * Swap it for a real integration; the engine result keeps
 * `tableAvailability: null` until one exists.
 */
export const noAvailabilityProvider: AvailabilityProvider = {
  name: "none",
  async checkTables() {
    return [];
  },
};
