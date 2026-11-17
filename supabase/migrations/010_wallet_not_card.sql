-- 010_wallet_not_card.sql — keeps match_item in step with src/lib/scoring.js (Nov 16, 2026).
-- Idempotent; safe to re-run. Run after 009.
--
--   • wallet is no longer a neighbour of card / ucard: a found wallet and a lost UCard are
--     different objects (a lost wallet was matching a found UCard at 70+).
--   • neighbouring item types (earbuds ↔ airpods case, card ↔ ucard, …) pay ×0.8 instead of
--     ×0.9, so they only cross the 55 threshold with place, time and colour agreeing.

create or replace function public.ftl_item_neighbor(a text, b text)
returns boolean language sql immutable as $$
  select (a, b) in (
    ('earbuds','airpods_case'), ('airpods_case','earbuds'),
    ('water_bottle','coffee_cup'), ('coffee_cup','water_bottle'),
    ('card','ucard'), ('ucard','card'),
    ('notebook','textbook'), ('textbook','notebook'),
    ('pen','pencil_case'), ('pencil_case','pen'))
$$;

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
    -- neighbouring item types (earbuds ↔ airpods case, wallet ↔ card/ucard) are a weak match, not a reject
    if my_item is not null and r_item is not null and my_item <> r_item and not public.ftl_item_neighbor(my_item, r_item) then continue; end if;
    if my_brand is not null and r_brand is not null and my_brand <> r_brand then continue; end if;
    color_penalty := 1;
    if cardinality(my_colors)=0 or cardinality(r_colors)=0 then color_attr := 0.2;
    elsif my_colors && r_colors then color_attr := 0.4;
    elsif exists (select 1 from unnest(my_colors) x, unnest(r_colors) y where public.ftl_color_neighbor(x,y)) then color_attr := 0.1; color_penalty := 0.78;
    else continue; end if;
    if my_item is not null and r_item is not null and my_item = r_item then s_sem := greatest(0.9, similarity(my_blob, r_blob));
    elsif my_item is not null and r_item is not null and public.ftl_item_neighbor(my_item, r_item) then s_sem := greatest(0.65, similarity(my_blob, r_blob));
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
    if my_item is not null and r_item is not null and my_item <> r_item then composite := composite * 0.8; end if; -- neighbour item type
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
