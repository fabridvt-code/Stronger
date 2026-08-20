# Deploying Stronger

Stronger is a Next.js app with one server route (`/api/import`, which keeps the AI key
server-side). It needs a host that runs Next.js server code — **not** classic static
hosting. Cloud sync + auth run on **Firebase (Firestore + Auth)**, which is free on the
Spark plan and works from any host.

The app is local-first, so it works the moment it loads; AI import and cloud sync are
optional add-ons enabled with environment variables.

## Which host?

| Option | Cost | Notes |
|--------|------|-------|
| **A — Vercel + Firebase Spark** ⭐ | **Free** | Vercel's free tier runs Next.js + the `/api/import` function. Firestore + Auth stay on Firebase's free plan. **Recommended if you don't want a paid Firebase plan.** |
| **B — Firebase App Hosting** | Needs **Blaze** (pay-as-you-go, scales to zero) | Everything in one Google project. Requires enabling billing. |

Both use the same Firebase Firestore + Auth setup (section **Firebase** below). Only the
frontend host differs.

---

# Option A — Vercel (free) + Firebase (free)  ⭐

1. Push this repo to GitHub.
2. Go to <https://vercel.com>, "Add New Project", import the repo. Vercel auto-detects
   Next.js — no config needed.
3. In the project's **Settings → Environment Variables**, add:
   - `GEMINI_API_KEY` = your key from <https://aistudio.google.com/apikey>
   - `GEMINI_MODEL` = `gemini-2.5-flash` (optional)
   - `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
     `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` (from Firebase, see below)
4. Deploy. Every push to `main` redeploys automatically.
5. Do the **Firebase (Firestore + Auth)** setup below — it's free on the Spark plan.

That's it: full app, AI import, and multi-device sync at zero cost.

---

# Firebase setup (Firestore + Auth) — free on Spark

Needed for cloud sync + sign-in, whichever host you pick. **No Blaze required.**

1. Create a project at <https://console.firebase.google.com>.
2. **Authentication → Sign-in method**: enable **Email/Password** (and **Google** for the
   "Continue with Google" button).
3. **Firestore Database**: create it (production mode).
4. Deploy the security rules from this repo:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules
   ```
   ([`firestore.rules`](firestore.rules) restricts each user to `users/{uid}/documents/**`.)
5. **Project settings → Your apps → Web app**: copy the config values into your host's env
   vars (`NEXT_PUBLIC_FIREBASE_*`). They're public by design — access is enforced by the rules.
6. If you deploy on Vercel, add its domain under **Authentication → Settings → Authorized
   domains** so Google sign-in works.

---

# Option B — Firebase App Hosting (requires the Blaze plan)

Use this only if you want everything inside one Google project and are willing to
enable the **Blaze** plan (it scales to zero, so idle cost is effectively nil).

1. Push the repo to GitHub; install the CLI (`npm i -g firebase-tools`, `firebase login`).
2. Create the backend: `firebase init apphosting` — connect the GitHub repo, `main` branch,
   repo root. `apphosting.yaml` already configures the runtime.
3. AI key as a secret: `firebase apphosting:secrets:set GEMINI_API_KEY`, then uncomment the
   `GEMINI_API_KEY` block in `apphosting.yaml`.
4. Fill in the `NEXT_PUBLIC_FIREBASE_*` block in `apphosting.yaml` (from the Firebase setup
   above).
5. `git push origin main` → App Hosting builds and rolls out. Your app goes live at the
   generated URL. Open it on your phone and **Add to Home Screen** to install the PWA.

## What works after each step

| Configured | Works |
|-----------|-------|
| Nothing (just deployed) | Full app: builder, execution, timer, history, progression, analytics, export — all local-first. Text import via the deterministic parser. |
| `GEMINI_API_KEY` | AI import from messy text, photos, and scanned PDFs. |
| `NEXT_PUBLIC_FIREBASE_*` + rules deployed | Sign-in + multi-device cloud sync via Firestore. |

## Any other host

Anything that runs `next build` + `next start` works (Netlify, Cloudflare Pages, Render,
a VPS…). The only hard requirement is a Node runtime for the `/api/import` route.
