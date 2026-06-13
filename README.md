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
- **Supabase** — Postgres, Auth, RLS (the backend)

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173
```

The app runs in **demo mode** out of the box — no backend needed. All data persists to
`localStorage`, including real matching. Use the avatar menu → **Reset demo data** to start fresh.

## Going live (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → run `supabase/migrations/001_foundthelost_schema.sql`.
3. **Authentication → Providers → Email**: keep email confirmations **on**.
4. **Settings → API** → copy the Project URL + anon key.
5. `cp .env.example .env.local` and fill them in.
6. Restart `npm run dev`. The app now uses Supabase for auth, data, and matching.

When `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are absent, the app stays in demo mode.

## Security posture

- **RLS on every table.** Items are private by default — you only read your own.
- **Found items are revealed only through matches**, never by browsing.
- **Matching is server-side** (`match_item`, a `SECURITY DEFINER` function). Clients have
  no insert path into `matches`, so a match can't be forged to peek at someone's item.
- **@umass.edu enforced at the database** via the signup trigger (client checks are just UX).
- **No email/PII** in the readable `profiles` table — only name + karma (the leaderboard).
- **Security headers + CSP** set in `netlify.toml`.
- The anon key is public by design; it's safe *because* of RLS. The `service_role` key must
  never appear in this repo or the frontend. `.env*` is gitignored.

## What's real vs. demo (status)

**Working now (demo + live):**
- Globe intro, 3D map, sticker pins, lost→found path
- Three-tab private sheet (matches / lost / found), report flows
- Matching engine with transparent score breakdown
- Karma + leaderboard, in-app chat ("text portal"), UMass-email auth
- Standalone landing page (`public/landing.html`)

**Mocked / not yet built:**
- **Snap & Fill** — the photo→fields step is a scripted animation; no real vision model yet.
- **Photo upload / storage** — bucket + policies are stubbed in the migration.
- **Push notifications** on match.
- **Proof-of-ownership** step for sensitive items (IDs, cards).
- **Admin dashboard** for campus staff.
- Chat is local in demo; live chat conversations aren't auto-created from a confirmed match yet.

## License

© 2026 foundthelost. All rights reserved.
