# Stronger — Local-First Training Tracker

A mobile-first, offline-capable PWA that turns a workout program (from a coach, text,
or manual entry) into a structured, trackable, progressive training system.

Built on the strict domain principle: **PROGRAMMED** (the plan) / **PERFORMED**
(what you did — an append-only log) / **RECOMMENDED** (derived, never stored as truth)
are kept separate and never overwrite each other.

## Status

Built incrementally; every stage leaves the project runnable. **42 unit tests green**,
production build clean, full training loop verified end-to-end in the browser.

**Working now:**
- Pure, tested **domain core** (42 tests)
  - Progression engine: double / linear / RIR / RPE / percentage / rep-target / manual
  - Substitution engine: transparent weighted similarity + ranking + filtering
  - Deterministic import parser (English + Italian gym shorthand)
  - Analytics primitives: e1RM (Epley), volume, PR detection; RIR↔RPE (flagged approximate)
- **Local-first persistence** — Dexie/IndexedDB, repository write-boundary, `SyncOperation` queue
- **Exercise Library** — 56 seeded exercises, live search (name/alias/muscle/equipment,
  accent- and multilingual-aware), pattern/equipment filters
- **Exercise detail + Alternatives** — live substitution with similarity % + per-axis breakdown
- **Workout Builder** — create program, add training days, add/remove/reorder exercises,
  configure sets (warm-up/working/back-off/drop/AMRAP), rep ranges + RIR
- **Workout Execution** — the mobile-first crown-jewel screen: per-set load/reps/RIR logging,
  smart defaults, offline rest timer (±15s, pause, skip, beep+vibration), progress bar
- **Post-workout summary** — PROGRAMMED / PERFORMED / RECOMMENDED per exercise with rationale
- **AI import** — provider-agnostic server route (**Gemini** by default, Claude optional via
  `AI_PROVIDER`) with a strict schema + confidence + NEEDS_REVIEW, falling back to the
  deterministic parser offline / without a key; editable review screen. Accepts **text, PDF
  (text layer extracted client-side via pdf.js), and photos / scanned PDFs (vision)**
- **Cloud sync + auth** — Firestore adapter (`SyncProvider`) + Firebase Auth (email/password &
  Google), autosync on reconnect/heartbeat, status in Settings; security in `firestore.rules`
- **Analytics** — estimated-1RM trend, weighted sets-per-muscle (30d), sessions-per-week
  (Recharts, mobile-friendly); automatic PR detection
- **Sync engine** — tested offline→queue→push→pull→conflict-resolution runner against a
  provider interface (append-only performed sets w/ idempotency; last-writer-wins for
  programmed rows; tombstones). MemoryProvider backs the tests; the Firestore adapter is live.
- **Settings** — units, effort system, rest defaults; **data export/import** (JSON + CSV)
- **PWA** — manifest, service worker (installable, offline shell), persistent-storage request

**Deferred (by plan):** AI coach (natural-language queries over real data); advanced
autoregulation; wearables/health integrations; drag-and-drop reorder (uses ↑/↓ buttons today).

## Requirements

- Node.js 20+ (developed on 24)

## Setup

```bash
npm install
```

## Run (development)

```bash
npm run dev
```

Open http://localhost:3000. On first load it seeds the exercise library into IndexedDB.

## Test

```bash
npm test          # run the domain test suite once
npm run test:watch
```

## Production build

```bash
npm run build
npm start
```

## Type check

```bash
npm run typecheck
```

## Environment (all optional — the app is fully local without any of it)

Copy `.env.example` to `.env.local`.

- **AI import (Gemini)** — set `GEMINI_API_KEY`. Without it, text/PDF-with-text import uses the
  deterministic parser; only photo / scanned-PDF import (vision) needs the key. Claude is
  available as an alternative via `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`.
- **Cloud sync + auth (Firebase)** — set the `NEXT_PUBLIC_FIREBASE_*` values.

### Enabling cloud sync (Firebase / Firestore)

1. Create a Firebase project, enable **Authentication** (Email/Password, optionally Google)
   and **Firestore**.
2. Deploy the rules: `firebase deploy --only firestore:rules` ([`firestore.rules`](firestore.rules)
   scopes each user to `users/{uid}/documents/**`).
3. Paste your web app config into `.env.local` (`NEXT_PUBLIC_FIREBASE_*`), restart `npm run dev`.
4. Open **Settings → Account & cloud sync**, create an account or sign in. Your queued
   local changes sync up automatically; other devices pull them down.

Full step-by-step (host + AI + sync) is in [`DEPLOY.md`](DEPLOY.md).

Conflict handling: performed sets are append-only + idempotent (never duplicated);
programmed rows use last-writer-wins by `updatedAt`; deletes are tombstoned. The engine
and its conflict rules are covered by integration tests (`src/lib/sync/engine.test.ts`).

## Architecture

- **Frontend:** Next.js (App Router) + React + TypeScript + Tailwind
- **Local DB:** IndexedDB via Dexie (`src/lib/db.ts`)
- **Write boundary:** all mutations go through `src/lib/repo.ts`, which stamps sync
  metadata and enqueues a `SyncOperation`. Reads use Dexie liveQuery directly.
- **Domain:** framework-agnostic pure TypeScript under `src/domain/` (no React/DB imports),
  fully unit-tested. This is what makes the logic portable and testable.

```
src/
  domain/            pure logic (no framework) — the tested heart
    values/          RIR/RPE, load rounding, taxonomy enums
    exercises/       seed library + search
    progression/     deterministic progression engine (+ tests)
    substitution/    similarity/substitution engine (+ tests)
    analytics/       e1RM, volume, PRs
    types.ts         PROGRAMMED / PERFORMED / RECOMMENDED entities + SyncMeta
  lib/               persistence + app services
    db.ts            Dexie schema + SyncOperation queue
    repo.ts          write boundary (sync-aware)
    queries.ts       read helpers
    backup.ts        export/import (JSON/CSV)
  app/               Next.js routes (Dashboard, Library, Exercise, Programs, Progress, Settings)
  components/        shared UI
public/              manifest + service worker + icons
```

## Deploy

**Free path:** host on **Vercel** (free tier runs Next.js + the `/api/import` function) and
use **Firebase Spark** (free) for Firestore + Auth — no paid plan needed. Firebase App
Hosting is an alternative but requires the Blaze plan. Full steps in [`DEPLOY.md`](DEPLOY.md).
The app is local-first, so it functions without any backend; the service worker + IndexedDB
provide offline use and "Add to Home Screen".

## Honest PWA limitations

A PWA is not identical to a native app. On iOS especially: background sync is limited,
storage can be evicted under pressure (we request persistent storage to mitigate), and
install is a manual "Add to Home Screen". Export your data periodically as a backup.

## Not a medical device

Stronger is a training-management tool. It does not diagnose injuries or provide medical
advice. If you experience pain, stop and consult a qualified professional. All automated
recommendations can be overridden.
