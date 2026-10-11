import { useEffect, useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { gpsPointsAfter } from '@/db/gps';
import { haversineM } from '@/utils/geo';

const POLL_MS = 2000;
const POOR_ACCURACY_M = 30; // FR-8
const POOR_ACCURACY_WINDOW_MS = 2 * 60 * 1000; // FR-8
// Display distance ignores very inaccurate fixes so a stationary phone does not "walk". Stored data is untouched.
const DISTANCE_MAX_ACCURACY_M = 50;

export interface RecordingStats {
  elapsedS: number;
  distanceM: number;
  speedMps: number | null;
  accuracyM: number | null;
  pointCount: number;
  /** True when accuracy has been worse than 30 m for over 2 minutes, or no fix has arrived for 2 minutes. */
  poorGps: boolean;
}

// Reads what the background task has stored (the task, not this screen, owns GPS recording).
export function useRecordingStats(sessionId: string, startUtc: string): RecordingStats {
  const db = useSQLiteContext();
  const [stats, setStats] = useState<RecordingStats>({
    elapsedS: 0, distanceM: 0, speedMps: null, accuracyM: null, pointCount: 0, poorGps: false,
  });
  const acc = useRef({
    lastId: 0,
    distanceM: 0,
    count: 0,
    lastLat: null as number | null,
    lastLon: null as number | null,
    lastAccuracy: null as number | null,
    lastSpeed: null as number | null,
    lastTs: 0,
    badSince: null as number | null,
  });

  useEffect(() => {
    let cancelled = false;
    const start = Date.parse(startUtc);

    async function tick() {
      const a = acc.current;
      const points = await gpsPointsAfter(db, sessionId, a.lastId);
      if (cancelled) return;
      for (const p of points) {
        const ts = Date.parse(p.ts_utc);
        const usable = p.accuracy_m !== null && p.accuracy_m <= DISTANCE_MAX_ACCURACY_M;
        if (usable && a.lastLat !== null && a.lastLon !== null) {
          a.distanceM += haversineM(a.lastLat, a.lastLon, p.lat, p.lon);
        }
        if (usable) {
          a.lastLat = p.lat;
          a.lastLon = p.lon;
        }
        if (p.accuracy_m !== null && p.accuracy_m > POOR_ACCURACY_M) {
          if (a.badSince === null) a.badSince = ts;
        } else {
          a.badSince = null;
        }
        a.lastId = p.id;
        a.count += 1;
        a.lastAccuracy = p.accuracy_m;
        a.lastSpeed = p.speed_mps;
        a.lastTs = ts;
      }
      const now = Date.now();
      const badFor = a.badSince !== null ? now - a.badSince : 0;
      const noFix = now - (a.lastTs || start) > POOR_ACCURACY_WINDOW_MS;
      setStats({
        elapsedS: Math.max(0, Math.floor((now - start) / 1000)),
        distanceM: a.distanceM,
        speedMps: a.lastSpeed,
        accuracyM: a.lastAccuracy,
        pointCount: a.count,
        poorGps: badFor > POOR_ACCURACY_WINDOW_MS || noFix,
      });
    }

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [db, sessionId, startUtc]);

  return stats;
}
