import * as Location from 'expo-location';
import type { SQLiteDatabase } from 'expo-sqlite';
import { lastGpsTimestamp } from '@/db/gps';
import { reconcileScheduledPrompts } from '@/db/prompts';
import { createSession, endSession } from '@/db/sessions';
import type { NewSession } from '@/db/sessions';
import type { Session } from '@/types/models';
import { nowUtcIso } from '@/utils/time';
import { LOCATION_TASK } from './locationTask';
import { cancelReminders, scheduleReminders } from './reminders';

async function stopLocationUpdates(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}

// Safe to call repeatedly; used for Start and for resuming after the app or phone was restarted.
export async function ensureLocationUpdates(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) return;
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 5000,
    distanceInterval: 0,
    foregroundService: {
      notificationTitle: 'HikeLogger is recording',
      notificationBody: 'Recording your location for the hike.',
    },
  });
}

export async function startSession(db: SQLiteDatabase, input: NewSession): Promise<Session> {
  const session = await createSession(db, input);
  try {
    await ensureLocationUpdates();
    await scheduleReminders(session);
  } catch (e) {
    // Do not leave an active session behind that has no GPS.
    await stopLocationUpdates();
    await cancelReminders();
    await endSession(db, session.session_id, nowUtcIso());
    throw e;
  }
  return session;
}

async function closeSession(db: SQLiteDatabase, session: Session, endUtc: string): Promise<void> {
  await stopLocationUpdates();
  await cancelReminders();
  // Prompts that were due but never answered stay 'missed'.
  await reconcileScheduledPrompts(db, session, endUtc);
  await endSession(db, session.session_id, endUtc);
}

export function stopSession(db: SQLiteDatabase, session: Session): Promise<void> {
  return closeSession(db, session, nowUtcIso());
}

// "Finish" for a recovered session: the app was dead, so the honest end time is the last GPS point
// (or the start time if there is none), not the moment the user taps the button.
export async function finishRecoveredSession(db: SQLiteDatabase, session: Session): Promise<void> {
  const last = await lastGpsTimestamp(db, session.session_id);
  await closeSession(db, session, last ?? session.start_utc);
}
