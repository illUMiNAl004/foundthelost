-- ============================================================================
-- foundthelost — matching engine v2 (parity with src/lib/scoring.js)
-- Adds canonical item/color normalization (so live matching uses the SAME synonyms
-- as the client), a self-learning lexicon table, and rewrites match_item to mirror
-- the shared spec exactly: must-match item-identity GATE, per-feature weighted score,
-- and a SEMANTIC FLOOR so location+time+category can't manufacture a match.
--
-- Safe to re-run. Run AFTER 001_foundthelost_schema.sql.
-- ============================================================================

-- ---- canonical alias table (seeded from the JS data dictionary) -------------
drop table if exists public.ftl_aliases cascade;
create table public.ftl_aliases (
  term text not null,
  kind text not null check (kind in ('item', 'color')),
  canonical text not null,
  category text,
  primary key (term, kind)
);

insert into public.ftl_aliases (term, kind, canonical, category) values
  ('headphones','item','headphones','electronics'),
  ('over-ear','item','headphones','electronics'),
  ('over ear','item','headphones','electronics'),
  ('headset','item','headphones','electronics'),
  ('beats','item','headphones','electronics'),
  ('airpods','item','earbuds','electronics'),
  ('air pods','item','earbuds','electronics'),
  ('earbuds','item','earbuds','electronics'),
  ('earbud','item','earbuds','electronics'),
  ('earphones','item','earbuds','electronics'),
  ('earphone','item','earbuds','electronics'),
  ('ear pods','item','earbuds','electronics'),
  ('airpod','item','earbuds','electronics'),
  ('iphone','item','phone','electronics'),
  ('samsung','item','phone','electronics'),
  ('android','item','phone','electronics'),
  ('phone','item','phone','electronics'),
  ('cellphone','item','phone','electronics'),
  ('cell phone','item','phone','electronics'),
  ('laptop','item','laptop','electronics'),
  ('macbook','item','laptop','electronics'),
  ('macbook air','item','laptop','electronics'),
  ('macbook pro','item','laptop','electronics'),
  ('dell xps','item','laptop','electronics'),
  ('chromebook','item','laptop','electronics'),
  ('computer','item','laptop','electronics'),
  ('charger','item','charger','electronics'),
  ('charging cable','item','charger','electronics'),
  ('cable','item','charger','electronics'),
  ('cord','item','charger','electronics'),
  ('adapter','item','charger','electronics'),
  ('power bank','item','charger','electronics'),
  ('powerbank','item','charger','electronics'),
  ('calculator','item','calculator','electronics'),
  ('graphing calculator','item','calculator','electronics'),
  ('ti84','item','calculator','electronics'),
  ('ti-84','item','calculator','electronics'),
  ('ti 84','item','calculator','electronics'),
  ('ti84 plus','item','calculator','electronics'),
  ('ti83','item','calculator','electronics'),
  ('ti-83','item','calculator','electronics'),
  ('apple watch','item','watch','electronics'),
  ('smartwatch','item','watch','electronics'),
  ('smart watch','item','watch','electronics'),
  ('watch','item','watch','electronics'),
  ('fitbit','item','watch','electronics'),
  ('hydro flask','item','water_bottle','bottles'),
  ('hydroflask','item','water_bottle','bottles'),
  ('stanley cup','item','water_bottle','bottles'),
  ('stanley','item','water_bottle','bottles'),
  ('owala','item','water_bottle','bottles'),
  ('yeti','item','water_bottle','bottles'),
  ('nalgene','item','water_bottle','bottles'),
  ('tumbler','item','water_bottle','bottles'),
  ('insulated bottle','item','water_bottle','bottles'),
  ('water bottle','item','water_bottle','bottles'),
  ('bottle','item','water_bottle','bottles'),
  ('flask','item','water_bottle','bottles'),
  ('wallet','item','wallet','wallets'),
  ('bifold','item','wallet','wallets'),
  ('card holder','item','wallet','wallets'),
  ('cardholder','item','wallet','wallets'),
  ('card wallet','item','wallet','wallets'),
  ('money holder','item','wallet','wallets'),
  ('purse','item','wallet','wallets'),
  ('billfold','item','wallet','wallets'),
  ('ucard','item','ucard','wallets'),
  ('u-card','item','ucard','wallets'),
  ('u card','item','ucard','wallets'),
  ('student id','item','ucard','wallets'),
  ('umass id','item','ucard','wallets'),
  ('id card','item','ucard','wallets'),
  ('school id','item','ucard','wallets'),
  ('license','item','ucard','wallets'),
  ('passport','item','ucard','wallets'),
  ('keys','item','keys','keys'),
  ('key','item','keys','keys'),
  ('keychain','item','keys','keys'),
  ('key chain','item','keys','keys'),
  ('key fob','item','keys','keys'),
  ('fob','item','keys','keys'),
  ('lanyard','item','keys','keys'),
  ('jacket','item','jacket','clothing'),
  ('coat','item','jacket','clothing'),
  ('hoodie','item','jacket','clothing'),
  ('sweater','item','jacket','clothing'),
  ('sweatshirt','item','jacket','clothing'),
  ('windbreaker','item','jacket','clothing'),
  ('puffer','item','jacket','clothing'),
  ('north face','item','jacket','clothing'),
  ('patagonia','item','jacket','clothing'),
  ('beanie','item','beanie','clothing'),
  ('hat','item','beanie','clothing'),
  ('cap','item','beanie','clothing'),
  ('toque','item','beanie','clothing'),
  ('gloves','item','gloves','clothing'),
  ('glove','item','gloves','clothing'),
  ('mittens','item','gloves','clothing'),
  ('mitten','item','gloves','clothing'),
  ('scarf','item','scarf','clothing'),
  ('backpack','item','backpack','other'),
  ('bookbag','item','backpack','other'),
  ('book bag','item','backpack','other'),
  ('rucksack','item','backpack','other'),
  ('tote bag','item','backpack','other'),
  ('tote','item','backpack','other'),
  ('canvas bag','item','backpack','other'),
  ('duffel','item','backpack','other'),
  ('bag','item','backpack','other'),
  ('umbrella','item','umbrella','other'),
  ('glasses','item','glasses','other'),
  ('sunglasses','item','glasses','other'),
  ('spectacles','item','glasses','other'),
  ('eyeglasses','item','glasses','other'),
  ('blue','color','blue',null),
  ('navy','color','blue',null),
  ('dark blue','color','blue',null),
  ('light blue','color','blue',null),
  ('sky blue','color','blue',null),
  ('red','color','red',null),
  ('maroon','color','red',null),
  ('burgundy','color','red',null),
  ('crimson','color','red',null),
  ('pink','color','red',null),
  ('white','color','white',null),
  ('cream','color','white',null),
  ('off white','color','white',null),
  ('off-white','color','white',null),
  ('black','color','black',null),
  ('dark black','color','black',null),
  ('green','color','green',null),
  ('light green','color','green',null),
  ('dark green','color','green',null),
  ('grey','color','grey',null),
  ('gray','color','grey',null),
  ('silver','color','grey',null),
  ('brown','color','brown',null),
  ('tan','color','brown',null),
  ('beige','color','brown',null),
  ('khaki','color','brown',null),
  ('yellow','color','yellow',null),
  ('gold','color','yellow',null),
  ('orange','color','orange',null),
  ('purple','color','purple',null),
  ('violet','color','purple',null),
  ('lavender','color','purple',null)
on conflict do nothing;

create index ftl_aliases_kind_len_idx on public.ftl_aliases (kind, (length(term)) desc);

alter table public.ftl_aliases enable row level security;
create policy "aliases readable to members" on public.ftl_aliases
  for select using (auth.role() = 'authenticated');

-- ---- whole-word, longest-match canonicalization (mirrors the JS parser) ------
-- A term matches only as a whole word/phrase: spaces become \s+, edges are \m..\M.
create or replace function public.ftl_canonical_item(p text)
returns text language sql stable set search_path = public as $$
  select canonical from public.ftl_aliases
   where kind = 'item' and lower(p) ~ ('\m' || replace(term, ' ', '\s+') || '\M')
   order by length(term) desc limit 1;
$$;

create or replace function public.ftl_category_of(p text)
returns text language sql stable set search_path = public as $$
  select category from public.ftl_aliases
   where kind = 'item' and lower(p) ~ ('\m' || replace(term, ' ', '\s+') || '\M')
   order by length(term) desc limit 1;
$$;

create or replace function public.ftl_colors(p text)
returns text[] language sql stable set search_path = public as $$
  select coalesce(array_agg(distinct canonical), '{}')
    from public.ftl_aliases
   where kind = 'color' and lower(p) ~ ('\m' || replace(term, ' ', '\s+') || '\M');
$$;

-- ---- self-learning lexicon (live mirror of lib/lexicon.js) -------------------
create table if not exists public.lexicon (
  term text primary key,
  type text not null default 'item',
  canonical_id text,
  label text,
  category text,
  count int not null default 1,
  status text not null default 'pending', -- 'pending' until promoted, then 'learned'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lexicon enable row level security;
create policy "lexicon readable to members" on public.lexicon
  for select using (auth.role() = 'authenticated');

-- Record a sighting of an unrecognized term; promote after it recurs. SECURITY DEFINER
-- so the write path is controlled (clients can't arbitrarily rewrite the dictionary).
create or replace function public.bump_lexicon(p_term text, p_label text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into public.lexicon (term, label) values (lower(trim(p_term)), coalesce(p_label, p_term))
  on conflict (term) do update set count = public.lexicon.count + 1, updated_at = now()
  returning count into c;
  if c >= 2 then
    update public.lexicon set status = 'learned' where term = lower(trim(p_term)) and status = 'pending';
  end if;
end $$;
revoke all on function public.bump_lexicon(text, text) from public, anon;
grant execute on function public.bump_lexicon(text, text) to authenticated;

-- ---- matching v2 — mirrors src/lib/scoring.js scorePair() -------------------
create or replace function public.match_item(p_item_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  my_user uuid; my_kind text; my_blob text; my_item text; my_cat text; my_colors text[];
  my_lat double precision; my_lng double precision; my_occ timestamptz;
  r record;
  r_item text; r_colors text[]; r_blob text;
  s_sem numeric; s_attr numeric; s_loc numeric; s_time numeric; s_score numeric;
  s_km numeric; s_hours numeric; composite numeric;
  hits int := 0;
begin
  select user_id, kind, lower(name || ' ' || coalesce(description, '')),
         public.ftl_canonical_item(name || ' ' || coalesce(description, '')),
         coalesce(public.ftl_category_of(name || ' ' || coalesce(description, '')), category),
         public.ftl_colors(name || ' ' || coalesce(description, '')),
         lat, lng, occurred_at
    into my_user, my_kind, my_blob, my_item, my_cat, my_colors, my_lat, my_lng, my_occ
    from public.items where id = p_item_id;

  if my_user is null then raise exception 'item not found'; end if;
  if my_user <> auth.uid() then raise exception 'not authorized for this item'; end if;

  for r in
    select * from public.items
    where kind = case when my_kind = 'lost' then 'found' else 'lost' end
      and status not in ('closed', 'recovered', 'returned')
      and user_id <> my_user
  loop
    r_blob := lower(r.name || ' ' || coalesce(r.description, ''));
    r_item := public.ftl_canonical_item(r.name || ' ' || coalesce(r.description, ''));
    r_colors := public.ftl_colors(r.name || ' ' || coalesce(r.description, ''));

    -- MUST-MATCH GATE: two known, different item types are never the same object.
    if my_item is not null and r_item is not null and my_item <> r_item then
      continue;
    end if;

    -- SEMANTIC: canonical identity agreement dominates; else trigram text overlap
    -- approximates the JS distinctive-word Jaccard.
    if my_item is not null and r_item is not null and my_item = r_item then
      s_sem := 0.9;
    else
      s_sem := greatest(
        case when my_item is not null and r_item is not null then 0.05 else 0 end,
        similarity(my_blob, r_blob)
      );
    end if;

    -- ATTRIBUTES: category (0.6) + color overlap (0.4) / neutral 0.2 when unknown.
    s_attr := case when my_cat = coalesce(public.ftl_category_of(r.name || ' ' || coalesce(r.description,'')), r.category) then 0.6 else 0 end;
    if cardinality(my_colors) > 0 and cardinality(r_colors) > 0 then
      s_attr := s_attr + case when my_colors && r_colors then 0.4 else 0 end;
    else
      s_attr := s_attr + 0.2;
    end if;
    s_attr := least(1, s_attr);

    -- LOCATION tiers (km) + TIME tiers (hours), asymmetric time penalty.
    s_km := public.km_between(my_lat, my_lng, r.lat, r.lng);
    s_loc := case
      when s_km <= 0.05 then 1 when s_km <= 0.12 then 0.9 when s_km <= 0.25 then 0.78
      when s_km <= 0.5 then 0.6 when s_km <= 1 then 0.42 when s_km <= 2 then 0.25 else 0.1 end;
    s_hours := abs(extract(epoch from (my_occ - r.occurred_at)) / 3600.0);
    s_time := case
      when s_hours <= 2 then 1 when s_hours <= 6 then 0.9 when s_hours <= 24 then 0.78
      when s_hours <= 48 then 0.6 when s_hours <= 168 then 0.4 else 0.2 end;

    composite := 0.45 * s_sem + 0.2 * s_attr + 0.2 * s_loc + 0.15 * s_time;
    -- SEMANTIC FLOOR
    if s_sem < 0.3 then composite := least(composite, 0.5); end if;

    s_score := round(composite * 100);

    if s_score >= 55 then
      insert into public.matches (lost_item_id, found_item_id, score, breakdown, status)
      values (
        case when my_kind = 'lost' then p_item_id else r.id end,
        case when my_kind = 'lost' then r.id else p_item_id end,
        s_score,
        jsonb_build_object('semantic', round(s_sem * 100), 'attributes', round(s_attr * 100),
                           'location', round(s_loc * 100), 'time', round(s_time * 100), 'km', round(s_km, 3)),
        'pending'
      )
      on conflict (lost_item_id, found_item_id)
        do update set score = excluded.score, breakdown = excluded.breakdown;
      hits := hits + 1;
    end if;
  end loop;
  return hits;
end $$;

revoke all on function public.match_item(uuid) from public, anon;
grant execute on function public.match_item(uuid) to authenticated;
