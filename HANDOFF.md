# foundthelost — Engineering Handoff (parsing + matching overhaul)

> Onboarding a fresh agent? Read this file, then `git log` for branch
> `claude/found-lost-matching-overview-4v7ig6` (PR #5) and PR #4. The diffs +
> commit messages cover the *what/how*; this file covers the *why*, the open
> decisions, and the backlog that isn't visible from code alone.

## 0. Context
Map-first campus lost & found (UMass Amherst). Privacy model: users only ever see
found items **matched** to their own lost reports — never a public board. Two runtimes:
- **Demo mode** — no Supabase env vars → all data + matching in `localStorage`.
- **Live mode** — Supabase Postgres + Auth + RLS; matching runs server-side.

`src/lib/api.js` is the single data layer; it branches on `useDemo(user)` for every op.

## 1. Architecture / data flow
```
ReportFlow.jsx ──draft──► App.handleReportSubmit ──► api.createItem(user, draft)
  │ HighlightedInput          │                          │
  │ ChipRow / RefineDetails    │                    demo ─┴─ live
  │ extract.parseDescription   │              matching.js     match_item() SQL
  │   ├─ campusPlaces (places)  │              └─ scoring.js   (002 migration)
  │   ├─ dictionary (item/color/time)              ▲ SAME SPEC ▲
  │   ├─ fuzzy.js (did-you-mean)                    │
  │   └─ lexicon.js (self-learning) ────────────────┘ learnTerms on submit
  └──────────────────────────► getMyItems → Matches / Lost / Found tabs
```

## 2. Files created
| File | Purpose |
|---|---|
| `src/data/dictionary.js` | Canonical `ITEMS`, `COLORS`, `TIME_BUCKETS` (id + label + aliases) from the data-dictionary PDF. |
| `src/lib/fuzzy.js` | `levenshtein`, `ratio`, `dice` (trigram), `bestMatch(token, candidates, threshold)`. Typo/incomplete-word suggestions. |
| `src/lib/lexicon.js` | Self-learning store. `learnTerms`, `learnedEntries`, `lexiconVersion`, `hydrateLearned`, `resetLexicon`. |
| `src/lib/scoring.js` | **Single source of truth** for matching. `featurize`, `scorePair`, `WEIGHTS`, `MATCH_THRESHOLD`, `SEM_FLOOR`, `hoursAgo`, `metersBetween`. |
| `src/components/HighlightedInput.jsx` | Textarea with a colored highlight layer; exports `TYPE_STYLE`. |
| `supabase/migrations/002_matching_v2.sql` | `ftl_aliases` table + seed, canonicalization fns, gated/floored `match_item`, `lexicon` table + `bump_lexicon`. |

## 3. Files rewritten / modified
| File | Change |
|---|---|
| `src/data/campusPlaces.js` | Full gazetteer (`NAMED_PLACES` + `RES_HALLS` by area + `AREA_COORDS`). `matchPlace`, `annotatePlaces`, `searchPlaces`, `normalize`. Whole-word + longest-match. `AMBIGUOUS_DORM` denylist. |
| `src/lib/extract.js` | `annotate(text)` → positioned spans; `parseDescription` returns `{chips, title, category, color, place, coords, time, spans, suggestions, unknownTokens}`. `getEntries()` merges base dict + learned aliases by `lexiconVersion()`. |
| `src/lib/matching.js` | Thin wrapper; re-exports from `scoring.js`; `findMatches` skips `gated` pairs. |
| `src/lib/api.js` | `learnFromDraft` (learns on submit + mirrors to `bump_lexicon` live), `hydrateLexicon` (live), `createItem` returns `{item, instantMatch, learned}`. |
| `src/components/ReportFlow.jsx` | `HighlightedInput`, `ChipRow`, `RefineDetails` (brand/color prompts), `addWord` appender. |
| `src/App.jsx` | `toast` state + "Learned a new word" UI. |
| `README.md` | 002 migration + unified-engine notes. |

## 4. Parser spec (`extract.js`)
- **`annotate`**: regex `\b<alias>\b` per alias (spaces → `\s+`), longest-alias-first, non-overlapping greedy claim. Adds clock (`2pm`, `2:30 pm`) + relative-day (`today/yesterday/tonight/last night`) spans.
- **Whole-word matching** kills substring bugs (`som`∉somewhere, `woo`∉wood).
- **Chips = surface text** the user typed (NOT relabeled). `{text, type, learned}`; types `place|item|color|time|qualifier`.
- **Title** = title-cased surface color + item + qualifiers ("Navy Hydro Flask", "Keychain"). Canonical ids drive matching, never shown.
- **`suggestions`** = fuzzy "did you mean" for uncovered tokens (len≥4, not in `STOP`) via `bestMatch` over `FUZZY_POOL`. Never auto-applied.
- **`unknownTokens`** = uncovered content tokens fed to the learner.

## 5. Matching spec (`scoring.js`) — mirrored in SQL
```
WEIGHTS = { semantic:0.45, attributes:0.20, location:0.20, time:0.15 }
MATCH_THRESHOLD = 55   SEM_FLOOR = 0.30
```
`featurize(item, coordsOverride)` → `{itemId, category, colorIds:Set, tokens:Set(itemId + unknownTokens), coords, timeH}` (runs `parseDescription` on `name + details`).

`scorePair(lost, found)`:
1. **GATE — item identity**: both `itemId` known and different → `{score:0, gated:true, reason:'item'}`.
2. **GATE — color**: both have colors and share none → `{score:0, gated:true, reason:'color'}`. (Synonyms collapse first: navy/blue → `blue`, so they don't gate.)
3. **semantic**: itemId equal → 0.9; else `max(0.05 if both known, jaccard(tokens))`.
4. **attributes**: category match 0.6 + (color overlap 0.4 | unknown-color neutral 0.2), capped 1.
5. **location** tiers (m): ≤50→1, 120→.9, 250→.78, 500→.6, 1000→.42, 2000→.25, else .1.
6. **time** tiers (|Δh|): ≤2→1, 6→.9, 24→.78, 48→.6, 168→.4, else .2; ×0.8 if found reported >24h *before* loss (asymmetric).
7. **composite** = Σ w·score; **if semantic < SEM_FLOOR → cap composite at 0.50** (can't cross 55 on place+time+category alone).
8. score = round(composite·100); breakdown `{semantic,attributes,location,time,meters}`.

Verified: AirPods↔AirPods 88, Flask↔Flask 84, all decoys gated 0, laptop↔phone gated, laptop↔laptop 100, black↔white AirPods gated (color), navy↔blue flask 100.

## 6. Self-learning (`lexicon.js` + `002`)
- localStorage key `ftl-lexicon-v1`, `PROMOTE_AT = 2`.
- `learnTerms(tokens)`: increments pending counts; on recurrence promotes → if `bestMatch(≥0.82)` to existing canonical, adds as alias; else registers its own `other` keyword. Returns promoted `[{alias,label,correlatedTo}]`.
- Live: `bump_lexicon(term)` RPC (SECURITY DEFINER, promotes at count≥2, status `pending`→`learned`); `hydrateLexicon` pulls `status='learned'` rows into the parser on load.
- Parser rebuilds its entry table when `lexiconVersion()` changes.

## 7. SQL (`002_matching_v2.sql`)
- `ftl_aliases(term, kind, canonical, category)` seeded from the JS dictionary (generated — guarantees parity).
- `ftl_canonical_item`, `ftl_category_of`, `ftl_colors`: whole-word longest-match via Postgres regex `\m<term>\M` (spaces→`\s+`), `order by length(term) desc`.
- `match_item`: same gates (item + color), same weights/tiers, same semantic floor.
  **Approximation**: when neither side has a known item word, uses `pg_trgm similarity()` as a stand-in for JS token-Jaccard.
- RLS: `ftl_aliases`/`lexicon` readable to authenticated; `bump_lexicon` executable by authenticated only.
- **Run order**: `001_foundthelost_schema.sql` → `002_matching_v2.sql`.

## 8. NOT yet integrated (next-phase backlog)
1. **Snap & Fill (vision)** — `ReportFlow` photo path is scripted (`AI_FIELDS` hardcoded AirPods). No real image→fields model; photo upload/storage bucket still stubbed in `001`.
2. **Exact coordinates** — dorms use area centroids; building coords are estimates. Need real lat/lng to replace `AREA_COORDS`/`NAMED_PLACES` coords.
3. **Brand as a first-class signal** — `RefineDetails` appends brand as plain text → becomes an `unknownToken` (helps semantic Jaccard, can self-learn). OPEN DECISION: make brand a recognized entity type (highlightable) + choose **soft weight vs hard gate** (Apple earbuds ≠ Bose earbuds). Recommendation: soft brand weight, keep color as the hard gate.
4. **Real occurrence time (live)** — `occurred_at` defaults to `now()`; report flow never captures when the item was lost/found. Time-of-day buckets are parsed but not converted to a timestamp/window → time signal weak in live. Add a time picker → store `occurred_at`; map buckets to windows.
5. **Committed tests + JS↔SQL parity harness** — current tests are ad-hoc node scripts (were in `/tmp`, NOT committed). Add a real suite + a harness that feeds identical fixtures to `scorePair` and a local Postgres `match_item` to assert equal scores.
6. **Lexicon moderation** — `bump_lexicon` promotes globally at count≥2 with no review; add admin moderation/abuse guard before trusting learned terms in production.
7. **Push notifications on match**, **proof-of-ownership for sensitive items**, **admin dashboard** — still unbuilt (per README).
8. **Richer attributes** — size, pattern, distinctive marks; multi-color handling (two-tone items could falsely color-gate, rare).
9. **Optional semantic upgrade** — Transformers.js embeddings behind the same `semantic()` interface for fuzzy descriptions.
10. **Re-matching cadence** — `match_item` runs only on item creation; no periodic re-scan of older open items.

## 9. Run / verify
```bash
npm install
npm run dev      # demo mode at http://localhost:5173
npm run build    # production build (must pass)
```
Parser/matching can be exercised from a node ESM script importing `src/lib/extract.js`
and `src/lib/matching.js` (lexicon localStorage calls are try/caught → node-safe).

## 10. Status
PR **#5** (branch `claude/found-lost-matching-overview-4v7ig6`) → `main`. Conflicts
resolved (main had the older first-pass via PR #4; branch keeps the full rewrite).
Build green. Ready to merge.

---

# Addendum — Sept 2026: connectors hardened, Snap & Fill vision, waitlist

> Branch `feature/vision-waitlist`. Everything below is on top of the parsing/matching
> overhaul described above. Migrations 004–006 are new; 001–003 unchanged (except 002 is
> now re-runnable).

## A. Connector audit (what was actually broken in live mode)
Baseline run of the DB suite against 001–003: **19 of 57 checks failed.** Confirmed bugs, all
fixed in `004_connector_fixes.sql` + `src/lib/api.js`:
1. Any user could `update profiles set karma = 99999` on themselves → column-level grant
   (name/avatar only) + `karma_events` ledger; +25 per found report (cap 5/24h), +50 on return.
2. Anyone could open a conversation with anyone → insert requires the two owners of a real
   match (`is_match_pair`), unique per match.
3. `touch_conversation` ran under RLS with no update policy → `last_message_at` never moved →
   now `security definer`.
4. No way to set `read_at`; `markConversationRead` checked `!isLive` → `mark_conversation_read`
   RPC + live unread counts.
5. `messages` not in `supabase_realtime` → added; `subscribeToMessages()` in api.js, ChatPanel
   is live.
6. "Mark as returned" was local UI state (and leaked across items) → `mark_returned(match_id)`
   RPC closes both items + competing matches, +50 to the finder once.
7. Lexicon poisoning (one user repeating a word promoted it globally; junk accepted) → promote
   only when 2 *different* students use it, junk filter, 200/day budget.
8. Parser: dorm display names ("Brown", "Field", "Oak") bypassed `AMBIGUOUS_DORM` →
   `extract.js` only uses a dorm's safe aliases. "Brown leather wallet" keeps its colour now.
9. anon `select items` errored (`permission denied for function item_visible_to_me`) → read
   policies scoped `to authenticated`.
10. Demo matches had no `matchId` → a new conversation on every tap.

Suite after fixes: **73/73**. JS↔SQL parity: identical match/no-match decisions; two pairs
differ by ≤4 points (known trigram-vs-Jaccard approximation when no item word is known).

Harness: `scripts/db-test/` (`run.sh` applies shim + every migration twice + `tests.sql`;
`parity.mjs` compares `scorePair` vs `match_item`). Needs a local Postgres 15+.

## B. Snap & Fill — real vision
```
SnapFill.jsx ── compressImage (≤1024px JPEG, EXIF-rotated) ─┐
             ── extractGps (EXIF) → nearestPlace()          │  src/lib/vision.js
             ── currentPosition() fallback                    │
                                                              ▼
                              POST /api/vision  { image: base64, mime }
                                        │  netlify/functions/vision.mjs
                                        │  (verifies Supabase bearer token when live)
                                        ▼
                         lib/vision-core.js  analyzeImage()
                           ├─ OpenRouter  google/gemma-4-31b-it   (OPENROUTER_API_KEY)
                           └─ Gemini API  gemma-4-31b-it          (GEMINI_API_KEY)
                           prompt = strict JSON constrained to src/data/dictionary.js ids
                           normalize() → enums validated; toDescription() → one sentence
                                        ▼
ReportFlow: foundText = description → parseDescription() → SAME chips/title/matching
            draft += { attributes: { vision }, photo: Blob, coords, sensitive }
api.createItem: insert → upload <uid>/<itemId>.jpg to bucket item-photos → set photo_url
```
Design decisions:
- **Vocabulary-constrained output.** The model must pick from the app's canonical item/colour/
  material/brand ids, so photo reports need no new taxonomy and score exactly like typed ones
  (verified: photo-found AirPods ↔ typed-lost AirPods = 86, headphones decoy gated).
- **Photo → sentence → parser**, not photo → fields directly. Users can correct the sentence
  in the highlighted box; everything downstream stays one code path.
- Dev: `vite.config.js` mounts the same `handleVision` at `/api/vision` (reads `.env.local`
  via `loadEnv(mode, cwd, '')`). Prod: Netlify Function v2 (`config.path = '/api/vision'`).
- Cost guard: GET `/api/vision` reports `{configured}`; POST requires a valid Supabase session
  when Supabase is configured; images >6MB rejected; upstream 4xx surfaces as 502 (our config).
- Privacy: prompt forbids transcribing ID/card numbers or full names; `sensitive` is forced
  true for ucard/card/keys regardless of model output.

**Provider findings (Sept 27, 2026, measured with a real key):**
- **Google AI Studio (Gemini API) is the $0 route that works.** `gemma-4-26b-a4b-it` answers in
  ~3.5s **only with `generationConfig.thinkingConfig.thinkingLevel = 'minimal'`** — by default Gemma 4
  thinks for 600–1000 tokens (17–25s) and at `maxOutputTokens: 600` never reaches the answer
  (`finishReason: MAX_TOKENS`, empty text). `thinkingBudget` and `thinkingLevel: 'low'` are rejected
  (400). Thought parts come back flagged `thought: true` and are filtered out. `gemma-4-31b-it`
  returned `500 Internal error` on every image request → kept only as fallback. Gemma 3 ids are gone
  from the API (404).
- **OpenRouter free Gemma (`:free`)** is proxied to Google's *shared* AI Studio pool → persistent
  `429 temporarily rate-limited upstream`. Paid OpenRouter works but needs credits; a key created
  with credit limit 0 gets `403 Key limit exceeded`. OpenRouter path sends `reasoning: {effort:'none'}`.
- `VISION_PROVIDER=gemini|openrouter` forces a provider; `VISION_MODEL` applies only to the provider
  whose id format it matches (slug with `/` → OpenRouter, bare id → Gemini).
- **Time budget:** 8s per model call (`AbortSignal.timeout`), 9.5s overall; rotation/retry only if
  ≥2.5s remain. Netlify sync functions are cut around 10s, so a slow answer degrades to
  "took too long — type it out" instead of a hung request.

Open items: no rate limit per user (add a `vision_calls` ledger like karma if abused); AI Studio
free quota is per-key (watch the dashboard once real students use it).

## C. Waitlist (hype phase)
- `VITE_WAITLIST` (default **on**): loader → `Waitlist.jsx` (cream, floating stickers,
  no map mounted → no tile download) → *sign in* → AuthGate → globe intro → app. A restored
  session skips straight to the globe. `off` restores the original flow.
- **Copy is deliberately vague** (no "AI", "map", "matching", no landing-page link): the promise
  ("lost things are about to start finding their way home") + the incentive, nothing else.
- **Why join — the mechanics** (`src/lib/waitlist.js` constants):
  - `FOUNDING_CAP = 500` → founding member: badge, karma head start at launch, entry into the
    launch giveaway (`GIVEAWAY` in `Waitlist.jsx`, currently "AirPods Pro").
  - `MILESTONES` by referrals: 1 jump the line · 3 day-one access · 5 founder badge · 10 = 5×
    giveaway entries. Rank = referrals desc, created_at asc, so every campus friend moves you up.
  - Sticker game "what did you last lose?" → `waitlist_set_lost_item` → reveal "you + N others".
    Anonymous demand data by item (`waitlist_stats.by_item`).
  - ⚠️ **Giveaway = sweepstakes.** Free entry is fine, but post official rules (eligibility,
    dates, odds, MA residency notes) before promoting it. Copy currently says "launch giveaway".
- **Live counter**: `waitlist_stats` (one PII-free row: total, by_item, last_item) is kept by a
  trigger and streamed over Realtime (`subscribeStats()` → +1 pulse + "someone who lost 🔑 just
  joined" ticker). Polling fallback 45s. Demo mode simulates joins every 6–18s.
- `006_waitlist.sql`: `waitlist` has RLS + **no policies**; doors are `join_waitlist`,
  `waitlist_standing`, `waitlist_set_lost_item`, `waitlist_count` (definer, granted to anon).
  Referral credit only when the *new* joiner is @umass.edu; 120 joins/min global throttle.
  Known: `join_waitlist` on an existing email returns `existing: true` (membership inferable) —
  acceptable for a campus list.
- **Invite gate (`007_invite_gate.sql`)**: `app_settings.signup_mode` = `invite` (default) | `open`.
  `handle_new_user` (the 001 trigger) now also requires `signup_allowed(email)`, i.e. a
  `waitlist.approved_at` — enforced in the DB, unforgeable from the client. `useAuth.signUp`
  pre-checks `signup_allowed` so refusals render as AuthGate's "Not off the list yet" card (with a
  button back to the waitlist) instead of GoTrue's generic "Database error saving new user" (which
  `friendly()` also maps to the invite message). Admin helpers `approve_waitlist`,
  `approve_next_in_line`, `revoke_waitlist`, `set_signup_mode` are revoked from app roles — run
  them from the SQL editor. Local dev shares the production DB, so approve your own email once.
  `waitlist.activated_at` records when an approved person actually signed up.
- Honouring perks at launch (not built): in the signup trigger, look up `waitlist` by email →
  founding/milestones → seed `profiles.karma` + a `founder` flag. Pick giveaway winners with
  `select email from waitlist where <eligible> order by random() limit 1`.
- Not built: mailer (confirmation / launch email), admin export (`select email, referrals,
  lost_item from waitlist order by referrals desc, created_at` from the SQL editor for now).
- `public/landing.html` still explains the whole product and is reachable by URL during the hype
  phase — decide whether to unpublish it until launch.

## D. Found-flow QA round (Sept 27, first real-device test)
Bugs found by Tanishq testing with real photos, all fixed and re-verified with Playwright on desktop
(1280×820) and iPhone-14 viewport:
- **Blank sheet on tapping a found item.** Root cause (DOM-dumped): `BottomSheet` swaps list ↔ detail
  inside `AnimatePresence mode="wait"`; the exiting list contained `ItemCard`s with `layout` + `exit`
  props (exit propagates into the exiting subtree) and the `layoutId` tab pill. After a tab switch the
  list's exit never resolved → stuck at opacity 0, detail never mounted. Fix: tab bar lifted out of the
  animated swap, `layout`/`exit` removed from `ItemCard`, `initial={false}`. Detail now also shows the
  item photo (`ItemPhoto` → `getPhotoUrl`, signed URL / data URL).
- **Photo preview cropped/stretched.** SnapFill box now takes the photo's own aspect ratio (capped at
  46vh/360px) with `object-contain` over a blurred fill; the report card scrolls
  (`max-h-[calc(100dvh-2rem)] overflow-y-auto`) instead of overflowing the screen.
- **Pen → "Pencil case".** `pen`/`pencil` were aliases of `pencil_case`. New canonical `pen`
  (dictionary + `008_pen_alias.sql`). `toDescription()` now uses the alias the model itself said
  ("pen", not the canonical's first alias), skips multi-word "brand text" like "Soka University of
  America" (kept as visible text), and pins/cards use the item emoji (🖊️) instead of the category's 🧸.
- **Location UX.** New `PlacePicker` (searchable gazetteer: names, nicknames, dorms; ↑↓⏎; "use my
  location" snaps to the nearest place ≤250m) + `MiniMap` (live MapLibre, draggable/tap-to-move pin)
  replace the fake gradient on the confirm-spot step. The picker is also offered inline under the
  "where?"/"which dining hall?" chips, including when the text says "somewhere"/"idk". An explicit pick
  or dragged pin (`placeOverride` / `pinCoords`) overrides anything inferred from text/photo.
- Vision: `VISION_BUDGET_MS` (Vite dev passes 25s; prod default 9.5s), output cap 1500 tokens (a
  thought burst hit MAX_TOKENS at 700 once), Gemini model rotation 26B → 31B.

## D2. Misc
- `MapView` gained `introOnMount` (globe fly-in when the map mounts after sign-in).
- Vite build now splits `maplibre` / `vendor` chunks.
- `netlify.toml`: `functions = "netlify/functions"`, esbuild bundler, `/api/*` redirect.
- `STATUS_STYLES` has `returned` / `recovered` / `closed`.

---

# Addendum — Nov 2, 2026: demo-day sweep (parser, matcher, vision, backend status)

## E. Backend is gone
`xmafqfhmleegnvkqhjuc.supabase.co` returns NXDOMAIN from every resolver → the free-tier project was
deleted after its pause. Live mode cannot work until a **new** Supabase project exists: create it,
run `001`→`009` in order, put the new URL/anon key in `.env.local` (the two `VITE_SUPABASE_*` lines
are commented out right now so the app runs in demo mode; original values in
`.env.local.bak-2026-11-02`), and update the Netlify env too. `signup_mode` will default to invite —
approve your own email before testing sign-up.

## F. Parser / matcher fixes (JS + `009_item_neighbors.sql`)
- **Brand hidden inside the item word.** "hydro flask", "stanley", "beats", "jordans" are item aliases
  AND brands; the item entry claimed the characters first so `brand` was always null → the brand gate
  never fired (Hydro Flask ↔ Stanley scored 88). `extract.js` now runs a second, non-claiming brand
  scan (`detectBrand`); `featurize` reads `p.brand`. Flask ↔ Stanley is now `GATED(brand)`, matching
  what the SQL side (separate `ftl_brand()` scan) already did.
- **Qualifier echo.** "AirPods Pro" → title "White AirPods Pro Pro"; "AirPods Max" → "… Max Max".
  Qualifiers already inside the item phrase are skipped.
- **Title uses the user's brand words** ("North Face", not "The North Face") and skips the brand when
  the item phrase already carries it ("Navy Hydro Flask", not "Navy Hydro Flask Hydro Flask").
- **"Did you mean" noise.** `gen → Leather`, `pro → Blue Wall`, `card → Jacket/Wallet`,
  `charging → Charger`, `table → Tablet`, `maple → Maple (dorm)`. Prefix completion now needs ≥4
  chars and ≥60 % of the candidate (or the complete first word of a multi-word alias); tokens < 4
  chars are never suggested/learned; ~90 everyday words added to `STOP`; dorm "<name> hall/dorm"
  forms left out of the fuzzy pool.
- **Item neighbours** (`ITEM_NEIGHBORS`): earbuds ↔ airpods_case, water_bottle ↔ coffee_cup,
  wallet ↔ card ↔ ucard, notebook ↔ textbook, pen ↔ pencil_case are a weak identity match
  (semantic 0.65, composite ×0.9) instead of a hard reject. Bare `case` is no longer an AirPods-case
  alias ("phone case", "white case" were being typed as `airpods_case`); "charging case" is.
- **Unknown location is neutral** (0.5), not a 0.1 penalty, when either side has no pin.
- **Demo pool** (`api.js`): a lost report is also matched against found reports made on the same
  device, so a solo walkthrough (snap a find → report it lost) produces a match.

## G. Vision model findings (real key, Nov 2)
- Google AI Studio keys now come in an `AQ.…` format — valid.
- `gemma-4-26b-a4b-it` **ignores `thinkingLevel: minimal` on image inputs**: ~1,500 chars of
  unflagged reasoning → MAX_TOKENS / 38 s timeouts. Dropped from the rotation.
- `gemma-4-31b-it`: clean JSON, ~30 s/photo → the open-weights default (`DEFAULT_GEMINI_MODEL`).
- `gemini-3.5-flash-lite`: ~1.6 s/photo on the same key → fallback in `GEMINI_MODELS`; `.env.local`
  pins `VISION_MODEL=gemini-3.5-flash-lite` for the demo (delete the value to go back to Gemma).
  `thinkingConfig` is only sent to Gemma ids; a 404 (retired model id) now rotates to the next model.
- Vite dev budget raised to 45 s so 31B can finish locally; prod keeps the 9.5 s Netlify budget
  (only flash-lite fits it).
- `gemini-2.5-*` ids are retired (404). OpenRouter key has a **$0 limit** → "Key limit exceeded".
- `toDescription()` falls back to the model's caption when nothing is identified (was emitting a
  lone colour like "Brown" for a bulletin board).

Verified headlessly (playwright-core + cached Chromium): waitlist → sign in → explore demo → globe →
lost report (chips: navy · hydro flask · ILC · 1pm; place auto-pinned) → instant match 93–100 % →
photo found-report (synthetic bottle → `water_bottle`, blue/white, metal, "UMASS" text, 2 s) →
matching lost report → chat. `npm run build` green.

# Addendum — Nov 19 2026: private-beta gate + verified waitlist

- `/app` without a session shows `src/components/Beacon.jsx` (dark globe, "something you lost is
  out there"). Switch: `VITE_PRIVATE_BETA` (default on; `off` = launched). Signed-in beta
  testers go straight in; the sign-in screen no longer offers "create an account".
- Email-code check: `netlify/functions/waitlist.mjs` (`/api/waitlist`) emails a 6-digit code over
  SMTP and only adds the person after the right code (10 min expiry, 5 tries, resend once a
  minute / 5 an hour). Codes are salted hashes in `waitlist_codes`; `waitlist.verified_at` marks
  who proved their inbox.
- Turning it on, in this order:
  1. Netlify → Environment variables: `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_HOST`, `SMTP_PORT`,
     `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (Gmail app password or Brevo; Resend needs a domain).
  2. Redeploy.
  3. Run `supabase/migrations/012_waitlist_verify.sql` in the SQL editor.
  The page checks `GET /api/waitlist` and only switches to the code step once both the env vars
  and the table exist; before that it uses the old direct join. After 012 the browser can no
  longer call `join_waitlist` directly.
- The list: `select email, verified_at, source, created_at from public.waitlist order by created_at desc;`
