-- Realtime publication guards. run.sh applies this to a scratch DB that was migrated
-- WITHOUT a supabase_realtime publication (shim -v nopub=1): every migration must have
-- applied cleanly, and re-applying 004 + 006 once the publication exists must add
-- messages + waitlist_stats — and never the waitlist table itself (PII).
\set ON_ERROR_STOP 1
set client_min_messages = warning;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'pubcheck: expected no supabase_realtime publication in this DB';
  end if;
end $$;
\echo PASS   pubcheck: every migration applies with no supabase_realtime publication

create publication supabase_realtime;
\o /dev/null
\i supabase/migrations/004_connector_fixes.sql
\i supabase/migrations/006_waitlist.sql
\o

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    raise exception 'pubcheck: messages not added to supabase_realtime';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'waitlist_stats') then
    raise exception 'pubcheck: waitlist_stats not added to supabase_realtime';
  end if;
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('waitlist', 'items', 'profiles', 'matches')) then
    raise exception 'pubcheck: a private table is published';
  end if;
end $$;
\echo PASS   pubcheck: re-applying 004 + 006 with the publication present publishes messages + waitlist_stats only
