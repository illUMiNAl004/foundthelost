-- ============================================================================
-- foundthelost — invite-only sign-up (hype phase), Sept 2026. Run AFTER 006.
-- Sign-up is gated IN THE DATABASE (same trigger that enforces @umass.edu), so it can't be
-- bypassed from the browser. Two modes, one row:
--   signup_mode = 'invite'  → only emails you approved on the waitlist may create an account
--   signup_mode = 'open'    → anyone with a @umass.edu email (launch day)
-- Approving people = one SQL line (see the bottom of this file). Safe to re-run.
-- ============================================================================

-- ---- settings (RLS on, no policies: only definer functions read it) ---------------
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
insert into public.app_settings (key, value) values ('signup_mode', 'invite') on conflict (key) do nothing;

-- ---- approvals live on the waitlist row ------------------------------------------
alter table public.waitlist add column if not exists approved_at timestamptz;
alter table public.waitlist add column if not exists approved_note text;
alter table public.waitlist add column if not exists activated_at timestamptz; -- when they actually signed up
create index if not exists waitlist_approved_idx on public.waitlist (approved_at) where approved_at is not null;

-- ---- the gate -----------------------------------------------------------------------
-- Callable by anon so the sign-up form can say "not yet" nicely BEFORE hitting the trigger.
-- Leaks only a yes/no for an email the caller already typed.
create or replace function public.signup_allowed(p_email text)
returns boolean language sql security definer stable set search_path = public as $$
  select case
    when coalesce((select value from public.app_settings where key = 'signup_mode'), 'invite') = 'open' then true
    else exists (select 1 from public.waitlist
                  where email = lower(trim(p_email)) and approved_at is not null)
  end;
$$;
revoke all on function public.signup_allowed(text) from public;
grant execute on function public.signup_allowed(text) to anon, authenticated;

-- Replace the 001 trigger: domain check + invite gate + mark the waitlist row activated.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not (lower(new.email) like '%@umass.edu' or lower(new.email) like '%@students.umass.edu') then
    raise exception 'Only @umass.edu accounts are allowed';
  end if;
  if not public.signup_allowed(new.email) then
    raise exception 'Invite-only right now — join the waitlist and we will email you when your spot opens';
  end if;
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
  update public.waitlist set activated_at = coalesce(activated_at, now()) where email = lower(new.email);
  return new;
end $$;
-- (the trigger `on_auth_user_created` from 001 already points at this function)

-- The waitlist screen reads this to say "your spot is open — create your account".
create or replace function public.waitlist_standing_of(v_row public.waitlist, v_existing boolean default false)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'position', public.waitlist_rank_of(v_row.id),
    'total', (select total from public.waitlist_stats where id = 1),
    'referral_code', v_row.referral_code,
    'referrals', v_row.referrals,
    'lost_item', v_row.lost_item,
    'join_order', (select count(*) + 1 from public.waitlist w where w.created_at < v_row.created_at
                     or (w.created_at = v_row.created_at and w.id < v_row.id))::int,
    'founding', v_row.created_at <= coalesce((
        select created_at from public.waitlist order by created_at asc offset 499 limit 1), 'infinity'::timestamptz),
    'approved', v_row.approved_at is not null
      or coalesce((select value from public.app_settings where key = 'signup_mode'), 'invite') = 'open',
    'activated', v_row.activated_at is not null,
    'existing', v_existing,
    'umass', v_row.domain in ('umass.edu', 'students.umass.edu')
  );
$$;
revoke all on function public.waitlist_standing_of(public.waitlist, boolean) from public, anon, authenticated;

-- ---- admin helpers — NOT granted to app roles; run them from the SQL editor -----------
-- Approve emails (adds them to the waitlist if they never joined). Returns how many rows changed.
create or replace function public.approve_waitlist(p_emails text[], p_note text default null)
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; e text;
begin
  foreach e in array p_emails loop
    e := lower(trim(e));
    if e !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then raise exception 'not an email: %', e; end if;
    insert into public.waitlist (email, referral_code, source)
      values (e, public.waitlist_new_code(), 'admin')
      on conflict (email) do nothing;
    update public.waitlist set approved_at = coalesce(approved_at, now()), approved_note = coalesce(p_note, approved_note)
      where email = e and approved_at is null;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- Un-approve (they keep their waitlist spot, just can't sign up).
create or replace function public.revoke_waitlist(p_emails text[])
returns int language sql security definer set search_path = public as $$
  with u as (update public.waitlist set approved_at = null
              where approved_at is not null and email = any (select lower(trim(x)) from unnest(p_emails) x) returning 1)
  select count(*)::int from u;
$$;

-- Approve the next N people in line (by position: referrals desc, then sign-up time).
create or replace function public.approve_next_in_line(p_count int, p_note text default 'batch')
returns int language sql security definer set search_path = public as $$
  with next as (
    select id from public.waitlist
     where approved_at is null and domain in ('umass.edu', 'students.umass.edu')
     order by referrals desc, created_at asc
     limit greatest(p_count, 0)
  ), u as (update public.waitlist w set approved_at = now(), approved_note = p_note from next where w.id = next.id returning 1)
  select count(*)::int from u;
$$;

create or replace function public.set_signup_mode(p_mode text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if p_mode not in ('invite', 'open') then raise exception 'mode must be invite or open'; end if;
  insert into public.app_settings (key, value) values ('signup_mode', p_mode)
    on conflict (key) do update set value = excluded.value, updated_at = now();
  return p_mode;
end $$;

revoke all on function public.approve_waitlist(text[], text) from public, anon, authenticated;
revoke all on function public.revoke_waitlist(text[]) from public, anon, authenticated;
revoke all on function public.approve_next_in_line(int, text) from public, anon, authenticated;
revoke all on function public.set_signup_mode(text) from public, anon, authenticated;

-- ---- cheat sheet (paste into the SQL editor) -------------------------------------
-- who's waiting:          select email, referrals, lost_item, approved_at, activated_at, created_at
--                           from public.waitlist order by referrals desc, created_at;
-- approve test users:     select public.approve_waitlist(array['you@umass.edu', 'friend@umass.edu'], 'pilot testers');
-- approve the next 50:    select public.approve_next_in_line(50, 'wave 1');
-- take access back:       select public.revoke_waitlist(array['x@umass.edu']);
-- launch day:             select public.set_signup_mode('open');
