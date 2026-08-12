import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { CalendarIcon, ChevronDown, Clock } from "lucide-react";
import cafeDuo from "@/assets/cafe-duo.png.asset.json";
import titleArt from "@/assets/terrasse-title.png.asset.json";
import checkArt from "@/assets/check-button.png.asset.json";
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
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>

                <label className="pebble flex shrink-0 items-center gap-2 px-3 py-2 text-sm">
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
                <label className="pebble flex shrink-0 items-center gap-2 px-3 py-2 text-sm">
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
            className="h-auto w-full max-w-[22rem] max-h-[52vh] object-contain md:max-w-[24rem]"
          />
        </section>
      </div>
    </main>
  );
}
