import { it } from "vitest";
import { estimateTerrasse } from "./engine";
import { mockPlaces } from "./places.mock";
import { resolveLocation } from "./location";
const w = { async getForecast(){ return { hourly: Array.from({length:24},(_,hour)=>({hour,temperatureC:23,precipitationProbability:0,precipitationMm:0,cloudCover:0.15,windKph:8})), summary:"c" }; } };
it("scan", async () => {
  const L = resolveLocation("Le Marais");
  const cases: [string, Date, number, number][] = [
    ["tue14", new Date(2026,7,11), 14, 2],
    ["fri20", new Date(2026,7,14), 20, 2],
    ["fri20p6", new Date(2026,7,14), 20, 6],
    ["sat13", new Date(2026,7,15), 13, 2],
    ["wed15", new Date(2026,7,12), 15, 2],
  ];
  for (const [n,d,h,pp] of cases) {
    const r = await estimateTerrasse({location:L,date:d,from:h,to:h+1,party:pp},{places:mockPlaces,weather:w as any});
    console.log(n, r.probability);
  }
});
