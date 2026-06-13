-- ============================================================================
-- foundthelost — hardened schema v2 (June 2026)
-- Safe to re-run from scratch (drops + recreates). Functions use the standard
-- $$ tag; the email domain is checked with LIKE (no regex, so no stray $ that
-- would confuse the SQL editor's dollar-quote parser).
-- ============================================================================

-- clean slate (no-op on a fresh project) ------------------------------------
drop table if exists public.messages, public.conversations, public.matches,
  public.items, public.profiles cascade;
drop function if exists public.match_item(uuid) cascade;
drop function if exists public.km_between(double precision, double precision, double precision, double precision) cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.touch_conversation() cascade;

create extension if not exists pg_trgm; -- free fuzzy text similarity

-- profiles (no email PII — only what a campus leaderboard shows) --------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Student',
  avatar_url text,
  karma int not null default 0,
  items_returned int not null default 0,
  created_at timestamptz not null default now()
);

-- auto-create profile on signup + enforce @umass.edu at the DB
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not (lower(new.email) like '%@umass.edu' or lower(new.email) like '%@students.umass.edu') then
    raise exception 'Only @umass.edu accounts are allowed';
  end if;
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- items ----------------------------------------------------------------------
create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('lost', 'found')),
  name text not null check (char_length(name) <= 120),
  description text not null default '' check (char_length(description) <= 2000),
  category text not null default 'other',
  attributes jsonb not null default '{}',
  photo_url text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  building text,
  sensitive boolean not null default false,
  status text not null default 'open',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index items_user_idx on public.items (user_id);
create index items_kind_status_idx on public.items (kind, status);
create index items_name_trgm_idx on public.items using gin (name gin_trgm_ops);

-- matches --------------------------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  lost_item_id uuid not null references public.items (id) on delete cascade,
  found_item_id uuid not null references public.items (id) on delete cascade,
  score numeric not null,
  breakdown jsonb not null default '{}',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (lost_item_id, found_item_id)
);

-- chat -----------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches (id) on delete set null,
  item_label text,
  participant_a uuid not null references public.profiles (id) on delete cascade,
  participant_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) <= 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

create or replace function public.touch_conversation()
returns trigger language plpgsql as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end $$;

create trigger on_message_sent
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- matching (server-side; clients can't forge matches) ------------------------
create or replace function public.km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

create or replace function public.match_item(p_item_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_item public.items;
  v_count int := 0;
  r record;
  v_sem numeric; v_attr numeric; v_loc numeric; v_time numeric; v_score numeric;
  v_km numeric; v_hours numeric;
begin
  select * into v_item from public.items where id = p_item_id;
  if v_item.id is null then raise exception 'item not found'; end if;
  if v_item.user_id <> auth.uid() then raise exception 'not authorized for this item'; end if;

  for r in
    select * from public.items
    where kind = case when v_item.kind = 'lost' then 'found' else 'lost' end
      and status not in ('closed', 'recovered', 'returned')
      and user_id <> v_item.user_id
  loop
    v_sem := greatest(
      similarity(lower(v_item.name), lower(r.name)),
      0.5 * similarity(
        lower(v_item.name || ' ' || coalesce(v_item.description, '')),
        lower(r.name || ' ' || coalesce(r.description, ''))
      )
    );
    v_attr := case when v_item.category = r.category then 1 else 0.3 end;
    v_km := public.km_between(v_item.lat, v_item.lng, r.lat, r.lng);
    v_loc := case
      when v_km <= 0.05 then 1 when v_km <= 0.12 then 0.9 when v_km <= 0.25 then 0.78
      when v_km <= 0.5 then 0.6 when v_km <= 1 then 0.42 when v_km <= 2 then 0.25 else 0.1 end;
    v_hours := abs(extract(epoch from (v_item.occurred_at - r.occurred_at)) / 3600.0);
    v_time := case
      when v_hours <= 2 then 1 when v_hours <= 6 then 0.9 when v_hours <= 24 then 0.78
      when v_hours <= 48 then 0.6 when v_hours <= 168 then 0.4 else 0.2 end;

    v_score := round((0.45 * v_sem + 0.2 * v_attr + 0.2 * v_loc + 0.15 * v_time) * 100);

    if v_score >= 55 then
      insert into public.matches (lost_item_id, found_item_id, score, breakdown, status)
      values (
        case when v_item.kind = 'lost' then v_item.id else r.id end,
        case when v_item.kind = 'lost' then r.id else v_item.id end,
        v_score,
        jsonb_build_object('semantic', round(v_sem * 100), 'attributes', round(v_attr * 100),
                           'location', round(v_loc * 100), 'time', round(v_time * 100), 'km', round(v_km, 3)),
        'pending'
      )
      on conflict (lost_item_id, found_item_id)
        do update set score = excluded.score, breakdown = excluded.breakdown;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

revoke all on function public.match_item(uuid) from public, anon;
grant execute on function public.match_item(uuid) to authenticated;

-- Row Level Security ---------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.matches enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "profiles readable to members" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "own items select" on public.items
  for select using (auth.uid() = user_id);
create policy "own items insert" on public.items
  for insert with check (auth.uid() = user_id);
create policy "own items update" on public.items
  for update using (auth.uid() = user_id);
create policy "own items delete" on public.items
  for delete using (auth.uid() = user_id);

create policy "matched items readable" on public.items
  for select using (
    exists (
      select 1 from public.matches m
      join public.items mine on mine.user_id = auth.uid()
      where (m.lost_item_id = mine.id and m.found_item_id = items.id)
         or (m.found_item_id = mine.id and m.lost_item_id = items.id)
    )
  );

create policy "matches visible to parties" on public.matches
  for select using (
    exists (select 1 from public.items i where i.id = lost_item_id and i.user_id = auth.uid())
    or exists (select 1 from public.items i where i.id = found_item_id and i.user_id = auth.uid())
  );

create policy "own conversations" on public.conversations
  for select using (auth.uid() in (participant_a, participant_b));
create policy "create own conversations" on public.conversations
  for insert with check (auth.uid() in (participant_a, participant_b));
create policy "messages select" on public.messages
  for select using (
    exists (select 1 from public.conversations c
            where c.id = conversation_id and auth.uid() in (c.participant_a, c.participant_b))
  );
create policy "messages insert" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (select 1 from public.conversations c
                where c.id = conversation_id and auth.uid() in (c.participant_a, c.participant_b))
  );
