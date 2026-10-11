// NOAA / NWS heat index (https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml).
// Celsius in, Celsius out. Computed at export time only; never stored raw (spec FR-15).

const cToF = (c: number) => (c * 9) / 5 + 32;
const fToC = (f: number) => ((f - 32) * 5) / 9;

export function heatIndexC(tempC: number, humidityPct: number): number {
  const t = cToF(tempC);
  const rh = humidityPct;

  // Simple Steadman-style formula, used for cooler conditions.
  const simple = 0.5 * (t + 61.0 + (t - 68.0) * 1.2 + rh * 0.094);
  if ((simple + t) / 2 < 80) return fToC(simple);

  // Rothfusz regression.
  let hi =
    -42.379 +
    2.04901523 * t +
    10.14333127 * rh -
    0.22475541 * t * rh -
    0.00683783 * t * t -
    0.05481717 * rh * rh +
    0.00122874 * t * t * rh +
    0.00085282 * t * rh * rh -
    0.00000199 * t * t * rh * rh;

  if (rh < 13 && t >= 80 && t <= 112) {
    hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(t - 95)) / 17);
  } else if (rh > 85 && t >= 80 && t <= 87) {
    hi += ((rh - 85) / 10) * ((87 - t) / 5);
  }
  return fToC(hi);
}
