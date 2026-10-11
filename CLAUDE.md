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
- Lint: npx expo lint (ESLint pinned to v9; v10 breaks eslint-plugin-react; install with --legacy-peer-deps)
- Run on phone: npx expo run:android
- Build APK: see README.md
```
