/**
 * Hand-drawn line illustrations for Terrasse?.
 * All strokes inherit the ink token via the `ink-stroke` utilities —
 * never hardcode a color here.
 */

type Props = { className?: string };

export function TerraceScene({ className }: Props) {
  return (
    <svg viewBox="0 0 320 260" className={className} role="img" aria-label="Café table with two glasses under a parasol">
      {/* parasol */}
      <path className="ink-stroke" d="M52 78c14-31 44-49 78-49s63 19 76 50c-15-8-28-9-39-3-11-8-24-9-37-2-13-8-26-7-38 1-13-6-26-4-40 3z" />
      <path className="ink-stroke" d="M130 79v96" />
      <path className="ink-stroke-soft" d="M96 79c8 4 22 5 34 3M164 79c-8 5-21 6-34 3" />
      {/* table */}
      <path className="ink-stroke" d="M74 176h174c-4 7-13 11-25 12H99c-13-1-21-5-25-12z" />
      <path className="ink-stroke" d="M162 188v42M140 231c9-6 34-6 44 0" />
      {/* glasses */}
      <path className="ink-stroke" d="M92 128c1 13 6 21 13 24 7-3 12-11 13-24-9 2-17 2-26 0z" />
      <path className="ink-stroke" d="M105 152v20M96 173c4-3 14-3 18 0" />
      <path className="ink-stroke" d="M196 126c1 14 6 22 13 25 7-3 12-11 13-25-9 2-17 2-26 0z" />
      <path className="ink-stroke" d="M209 151v21M200 173c4-3 14-3 18 0" />
      {/* little plate of lemons */}
      <ellipse className="ink-stroke" cx="160" cy="163" rx="30" ry="9" />
      <circle className="ink-stroke" cx="149" cy="160" r="6" />
      <circle className="ink-stroke" cx="167" cy="161" r="6" />
      <path className="ink-stroke-soft" d="M149 154v12M143 160h12M167 155v12M161 161h12" />
      {/* small flowers */}
      <path className="ink-stroke" d="M259 168c-6-14-3-30 6-40M265 128c-7-2-11-8-10-15 8 0 13 5 13 13" />
      <path className="ink-stroke-soft" d="M265 141c7-3 13-1 16 5-7 4-13 3-17-2" />
    </svg>
  );
}

export function SunSprig({ className }: Props) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Sun">
      <circle className="ink-stroke" cx="60" cy="60" r="21" />
      <path
        className="ink-stroke"
        d="M60 22V8M60 112V98M98 60h14M8 60h14M87 33l10-10M23 97l10-10M87 87l10 10M23 23l10 10"
      />
    </svg>
  );
}

export function CloudDrops({ className }: Props) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Cloud with rain">
      <path
        className="ink-stroke"
        d="M32 70c-11 0-19-7-19-16s8-16 18-15c3-13 15-22 29-22 16 0 28 11 30 26 10 0 18 6 18 14s-8 13-19 13z"
      />
      <path className="ink-stroke" d="M40 84l-6 15M62 84l-6 15M84 84l-6 15" />
    </svg>
  );
}

export function Awning({ className }: Props) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Café awning">
      <path className="ink-stroke" d="M14 62c0-20 21-34 46-34s46 14 46 34c-9-7-16-7-23-1-8-7-15-7-23-1-8-6-15-6-23 1-7-6-14-6-23 1z" />
      <path className="ink-stroke-soft" d="M37 34c-3 9-4 19-3 28M83 34c3 9 4 19 3 28" />
      <path className="ink-stroke" d="M28 74v30M92 74v30" />
    </svg>
  );
}

export function OliveBranch({ className }: Props) {
  return (
    <svg viewBox="0 0 160 60" className={className} aria-hidden="true">
      <path className="ink-stroke" d="M6 40c34 10 82 4 148-18" />
      <g className="ink-stroke">
        <ellipse cx="36" cy="30" rx="9" ry="4.5" transform="rotate(-34 36 30)" />
        <path d="M40 34l-4 4" />
        <ellipse cx="66" cy="24" rx="9" ry="4.5" transform="rotate(-28 66 24)" />
        <path d="M70 28l-4 4" />
        <ellipse cx="98" cy="17" rx="9" ry="4.5" transform="rotate(-24 98 17)" />
        <path d="M102 21l-4 4" />
        <ellipse cx="126" cy="9" rx="8" ry="4" transform="rotate(-20 126 9)" />
        <path d="M129 13l-3 4" />
      </g>
    </svg>
  );
}

export function Squiggle({ className }: Props) {
  return (
    <svg viewBox="0 0 200 14" className={className} aria-hidden="true">
      <path className="ink-stroke-soft" d="M2 8c22-9 44 9 66 0s44-9 66 0 44 5 64-4" />
    </svg>
  );
}
