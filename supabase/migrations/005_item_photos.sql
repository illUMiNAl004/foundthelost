-- ============================================================================
-- foundthelost — item photos (Snap & Fill), Sept 2026. Run AFTER 004.
-- Private Storage bucket. Objects live at  <owner uuid>/<item uuid>.jpg
--   • the owner can upload/read/delete their own photos
--   • a matched party can READ the photo (same rule as the item row itself,
--     via item_visible_to_me) — so the owner of a lost item sees the finder's photo.
-- Also stores the model's structured answer on the item (items.attributes).
-- Safe to re-run.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-photos', 'item-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- object name → the item uuid it belongs to (null when the name isn't in our shape)
create or replace function public.photo_item_id(p_name text)
returns uuid language sql immutable as $$
  select case
    when p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
    then split_part(split_part(p_name, '/', 2), '.', 1)::uuid
  end;
$$;

drop policy if exists "photos: owner insert" on storage.objects;
drop policy if exists "photos: owner update" on storage.objects;
drop policy if exists "photos: owner delete" on storage.objects;
drop policy if exists "photos: owner or matched read" on storage.objects;

create policy "photos: owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "photos: owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "photos: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "photos: owner or matched read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'item-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.item_visible_to_me(public.photo_item_id(name))
    )
  );

-- items.photo_url holds the object PATH (not a URL); the client mints short-lived
-- signed URLs. items.attributes gets {"vision": {...}} with the model's answer.
comment on column public.items.photo_url is 'storage path in bucket item-photos: <owner>/<item>.jpg';
comment on column public.items.attributes is 'jsonb; "vision" key = normalized Snap & Fill result';
