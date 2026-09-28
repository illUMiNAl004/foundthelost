#!/usr/bin/env bash
# Apply every migration to a throwaway local Postgres (with a Supabase shim), apply
# them all AGAIN (every migration must be re-run safe), then run the RLS / matching /
# chat / karma / waitlist suite in tests.sql.
#
#   scripts/db-test/run.sh            # starts the throwaway Postgres if needed, stops it after
#   scripts/db-test/run.sh --keep     # …but leave it running (poke around with pg.sh psql,
#                                     #  or run parity.mjs against it)
#
# Point it at another server with PGHOST / PGPORT / PGUSER — but NEVER at a real
# Supabase project: it drops + recreates $DB (default ftl_test).
set -euo pipefail
cd "$(dirname "$0")/../.."
export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-54329}" PGUSER="${PGUSER:-postgres}"
DB="${DB:-ftl_test}"
KEEP=0; [[ "${1:-}" == "--keep" ]] && KEEP=1
eval "$(scripts/db-test/pg.sh env)"   # Homebrew keg-only Postgres → PATH

# bring up the throwaway cluster if nothing answers on PGHOST:PGPORT
STARTED=0
if ! pg_isready -q 2>/dev/null; then
  scripts/db-test/pg.sh start
  STARTED=1
fi
[[ $STARTED == 1 && $KEEP == 0 ]] && trap 'scripts/db-test/pg.sh stop' EXIT

PSQL=(psql -X -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB" 2>&1 | grep -v NOTICE || true
"${PSQL[@]}" -d "$DB" -f scripts/db-test/supabase_shim.sql 2>&1 | grep -v -E 'wal_level|HINT' || true
for f in supabase/migrations/*.sql; do
  echo "== apply $f"
  "${PSQL[@]}" -d "$DB" -f "$f" 2>&1 | grep -v -E '^(NOTICE|psql:.*NOTICE)' || true
  "${PSQL[@]}" -d "$DB" -c "select 1" >/dev/null
done
if [[ "${RERUN:-1}" == 1 ]]; then
  for f in supabase/migrations/*.sql; do
    "${PSQL[@]}" -d "$DB" -f "$f" >/dev/null 2>&1 || { echo "!! re-run failed: $f"; "${PSQL[@]}" -d "$DB" -f "$f" 2>&1 | tail -5; exit 1; }
  done
  echo "== re-run of all migrations OK"
fi
# realtime guard: a DB with NO supabase_realtime publication must still migrate, and
# re-applying once it exists must publish exactly messages + waitlist_stats (pubcheck.sql)
echo "== pubcheck"
NP="${DB}_nopub"
"${PSQL[@]}" -d postgres -c "drop database if exists $NP" -c "create database $NP" 2>&1 | grep -v NOTICE || true
"${PSQL[@]}" -d "$NP" -v nopub=1 -f scripts/db-test/supabase_shim.sql >/dev/null
for f in supabase/migrations/*.sql; do
  "${PSQL[@]}" -d "$NP" -f "$f" >/dev/null 2>&1 || { echo "!! $f fails without a supabase_realtime publication:"; "${PSQL[@]}" -d "$NP" -f "$f" 2>&1 | grep ERROR | head -3; exit 1; }
done
"${PSQL[@]}" -d "$NP" -f scripts/db-test/pubcheck.sql 2>&1 | grep -E '^(PASS|psql:.*ERROR|ERROR)' || { echo "!! pubcheck failed"; exit 1; }
"${PSQL[@]}" -d postgres -c "drop database $NP" >/dev/null

echo "== tests"
TESTS_OK=1
"${PSQL[@]}" -d "$DB" -f scripts/db-test/tests.sql || TESTS_OK=0
[[ $KEEP == 1 ]] && echo "== kept: PGPORT=$PGPORT scripts/db-test/pg.sh psql   ·   node scripts/db-test/parity.mjs   ·   scripts/db-test/pg.sh stop"
[[ $TESTS_OK == 1 ]] || { echo "!! some checks failed (see FAIL rows above)"; exit 1; }
exit 0
