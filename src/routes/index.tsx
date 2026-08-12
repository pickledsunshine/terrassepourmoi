import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import wineSketch from "@/assets/wine-sketch.png.asset.json";
import { estimate, type Estimate } from "@/lib/terrasse-estimate";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Terrasse? — Your odds of a terrace seat" },
      {
        name: "description",
        content:
          "Enter a place, a time window and a party size. Terrasse? estimates your chance of finding a terrace seat.",
      },
      { property: "og:title", content: "Terrasse? — Your odds of a terrace seat" },
      {
        property: "og:description",
        content: "A tiny Paris tool for the odds of a terrace seat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const [place, setPlace] = useState("");
  const [from, setFrom] = useState("18:30");
  const [to, setTo] = useState("20:00");
  const [party, setParty] = useState(2);
  const [result, setResult] = useState<Estimate | null>(null);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-md">
        <h1 className="script-xl text-center leading-none">Terrasse?</h1>

        <img
          src={wineSketch.url}
          alt="Hand-drawn sketch of a wine bottle and two glasses"
          className="mx-auto mt-2 h-28 w-auto opacity-85 mix-blend-multiply"
        />

        <form
          className="mt-8 space-y-7"
          onSubmit={(e) => {
            e.preventDefault();
            setResult(estimate({ place: place || "Paris", from, to, party }));
          }}
        >
          <div>
            <label className="field-caption" htmlFor="place">
              Where?
            </label>
            <input
              id="place"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="Maps link, address, neighbourhood or coordinates"
              className="field-line mt-2 w-full"
            />
          </div>

          <div>
            <span className="field-caption">When?</span>
            <div className="mt-2 flex items-center gap-4">
              <span className="pebble">Today</span>
              <input
                type="time"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="From"
                className="field-line w-24 text-center"
              />
              <span className="text-muted-foreground">—</span>
              <input
                type="time"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                aria-label="To"
                className="field-line w-24 text-center"
              />
            </div>
          </div>

          <div>
            <span className="field-caption">For how many?</span>
            <div className="mt-2 flex items-center gap-5">
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

          <button type="submit" className="btn-ink w-full">
            Check
          </button>
        </form>

        {result && (
          <div className="mt-8 border-t border-border pt-6 text-center">
            <p className="odds-figure text-5xl leading-none">{result.probability}%</p>
            <p className="engraved mt-2">{result.verdict}</p>
            <p className="body-note mt-1 text-muted-foreground">{result.note}</p>
          </div>
        )}
      </div>
    </main>
  );
}
