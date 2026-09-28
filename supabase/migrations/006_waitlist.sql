-- ============================================================================
-- foundthelost — pre-launch waitlist, Sept 2026. Run AFTER 005.
-- The waitlist table has RLS on and NO policies: the anon key can neither read nor
-- write it directly. All access goes through SECURITY DEFINER functions that return only
-- the caller's own position + referral code — never anyone's email.
--
-- Live counter: a single-row `waitlist_stats` table (no PII) is kept current by a trigger
-- and streamed to every open waitlist screen over Realtime.
-- Safe to re-run.
-- ============================================================================

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  domain text generated always as (split_part(email, '@', 2)) stored,
  referral_code text not null unique,
  referred_by uuid references public.waitlist (id) on delete set null,
  referrals int not null default 0,
  lost_item text,                       -- the "what did you last lose?" sticker (optional)
  source text,
  created_at timestamptz not null default now()
);
alter table public.waitlist add column if not exists lost_item text;
create index if not exists waitlist_rank_idx on public.waitlist (referrals desc, created_at asc);

alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;

-- ---- public, PII-free stats (one row) --------------------------------------
create table if not exists public.waitlist_stats (
  id int primary key default 1 check (id = 1),
  total int not null default 0,
  by_item jsonb not null default '{}',   -- { "airpods": 312, "keys": 87, ... }
  last_item text,                        -- sticker of the most recent joiner (for the ticker)
  updated_at timestamptz not null default now()
);
insert into public.waitlist_stats (id) values (1) on conflict (id) do nothing;

alter table public.waitlist_stats enable row level security;
drop policy if exists "stats readable by everyone" on public.waitlist_stats;
create policy "stats readable by everyone" on public.waitlist_stats
  for select to anon, authenticated using (true);
revoke insert, update, delete on public.waitlist_stats from anon, authenticated;

create or replace function public.waitlist_refresh_stats()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.waitlist_stats set
    total = (select count(*) from public.waitlist),
    by_item = coalesce((
      select jsonb_object_agg(lost_item, n)
      from (select lost_item, count(*) as n from public.waitlist where lost_item is not null group by lost_item) t
    ), '{}'),
    -- only a newly-SET sticker moves the ticker (plain joins and clears leave it alone)
    last_item = case
      when tg_op <> 'DELETE' and new.lost_item is not null and new.lost_item is distinct from old.lost_item then new.lost_item
      else last_item end,
    updated_at = now()
  where id = 1;
  return null;
end $$;

drop trigger if exists waitlist_stats_trigger on public.waitlist;
create trigger waitlist_stats_trigger
  after insert or update or delete on public.waitlist
  for each row execute function public.waitlist_refresh_stats();

-- stream the stats row (only this table — the waitlist itself is never published)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'waitlist_stats') then
    alter publication supabase_realtime add table public.waitlist_stats;
  end if;
end $$;

-- ---- helpers ------------------------------------------------------------------
-- 6-char code from an alphabet without look-alikes (no 0/O/1/I)
create or replace function public.waitlist_new_code()
returns text language plpgsql as $$
declare alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code text; i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.waitlist where referral_code = code);
  end loop;
  return code;
end $$;

-- position = 1-based rank: more referrals first, then earlier sign-up. So every friend
-- who joins with your link genuinely moves you up.
create or replace function public.waitlist_rank_of(p_id uuid)
returns int language sql stable as $$
  select rnk::int from (
    select id, row_number() over (order by referrals desc, created_at asc) as rnk
    from public.waitlist
  ) r where r.id = p_id;
$$;

-- the shape every RPC returns for "your standing"
create or replace function public.waitlist_standing_of(v_row public.waitlist, v_existing boolean default false)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'position', public.waitlist_rank_of(v_row.id),
    'total', (select total from public.waitlist_stats where id = 1),
    'referral_code', v_row.referral_code,
    'referrals', v_row.referrals,
    'lost_item', v_row.lost_item,
    -- join_order = how many signed up before you + 1 (fixed at join time, unlike position).
    -- Perk tiers key off this: first 500 founding, first 2000 ad-free (caps live in the client).
    'join_order', (select count(*) + 1 from public.waitlist w where w.created_at < v_row.created_at
                     or (w.created_at = v_row.created_at and w.id < v_row.id))::int,
    'founding', v_row.created_at <= coalesce((
        select created_at from public.waitlist order by created_at asc offset 499 limit 1), 'infinity'::timestamptz),
    'existing', v_existing,
    'umass', v_row.domain in ('umass.edu', 'students.umass.edu')
  );
$$;

-- ---- the doors --------------------------------------------------------------
create or replace function public.join_waitlist(
  p_email text, p_name text default null, p_ref text default null, p_source text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_row public.waitlist%rowtype;
  v_ref public.waitlist%rowtype;
  v_existing boolean := false;
begin
  if v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then
    raise exception 'That email address does not look right';
  end if;
  if char_length(v_email) > 254 then raise exception 'Email too long'; end if;

  select * into v_row from public.waitlist where email = v_email;
  if found then
    v_existing := true;
  else
    -- crude anti-script throttle (no IP visible inside Postgres): the whole campus
    -- signing up at once is fine at 120/min; a farming loop is not.
    if (select count(*) from public.waitlist where created_at > now() - interval '1 minute') >= 120 then
      raise exception 'Lots of people joining right now — try again in a minute';
    end if;
    if p_ref is not null then
      select * into v_ref from public.waitlist where referral_code = upper(trim(p_ref));
    end if;
    insert into public.waitlist (email, name, referral_code, referred_by, source)
    values (v_email, nullif(left(trim(p_name), 80), ''), public.waitlist_new_code(), v_ref.id, left(p_source, 60))
    returning * into v_row;
    -- referral credit only for real campus addresses — throwaway gmails can't farm the queue
    if v_ref.id is not null and v_row.domain in ('umass.edu', 'students.umass.edu') then
      update public.waitlist set referrals = referrals + 1 where id = v_ref.id;
    end if;
  end if;

  return public.waitlist_standing_of(v_row, v_existing);
end $$;

-- Refresh your own standing from the code stored in localStorage (no email needed).
create or replace function public.waitlist_standing(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.waitlist%rowtype;
begin
  select * into v_row from public.waitlist where referral_code = upper(trim(p_code));
  if not found then return null; end if;
  return public.waitlist_standing_of(v_row, true);
end $$;

-- "What did you last lose?" — one sticker per person, from a fixed list. Returns how many
-- others picked the same thing (the reveal).
create or replace function public.waitlist_set_lost_item(p_code text, p_item text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_n int;
begin
  if p_item is not null and p_item not in ('airpods','ucard','keys','wallet','bottle','laptop','jacket','dignity') then
    raise exception 'unknown item';
  end if;
  update public.waitlist set lost_item = p_item where referral_code = upper(trim(p_code)) returning id into v_id;
  if v_id is null then return null; end if;
  select count(*) into v_n from public.waitlist where lost_item = p_item;
  return jsonb_build_object('item', p_item, 'count', v_n);
end $$;

create or replace function public.waitlist_count()
returns int language sql security definer stable set search_path = public as $$
  select total from public.waitlist_stats where id = 1;
$$;

revoke all on function public.join_waitlist(text, text, text, text) from public;
revoke all on function public.waitlist_standing(text) from public;
revoke all on function public.waitlist_set_lost_item(text, text) from public;
revoke all on function public.waitlist_count() from public;
grant execute on function public.join_waitlist(text, text, text, text) to anon, authenticated;
grant execute on function public.waitlist_standing(text) to anon, authenticated;
grant execute on function public.waitlist_set_lost_item(text, text) to anon, authenticated;
grant execute on function public.waitlist_count() to anon, authenticated;
-- internals: only reachable through the definer functions above
revoke all on function public.waitlist_new_code() from public, anon, authenticated;
revoke all on function public.waitlist_rank_of(uuid) from public, anon, authenticated;
revoke all on function public.waitlist_standing_of(public.waitlist, boolean) from public, anon, authenticated;
revoke all on function public.waitlist_refresh_stats() from public, anon, authenticated;

-- make sure the stats row reflects any rows that pre-date this trigger
update public.waitlist_stats set
  total = (select count(*) from public.waitlist),
  by_item = coalesce((select jsonb_object_agg(lost_item, n) from (select lost_item, count(*) n from public.waitlist where lost_item is not null group by lost_item) t), '{}'),
  updated_at = now()
where id = 1;
