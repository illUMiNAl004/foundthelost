# foundthelost

A map-first lost & found platform for college campuses. **Make lost temporary.**
Pilot: UMass Amherst.

Students report what they lost or found, an AI matching engine privately pairs them,
and the map shows exactly where to go. Not a public bulletin board — you only ever see
items matched to you.

## Stack

- **React 18 + Vite** — SPA
- **Tailwind CSS** — design system (cream / lime / coral, General Sans + JetBrains Mono)
- **MapLibre GL v5** — 3D vector campus map + globe intro
- **Framer Motion** — animation
- **Supabase** — Postgres, Auth, RLS, Storage, Realtime (the backend)
- **Gemma 4** (open weights, multimodal) via OpenRouter or Google AI Studio — Snap & Fill vision,
  called from a **Netlify Function** so the key never reaches the browser

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173
```

The app runs in **demo mode** out of the box — no backend needed. All data persists to
`localStorage`, including real matching. Use the avatar menu → **Reset demo data** to start fresh.

Out of the box you land on the **waitlist** screen after the intro; tap *sign in ↗* → *explore the
demo* to get into the app. Set `VITE_WAITLIST=off` to skip the waitlist entirely.

### Snap & Fill (photo → fields) locally

```bash
cp .env.example .env.local      # add OPENROUTER_API_KEY or GEMINI_API_KEY
npm run dev                     # /api/vision is served by a Vite middleware in dev
```

Without a key the photo path shows "Photo AI isn't connected" and offers the text path.

## Going live (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → run the migrations **in order**, one file per run:
   `001` (schema — ⚠️ drops everything, run once on a fresh project only) → `002` (aliases,
   lexicon, matching v2) → `003` (matching v3: brands, materials, graded colour) →
   `004` (connector fixes: karma ledger, chat policies, realtime, `mark_returned`, read receipts)
   → `005` (private `item-photos` Storage bucket + policies) → `006` (waitlist RPCs) →
   `007` (invite-only sign-up gate + admin approval helpers) → `008` (pen ≠ pencil case vocabulary fix).
   004–008 are idempotent; re-running them is safe.

### Letting people in (hype phase)

Sign-up is **invite-only** until you flip it: the database trigger refuses any account whose
email you haven't approved on the waitlist. From the SQL editor:

```sql
select public.approve_waitlist(array['you@umass.edu', 'friend@umass.edu'], 'pilot testers');
select public.approve_next_in_line(50, 'wave 1');   -- next 50 by position
select public.revoke_waitlist(array['x@umass.edu']);
select public.set_signup_mode('open');             -- launch day: anyone @umass.edu
```

Refused sign-ups see "Not off the list yet" with a button back to the waitlist. There's no
mailer yet — email approved people yourself (or add one; see HANDOFF).
3. **Authentication → Providers → Email**: keep email confirmations **on**.
4. **Settings → API** → copy the Project URL + anon key.
5. `cp .env.example .env.local` and fill them in (plus a vision key, see below).
6. Restart `npm run dev`. The app now uses Supabase for auth, data, matching, chat and photos.

When `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are absent, the app stays in demo mode.

### Environment variables

| Name | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | browser | Supabase project (public by design; RLS protects data) |
| `OPENROUTER_API_KEY` **or** `GEMINI_API_KEY` | **server only** | Snap & Fill vision. OpenRouter wins if both set |
| `VISION_MODEL` | server only | override the Gemma model id (default `google/gemma-4-31b-it` / `gemma-4-31b-it`) |
| `VITE_WAITLIST` | browser | `on` (default) = waitlist after the intro; `off` = launched flow |

On Netlify, set all of these under *Site configuration → Environment variables*. The vision keys
are read by `netlify/functions/vision.mjs` only.

### Testing the database locally

`scripts/db-test/run.sh` spins the migrations up against a throwaway Postgres with a Supabase
auth/storage shim and runs 70+ RLS / RPC / matching-parity checks. See `scripts/db-test/README.md`.

## Security posture

- **RLS on every table.** Items are private by default — you only read your own.
- **Found items are revealed only through matches**, never by browsing.
- **Matching is server-side** (`match_item`, a `SECURITY DEFINER` function). Clients have
  no insert path into `matches`, so a match can't be forged to peek at someone's item.
- **Karma is a server-side ledger** (`karma_events`) — clients can't write their own score.
- **Chats can only be opened between the two parties of a real match** (`is_match_pair`).
- **Photos are private** (`item-photos` bucket): readable by the owner and by whoever is
  matched to that item, via the same `item_visible_to_me` rule as the row itself.
- **Vision runs server-side** with a Supabase session check, so only signed-in students can
  spend model credits. The model is asked never to transcribe ID/card numbers or full names.
- **Waitlist table has RLS and no policies** — only two definer RPCs touch it, and they return
  the caller's own position + referral code, never any email.
- **One scoring spec, two runtimes.** `src/lib/scoring.js` (demo) and the SQL `match_item`
  (live) implement the *same* spec: a must-match item-identity gate + per-feature weighted
  score + semantic floor. Different known item types (laptop vs phone) are hard-rejected,
  so place+time proximity alone can never forge a false match.
- **@umass.edu enforced at the database** via the signup trigger (client checks are just UX).
- **No email/PII** in the readable `profiles` table — only name + karma (the leaderboard).
- **Security headers + CSP** set in `netlify.toml`.
- The anon key is public by design; it's safe *because* of RLS. The `service_role` key must
  never appear in this repo or the frontend. `.env*` is gitignored.

## What's real vs. demo (status)

**Working now (demo + live):**
- Pre-launch **waitlist**: founding-member tier (first 500), referral milestones, launch giveaway,
  a "what did you last lose?" sticker game, and a **live** counter streamed over Realtime
- Globe intro, 3D map, sticker pins, lost→found path
- Three-tab private sheet (matches / lost / found), report flows
- **Snap & Fill** — real vision: photo → item / colour / brand / material / distinctive marks /
  sensitive flag, plus location from the photo's EXIF GPS or the phone. The answer is rendered
  as a sentence and run through the *same* parser and matching engine as typed reports.
- Private **photo storage** on found items (owner + matched party only)
- Matching engine with transparent score breakdown (JS and SQL agree pair-for-pair)
- Karma ledger + leaderboard, **realtime** in-app chat with read receipts, mark-as-returned
  (+50 karma, closes both items), UMass-email auth with password reset
- Standalone landing page (`public/landing.html`)

**Not yet built:**
- **Push / email notifications** on match (matches appear on next open).
- **Proof-of-ownership** step for sensitive items (IDs, cards).
- **Admin dashboard** for campus staff; lexicon moderation UI.
- **Waitlist emails** (confirmation / launch announcement) — the table is ready, no mailer yet.

## License

© 2026 foundthelost. All rights reserved.
