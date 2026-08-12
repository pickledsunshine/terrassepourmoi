import { createFileRoute } from "@tanstack/react-router";
import {
  Awning,
  CloudDrops,
  OliveBranch,
  Squiggle,
  SunSprig,
  TerraceScene,
} from "@/components/illustrations";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Terrasse? — Will there be a seat in the sun?" },
      {
        name: "description",
        content:
          "A quiet Paris tool that tells you the odds of finding a terrace seat — by neighbourhood, hour and party size.",
      },
      { property: "og:title", content: "Terrasse? — Will there be a seat in the sun?" },
      {
        property: "og:description",
        content: "The odds of a terrace seat in Paris, written like an invitation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const AREAS = ["Le Marais", "Canal Saint-Martin", "Montmartre", "Belleville", "Saint-Germain"];

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <Hero />
      <Invitation />
      <OddsPreview />
      <Weather />
      <Addresses />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-7">
      <span className="script-lg leading-none">Terrasse?</span>
      <nav className="hidden items-center gap-9 sm:flex">
        <a className="nav-link" href="#invitation">
          The idea
        </a>
        <a className="nav-link" href="#odds">
          The odds
        </a>
        <a className="nav-link" href="#addresses">
          Addresses
        </a>
      </nav>
      <button type="button" className="btn-outline-ink hidden md:inline-flex">
        Ask
      </button>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-20 pt-10 text-center sm:pt-16">
      <p className="engraved-soft">Paris · Outdoors · Since always</p>

      <h1 className="script-xl mt-6">
        Will there be
        <br />a seat in the sun?
      </h1>

      <Squiggle className="mx-auto mt-6 w-44" />

      <TerraceScene className="mx-auto mt-8 w-full max-w-md text-foreground" />

      <p className="engraved mt-8">We cordially estimate your chances of a terrace</p>

      <p className="body-note mx-auto mt-4 max-w-md">
        Choose a quartier, an hour and how many of you there are. We read the sky, the
        crowd and the number of chairs on the pavement — and answer in one number.
      </p>

      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <button type="button" className="btn-ink">
          Read my odds
        </button>
        <button type="button" className="btn-outline-ink">
          How it works
        </button>
      </div>
    </section>
  );
}

function Invitation() {
  const items = [
    {
      icon: <SunSprig className="h-16 w-16" />,
      title: "The sky",
      note: "Temperature, wind and the chance of rain at the hour you intend to sit down.",
    },
    {
      icon: <Awning className="h-16 w-16" />,
      title: "The chairs",
      note: "How many terrace seats a quartier actually holds, and how many are covered.",
    },
    {
      icon: <OliveBranch className="h-16 w-20" />,
      title: "The crowd",
      note: "Apéro pressure, weekends, and the way a warm evening empties every table.",
    },
  ];

  return (
    <section id="invitation" className="band-lavender">
      <div className="mx-auto max-w-5xl px-6 py-20 text-center">
        <p className="engraved-soft">Three things we watch</p>
        <h2 className="script-lg mt-3">Read like an invitation</h2>

        <div className="mt-14 grid gap-14 sm:grid-cols-3">
          {items.map((it) => (
            <div key={it.title} className="flex flex-col items-center">
              <div className="text-foreground">{it.icon}</div>
              <h3 className="engraved mt-5">{it.title}</h3>
              <p className="body-note mt-3 max-w-[16rem]">{it.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function OddsPreview() {
  return (
    <section id="odds" className="mx-auto max-w-5xl px-6 py-24">
      <div className="grid items-start gap-16 md:grid-cols-2">
        {/* the asking */}
        <div>
          <p className="engraved-soft">The asking</p>
          <h2 className="script-lg mt-3">Four small questions</h2>

          <div className="mt-10 space-y-8">
            <div>
              <span className="field-caption">Where</span>
              <select className="field-line" defaultValue={AREAS[0]}>
                {AREAS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>

            <div>
              <span className="field-caption">Which evening</span>
              <input className="field-line" type="text" defaultValue="Friday 14 August" readOnly />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <span className="field-caption">From</span>
                <input className="field-line" type="text" defaultValue="19:00" readOnly />
              </div>
              <div>
                <span className="field-caption">Until</span>
                <input className="field-line" type="text" defaultValue="21:00" readOnly />
              </div>
            </div>

            <div>
              <span className="field-caption">How many</span>
              <div className="flex flex-wrap gap-2 pt-1">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button key={n} type="button" className="pebble" aria-pressed={n === 2}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* the answer */}
        <div className="paper-card text-center">
          <p className="engraved-soft">Le Marais · Friday, 19h–21h</p>
          <p className="odds-figure mt-4">68%</p>
          <p className="script-md mt-3">Rather promising.</p>
          <hr className="inked-rule mx-auto mt-6 w-24" />

          <div className="mt-6 flex items-end justify-center gap-2">
            {[
              [17, 52],
              [18, 61],
              [19, 74],
              [20, 68],
              [21, 47],
            ].map(([hour, v]) => (
              <div key={hour} className="flex w-10 flex-col items-center gap-2">
                <div className="flex h-24 w-1.5 items-end rounded-full bg-secondary">
                  <div className="w-1.5 rounded-full bg-foreground" style={{ height: `${v}%` }} />
                </div>
                <span className="engraved-soft">{hour}h</span>
              </div>
            ))}
          </div>

          <p className="body-note mt-6">
            Best moment around 19h. After 21h the apéro crowd settles in and rarely moves.
          </p>
        </div>
      </div>
    </section>
  );
}

function Weather() {
  return (
    <section className="band-lavender">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 px-6 py-16 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-6">
          <CloudDrops className="h-16 w-16 text-foreground" />
          <div>
            <p className="engraved-soft">This evening in Paris</p>
            <p className="script-md mt-1">24°, a little wind, rain unlikely</p>
          </div>
        </div>
        <dl className="flex gap-10">
          {[
            ["Temperature", "24°"],
            ["Rain", "12%"],
            ["Wind", "9 km/h"],
          ].map(([k, v]) => (
            <div key={k} className="text-center">
              <dt className="engraved-soft">{k}</dt>
              <dd className="script-md mt-1">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Addresses() {
  const places = [
    { name: "Café de la Perle", area: "Le Marais", seats: "34 seats", odds: "71%" },
    { name: "Chez Prune", area: "Canal Saint-Martin", seats: "48 seats", odds: "56%" },
    { name: "Le Petit Chavignol", area: "Batignolles", seats: "22 seats", odds: "83%" },
  ];

  return (
    <section id="addresses" className="mx-auto max-w-5xl px-6 py-24 text-center">
      <p className="engraved-soft">A few addresses</p>
      <h2 className="script-lg mt-3">Where the chairs are</h2>
      <Squiggle className="mx-auto mt-5 w-32" />

      <div className="mt-12 grid gap-8 sm:grid-cols-3">
        {places.map((p) => (
          <article key={p.name} className="paper-card text-left">
            <Awning className="h-12 w-12 text-foreground" />
            <h3 className="script-md mt-4">{p.name}</h3>
            <p className="engraved-soft mt-2">{p.area}</p>
            <hr className="inked-rule mt-5 w-full" />
            <div className="mt-4 flex items-baseline justify-between">
              <span className="body-note">{p.seats}</span>
              <span className="script-md">{p.odds}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="band-lavender">
      <div className="mx-auto max-w-5xl px-6 py-16 text-center">
        <p className="script-lg">Terrasse?</p>
        <OliveBranch className="mx-auto mt-4 w-40 text-foreground" />
        <p className="engraved mt-6">Made in Paris, for sitting outside</p>
        <p className="body-note mx-auto mt-3 max-w-sm">
          A quiet instrument, not a booking platform. No accounts, no notifications.
        </p>
      </div>
    </footer>
  );
}
