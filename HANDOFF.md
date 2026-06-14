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
