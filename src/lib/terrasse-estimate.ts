export type Estimate = {
  probability: number;
  verdict: string;
  note: string;
};

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/** Demand curve across the day: apéro and dinner are the crowded hours. */
function demandAt(hour: number): number {
  const peaks: Array<[number, number]> = [
    [13, 0.7],
    [18.5, 1],
    [20.5, 0.9],
  ];
  return peaks.reduce(
    (acc, [center, weight]) => acc + weight * Math.exp(-((hour - center) ** 2) / 3.2),
    0.12,
  );
}

function parseHour(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) + (m || 0) / 60;
}

export function estimate(input: {
  place: string;
  from: string;
  to: string;
  party: number;
}): Estimate {
  const from = parseHour(input.from);
  const to = Math.max(parseHour(input.to), from + 0.25);

  // Best chance across the window: sample every 15 minutes.
  let bestDemand = Infinity;
  for (let t = from; t <= to; t += 0.25) bestDemand = Math.min(bestDemand, demandAt(t));

  const windowBonus = Math.min(0.18, (to - from) * 0.06);
  const popularity = 0.55 + hash(input.place.trim().toLowerCase()) * 0.5;
  const partyPenalty = Math.max(0, input.party - 2) * 0.075;
  const weatherComfort = 0.82; // mock: a mild, dry Paris evening

  const pressure = (bestDemand / 1.7) * popularity * (1.35 - weatherComfort * 0.35);
  let p = 1 - pressure + windowBonus - partyPenalty;
  p = Math.max(0.04, Math.min(0.96, p));

  const probability = Math.round(p * 100);
  const verdict =
    probability >= 70 ? "Go, quietly confident" : probability >= 40 ? "Worth a walk" : "Plan a fallback";
  const note =
    probability >= 70
      ? "Tables should still be turning when you arrive."
      : probability >= 40
        ? "Arrive at the earlier end of your window."
        : "Peak hour and a big table — try just after 21:30.";

  return { probability, verdict, note };
}
