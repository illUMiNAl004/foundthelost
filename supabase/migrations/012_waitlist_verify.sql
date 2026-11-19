-- ============================================================================
-- foundthelost — verified waitlist (Nov 2026). Run AFTER 006. Safe to re-run.
-- Joining the waitlist now needs a 6-digit code emailed to the address (see
-- netlify/functions/waitlist.mjs). This migration:
--   1. adds a private table for those codes (salted hashes, never the code itself)
--   2. records when each waitlist email was verified
--   3. takes join_waitlist away from the browser, so the only way onto the list is
--      through the function, after the right code
--
-- ORDER: set the Netlify env vars first (SUPABASE_SERVICE_ROLE_KEY + SMTP_*), redeploy,
-- THEN run this. Until it runs, the page keeps using the old direct join.
-- ============================================================================

-- 1. codes (RLS on, no policies: only the service role can read or write)
create table if not exists public.waitlist_codes (
  email text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  sends int not null default 1,
  last_sent_at timestamptz not null default now()
);
alter table public.waitlist_codes enable row level security;
revoke all on public.waitlist_codes from anon, authenticated;
grant select, insert, update, delete on public.waitlist_codes to service_role;

-- 2. verified timestamp (null = joined before verification existed)
alter table public.waitlist add column if not exists verified_at timestamptz;

-- 3. only the server can add people now
revoke execute on function public.join_waitlist(text, text, text, text) from public, anon, authenticated;
grant execute on function public.join_waitlist(text, text, text, text) to service_role;
grant select, update on public.waitlist to service_role;

-- ---- cheat sheet ------------------------------------------------------------------
-- everyone on the waitlist, newest first (verified_at null = joined before codes existed):
--   select email, verified_at, source, created_at from public.waitlist order by created_at desc;
-- only verified people:
--   select email, verified_at from public.waitlist where verified_at is not null order by verified_at;
-- undo step 3 (lets the browser join directly again, no code):
--   grant execute on function public.join_waitlist(text, text, text, text) to anon, authenticated;
