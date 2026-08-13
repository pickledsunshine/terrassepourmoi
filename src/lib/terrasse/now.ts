/**
 * The "Now" action: a forced refresh on top of the single refresh path.
 *
 * It owns exactly two concerns that the orchestrator deliberately does not:
 *  - a single-flight guard, so repeated clicks cannot stack requests;
 *  - the wording of the freshness line, derived from the `fetchedAt` the
 *    refresh result carries (never from the moment the button was clicked).
 *
 * No weather is fetched here: `run()` delegates to `refreshTerrasse`.
 */

import { refreshTerrasse, type RefreshDeps, type RefreshInput, type RefreshOutcome } from "./refresh";

export type RefreshFn = (input: RefreshInput, deps: RefreshDeps) => Promise<RefreshOutcome>;

/** Returned when a click arrives while a forced refresh is still in flight. */
export const BUSY = "busy" as const;

export class NowRefresher {
  private inflight: Promise<RefreshOutcome> | null = null;

  constructor(private readonly refresh: RefreshFn = refreshTerrasse) {}

  get isPending(): boolean {
    return this.inflight !== null;
  }

  /**
   * Always forces: "Now" means the sky as it is, not as it was cached.
   * Returns BUSY instead of queueing when a run is already pending.
   */
  async run(
    input: Omit<RefreshInput, "force">,
    deps: RefreshDeps,
  ): Promise<RefreshOutcome | typeof BUSY> {
    if (this.inflight) return BUSY;
    const promise = this.refresh({ ...input, force: true }, deps).finally(() => {
      this.inflight = null;
    });
    this.inflight = promise;
    return promise;
  }
}

/** Human freshness for a provider timestamp, relative to `now`. */
export function formatFreshness(fetchedAt: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - fetchedAt) / 1000));
  if (seconds < 60) return "Updated just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `Updated ${hours} h ago`;
}
