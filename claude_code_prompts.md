# Claude Code Prompt Pack: Build HikeLogger (React Native Android APK)

How to use this file:

1. Create an empty folder (for example `hikelogger`) and copy **`data_collector_app_spec.md`** into it. Claude Code will treat it as the source of truth.
2. Open the folder in Claude Code.
3. Paste **Section A** (CLAUDE.md) into a file called `CLAUDE.md`, or tell Claude Code: "Create CLAUDE.md with this content".
4. Then pick **one** path:
   - **Path 1 (recommended): staged prompts** (Section C). Smaller steps, easier to check, fewer mistakes.
   - **Path 2: master prompt** (Section B). One big prompt; faster but riskier.
5. Finish with Section D (build the APK) and Section E (review prompts).

---

## A. CLAUDE.md (project rules)

```markdown
# HikeLogger: project rules

## What this is
A minimal Android-only React Native (Expo, development build, TypeScript) app that
collects hiking data for ML training: GPS from the phone, heart rate + steps from the
Galaxy Watch 6 via Samsung Health -> Health Connect, weather, and five self-report
questions. It does NO AI and NO prediction.

Source of truth: ./data_collector_app_spec.md. Read it fully before coding.
If the spec and your assumptions disagree, the spec wins. If the spec is unclear
or technically impossible, STOP and ask me instead of guessing.

## Hard rules
- Keep it MINIMAL. No extra features, no accounts, no analytics, no cloud, no iOS.
- Android only. Not Expo Go: use a development build / prebuild.
- Never invent package APIs. Before using any library, read its installed README /
  docs in node_modules or its official docs, and follow the current setup steps.
- Never fabricate data. Missing values stay empty in exports. No interpolation in the app.
- Store raw data as received. Resampling to 10 s happens only at export time.
- Timestamps: store UTC (ISO 8601); export UTC with a trailing Z.
- Write each event to SQLite immediately (one write per event).
- No network calls except the Open-Meteo weather request. Round coordinates to 2 decimals.
- Participant identity is an anonymous code only. No names, emails or phone numbers.
- TypeScript strict mode. Small files, one responsibility each.
- After each stage: run type-check and lint, and tell me exactly what to test on the phone.
- Be honest about anything you could not verify (especially Health Connect behaviour
  and background location on real devices).

## Commands (fill in as the project is created)
- Type check: npx tsc --noEmit
- Run on phone: npx expo run:android
- Build APK: see README.md
```

---

## B. Master prompt (one-shot path)

```text
You are building "HikeLogger", a minimal Android data-collection app in React Native
(Expo development build, TypeScript). The full specification is in
./data_collector_app_spec.md. Read it completely first, and read CLAUDE.md.

GOAL
A volunteer starts a hiking session, the phone records GPS in the background, the app
asks five questions every N minutes, and after the hike the app pulls heart rate and steps
from Health Connect (originating from a Samsung Galaxy Watch 6 via Samsung Health),
then exports CSV files in the exact format from section 7 of the spec.

DO
1. Set up the project (Expo, TypeScript, development build for Android) and the
   libraries listed in section 8 of the spec. Read each library's current docs first.
2. Implement the SQLite schema from section 7.1 with simple migrations.
3. Implement all 11 screens from section 4, with plain, large-button UI.
4. Implement background GPS recording with an Android foreground service.
5. Implement repeating reminder notifications that open the five-question sheet.
6. Implement the Health Connect permission flow and the post-session pull of
   HeartRateRecord and StepsRecord (and ExerciseSessionRecord if simple), idempotent.
7. Implement the weather fetch (Open-Meteo) with manual fallback, and the heat-index
   calculation (NOAA formula, Celsius in and out) used only at export.
8. Implement the Data check metrics (FR-21) and traffic-light summary.
9. Implement export: sensor_log.csv (10-second grid, rules in section 7.2), env_log.csv,
   labels.csv, session_info.csv, raw_hr_samples.csv, shared through the Android share sheet.
10. Implement session recovery after an app kill (FR-3).
11. Write README.md: setup, running on a phone, building the APK (EAS and local Gradle),
    researcher setup checklist (spec section 10), and the pilot test plan (spec section 11).

DO NOT
- Add AI/ML, accounts, cloud sync, analytics, iOS support, or any feature not in the spec.
- Guess library APIs. If a library cannot do something, tell me and propose an alternative.
- Show live heart rate (the spec explains why).

WORKING STYLE
- First, reply with a short plan (files to create, libraries, risks, and any questions).
  Ask me only questions that truly block progress. Then wait for my "go".
- After "go", build in the stage order of the spec. After each stage, run
  `npx tsc --noEmit`, fix errors, and give me a 3-line phone test for that stage.
- At the end, list: what is done, what is NOT verified on a real device, and known risks.
```

---

## C. Staged prompts (recommended path)

Run these in order. Do not start the next stage until the current stage works on your phone.

### Stage 0: Plan and project setup

```text
Read CLAUDE.md and data_collector_app_spec.md completely.

Then:
1. Summarise back to me in under 15 lines what you understand you are building,
   including the one big constraint about Health Connect not being real time.
2. List any ambiguity, risk or impossibility you see in the spec. Ask me only
   questions that block progress.
3. Propose the exact library list and versions you will install, after checking each
   library's current docs, especially react-native-health-connect (setup, config plugin,
   manifest requirements, minimum SDK versions) and expo-location background tasks.

Do not write app code yet. Wait for my "go".
```

### Stage 1: Scaffold, database, navigation

```text
Go. Stage 1:
- Create the Expo TypeScript project in this folder (Android only, development build
  workflow, not Expo Go). Configure app.json / app.config for package name
  "com.hikelogger.app", app name "HikeLogger", and the Android permissions from spec
  section 8.1 (do not add permissions we do not use).
- Add expo-sqlite and implement the full schema from spec section 7.1 with a simple
  versioned migration system and a typed query layer in src/db/.
- Set up navigation and create placeholder screens for all 11 screens in spec section 4.
- Implement the Profile screen (screen 3) and Consent screen (screen 2) fully, saving to
  the profile table. Consent text is a clearly marked placeholder I will replace later.
- Implement Home (screen 4) listing sessions from the database (empty for now).

Finish with: npx tsc --noEmit, then a 3-line test I can do on my phone using
`npx expo run:android`.
```

### Stage 2: Onboarding checklist and permissions (no Health Connect reads yet)

```text
Stage 2: Implement the Onboarding checklist (screen 1):
- Items: Health Connect available, Health Connect permissions granted, Location granted,
  Notifications granted, Battery-optimization exemption, "Samsung Health sharing to Health
  Connect enabled" (manual confirm tick).
- Each failed item has a "Fix" button that triggers the right permission prompt or opens
  the right Android settings screen.
- For Health Connect: check availability (Android 14+ built in; older needs the app),
  request read permissions for HeartRate, Steps and ExerciseSession. Follow the
  library's current docs exactly, including any permission-rationale activity or
  manifest requirements.
- Persist the checklist status; allow re-checking from Settings.

Tell me honestly if any step needs a native config change, and what I must run
(for example a prebuild or rebuild). Finish with type-check and a 3-line phone test.
```

### Stage 3: Session start/end, GPS in the background

```text
Stage 3: Implement the session lifecycle and location recording:
- Pre-session screen (5): sleep_quality, water_carried_ml, clothing_note, session_note,
  reminder interval picker (5/10/15, default 10), and the reminder card telling the user to
  start a HIKING workout on the Galaxy Watch. Start creates the session row.
- Recording screen (6): elapsed time, distance, current speed, GPS accuracy indicator,
  "Answer now" (opens a placeholder for now), "End session" with confirmation.
- Background GPS: expo-location with expo-task-manager and a foreground service with a
  persistent notification. Insert each location update immediately into gps_point
  (about every 5 s). Raw data only; no filtering.
- Accuracy warning if accuracy > 30 m for over 2 minutes (FR-8).
- Session recovery after app kill (FR-3).

Finish with type-check and a phone test: record 10 minutes with the screen off, then
confirm gps_point rows exist (add a temporary debug count on Home).
```

### Stage 4: Reminders and the five questions

```text
Stage 4: Implement reminders and the labels:
- Repeating local notification at the session's interval with vibration, using an Android
  notification channel (high importance). Cancel all on session end.
- Questions sheet (screen 7) with exactly the five questions in spec section 2.1:
  RPE 1-10 with word hints, thirst 1-5, dizzy/cramp yes/no, drank water yes/no,
  rested yes/no. One screen, large buttons, Submit and Skip.
- Tapping the notification opens the sheet. "Answer now" opens it with trigger = manual.
- Save every prompt into prompt_answer with prompted_at_utc, answered_at_utc, trigger and
  status (answered / skipped / missed). Mark prompts still unanswered at session end as missed.
- Safety message when rpe >= 9 or dizzy/cramp = yes (exact wording in spec section 2.1).

Finish with type-check and a phone test: set interval to 5 minutes, lock the phone,
confirm the notification arrives and opens the sheet.
```

### Stage 5: Weather and heat index

```text
Stage 5: Implement environment data:
- At session start and about every 30 minutes while online, fetch air temperature and
  relative humidity from Open-Meteo for the current coordinates rounded to 2 decimals
  (check the current Open-Meteo API docs for the right parameters; no API key).
- If offline at start, show optional manual temperature/humidity inputs on the Pre-session
  screen; store source = manual.
- Save rows in env_reading. Never block recording if the fetch fails.
- Implement src/utils/heatIndex.ts (NOAA Rothfusz regression with the simple formula
  for cooler conditions, Celsius in and out). Add a tiny unit test file with 3 known values.

Finish with type-check and tests. Phone test: start a session online and offline.
```

### Stage 6: Health Connect pull and Data check

```text
Stage 6: Implement the post-session watch data pull:
- Sync screen (8): clear instructions (open Samsung Health, let the watch sync, come back),
  a "Pull from Health Connect" button, progress, and a result summary.
- Read HeartRateRecord samples and StepsRecord intervals for
  [start_utc - 1 min, end_utc + 5 min]. Read ExerciseSessionRecord if simple, to show
  "Watch workout found: yes/no".
- Store raw samples in hr_sample and steps_interval. Make re-pulls idempotent
  (no duplicates). Handle denied permission and unavailable Health Connect gracefully.
- Data check screen (9): HR sample count, average HR gap in seconds, % of 10 s bins with
  at least one HR sample, steps total, GPS point count, GPS median accuracy, label count,
  weather row count, watch workout found, and a traffic light:
  Good (>= 80% bins with HR), Sparse HR (10-79%), Missing (< 10%).

Be explicit with me about what you could verify and what only a real Galaxy Watch 6 pilot can
verify. Finish with type-check and a phone test: walk 20 minutes with a watch workout
running, sync, pull, and read the Data check.
```

### Stage 7: Export

```text
Stage 7: Implement export (screen 10) exactly per spec section 7.2:
- Build the 10-second grid from start_utc to end_utc (UTC).
- sensor_log.csv columns and binning rules as in the spec: HR mean per bin or empty,
  cumulative steps, last GPS point per bin or empty, hr_sample_count.
  Never interpolate or invent values.
- env_log.csv (with heat_index_c computed at export), labels.csv, session_info.csv
  (including app_version and device_model), raw_hr_samples.csv.
- Write files to app-private storage in a folder like S014_U03/, then share via the Android
  share sheet (expo-sharing). Zip them only if a well-maintained library makes it easy;
  otherwise share the files directly.
- CSV hygiene: header row, comma separator, UTF-8, quotes around text with commas or
  newlines, empty string for missing values.
- Add a small test that builds sensor_log for a fake session and checks row count, column
  names and one binned value by hand.

Finish with type-check and a phone test: export, send to myself, open in Excel or run
pandas.read_csv on it.
```

### Stage 8: Polish and README

```text
Stage 8: Finish up:
- Settings screen (11): default reminder interval, "Delete all local data" with a double
  confirmation, app version, link to re-run the onboarding checklist.
- Handle empty states, errors and loading states on every screen with plain wording.
- Go through spec sections 5 and 6 line by line and give me a table: requirement ID,
  done / partly / not done, and where in the code. Be honest.
- Write README.md: what the app is, how to run it, how to build the APK (both methods),
  the researcher's setup checklist (spec section 10), the pilot test plan (spec section 11),
  and a short "Known limitations" section.
```

---

## D. Build the APK

```text
Produce an installable Android APK.

1. Check the current Expo documentation, then choose the simplest method that works for
   this project. Prefer EAS Build with a profile named "preview" that outputs an APK
   (not an AAB), unless I tell you I want a local Gradle build.
2. Create or update eas.json (or the Gradle config) accordingly. Do not commit any secrets.
3. Give me the exact commands to run, including login steps, in order. If a step needs my
   account or machine, say so clearly and stop there.
4. Explain how to install the APK on my phone (allow installs from unknown sources, send
   the file by USB, Drive or WhatsApp) and how to confirm the version number inside the app.
5. Add a "Release checklist" to README.md: type-check passes, pilot test passed, consent
   text replaced, app version bumped.
```

---

## E. Review and debugging prompts

### Independent code review

```text
Review the whole project against data_collector_app_spec.md. Do not change code yet.
Produce a table of findings: severity (blocker / major / minor), where, what is wrong, and
the fix. Focus on: data loss risks, Health Connect usage correctness, background location and
notification reliability on Android, timezone and UTC handling, duplicate rows, CSV format
correctness, privacy (any unexpected network call), and anything beyond the minimal scope.
```

### Data correctness check

```text
Create a small Python script in /tools/check_export.py that takes an exported session
folder and verifies: column names match spec section 7.2, timestamps are strictly increasing
10 s steps in UTC, no duplicate rows, hr_bpm in 30-230 or empty, speed >= 0 or empty,
labels.csv values are in range (rpe 1-10, thirst 1-5), and prints a summary of
missing-value percentages per column. No third-party libraries beyond pandas.
```

### When Health Connect returns little or no heart rate

```text
Heart rate from Health Connect is sparse or empty in my pilot. Do not guess.
1. Add temporary diagnostic logging in the Data check screen: list the data origin
   (package name) of each record, record time ranges, and sample counts, for the last 3 hours.
2. Tell me, from the current Health Connect and library docs, the likely reasons
   (Samsung Health sharing off, no watch workout, permission scope, time window, sync delay).
3. Give me a step-by-step checklist to test on my phone and watch.
4. If the data is fundamentally too sparse, outline (do not build yet) a Phase 2 option:
   a Wear OS logger using the Wearable Data Layer, with the data flow and effort estimate.
```

### When background tracking stops

```text
GPS recording stops or has gaps when the screen is off. Do not guess.
1. Review the foreground service and task registration against the current expo-location
   and expo-task-manager docs, and Android foreground-service type requirements.
2. List the likely causes (battery optimisation, missing permission, service not started
   from foreground, notification channel) and how to check each on my phone.
3. Fix only what the evidence supports, and add a debug line on the Recording screen
   showing the time of the last saved GPS point.
```

---

## F. Tips for working with Claude Code on this project

- **Keep the spec in the folder** and tell Claude Code to re-read it when a stage feels off.
- **Test every stage on the real phone** before moving on. Background GPS, notifications and Health Connect cannot be trusted from emulator behaviour.
- **Commit after each stage** (`git init`, then a commit per stage) so a bad stage is easy to undo.
- **Do the pilot walk early** (after Stage 6). If heart rate is sparse, you learn it in week 1, not week 6.
- **Replace the consent text only after ethics approval**, and bump the `consent_version` when you do.
- If Claude Code claims something works but cannot have tested it (for example Health Connect on a real Samsung watch), treat it as unverified until your pilot confirms it.
