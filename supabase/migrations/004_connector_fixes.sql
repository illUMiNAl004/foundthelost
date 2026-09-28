-- ============================================================================
-- foundthelost — connector fixes (September 2026)
-- Found by scripts/db-test (local Postgres + Supabase shim). Safe to re-run.
-- Run AFTER 001 → 002 → 003. Does not touch any user data.
--
--   1. anon queries on items/matches errored (policy called a function anon can't run)
--   2. chat: last_message_at never updated (trigger ran under RLS with no update policy)
--   3. chat: anyone could open a conversation with anyone (DM spam) → match parties only
--   4. chat: no way to mark messages read (unread counts were always 0)
--   5. chat: messages weren't in the realtime publication
--   6. karma: users could UPDATE their own karma (leaderboard forgery)
--   7. karma: live mode never awarded any → server-side ledger + triggers/RPC
--   8. returns: nothing persisted "mark as returned" → mark_returned(match_id)
--   9. lexicon: one user repeating a word promoted it globally; no junk filter
-- ============================================================================

-- ---- 1. scope item/match read policies to signed-in users ------------------
drop policy if exists "matched items readable" on public.items;
create policy "matched items readable" on public.items
  for select to authenticated using (public.item_visible_to_me(id));

drop policy if exists "matches visible to parties" on public.matches;
create policy "matches visible to parties" on public.matches
  for select to authenticated using (
    exists (select 1 from public.items i where i.id = lost_item_id and i.user_id = auth.uid())
    or exists (select 1 from public.items i where i.id = found_item_id and i.user_id = auth.uid())
  );

-- ---- 2. last_message_at bump must bypass RLS ---------------------------------
create or replace function public.touch_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end $$;

-- ---- 3. conversations only between the two owners of a real match ------------
create or replace function public.is_match_pair(p_match_id uuid, a uuid, b uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select a <> b and exists (
    select 1 from public.matches m
    join public.items l on l.id = m.lost_item_id
    join public.items f on f.id = m.found_item_id
    where m.id = p_match_id
      and ((l.user_id = a and f.user_id = b) or (l.user_id = b and f.user_id = a))
  );
$$;
revoke all on function public.is_match_pair(uuid, uuid, uuid) from public, anon;
grant execute on function public.is_match_pair(uuid, uuid, uuid) to authenticated;

drop policy if exists "create own conversations" on public.conversations;
create policy "create own conversations" on public.conversations
  for insert to authenticated with check (
    auth.uid() in (participant_a, participant_b)
    and match_id is not null
    and public.is_match_pair(match_id, participant_a, participant_b)
  );

-- one conversation per match (skip if legacy duplicates already exist)
do $$ begin
  if not exists (select 1 from public.conversations where match_id is not null group by match_id having count(*) > 1) then
    create unique index if not exists conversations_match_uidx on public.conversations (match_id);
  end if;
end $$;

-- ---- 4. read receipts (recipient only; message content stays immutable) -----
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not exists (select 1 from public.conversations c
                 where c.id = p_conversation_id and auth.uid() in (c.participant_a, c.participant_b)) then
    raise exception 'not a participant';
  end if;
  update public.messages set read_at = now()
   where conversation_id = p_conversation_id and sender_id <> auth.uid() and read_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- ---- 5. realtime chat --------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ---- 6. profiles: users may rename themselves, never touch karma --------------
revoke update on public.profiles from anon, authenticated;
grant update (name, avatar_url) on public.profiles to authenticated;

-- ---- 7. karma ledger (server-side, auditable, can't be deleted by clients) ----
create table if not exists public.karma_events (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('found_report', 'return')),
  ref_id uuid not null,
  amount int not null,
  created_at timestamptz not null default now(),
  unique (reason, ref_id)
);
alter table public.karma_events enable row level security;
drop policy if exists "own karma events" on public.karma_events;
create policy "own karma events" on public.karma_events
  for select to authenticated using (user_id = auth.uid());

-- +25 per found report, max 5 rewarded reports per rolling 24h (no farming)
create or replace function public.award_found_karma()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.karma_events
       where user_id = new.user_id and reason = 'found_report' and created_at > now() - interval '24 hours') < 5 then
    insert into public.karma_events (user_id, reason, ref_id, amount)
      values (new.user_id, 'found_report', new.id, 25)
      on conflict (reason, ref_id) do nothing;
    if found then
      update public.profiles set karma = karma + 25 where id = new.user_id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists on_found_item_karma on public.items;
create trigger on_found_item_karma
  after insert on public.items
  for each row when (new.kind = 'found')
  execute function public.award_found_karma();

-- ---- 8. mark a match returned (either party) → finder +50, once --------------
create or replace function public.mark_returned(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m public.matches%rowtype;
  lost_owner uuid; finder uuid; found_id uuid; awarded boolean := false;
begin
  select * into m from public.matches where id = p_match_id;
  if m.id is null then raise exception 'match not found'; end if;
  select user_id into lost_owner from public.items where id = m.lost_item_id;
  select user_id, id into finder, found_id from public.items where id = m.found_item_id;
  if auth.uid() is null or auth.uid() not in (lost_owner, finder) then
    raise exception 'not a party to this match';
  end if;
  if m.status = 'returned' then
    return jsonb_build_object('status', 'returned', 'awarded', false);
  end if;

  update public.matches set status = 'returned' where id = p_match_id;
  -- the item is home: retire every other candidate pairing for both sides
  update public.matches set status = 'closed'
   where id <> p_match_id and status = 'pending'
     and (found_item_id = m.found_item_id or lost_item_id = m.lost_item_id);
  update public.items set status = 'returned' where id = m.found_item_id;
  update public.items set status = 'recovered' where id = m.lost_item_id;

  insert into public.karma_events (user_id, reason, ref_id, amount)
    values (finder, 'return', found_id, 50)
    on conflict (reason, ref_id) do nothing;
  if found then
    update public.profiles set karma = karma + 50, items_returned = items_returned + 1 where id = finder;
    awarded := true;
  end if;
  return jsonb_build_object('status', 'returned', 'awarded', awarded);
end $$;
revoke all on function public.mark_returned(uuid) from public, anon;
grant execute on function public.mark_returned(uuid) to authenticated;

-- ---- 9. lexicon: promote on DISTINCT students, drop junk ----------------------
create table if not exists public.lexicon_sightings (
  term text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (term, user_id)
);
alter table public.lexicon_sightings enable row level security; -- no policies: definer-only

create or replace function public.bump_lexicon(p_term text, p_label text default null)
returns void language plpgsql security definer set search_path = public as $$
declare t text := lower(trim(coalesce(p_term, ''))); c int;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if length(t) < 3 or length(t) > 40 or t !~ '^[a-z0-9][a-z0-9 -]*$' then return; end if;
  -- per-student budget so nobody can flood the pending table
  if (select count(*) from public.lexicon_sightings
       where user_id = auth.uid() and created_at > now() - interval '24 hours') >= 200 then return; end if;

  insert into public.lexicon_sightings (term, user_id) values (t, auth.uid()) on conflict do nothing;
  if not found then return; end if; -- this student already counted

  insert into public.lexicon (term, label) values (t, left(coalesce(nullif(trim(p_label), ''), t), 40))
  on conflict (term) do update set count = public.lexicon.count + 1, updated_at = now()
  returning count into c;
  if c >= 2 then
    update public.lexicon set status = 'learned' where term = t and status = 'pending';
  end if;
end $$;
revoke all on function public.bump_lexicon(text, text) from public, anon;
grant execute on function public.bump_lexicon(text, text) to authenticated;

-- ---- 10. match_item parity with src/lib/scoring.js (scripts/db-test/parity.mjs) --
-- vs 003: (a) the stored category wins over the parsed one, like featurize();
-- (b) same-item semantic is max(0.9, text similarity), like max(0.9, jaccard);
-- (c) asymmetric time: found reported >24h BEFORE the loss is scored ×0.8.
create or replace function public.match_item(p_item_id uuid)
returns int language plpgsql security definer set search_path = public as $FN$
declare
  my_user uuid; my_kind text; my_blob text; my_item text; my_cat text;
  my_colors text[]; my_mats text[]; my_brand text;
  my_lat double precision; my_lng double precision; my_occ timestamptz;
  r record; r_item text; r_colors text[]; r_mats text[]; r_brand text; r_blob text; r_cat text;
  s_sem numeric; s_attr numeric; s_loc numeric; s_time numeric; s_score numeric;
  s_km numeric; s_gap numeric; composite numeric; color_attr numeric; color_penalty numeric; hits int := 0;
begin
  select user_id, kind, lower(name||' '||coalesce(description,'')),
         public.ftl_canonical_item(name||' '||coalesce(description,'')),
         coalesce(nullif(category, ''), public.ftl_category_of(name||' '||coalesce(description,'')), 'other'),
         public.ftl_colors(name||' '||coalesce(description,'')),
         public.ftl_materials(name||' '||coalesce(description,'')),
         public.ftl_brand(name||' '||coalesce(description,'')),
         lat, lng, occurred_at
    into my_user, my_kind, my_blob, my_item, my_cat, my_colors, my_mats, my_brand, my_lat, my_lng, my_occ
    from public.items where id = p_item_id;
  if my_user is null then raise exception 'item not found'; end if;
  if my_user <> auth.uid() then raise exception 'not authorized for this item'; end if;

  for r in select * from public.items
    where kind = case when my_kind='lost' then 'found' else 'lost' end
      and status not in ('closed','recovered','returned') and user_id <> my_user
  loop
    r_blob := lower(r.name||' '||coalesce(r.description,''));
    r_item := public.ftl_canonical_item(r_blob); r_colors := public.ftl_colors(r_blob);
    r_mats := public.ftl_materials(r_blob); r_brand := public.ftl_brand(r_blob);
    r_cat := coalesce(nullif(r.category, ''), public.ftl_category_of(r_blob), 'other');
    if my_item is not null and r_item is not null and my_item <> r_item then continue; end if;
    if my_brand is not null and r_brand is not null and my_brand <> r_brand then continue; end if;
    color_penalty := 1;
    if cardinality(my_colors)=0 or cardinality(r_colors)=0 then color_attr := 0.2;
    elsif my_colors && r_colors then color_attr := 0.4;
    elsif exists (select 1 from unnest(my_colors) x, unnest(r_colors) y where public.ftl_color_neighbor(x,y)) then color_attr := 0.1; color_penalty := 0.78;
    else continue; end if;
    if my_item is not null and r_item is not null and my_item = r_item then s_sem := greatest(0.9, similarity(my_blob, r_blob));
    else s_sem := greatest(case when my_item is not null and r_item is not null then 0.05 else 0 end, similarity(my_blob, r_blob)); end if;
    s_attr := least(1, (case when my_cat = r_cat then 0.6 else 0 end) + color_attr);
    s_km := public.km_between(my_lat, my_lng, r.lat, r.lng);
    s_loc := case when s_km<=0.05 then 1 when s_km<=0.12 then 0.9 when s_km<=0.25 then 0.78 when s_km<=0.5 then 0.6 when s_km<=1 then 0.42 when s_km<=2 then 0.25 else 0.1 end;
    -- gap = hours from the loss to the find (negative: found reported before it was lost)
    s_gap := extract(epoch from (case when my_kind='lost' then r.occurred_at - my_occ else my_occ - r.occurred_at end))/3600.0;
    s_time := case when abs(s_gap)<=2 then 1 when abs(s_gap)<=6 then 0.9 when abs(s_gap)<=24 then 0.78 when abs(s_gap)<=48 then 0.6 when abs(s_gap)<=168 then 0.4 else 0.2 end;
    if s_gap < -24 then s_time := s_time * 0.8; end if;
    composite := 0.45*s_sem + 0.2*s_attr + 0.2*s_loc + 0.15*s_time;
    if s_sem < 0.3 then composite := least(composite, 0.5); end if;
    composite := composite * color_penalty;
    if cardinality(my_mats)>0 and cardinality(r_mats)>0 and not (my_mats && r_mats) then composite := composite*0.9; end if;
    if my_brand is not null and r_brand is not null and my_brand = r_brand then composite := least(1, composite+0.05); end if;
    s_score := round(composite*100);
    if s_score >= 55 then
      insert into public.matches (lost_item_id, found_item_id, score, breakdown, status)
      values (case when my_kind='lost' then p_item_id else r.id end, case when my_kind='lost' then r.id else p_item_id end, s_score,
              jsonb_build_object('semantic',round(s_sem*100),'attributes',round(s_attr*100),'location',round(s_loc*100),'time',round(s_time*100),'km',round(s_km,3)),'pending')
      on conflict (lost_item_id, found_item_id) do update set score = excluded.score, breakdown = excluded.breakdown
        where public.matches.status = 'pending'; -- never reopen a returned/closed match
      hits := hits + 1;
    end if;
  end loop;
  return hits;
end $FN$;
revoke all on function public.match_item(uuid) from public, anon;
grant execute on function public.match_item(uuid) to authenticated;
