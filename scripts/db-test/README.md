# DB tests — RLS, matching, chat, karma, photos, waitlist

Runs every `supabase/migrations/*.sql` against a **throwaway local Postgres** with a small
Supabase shim (`auth.uid()`, roles, `storage.*`), applies them a second time to prove they
are re-run safe, then runs ~90 checks as three simulated students + anon.

Nothing here talks to a real Supabase project.

## Run it

```bash
brew install postgresql@15          # once (any 14+ with pg_trgm works)
scripts/db-test/run.sh              # start throwaway PG → migrate → test → stop
```

Exit code is non-zero if any check fails. Output ends with a `PASS`/`FAIL` table.
Before the suite, a `pubcheck` phase migrates a second scratch DB **without** a
`supabase_realtime` publication (so the `alter publication … add table` blocks must be
guarded), then creates it and re-applies 004 + 006 to prove `messages` + `waitlist_stats`
get published — and nothing private does.

## Poke around

```bash
scripts/db-test/run.sh --keep       # leave the server + ftl_test DB up
scripts/db-test/pg.sh psql          # psql on ftl_test (tables, policies, functions)
node scripts/db-test/parity.mjs     # JS scorePair() vs SQL match_item() side by side
scripts/db-test/pg.sh stop          # or: pg.sh destroy  (also deletes .pgdata)
```

`pg.sh start|stop|status` manage the cluster on its own — data lives in
`scripts/db-test/.pgdata` (gitignored), port **54329**, TCP only.

Impersonate a user inside psql the way the tests do:

```sql
set request.jwt.claims to '{"sub":"<uuid>","role":"authenticated"}'; set role authenticated;
reset role;  -- back to superuser
```

## Files

| file | what |
|---|---|
| `run.sh` | orchestrates: (auto-start PG) → shim → migrations ×2 → `tests.sql` → (stop) |
| `pg.sh` | start / stop / status / psql / destroy for the throwaway cluster |
| `supabase_shim.sql` | minimal `auth` + `storage` schemas, roles, realtime publication |
| `tests.sql` | the suite; each `t.ok(cond, label)` becomes one PASS/FAIL row |
| `pubcheck.sql` | realtime publication guard checks (run on the `_nopub` scratch DB) |
| `parity.mjs` | demo-vs-live scoring comparison over fixture pairs (needs the kept DB) |

## Adding a check

`tests.sql` uses psql variables to switch identity: `:asA`, `:asB`, `:asC`, `:asAnon`,
`:asSuper`. Helpers: `t.raises('sql')` → did it error, `t.n('select count(*) …')` →
scalar or −1 on error, `t.affected('update …')` → row count. Add the check near the
feature it covers and keep the label a one-line sentence a non-DBA can read.
