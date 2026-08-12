import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import cafeDuo from "@/assets/cafe-duo.png.asset.json";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { estimateTerrasse, formatHour, parseHour } from "@/lib/terrasse/engine";
import { resolveLocation } from "@/lib/terrasse/location";
import type { TerrasseResult } from "@/lib/terrasse/types";

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
  const [date, setDate] = useState<Date>(() => new Date());
  const [from, setFrom] = useState("18:30");
  const [to, setTo] = useState("20:00");
  const [party, setParty] = useState(2);
  const [result, setResult] = useState<(TerrasseResult & { area: string }) | null>(null);
  const [pending, setPending] = useState(false);

  const dayLabel = useMemo(() => format(date, "EEEE"), [date]);

  async function onCheck(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const location = resolveLocation(place);
    const res = await estimateTerrasse({
      location,
      date,
      from: parseHour(from),
      to: parseHour(to),
      party,
    });
    setResult({ ...res, area: location.label });
    setPending(false);
  }

  return (
    <main className="min-h-screen bg-background px-6 py-8 lg:px-16 lg:py-10">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* ————— left: the tool ————— */}
        <section className="order-2 w-full max-w-md lg:order-1">
          <h1 className="script-xl leading-none">Terrasse?</h1>

          <form className="mt-6 space-y-6" onSubmit={onCheck}>
            <div>
              <label className="field-caption" htmlFor="place">
                Where?
              </label>
              <input
                id="place"
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                placeholder="Maps link, address, neighbourhood or coordinates"
                className="field-line mt-1 w-full"
              />
            </div>

            <div>
              <span className="field-caption">When?</span>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="pebble flex items-center gap-2 px-4 py-2.5">
                      <CalendarIcon className="h-4 w-4 opacity-70" />
                      {format(date, "MMM d, yyyy")}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => d && setDate(d)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>

                <input
                  type="time"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  aria-label="Start time"
                  className="pebble px-4 py-2.5 text-center"
                />
                <span className="text-muted-foreground">—</span>
                <input
                  type="time"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  aria-label="End time"
                  className="pebble px-4 py-2.5 text-center"
                />
              </div>
            </div>

            <div>
              <span className="field-caption">For how many?</span>
              <div className="mt-1 flex items-center gap-4">
                <button
                  type="button"
                  aria-label="Fewer people"
                  className="btn-outline-ink h-9 w-9 rounded-full p-0 leading-none"
                  onClick={() => setParty((n) => Math.max(1, n - 1))}
                >
                  −
                </button>
                <span className="script-md w-8 text-center text-3xl leading-none">{party}</span>
                <button
                  type="button"
                  aria-label="More people"
                  className="btn-outline-ink h-9 w-9 rounded-full p-0 leading-none"
                  onClick={() => setParty((n) => Math.min(12, n + 1))}
                >
                  +
                </button>
              </div>
            </div>

            <button type="submit" className="btn-check w-full" disabled={pending}>
              {pending ? "Checking…" : "Check"}
            </button>
          </form>

          {result && (
            <div className="mt-6 border-t border-border pt-5">
              <p className="odds-figure text-6xl leading-none">{result.probability}%</p>
              <p className="engraved mt-1">{result.verdict}</p>
              <p className="body-note mt-2">
                {result.area} · {result.party ?? party} {party === 1 ? "person" : "people"} · {from}–{to}
              </p>
              <p className="body-note">
                {result.weatherLine} · {dayLabel}
              </p>
              <p className="body-note">
                Best window: {formatHour(result.bestWindow.from)}–{formatHour(result.bestWindow.to)} ·{" "}
                {result.venuesOpen} of {result.venuesConsidered} terraces open
              </p>
              <p className="body-note mt-1 italic">{result.explanation}</p>
              <p className="engraved-soft mt-3">Estimate from terrace supply, weather and crowd patterns</p>
            </div>
          )}
        </section>

        {/* ————— right: the drawing ————— */}
        <section className="order-1 lg:order-2">
          <img
            src={cafeDuo.url}
            alt="Hand-drawn indigo ink sketch of two people at a small café table with wine glasses"
            width={1024}
            height={1024}
            className="mx-auto w-full max-w-[34rem] mix-blend-multiply"
          />
        </section>
      </div>
    </main>
  );
}
