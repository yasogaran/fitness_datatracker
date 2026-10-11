import type { SQLiteDatabase } from 'expo-sqlite';
import { insertEnvReading, lastApiEnvTimestamp } from '@/db/env';

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 10000;
const REFRESH_MS = 30 * 60 * 1000; // FR-13
const RETRY_AFTER_FAILURE_MS = 2 * 60 * 1000;

export interface Weather {
  airTempC: number;
  humidityPct: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// The only network call in the app. Sends coordinates rounded to 2 decimals and nothing else.
export async function fetchCurrentWeather(lat: number, lon: number): Promise<Weather> {
  const url =
    `${ENDPOINT}?latitude=${round2(lat)}&longitude=${round2(lon)}` +
    '&current=temperature_2m,relative_humidity_2m';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const json = (await res.json()) as {
      current?: { temperature_2m?: unknown; relative_humidity_2m?: unknown };
    };
    const t = json.current?.temperature_2m;
    const h = json.current?.relative_humidity_2m;
    if (typeof t !== 'number' || typeof h !== 'number') throw new Error('Unexpected Open-Meteo response');
    return { airTempC: t, humidityPct: h };
  } finally {
    clearTimeout(timer);
  }
}

let inFlight = false;
let lastAttemptFailedAt = 0;

// Called from the background location task on every update. Fetches only when the newest API reading is
// missing or older than 30 minutes, so the first GPS fix triggers the "at session start" reading and an
// offline start catches up as soon as the phone is online. Never throws: weather must not affect recording.
export async function maybeFetchWeather(
  db: SQLiteDatabase,
  sessionId: string,
  lat: number,
  lon: number,
): Promise<void> {
  if (inFlight) return;
  const now = Date.now();
  if (now - lastAttemptFailedAt < RETRY_AFTER_FAILURE_MS) return;
  inFlight = true;
  try {
    const last = await lastApiEnvTimestamp(db, sessionId);
    if (last !== null && now - Date.parse(last) < REFRESH_MS) return;
    const w = await fetchCurrentWeather(lat, lon);
    await insertEnvReading(db, {
      session_id: sessionId,
      ts_utc: new Date().toISOString(),
      air_temp_c: w.airTempC,
      humidity_pct: w.humidityPct,
      source: 'api',
    });
  } catch {
    lastAttemptFailedAt = Date.now();
  } finally {
    inFlight = false;
  }
}
