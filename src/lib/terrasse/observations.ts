import type { Observation, ObservationStore, TerrasseQuery } from "./types";

/**
 * Placeholder store for "Did you actually get a terrace?" answers.
 * Later backed by a database so observations can calibrate the model.
 */
export const memoryObservations: ObservationStore = {
  async record(query: TerrasseQuery, predicted: number, outcome: Observation) {
    if (typeof console !== "undefined") {
      console.info("[terrasse] observation", { area: query.location.label, predicted, outcome });
    }
  },
};
