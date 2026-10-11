export type Sex = 'female' | 'male' | 'other';
export type FitnessLevel = 'Beginner' | 'Regular' | 'Athlete';
export type SessionStatus = 'active' | 'recorded' | 'synced' | 'exported';
export type EnvSource = 'api' | 'manual';
export type PromptTrigger = 'scheduled' | 'manual';
export type PromptStatus = 'answered' | 'skipped' | 'missed';

export interface Profile {
  user_id: string;
  age: number;
  sex: Sex;
  weight_kg: number;
  height_cm: number;
  resting_hr: number;
  max_hr_est: number;
  fitness_level: FitnessLevel;
  usual_pace_kmh: number;
  consent_version: string | null;
  consent_at: string | null;
}

export interface Session {
  session_id: string;
  user_id: string;
  start_utc: string;
  end_utc: string | null;
  utc_offset_min: number;
  reminder_interval_min: number;
  sleep_quality: number | null;
  water_carried_ml: number | null;
  clothing_note: string | null;
  session_note: string | null;
  status: SessionStatus;
  hc_synced_at: string | null;
}

export interface GpsPoint {
  id: number;
  session_id: string;
  ts_utc: string;
  lat: number;
  lon: number;
  speed_mps: number | null;
  accuracy_m: number | null;
  altitude_m: number | null;
}

export interface HrSample {
  session_id: string;
  ts_utc: string;
  bpm: number;
  source_app: string | null;
  record_id: string;
}

export interface StepsInterval {
  session_id: string;
  start_utc: string;
  end_utc: string;
  count: number;
  record_id: string;
}

export interface EnvReading {
  id: number;
  session_id: string;
  ts_utc: string;
  air_temp_c: number | null;
  humidity_pct: number | null;
  source: EnvSource;
}

export interface PromptAnswer {
  prompt_id: string;
  session_id: string;
  prompted_at_utc: string;
  answered_at_utc: string | null;
  trigger: PromptTrigger;
  status: PromptStatus;
  rpe: number | null;
  thirst: number | null;
  felt_dizzy_or_cramp: 0 | 1 | null;
  drank_water: 0 | 1 | null;
  rested: 0 | 1 | null;
}
