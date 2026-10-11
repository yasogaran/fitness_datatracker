# HikeLogger: Data Collection App (Minimal) — Full Specification

**Purpose:** a minimal Android app (React Native) that records everything the hiking-risk model needs for training, in the exact format described in `model_training_lecture.md`. It does **no AI and no prediction**. It only gathers data.

**Target device:** Android phone paired with a Samsung Galaxy Watch 6, with Samsung Health connected to Health Connect.

---

## 1. Read This First: The One Big Constraint

The Galaxy Watch 6 does **not** let a normal React Native app stream live heart rate. The practical route is:

```
Galaxy Watch 6 --> Samsung Health (phone) --> Health Connect --> HikeLogger (reads after the hike)
```

Consequences that shape the whole design:

| Fact | Design decision |
|---|---|
| Health Connect data is **not real-time**; the watch syncs to Samsung Health, then Samsung Health writes to Health Connect, with delay. | The app does **not** show live heart rate. It records GPS and answers live, then **pulls watch data after the session** ("Sync watch data" step). |
| Heart rate is dense (about every few seconds) only when the watch is **recording an exercise** in Samsung Health. Outside exercise, it is sparse (about every 10 minutes). | **During every session, start a "Hiking" workout on the watch.** The app reminds the user at start. |
| Samsung Health must be allowed to write into Health Connect. | Onboarding checklist tells the user to enable it. |
| A live watch stream would need a separate Wear OS app. | Out of scope. Listed as "Phase 2". |

> **Verify early:** run one pilot walk, then check how many heart-rate samples the app gets back. The "Data check" screen (section 5.6) exists for this. Do not collect real participant data until the pilot shows dense heart rate.

---

## 2. What the App Records

Everything maps to the lecture's four tables.

| Lecture table | Source in this app |
|---|---|
| 2.1 Raw sensor log | HR + steps from Health Connect (watch); GPS, speed, accuracy, altitude from the phone |
| 2.2 Environment log | Temperature and humidity from a free weather API (Open-Meteo), with manual entry fallback |
| 2.3 User profile | One-time profile screen |
| 2.4 Label log | **The five questions**, asked every N minutes |

### 2.1 The five questions (from Lesson 2.4)

Asked on one screen, each answerable with one tap. Total time target: under 10 seconds.

| # | Field | Question | Answer type |
|---|---|---|---|
| 1 | `rpe` | "How hard does this feel right now?" | 1 to 10 (Borg scale with short word hints) |
| 2 | `thirst` | "How thirsty are you?" | 1 to 5 |
| 3 | `felt_dizzy_or_cramp` | "Dizzy, cramping or unwell?" | Yes / No |
| 4 | `drank_water` | "Drank water since the last prompt?" | Yes / No |
| 5 | `rested` | "Rested since the last prompt?" | Yes / No |

RPE hints: 1 = very easy, 3 = easy, 5 = moderate, 7 = hard, 9 = very hard, 10 = maximum.

**Safety rule inside the app:** if `rpe >= 9` or `felt_dizzy_or_cramp = yes`, show a calm message: *"Please slow down, rest and drink water. You can end the session any time."* This is a data-collection tool, never a reason to push someone on.

### 2.2 Pre-session fields (asked once per session)

| Field | Type |
|---|---|
| `sleep_quality` | 1 to 5 |
| `water_carried_ml` | number (optional) |
| `clothing_note` | short text (optional) |
| `session_note` | short text (optional) |

---

## 3. Users and Flow

**Users:** the researcher (you) and 8 to 15 volunteer participants. Each volunteer uses the app on their own phone or yours.

**Happy-path flow**

```
Install -> Onboarding checklist -> Consent -> Profile (once)
   -> Home -> Start Session (pre-session form)
   -> [Hike: GPS recording + reminder every N min -> five questions]
   -> End Session -> Sync watch data -> Data check -> Export CSV -> Share
```

---

## 4. Screens

Keep the UI plain and large-button friendly (hikers use it with sweaty hands).

| # | Screen | Contents |
|---|---|---|
| 1 | **Onboarding checklist** | Steps with status ticks: Health Connect available, Health Connect permissions granted, Location granted, Notifications granted, Battery-optimization exemption done, Samsung Health to Health Connect sharing enabled (manual confirm tick). Each failed item has a "Fix" button. |
| 2 | **Consent** | Short plain-language text and an "I agree" checkbox. Stores `consent_version` and a timestamp. (Text supplied by the researcher after ethics approval; app holds a placeholder.) |
| 3 | **Profile** | `participant_code` (anonymous, such as U01), age, sex, weight_kg, height_cm, resting_hr, max_hr_est (default 220 minus age, editable), fitness_level (Beginner / Regular / Athlete), usual_pace_kmh. |
| 4 | **Home** | "Start session" button, list of past sessions (date, duration, status: recorded / synced / exported), "Settings" link. |
| 5 | **Pre-session** | The pre-session fields, reminder interval picker (default 10 min; options 5 / 10 / 15), a reminder card: *"Start a HIKING workout on your Galaxy Watch now."* Button: Start. |
| 6 | **Recording** | Elapsed time, distance, current speed, GPS accuracy indicator, "Answer now" button, "End session" (with confirmation). A persistent notification shows while recording. No live heart rate (see section 1). |
| 7 | **Questions sheet** | The five questions, one screen, big buttons, Submit. Opens from the reminder notification or "Answer now". "Skip" is allowed and is logged as skipped. |
| 8 | **Sync watch data** | Instructions: open Samsung Health, let the watch sync, return. Button "Pull from Health Connect". Shows progress and result. |
| 9 | **Data check** | Per session: HR sample count, average HR gap in seconds, % of 10 s bins with HR, steps total, GPS point count, GPS median accuracy, label count, weather rows. Traffic-light summary: Good / Sparse HR / Missing. |
| 10 | **Export** | "Export CSV bundle" then the Android share sheet (email, Drive, WhatsApp, cable). |
| 11 | **Settings** | Reminder interval default, units, "Delete all local data" (with confirmation), app version. |

---

## 5. Functional Requirements

### 5.1 Session lifecycle
- **FR-1** Create a session with a unique `session_id` (format `S` plus an incrementing number, such as `S014`) tied to the profile's `user_id`.
- **FR-2** Store `start_time` and `end_time` in UTC, plus the phone's UTC offset.
- **FR-3** If the app is killed or the phone reboots mid-session, the session is recoverable: on next launch show "Resume or finish previous session".
- **FR-4** Only one active session at a time.

### 5.2 Location recording
- **FR-5** While recording, collect location updates about every 5 seconds: `lat`, `lon`, `speed_mps`, `accuracy_m`, `altitude_m`, `timestamp`.
- **FR-6** Recording must continue with the screen off and the app in the background, using an Android **foreground service** with a persistent notification.
- **FR-7** Keep points with poor accuracy; do **not** filter in the app. Store raw. Filtering is done later in the Python pipeline.
- **FR-8** Show a warning if accuracy stays worse than 30 m for over 2 minutes.

### 5.3 Reminders and questions
- **FR-9** Schedule a repeating local notification at the chosen interval (vibration plus sound). Tapping opens the Questions sheet.
- **FR-10** Each prompt creates a `prompt_id`, `prompted_at`; an answer records `answered_at`. Skipped or ignored prompts are stored with `status = skipped` or `missed`.
- **FR-11** The user can answer any time via "Answer now" (`trigger = manual`).
- **FR-12** Reminders stop when the session ends.

### 5.4 Environment (weather)
- **FR-13** At session start, then about every 30 minutes if online, fetch air temperature and relative humidity for the current GPS position from Open-Meteo (free, no API key). Store each fetch as an environment row.
- **FR-14** If offline at start, allow manual entry of temperature and humidity (optional fields), flagged `source = manual`.
- **FR-15** Compute `heat_index_c` at export time using the NOAA formula from the lecture. (Not stored raw, so formula fixes need no re-collection.)

### 5.5 Health Connect pull
- **FR-16** After the session, read from Health Connect for `[start_time − 1 min, end_time + 5 min]`: **HeartRateRecord** (samples), **StepsRecord**.
- **FR-17** Optionally read ExerciseSessionRecord for the time window, to confirm the watch workout existed (shown in Data check as "Watch workout found: yes/no").
- **FR-18** Store raw samples exactly as returned: `time`, `bpm`, `source_app`, `record_id`. No smoothing.
- **FR-19** Provide a retry button: Samsung Health sometimes syncs late. Re-pulling must be **idempotent** (no duplicate rows; use record id plus time as the key).
- **FR-20** If permission is denied or Health Connect is unavailable, the session still exports with empty HR and steps, and the Data check shows "Missing".

### 5.6 Data check
- **FR-21** Compute and display the metrics listed in screen 9. These help the researcher decide to repeat a session before the participant goes home.

### 5.7 Export
- **FR-22** Export one folder per session containing four CSVs plus a metadata JSON (section 7), zipped if practical, or shared as multiple files if zipping is hard.
- **FR-23** Export is available repeatedly (re-export after a late sync).
- **FR-24** Files are created in the app's private storage and shared through the Android share sheet. No cloud upload, no analytics, no accounts.

---

## 6. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | Android only, minimum Android 10 (API 29). Health Connect is built into Android 14 and later; on Android 9 to 13 the Health Connect app must be installed. |
| NFR-2 | Works fully **offline** (only the weather fetch needs internet, with manual fallback). |
| NFR-3 | Battery: a 3-hour session must not drain more than about 25% of the phone battery. |
| NFR-4 | Privacy: all data stays on the phone until the user exports. No third-party SDKs that send data out. Weather request sends only coordinates rounded to 2 decimals. |
| NFR-5 | Participant identity: only the anonymous `participant_code`. No name, email or phone number stored. |
| NFR-6 | Reliability: writes happen to the database immediately (one row per event), so a crash loses at most one row. |
| NFR-7 | Sessions up to 4 hours supported. |
| NFR-8 | Install as a **sideloaded APK** (no Play Store needed). |

---

## 7. Data Model and Export Format

### 7.1 Database tables (SQLite on the phone)

| Table | Columns |
|---|---|
| `profile` | `user_id`, `age`, `sex`, `weight_kg`, `height_cm`, `resting_hr`, `max_hr_est`, `fitness_level`, `usual_pace_kmh`, `consent_version`, `consent_at` |
| `session` | `session_id`, `user_id`, `start_utc`, `end_utc`, `utc_offset_min`, `reminder_interval_min`, `sleep_quality`, `water_carried_ml`, `clothing_note`, `session_note`, `status`, `hc_synced_at` |
| `gps_point` | `id`, `session_id`, `ts_utc`, `lat`, `lon`, `speed_mps`, `accuracy_m`, `altitude_m` |
| `hr_sample` | `session_id`, `ts_utc`, `bpm`, `source_app`, `record_id` (unique on `record_id` + `ts_utc`) |
| `steps_interval` | `session_id`, `start_utc`, `end_utc`, `count`, `record_id` |
| `env_reading` | `id`, `session_id`, `ts_utc`, `air_temp_c`, `humidity_pct`, `source` (`api` or `manual`) |
| `prompt_answer` | `prompt_id`, `session_id`, `prompted_at_utc`, `answered_at_utc`, `trigger` (`scheduled` or `manual`), `status` (`answered`, `skipped`, `missed`), `rpe`, `thirst`, `felt_dizzy_or_cramp`, `drank_water`, `rested` |

### 7.2 Exported files (per session folder `S014_U03/`)

**`sensor_log.csv`** — resampled to a **10-second grid** (matches the lecture's sampling step), one row per step from session start to end:

`session_id, user_id, timestamp, hr_bpm, steps_total, lat, lon, gps_speed_mps, gps_accuracy_m, altitude_m, hr_sample_count`

Rules for building each 10 s bin:
- `hr_bpm`: mean of Health Connect samples inside the bin; **empty** if none (never invent values).
- `steps_total`: cumulative steps since session start, taken at the end of the bin (spread an interval's count evenly across the bins it covers).
- GPS fields: the **last** GPS point inside the bin, empty if none.
- `hr_sample_count`: how many HR samples fell in the bin (so the pipeline can judge quality).
- `timestamp`: ISO 8601 in UTC, such as `2026-11-01T09:30:10Z`.

**`env_log.csv`:** `session_id, timestamp, air_temp_c, humidity_pct, heat_index_c, source`

**`labels.csv`:** `session_id, user_id, prompted_at, answered_at, trigger, status, rpe, thirst, felt_dizzy_or_cramp, drank_water, rested`

**`session_info.csv` (one row):** profile fields plus pre-session fields (`age, sex, weight_kg, height_cm, resting_hr, max_hr_est, fitness_level, usual_pace_kmh, sleep_quality, water_carried_ml, clothing_note, session_note, reminder_interval_min, app_version, device_model`)

**`raw_hr_samples.csv`:** the unbinned samples (`timestamp, bpm, source_app`) kept for audit.

> The Python pipeline later computes `hr_pct`, slope, cadence and so on. **The app stays dumb on purpose.**

---

## 8. Technology Choices

| Need | Recommended | Notes |
|---|---|---|
| Framework | **React Native with Expo (development build, not Expo Go)** and TypeScript | Health Connect needs native code, so Expo Go will not work. |
| Health Connect | `react-native-health-connect` (with its Expo config plugin, plus `expo-build-properties` for SDK levels) | Check the package's current README for exact setup and the manifest permission-rationale entries. |
| Location + background | `expo-location` with a foreground service | Use `startLocationUpdatesAsync` and `expo-task-manager`. |
| Notifications | `expo-notifications` | Repeating time-interval trigger; Android notification channel with vibration. |
| Local DB | `expo-sqlite` | One write per event. |
| Export / share | `expo-file-system`, `expo-sharing` | Zip is optional. |
| Navigation | `expo-router` or React Navigation | Either is fine. |
| State | Plain React state or Zustand | Keep it simple. |
| Keep awake (optional) | `expo-keep-awake` | Off by default to save battery. |

**Rule for the coding agent:** package APIs and Android requirements change. Always read the installed package's current documentation before using it. If something is uncertain, say so instead of guessing.

### 8.1 Android permissions (expected)

- Location: fine location (and background location only if testing shows it is needed)
- Foreground service and foreground service of type location
- Notifications (Android 13 and later)
- Vibrate
- Health Connect read: heart rate, steps, exercise (optional)
- Ask the user to disable battery optimization for the app (Android settings screen)

---

## 9. Suggested Project Structure

```
hikelogger/
  app/                      screens (expo-router) or src/screens
    onboarding.tsx
    consent.tsx
    profile.tsx
    index.tsx               home
    pre-session.tsx
    recording.tsx
    questions.tsx
    sync.tsx
    data-check.tsx
    export.tsx
    settings.tsx
  src/
    db/                     schema, migrations, queries
    services/
      location.ts           background task + foreground service
      healthConnect.ts      permissions + reads
      reminders.ts          notification scheduling
      weather.ts            Open-Meteo fetch + manual fallback
      export.ts             10 s resampling + CSV writing
      dataCheck.ts          quality metrics
    utils/
      heatIndex.ts          NOAA formula (Celsius in/out)
      time.ts
    types/
  CLAUDE.md                 rules for Claude Code
  README.md                 setup + build + pilot instructions
```

---

## 10. Setup the Researcher Must Do (before the first session)

1. On the phone: install the **Health Connect** app if Android is 13 or older.
2. In **Samsung Health**: Settings, then Connected services (or Data permissions), then **Health Connect**, and allow Samsung Health to **share** heart rate, steps, and exercise data. (Menu names vary by version.)
3. Confirm the watch is paired and syncing to Samsung Health.
4. Install the HikeLogger APK (allow "install unknown apps").
5. Grant permissions on first launch (the onboarding checklist guides this).
6. Android Settings, then Apps, then HikeLogger, then Battery: set to **Unrestricted**.
7. Before each hike: start a **Hiking** workout on the watch and wear it snug, above the wrist bone.

---

## 11. Test Plan

### 11.1 Pilot checklist (do this alone first)

| Test | Pass condition |
|---|---|
| 20-minute walk with a watch workout running | HR samples present for at least 80% of 10 s bins |
| Walk with the watch workout **not** running | App shows "Sparse HR" in Data check (confirms the warning works) |
| Screen off for 15 minutes | GPS points continue throughout |
| Reminder every 5 min (test setting) | Notification arrives with the screen off, and tapping opens the questions |
| Airplane mode for the whole session | App records fully; weather is manual or empty; no crash |
| Force-close the app mid-session | Recovery prompt appears on relaunch; no data lost |
| Pull from Health Connect twice | No duplicate samples |
| Export, then open CSVs in Excel or Python | Columns match section 7; timestamps are UTC |
| 3-hour session | Battery drain within NFR-3 |

### 11.2 Acceptance criteria (definition of done)

- [ ] Install via APK on a real Android phone, no Play Store.
- [ ] Onboarding detects and guides every permission.
- [ ] Full session works with the screen off.
- [ ] All five questions are saved with correct timestamps.
- [ ] HR and steps from the Galaxy Watch 6 are pulled after the session.
- [ ] Data check clearly flags missing or sparse heart rate.
- [ ] Exported CSVs match the lecture schema and load with `pandas.read_csv` without errors.
- [ ] No network calls other than the weather API.

---

## 12. Risks and What to Do

| Risk | Impact | Mitigation |
|---|---|---|
| Samsung Health writes sparse HR to Health Connect | Weak training data | Pilot first. Require a watch workout. If still sparse, switch to Phase 2 (Wear OS logger). |
| Sync delay after the hike | Missing tail of data | Retry button; wait a few minutes; re-export. |
| Phone GPS in a pocket or bag is noisy | Poor speed and slope | Store accuracy; filter later; keep the phone in a chest or hip pocket. |
| Android kills background work | Gaps in GPS or missed reminders | Foreground service, battery "Unrestricted", pilot test. |
| Weather API unavailable | No env data | Manual entry; compute from a later API fetch for the same time and location if needed. |
| Participant fatigue from questions | Skipped answers | Keep to 10 s; 10-minute default; allow 15. |
| Health Connect permissions or API changes | Build problems | Pin versions; read the current package docs. |
| Ethics and consent | Cannot use the data | Get approval before any volunteer session; keep the consent screen text editable. |

---

## 13. Out of Scope (Phase 2 Ideas)

- Wear OS companion app with live HR over the Wearable Data Layer (needed if Health Connect HR proves too sparse).
- Live risk prediction and alerts (this app only gathers data).
- Cloud upload or accounts.
- Phone barometer, skin temperature, SpO2 (can be added as optional Health Connect reads later).
- iOS.

---

## 14. Build Output

Deliverable: `hikelogger.apk` (a release or preview build that installs directly). Two ways to build, and the README should document the one that works:

| Method | When |
|---|---|
| **EAS Build** with an Android `apk` build profile | Easiest; needs a free Expo account; builds in the cloud. |
| **Local build**: `npx expo prebuild`, then Gradle `assembleRelease` | Needs Android SDK and JDK on your computer; no account needed. |

For testing on a connected phone during development: `npx expo run:android`.
