import type { SQLiteDatabase } from 'expo-sqlite';
import {
  getGrantedPermissions,
  initialize,
  readRecords,
} from 'react-native-health-connect';
import {
  insertHrSamples,
  insertStepsIntervals,
  markSynced,
  setWorkoutFound,
} from '@/db/healthData';
import type { HrSample, Session, StepsInterval } from '@/types/models';
import { nowUtcIso } from '@/utils/time';
import { hcAvailability, hcPermissionsGranted } from './setupChecks';

const MARGIN_BEFORE_MS = 60 * 1000; // FR-16: start - 1 min
const MARGIN_AFTER_MS = 5 * 60 * 1000; // FR-16: end + 5 min
const PAGE_SIZE = 1000;

type TimeRangeFilter = Parameters<typeof readRecords>[1]['timeRangeFilter'];

export type PullResult =
  | { status: 'unavailable'; message: string }
  | { status: 'denied'; message: string }
  | { status: 'error'; message: string }
  | {
      status: 'ok';
      hrNew: number;
      hrTotalRead: number;
      stepsNew: number;
      stepsTotalRead: number;
      /** null when the optional ExerciseSession permission was not granted, so it could not be checked. */
      workoutFound: boolean | null;
    };

// Reads every page of a record type for the window.
async function readAll<T extends 'HeartRate' | 'Steps' | 'ExerciseSession'>(recordType: T, range: TimeRangeFilter) {
  const out = [];
  let pageToken: string | undefined;
  do {
    const res = await readRecords(recordType, {
      timeRangeFilter: range,
      ascendingOrder: true,
      pageSize: PAGE_SIZE,
      pageToken,
    });
    out.push(...res.records);
    pageToken = res.pageToken || undefined;
  } while (pageToken);
  return out;
}

// FR-16 to FR-20. Stores samples as Health Connect returned them (no smoothing); safe to run repeatedly.
export async function pullFromHealthConnect(
  db: SQLiteDatabase,
  session: Session,
  onProgress: (message: string) => void,
): Promise<PullResult> {
  if (!session.end_utc) return { status: 'error', message: 'The session has not ended yet.' };

  onProgress('Checking Health Connect...');
  const availability = await hcAvailability();
  if (availability !== 'available') {
    return {
      status: 'unavailable',
      message:
        availability === 'update_required'
          ? 'Health Connect needs an update from the Play Store.'
          : 'Health Connect is not available on this phone.',
    };
  }
  if (!(await hcPermissionsGranted())) {
    return { status: 'denied', message: 'Heart rate and steps permissions are not granted.' };
  }

  const startMs = Date.parse(session.start_utc);
  const endMs = Date.parse(session.end_utc);
  const windowStart = startMs - MARGIN_BEFORE_MS;
  const windowEnd = endMs + MARGIN_AFTER_MS;
  const range: TimeRangeFilter = {
    operator: 'between',
    startTime: new Date(windowStart).toISOString(),
    endTime: new Date(windowEnd).toISOString(),
  };

  try {
    await initialize();

    onProgress('Reading heart rate...');
    const hrRecords = await readAll('HeartRate', range);
    const hr: HrSample[] = [];
    for (const rec of hrRecords) {
      const recordId = rec.metadata?.id ?? `${rec.metadata?.dataOrigin ?? 'unknown'}:${rec.startTime}`;
      for (const s of rec.samples) {
        const t = Date.parse(s.time);
        // A record that overlaps the window can hold samples far outside it; keep only this session's.
        if (t < windowStart || t > windowEnd) continue;
        hr.push({
          session_id: session.session_id,
          ts_utc: new Date(t).toISOString(),
          bpm: s.beatsPerMinute,
          source_app: rec.metadata?.dataOrigin ?? null,
          record_id: recordId,
        });
      }
    }

    onProgress('Reading steps...');
    const stepRecords = await readAll('Steps', range);
    const steps: StepsInterval[] = stepRecords.map((rec) => ({
      session_id: session.session_id,
      start_utc: new Date(rec.startTime).toISOString(),
      end_utc: new Date(rec.endTime).toISOString(),
      count: rec.count,
      record_id: rec.metadata?.id ?? `${rec.metadata?.dataOrigin ?? 'unknown'}:${rec.startTime}`,
    }));

    onProgress('Checking for a watch workout...');
    let workoutFound: boolean | null = null;
    const granted = await getGrantedPermissions();
    if (granted.some((g) => 'recordType' in g && g.recordType === 'ExerciseSession')) {
      workoutFound = (await readAll('ExerciseSession', range)).length > 0;
    }

    onProgress('Saving...');
    const hrNew = await insertHrSamples(db, hr);
    const stepsNew = await insertStepsIntervals(db, steps);
    await setWorkoutFound(db, session.session_id, workoutFound);
    await markSynced(db, session.session_id, nowUtcIso());

    return {
      status: 'ok',
      hrNew,
      hrTotalRead: hr.length,
      stepsNew,
      stepsTotalRead: steps.length,
      workoutFound,
    };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Health Connect read failed.' };
  }
}
