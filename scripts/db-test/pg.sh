#!/usr/bin/env bash
# Throwaway local Postgres for the DB tests. Lives entirely in scripts/db-test/.pgdata
# (gitignored) on port 54329, TCP only — never touches your real Postgres or Supabase.
#
#   scripts/db-test/pg.sh start     # initdb (first time) + start
#   scripts/db-test/pg.sh stop
#   scripts/db-test/pg.sh status
#   scripts/db-test/pg.sh psql      # open a shell on the test DB (ftl_test)
#   scripts/db-test/pg.sh destroy   # stop + delete the data directory
#   eval "$(scripts/db-test/pg.sh env)"   # put the Postgres binaries on PATH in this shell
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DATA="$HERE/.pgdata"
export PGPORT="${PGPORT:-54329}" PGHOST="${PGHOST:-127.0.0.1}" PGUSER="${PGUSER:-postgres}"

# find pg_ctl: PATH first, then Homebrew's keg-only installs
if ! command -v pg_ctl >/dev/null 2>&1; then
  for v in 17 16 15 14; do
    for prefix in /opt/homebrew/opt /usr/local/opt; do
      if [[ -x "$prefix/postgresql@$v/bin/pg_ctl" ]]; then export PATH="$prefix/postgresql@$v/bin:$PATH"; break 2; fi
    done
  done
fi
command -v pg_ctl >/dev/null 2>&1 || { echo "pg_ctl not found — brew install postgresql@15 (or add it to PATH)"; exit 1; }

case "${1:-}" in
  start)
    if [[ ! -f "$DATA/PG_VERSION" ]]; then
      initdb -D "$DATA" -U "$PGUSER" --auth=trust >/dev/null
    fi
    if pg_ctl -D "$DATA" status >/dev/null 2>&1; then echo "already running on $PGHOST:$PGPORT"; exit 0; fi
    # -k '' disables the unix socket (its path has a 103-byte limit); clients use TCP
    pg_ctl -D "$DATA" -o "-p $PGPORT -h $PGHOST -k ''" -l "$DATA/server.log" -w start >/dev/null
    echo "postgres up on $PGHOST:$PGPORT (data: $DATA)"
    ;;
  stop)
    pg_ctl -D "$DATA" -m fast -w stop >/dev/null 2>&1 && echo "stopped" || echo "not running"
    ;;
  status)
    pg_ctl -D "$DATA" status 2>/dev/null || { echo "not running"; exit 3; }
    ;;
  psql)
    shift; exec psql -d "${DB:-ftl_test}" "$@"
    ;;
  env)
    echo "export PATH=\"$PATH\" PGPORT=$PGPORT PGHOST=$PGHOST PGUSER=$PGUSER"
    ;;
  destroy)
    pg_ctl -D "$DATA" -m fast -w stop >/dev/null 2>&1 || true
    rm -rf "$DATA" && echo "removed $DATA"
    ;;
  *)
    sed -n '2,11p' "$0"; exit 2
    ;;
esac
