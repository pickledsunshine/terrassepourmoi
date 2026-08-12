import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AREAS, predict } from "@/lib/terrasse-engine";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Terrasse? — Will you get a terrace seat?" },
      {
        name: "description",
        content:
          "Pick an area, date, time window and party size. Terrasse? estimates your odds of finding a terrace seat.",
      },
      { property: "og:title", content: "Terrasse? — Will you get a terrace seat?" },
      {
        property: "og:description",
        content: "Odds of scoring a terrace seat, based on weather, crowds and terrace supply.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const fmtHour = (h: number) => `${String(h).padStart(2, "0")}:00`;

function Index() {
  const today = new Date().toISOString().slice(0, 10);
  const [areaId, setAreaId] = useState(AREAS[0]!.id);
  const [dateISO, setDateISO] = useState(today);
  const [startHour, setStartHour] = useState(19);
  const [endHour, setEndHour] = useState(21);
  const [party, setParty] = useState(2);

  const result = useMemo(
    () => predict({ areaId, dateISO, startHour, endHour, party }),
    [areaId, dateISO, startHour, endHour, party],
  );

  const pct = Math.round(result.probability * 100);
  const mood = pct > 70 ? "sunny" : pct > 45 ? "mild" : "grey";

  return (
    <main className="min-h-screen bg-background px-5 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <header className="text-center">
          <h1 className="font-display text-5xl tracking-tight text-foreground">Terrasse?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your odds of landing a seat in the sun.
          </p>
        </header>

        <section className="card-soft mt-8 space-y-5 p-5">
          <label className="block">
            <span className="field-label">where</span>
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className="field"
            >
              {AREAS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="field-label">when</span>
            <input
              type="date"
              value={dateISO}
              onChange={(e) => setDateISO(e.target.value || today)}
              className="field"
            />
          </label>

          <div>
            <span className="field-label">between</span>
            <div className="flex items-center gap-3">
              <select
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
                className="field"
              >
                {Array.from({ length: 17 }, (_, i) => i + 8).map((h) => (
                  <option key={h} value={h}>
                    {fmtHour(h)}
                  </option>
                ))}
              </select>
              <span className="text-sm text-muted-foreground">and</span>
              <select
                value={endHour}
                onChange={(e) => setEndHour(Number(e.target.value))}
                className="field"
              >
                {Array.from({ length: 17 }, (_, i) => i + 8).map((h) => (
                  <option key={h} value={h}>
                    {fmtHour(h)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className="field-label">how many</span>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setParty(n)}
                  aria-pressed={party === n}
                  className="chip"
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="card-soft mt-5 overflow-hidden p-6 text-center" data-mood={mood}>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">chance of a seat</div>
          <div className="score mt-1">{pct}%</div>
          <p className="mt-1 text-sm font-medium text-foreground">{result.verdict}</p>

          <div className="mt-5 flex items-end justify-center gap-1.5">
            {result.hourly.map((h) => (
              <div key={h.hour} className="flex w-9 flex-col items-center gap-1">
                <div className="flex h-20 w-full items-end rounded-md bg-muted">
                  <div
                    className="w-full rounded-md bg-primary transition-all"
                    style={{ height: `${Math.max(6, h.probability * 100)}%` }}
                    title={`${Math.round(h.probability * 100)}%`}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{h.hour}h</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Best moment: {fmtHour(result.bestHour)} · {Math.round(result.bestHourProbability * 100)}%
          </p>
        </section>

        <section className="card-soft mt-5 divide-y divide-border p-1">
          {result.factors.map((f) => (
            <div key={f.label} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-foreground">{f.label}</div>
                <div className="text-xs text-muted-foreground">{f.note}</div>
              </div>
              <span className={f.effect >= 0 ? "pill pill-good" : "pill pill-bad"}>
                {f.effect >= 0 ? "helps" : "hurts"}
              </span>
            </div>
          ))}
        </section>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Running on realistic mock terrace &amp; weather data.
        </p>
      </div>
    </main>
  );
}
