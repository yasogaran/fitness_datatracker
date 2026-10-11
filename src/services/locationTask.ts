import * as TaskManager from 'expo-task-manager';
import type { LocationObject } from 'expo-location';
import { getBackgroundDb } from '@/db/connection';
import { insertGpsPoint } from '@/db/gps';
import { getActiveSession } from '@/db/sessions';
import { maybeFetchWeather } from './weather';

export const LOCATION_TASK = 'hikelogger-location';

// Must be defined at module top level (see index.ts). Stores every update raw, one insert per point (FR-5, FR-7).
TaskManager.defineTask<{ locations: LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  try {
    const db = await getBackgroundDb();
    const session = await getActiveSession(db);
    if (!session) return;
    for (const loc of data.locations) {
      await insertGpsPoint(db, {
        session_id: session.session_id,
        ts_utc: new Date(loc.timestamp).toISOString(),
        lat: loc.coords.latitude,
        lon: loc.coords.longitude,
        speed_mps: loc.coords.speed,
        accuracy_m: loc.coords.accuracy,
        altitude_m: loc.coords.altitude,
      });
    }
    const last = data.locations[data.locations.length - 1];
    if (last) {
      // Not awaited: a slow or failed weather request must never delay GPS inserts.
      void maybeFetchWeather(db, session.session_id, last.coords.latitude, last.coords.longitude);
    }
  } catch (e) {
    console.warn('gps insert failed', e);
  }
});
