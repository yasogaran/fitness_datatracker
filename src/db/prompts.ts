import type { SQLiteDatabase } from 'expo-sqlite';
import type { PromptAnswer, Session } from '@/types/models';

export interface Answers {
  rpe: number;
  thirst: number;
  felt_dizzy_or_cramp: 0 | 1;
  drank_water: 0 | 1;
  rested: 0 | 1;
}

function scheduledPromptId(sessionId: string, k: number): string {
  return `${sessionId}-P${String(k).padStart(3, '0')}`;
}

// A notification that fires in the background gives the app no chance to run code, so scheduled prompts are
// derived from the schedule: start + k * interval. Every due prompt gets a 'missed' row, which answering or
// skipping later overwrites. Idempotent. prompted_at is the scheduled time, not a measured delivery time
// (a tap replaces it with the notification's own timestamp).
export async function reconcileScheduledPrompts(
  db: SQLiteDatabase,
  session: Session,
  upToUtc: string,
): Promise<void> {
  const intervalMs = session.reminder_interval_min * 60000;
  const start = Date.parse(session.start_utc);
  const due = Math.floor((Date.parse(upToUtc) - start) / intervalMs);
  for (let k = 1; k <= due; k++) {
    await db.runAsync(
      `INSERT OR IGNORE INTO prompt_answer (prompt_id, session_id, prompted_at_utc, trigger, status)
       VALUES (?, ?, ?, 'scheduled', 'missed')`,
      scheduledPromptId(session.session_id, k),
      session.session_id,
      new Date(start + k * intervalMs).toISOString(),
    );
  }
}

export function listScheduledPrompts(db: SQLiteDatabase, sessionId: string): Promise<PromptAnswer[]> {
  return db.getAllAsync<PromptAnswer>(
    "SELECT * FROM prompt_answer WHERE session_id = ? AND trigger = 'scheduled' ORDER BY prompted_at_utc",
    sessionId,
  );
}

export async function answerPrompt(
  db: SQLiteDatabase,
  p: {
    prompt_id: string;
    session_id: string;
    prompted_at_utc: string;
    answered_at_utc: string;
    trigger: 'scheduled' | 'manual';
    answers: Answers | null; // null = skipped
  },
): Promise<void> {
  const a = p.answers;
  await db.runAsync(
    `INSERT INTO prompt_answer (prompt_id, session_id, prompted_at_utc, answered_at_utc, trigger, status,
       rpe, thirst, felt_dizzy_or_cramp, drank_water, rested)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(prompt_id) DO UPDATE SET
       prompted_at_utc = excluded.prompted_at_utc, answered_at_utc = excluded.answered_at_utc,
       status = excluded.status, rpe = excluded.rpe, thirst = excluded.thirst,
       felt_dizzy_or_cramp = excluded.felt_dizzy_or_cramp, drank_water = excluded.drank_water,
       rested = excluded.rested`,
    p.prompt_id, p.session_id, p.prompted_at_utc, p.answered_at_utc, p.trigger,
    a ? 'answered' : 'skipped',
    a?.rpe ?? null, a?.thirst ?? null, a?.felt_dizzy_or_cramp ?? null, a?.drank_water ?? null, a?.rested ?? null,
  );
}
