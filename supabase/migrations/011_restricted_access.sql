-- ============================================================================
-- foundthelost — restricted access (Nov 2026). Run AFTER 007. Safe to re-run.
-- Closes the app to everyone except approved emails:
--   1. sign-up goes back to invite-only (the 007 gate)
--   2. the founders are approved
--   3. every EXISTING account whose email isn't approved is banned, so it can't sign in or
--      refresh its session (the server refuses it; an open tab dies within the hour when its
--      access token expires). Nothing is deleted: their items, chats and karma stay put.
-- Undo everything with the "reopen" lines at the bottom.
-- ============================================================================

-- 1. invite-only sign-up
select public.set_signup_mode('invite');

-- 2. founders (add testers / judges here, or later with approve_waitlist + unban below)
select public.approve_waitlist(array['tsaria@umass.edu', 'narora@umass.edu'], 'founders');

-- 3. ban existing accounts that aren't approved
update auth.users u
   set banned_until = 'infinity'
 where (u.banned_until is null or u.banned_until < now())
   and not exists (select 1 from public.waitlist w
                    where w.email = lower(u.email) and w.approved_at is not null);

-- ---- cheat sheet ------------------------------------------------------------------
-- who's in / who's locked out:
--   select email, banned_until, last_sign_in_at from auth.users order by created_at;
--
-- let one more person in (approve + unban if they already had an account):
--   select public.approve_waitlist(array['someone@umass.edu'], 'tester');
--   update auth.users set banned_until = null where lower(email) = 'someone@umass.edu';
--
-- reopen to all of UMass:
--   select public.set_signup_mode('open');
--   update auth.users set banned_until = null where banned_until = 'infinity';
