import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { CalendarIcon, ChevronDown, Clock, MapPin } from "lucide-react";
import cafeDuo from "@/assets/cafe-duo.png.asset.json";
import titleArt from "@/assets/terrasse-title.png.asset.json";
import checkArt from "@/assets/check-button.png.asset.json";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatHour, parseHour } from "@/lib/terrasse/engine";
import {
  fromCoordinates,
  isMapsUrl,
  parseCoordinates,
  type SelectedLocation,
} from "@/lib/terrasse/geocode";
import {
  autocompletePlaces,
  getPlaceDetails,
  resolveMapsLink,
  searchPlaceText,
  type GooglePlacePoint,
  type GooglePlaceSuggestion,
} from "@/lib/terrasse/places.functions";
import { fetchForecast, type WeatherErrorKind } from "@/lib/terrasse/weather.functions";
import { forecastRange, fromIsoDay, zonedToday } from "@/lib/terrasse/weather.range";
import { nearbyVenues } from "@/lib/terrasse/venues.functions";
import { refreshTerrasse, type RefreshOutcome } from "@/lib/terrasse/refresh";
import type { TerrasseResult } from "@/lib/terrasse/types";


/** One line of copy per failure mode, so the cause is never guessed at. */
const WEATHER_MESSAGE: Record<WeatherErrorKind | "incomplete", string> = {
  "out-of-range": "No forecast that far out — pick a date inside the highlighted range.",
  network: "Could not reach the weather service — check your connection and try again.",
  upstream: "The weather service is having trouble right now — try again in a moment.",
  malformed: "The weather service sent something we could not read — try again in a moment.",
  incomplete: "The forecast has gaps for those hours — try a different time window.",
};


/** Google point → the app's normalized location shape. */
function toSelected(point: GooglePlacePoint): SelectedLocation {
  const base = fromCoordinates(point.latitude, point.longitude);
  return { ...base, displayName: point.displayName };
}


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Terrasse? — Odds of a terrace seat in Paris" },
      {
        name: "description",
        content:
          "Enter an area, a date, a time window and a party size. Terrasse? estimates your chance of finding terrace seating.",
      },
      { property: "og:title", content: "Terrasse? — Odds of a terrace seat in Paris" },
      {
        property: "og:description",
        content: "A tiny Paris utility for the odds of a terrace seat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const [place, setPlace] = useState("");
  const [selected, setSelected] = useState<SelectedLocation | null>(null);
  const [suggestions, setSuggestions] = useState<GooglePlaceSuggestion[]>([]);
  const [openList, setOpenList] = useState(false);
  const [date, setDate] = useState<Date>(() => new Date());
  const [from, setFrom] = useState("18:30");
  const [to, setTo] = useState("20:00");
  const [party, setParty] = useState(2);
  const [result, setResult] = useState<(TerrasseResult & { area: string }) | null>(null);
  const [pending, setPending] = useState(false);
  // The forecast itself lives in the refresh cache, not in component state.
  const [weatherState, setWeatherState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [weatherError, setWeatherError] = useState<WeatherErrorKind | "incomplete" | null>(null);
  // Venue timezone, learned from the forecast; anchors "today" and the range.
  const [timeZone, setTimeZone] = useState<string | undefined>(undefined);
  // Authoritative window, replaced by the provider's own if it disagrees.
  const [range, setRange] = useState(() => forecastRange(zonedToday()));
  const placeBox = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupSeq = useRef(0);
  // Monotonic refresh id: only the newest refresh may write to state.
  const refreshSeq = useRef(0);


  const dayLabel = useMemo(() => format(date, "EEEE"), [date]);

  // Re-anchor the selectable range on the venue's own calendar day.
  useEffect(() => {
    setRange(forecastRange(zonedToday(timeZone)));
  }, [timeZone]);

  /**
   * The one refresh trigger the UI owns today. Everything (cache lookup,
   * request de-duplication, error mapping, scoring) happens inside
   * refreshTerrasse; this only reflects the outcome in state.
   */
  async function runRefresh(
    loc: SelectedLocation,
    day: Date,
    mode: "weather" | "full",
    force = false,
  ): Promise<RefreshOutcome> {
    const seq = ++refreshSeq.current;
    setWeatherState("loading");
    setWeatherError(null);
    const outcome = await refreshTerrasse(
      {
        location: loc,
        date: day,
        from: parseHour(from),
        to: parseHour(to),
        party,
        mode,
        force,
      },
      { fetchForecast, nearbyVenues, timeZone },
    );
    // A newer refresh landed while this one was in flight: discard it.
    if (seq !== refreshSeq.current) return outcome;
    applyOutcome(outcome, loc);
    return outcome;
  }

  /**
   * Reflects a refresh outcome in state. `preserveResult` keeps a previously
   * valid result on screen when a refresh fails (used by Now).
   */
  function applyOutcome(
    outcome: RefreshOutcome,
    loc: SelectedLocation,
    preserveResult = false,
  ) {
    if (outcome.status === "weather-error") {
      console.error(`[terrasse] weather ${outcome.kind}: ${outcome.message ?? ""}`);
      if (outcome.kind === "out-of-range" && outcome.range) {
        setRange({ min: fromIsoDay(outcome.range.min), max: fromIsoDay(outcome.range.max) });
      }
      setWeatherState("error");
      setWeatherError(outcome.kind);
      if (!preserveResult) setResult(null);
      return;
    }
    if (outcome.status === "incomplete") {
      setWeatherState("error");
      setWeatherError("incomplete");
      if (!preserveResult) setResult(null);
      return;
    }

    setTimeZone(outcome.timeZone);
    setWeatherState("ready");
    // Freshness always comes from the provider timestamp, never the click.
    setFetchedAt(outcome.fetchedAt);
    if (outcome.result) {
      // Inspection only: never rendered in the production UI.
      console.debug("[terrasse] venue signals", outcome.signals);
      setResult({ ...outcome.result, area: loc.displayName });
    }
  }

  /** Forced refresh: same pipeline, cache bypassed, single-flight. */
  async function onNow() {
    const loc = selected;
    if (!loc || nowPending) return;
    setNowPending(true);
    const seq = ++refreshSeq.current;
    try {
      const outcome = await nowRefresher.current.run(
        {
          location: loc,
          date,
          from: parseHour(from),
          to: parseHour(to),
          party,
          mode: result ? "full" : "weather",
        },
        { fetchForecast, nearbyVenues, timeZone },
      );
      if (outcome === BUSY) return;
      if (seq !== refreshSeq.current) return;
      applyOutcome(outcome, loc, true);
    } catch (err) {
      console.error(err);
    } finally {
      setNowPending(false);
    }
  }

  // Warm the forecast when the location or the day changes.
  // The time window is not a dependency — one request covers the whole day.
  useEffect(() => {
    if (!selected) {
      setWeatherState("idle");
      setWeatherError(null);
      return;
    }
    void runRefresh(selected, date, "weather");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, date]);



  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (placeBox.current && !placeBox.current.contains(e.target as Node)) setOpenList(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function onPlaceChange(value: string) {
    setPlace(value);
    setSelected(null);
    const query = value.trim();
    if (debounce.current) clearTimeout(debounce.current);
    if (query.length < 2 || parseCoordinates(query) || isMapsUrl(query)) {
      setSuggestions([]);
      setOpenList(false);
      return;
    }
    const seq = ++lookupSeq.current;
    debounce.current = setTimeout(async () => {
      try {
        const next = await autocompletePlaces({ data: { input: query } });
        if (seq !== lookupSeq.current) return;
        setSuggestions(next);
        setOpenList(next.length > 0);
      } catch (err) {
        console.error(err);
      }
    }, 220);
  }

  async function pickSuggestion(s: GooglePlaceSuggestion) {
    setPlace(`${s.primary}${s.secondary ? `, ${s.secondary}` : ""}`);
    setOpenList(false);
    setSuggestions([]);
    try {
      const point = await getPlaceDetails({ data: { placeId: s.id } });
      if (point) {
        const loc = toSelected(point);
        setSelected(loc);
        setPlace(loc.displayName);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function resolveTyped(raw: string): Promise<SelectedLocation | null> {
    const input = raw.trim();
    if (!input) return null;
    const coords = parseCoordinates(input);
    if (coords) return fromCoordinates(coords.latitude, coords.longitude);
    const point = isMapsUrl(input)
      ? await resolveMapsLink({ data: { url: input } })
      : await searchPlaceText({ data: { query: input } });
    return point ? toSelected(point) : null;
  }

  async function onCheck(e: React.FormEvent) {
    e.preventDefault();
    // A check already running: ignore the extra submit rather than racing it.
    if (pending) return;
    setPending(true);
    setOpenList(false);
    try {
      const loc = selected ?? (await resolveTyped(place));
      if (!loc) {
        setResult(null);
        return;
      }
      setSelected(loc);
      // Single refresh path; the cache decides whether anything is refetched.
      await runRefresh(loc, date, "full");
    } catch (err) {
      console.error(err);
    } finally {
      setPending(false);
    }
  }


  return (
    <main className="min-h-screen w-full overflow-hidden bg-background">
      <div className="mx-auto grid min-h-screen w-full max-w-[1536px] grid-cols-1 items-center gap-8 px-6 py-4 md:grid-cols-[50fr_50fr] md:gap-10 md:px-12 lg:px-16">
        {/* ————— left: title artwork + tool ————— */}
        <section className="order-2 w-full max-w-[28rem] md:order-1 md:self-center">
          <h1 className="mb-4 -ml-1">
            <img
              src={titleArt.url}
              alt="Terrasse?"
              width={650}
              height={255}
              className="w-full max-w-[15rem]"
            />
          </h1>

          <form className="space-y-4" onSubmit={onCheck}>
            <div className="relative" ref={placeBox}>
              <label className="field-caption" htmlFor="place">
                Where?
              </label>
              <input
                id="place"
                value={place}
                onChange={(e) => onPlaceChange(e.target.value)}
                onFocus={() => setOpenList(suggestions.length > 0)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpenList(false);
                  if (e.key === "Enter" && openList && suggestions[0]) {
                    e.preventDefault();
                    pickSuggestion(suggestions[0]);
                  }
                }}
                autoComplete="off"
                role="combobox"
                aria-expanded={openList}
                aria-autocomplete="list"
                placeholder="Maps link, address, neighbourhood or coordinates"
                className="field-line mt-1 w-full"
              />
              {openList && suggestions.length > 0 && (
                <ul
                  role="listbox"
                  className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border bg-background shadow-sm"
                >
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected="false"
                        onClick={() => pickSuggestion(s)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0 opacity-60" />
                        <span>{s.primary}</span>
                        <span className="text-muted-foreground">{s.secondary}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <span className="field-caption">When?</span>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                  <button type="button" className="pebble flex shrink-0 items-center gap-2 px-3 py-2 text-sm">
                      <CalendarIcon className="h-4 w-4 opacity-70" />
                      {format(date, "MMM d, yyyy")}
                      <ChevronDown className="h-4 w-4 opacity-70" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => d && setDate(d)}
                      defaultMonth={date}
                      // The provider only serves this window; anything else is unfetchable.
                      disabled={{ before: range.min, after: range.max }}
                      startMonth={range.min}
                      endMonth={range.max}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />

                  </PopoverContent>
                </Popover>

                <div className="flex shrink-0 items-center gap-3">
                  <label className="pebble flex items-center gap-2 px-3 py-2 text-sm">
                    <input
                      type="time"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      aria-label="Start time"
                      className="bg-transparent text-sm outline-none [&::-webkit-calendar-picker-indicator]:hidden"
                    />
                    <Clock className="h-4 w-4 opacity-70" />
                  </label>
                  <span className="text-muted-foreground">—</span>
                  <label className="pebble flex items-center gap-2 px-3 py-2 text-sm">
                    <input
                      type="time"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      aria-label="End time"
                      className="bg-transparent text-sm outline-none [&::-webkit-calendar-picker-indicator]:hidden"
                    />
                    <Clock className="h-4 w-4 opacity-70" />
                  </label>
                </div>
              </div>
            </div>

            <div>
              <span className="field-caption">For how many?</span>
              <div className="mt-1 flex items-center gap-4">
                <button
                  type="button"
                  aria-label="Fewer people"
                  className="btn-outline-ink h-10 w-10 rounded-full p-0 text-lg leading-none"
                  onClick={() => setParty((n) => Math.max(1, n - 1))}
                >
                  −
                </button>
                <span className="w-8 text-center text-3xl leading-none">{party}</span>
                <button
                  type="button"
                  aria-label="More people"
                  className="btn-outline-ink h-10 w-10 rounded-full p-0 text-lg leading-none"
                  onClick={() => setParty((n) => Math.min(12, n + 1))}
                >
                  +
                </button>
              </div>
            </div>

            {/* visible layer = exact Check artwork, functional layer = transparent button */}
            <div className="relative w-full select-none">
              <img
                src={checkArt.url}
                alt=""
                aria-hidden="true"
                width={620}
                height={95}
                className="pointer-events-none w-full"
              />
              <button
                type="submit"
                disabled={pending}
                aria-label="Check"
                className="absolute inset-0 h-full w-full cursor-pointer rounded-full bg-transparent opacity-0"
              >
                Check
              </button>
            </div>
          </form>

          <div className="mt-3 border-t border-border pt-3">
            {pending && !result && <p className="body-note">Checking the sky…</p>}
            {weatherState === "error" && !pending && (
              <p className="body-note">
                {WEATHER_MESSAGE[weatherError ?? "upstream"]}
              </p>
            )}

            {result && (
              <>
                <p className="odds-figure text-5xl leading-none">{result.probability}%</p>
                <p className="engraved mt-1">{result.verdict}</p>
                <p className="body-note mt-1">
                  {result.area} · {party} {party === 1 ? "person" : "people"} · {from}–{to}
                </p>
                <p className="body-note">{result.weatherLine} · {dayLabel}</p>
                <p className="body-note">
                  Best window: {formatHour(result.bestWindow.from)}–{formatHour(result.bestWindow.to)}
                </p>
                <p className="body-note">
                  {result.supply.openDuringWindow} open nearby ·{" "}
                  {result.supply.outdoorConfirmed} confirmed terraces
                  {result.supply.outdoorUnknown > 0
                    ? ` · ${result.supply.outdoorUnknown} unknown`
                    : ""}{" "}
                  · conditions, not tables
                </p>
              </>
            )}
          </div>
        </section>

        {/* ————— right: the exact artwork ————— */}
        <section className="order-1 flex items-center justify-center md:order-2 md:self-center">
          <img
            src={cafeDuo.url}
            alt="Hand-drawn indigo ink sketch of two people at a small café table with wine glasses"
            width={716}
            height={780}
            className="h-auto w-full max-w-[20rem] max-h-[48vh] object-contain md:max-w-[24rem]"
          />
        </section>
      </div>
    </main>
  );
}
