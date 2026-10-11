/// <reference types="node" />
// Run with: npm test   (Node's built-in runner; no extra test framework)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { heatIndexC } from './heatIndex.ts';

const fToC = (f: number) => ((f - 32) * 5) / 9;

// Reference values are from the NWS heat index chart (degrees F, whole-number chart cells).
// Tolerance is 1.5 F because the chart is rounded and the regression itself is only accurate to about 1.3 F.
const cases: { tempF: number; rh: number; chartF: number }[] = [
  { tempF: 80, rh: 40, chartF: 80 }, // cool branch (simple formula)
  { tempF: 90, rh: 70, chartF: 106 }, // Rothfusz
  { tempF: 100, rh: 50, chartF: 118 }, // Rothfusz, hot
];

for (const c of cases) {
  test(`heat index ${c.tempF}F at ${c.rh}% is about ${c.chartF}F`, () => {
    const resultC = heatIndexC(fToC(c.tempF), c.rh);
    const toleranceC = 1.5 * (5 / 9);
    assert.ok(
      Math.abs(resultC - fToC(c.chartF)) <= toleranceC,
      `got ${((resultC * 9) / 5 + 32).toFixed(1)}F, expected ${c.chartF}F`,
    );
  });
}
