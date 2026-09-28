-- foundthelost DB test suite — RLS, matching, chat, karma, lexicon.
-- Run via scripts/db-test/run.sh (applies the shim + every migration first).
-- Each check writes a row to t.results; the summary at the bottom fails the run
-- (non-zero exit) if anything failed.
\set ON_ERROR_STOP 1
\pset footer off
set client_min_messages = warning;
\o /dev/null

-- ---- harness ----------------------------------------------------------------
reset role;
drop schema if exists t cascade;
create schema t;
create table t.results (n serial, label text, pass boolean, detail text);
create function t.ok(cond boolean, label text, detail text default null) returns void
  language sql security definer as $$ insert into t.results (label, pass, detail) values (label, coalesce(cond, false), detail) $$;
-- run an arbitrary statement as the CURRENT role; true if it raised
create function t.raises(stmt text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then return true; end $$;
-- rows affected by a statement as the current role
create function t.affected(stmt text) returns int language plpgsql as $$
declare n int; begin execute stmt; get diagnostics n = row_count; return n;
exception when others then return -1; end $$;
-- a count(*)-style scalar as the current role; -1 if it raised
create function t.n(stmt text) returns int language plpgsql as $$
declare v int; begin execute stmt into v; return v; exception when others then return -1; end $$;
-- error message of a failing statement ('' if it succeeded)
create function t.errmsg(stmt text) returns text language plpgsql as $$
begin execute stmt; return ''; exception when others then return sqlerrm; end $$;
grant usage on schema t to anon, authenticated;
grant execute on all functions in schema t to anon, authenticated;

\set A '''aaaaaaaa-0000-4000-8000-000000000001'''
\set B '''bbbbbbbb-0000-4000-8000-000000000002'''
\set C '''cccccccc-0000-4000-8000-000000000003'''
\set asA 'reset role; set request.jwt.claims to ''{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}''; set role authenticated;'
\set asB 'reset role; set request.jwt.claims to ''{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}''; set role authenticated;'
\set asC 'reset role; set request.jwt.claims to ''{"sub":"cccccccc-0000-4000-8000-000000000003","role":"authenticated"}''; set role authenticated;'
\set asAnon 'reset role; set request.jwt.claims to ''{"role":"anon"}''; set role anon;'
\set asSuper 'reset role; set request.jwt.claims to ''{}'';'

-- ---- 1. signup trigger + @umass.edu enforcement -----------------------------
:asSuper
-- 007 ships sign-up as invite-only; open it so the fixture students can be created
-- directly. Section 7 flips it back and exercises the gate itself.
select public.set_signup_mode('open');
insert into auth.users (id, email, raw_user_meta_data) values
  (:A, 'alice@umass.edu', '{"name":"Alice"}'),
  (:B, 'Bob@UMASS.EDU', '{"name":"Bob"}'),
  (:C, 'carol@students.umass.edu', '{}');
select t.ok((select count(*) from profiles) = 3, 'signup: trigger creates a profile per user');
select t.ok((select name from profiles where id = :C) = 'carol', 'signup: name falls back to email local-part');
select t.ok(t.raises($$insert into auth.users (email) values ('evil@gmail.com')$$), 'signup: non-umass email rejected');
select t.ok(t.raises($$insert into auth.users (email) values ('x@umass.edu.evil.com')$$), 'signup: umass.edu suffix spoof rejected');

-- ---- 2. items + RLS -----------------------------------------------------------
-- Berkshire DC (-72.5310, 42.3818) · ILC (-72.5258, 42.3912)
:asA
insert into items (id, user_id, kind, name, category, description, lat, lng, building, status, occurred_at) values
  ('11111111-0000-4000-8000-00000000000a', :A, 'lost', 'White AirPods Pro', 'electronics',
   'white airpods pro case, small scratch near the hinge, lost at berkshire around 2pm', 42.3818, -72.5310, 'Berkshire Dining Commons', 'still searching', now() - interval '3 hours'),
  ('11111111-0000-4000-8000-00000000000b', :A, 'lost', 'Silver MacBook Air', 'electronics',
   'silver macbook air laptop left in the ilc', 42.3912, -72.5258, 'ILC', 'still searching', now() - interval '5 hours'),
  ('11111111-0000-4000-8000-00000000000c', :A, 'lost', 'Black Hydro Flask', 'bottles',
   'black hydro flask water bottle with stickers near the ilc', 42.3912, -72.5258, 'ILC', 'still searching', now() - interval '4 hours');
select t.ok(t.raises($$insert into items (user_id, kind, name, lat, lng) values ('bbbbbbbb-0000-4000-8000-000000000002', 'lost', 'forged', 42, -72)$$),
  'items: cannot insert an item as someone else');

:asB
insert into items (id, user_id, kind, name, category, description, lat, lng, building, status, occurred_at) values
  ('22222222-0000-4000-8000-00000000000a', :B, 'found', 'White AirPods Pro', 'electronics',
   'white airpods pro in a case found on a table at berkshire', 42.38185, -72.53105, 'Berkshire Dining Commons', 'with you', now() - interval '2 hours'),
  ('22222222-0000-4000-8000-00000000000b', :B, 'found', 'Black iPhone', 'electronics',
   'black iphone phone found at the ilc', 42.3912, -72.5258, 'ILC', 'dropped off', now() - interval '4 hours'),
  ('22222222-0000-4000-8000-00000000000c', :B, 'found', 'White Hydro Flask', 'bottles',
   'white hydro flask water bottle at the ilc', 42.3912, -72.5258, 'ILC', 'left in place', now() - interval '3 hours'),
  ('22222222-0000-4000-8000-00000000000d', :B, 'found', 'Blue Umbrella', 'other',
   'blue umbrella by the entrance', 42.3818, -72.5310, 'Berkshire Dining Commons', 'with you', now() - interval '2 hours');
select t.ok((select count(*) from items where user_id = 'aaaaaaaa-0000-4000-8000-000000000001') = 0, 'rls: B cannot read A''s items');
select t.ok(t.affected($$update items set name = 'pwned' where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$) = 0, 'rls: B cannot update A''s items');
select t.ok(t.affected($$delete from items where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$) = 0, 'rls: B cannot delete A''s items');
:asA
select t.ok((select count(*) from items where user_id = 'bbbbbbbb-0000-4000-8000-000000000002') = 0, 'rls: A cannot read B''s unmatched found items');
:asAnon
select t.ok(t.n('select count(*) from items') = 0, 'rls: anon reads zero items (no error)', t.n('select count(*) from items')::text);
select t.ok(t.n('select count(*) from profiles') = 0, 'rls: anon cannot read profiles');

-- ---- 3. server-side matching ------------------------------------------------------
:asB
select public.match_item('22222222-0000-4000-8000-00000000000a');
select public.match_item('22222222-0000-4000-8000-00000000000b');
select public.match_item('22222222-0000-4000-8000-00000000000c');
select public.match_item('22222222-0000-4000-8000-00000000000d');
:asC
select t.ok(t.raises($$select public.match_item('22222222-0000-4000-8000-00000000000a')$$), 'match_item: outsider cannot run matching on someone else''s item');
select t.ok(t.raises($$insert into matches (lost_item_id, found_item_id, score) values ('11111111-0000-4000-8000-00000000000a', '22222222-0000-4000-8000-00000000000d', 99)$$),
  'matches: clients cannot forge a match row');
:asAnon
select t.ok(t.raises($$select public.match_item('22222222-0000-4000-8000-00000000000a')$$), 'match_item: anon cannot execute');

:asSuper
select t.ok(exists (select 1 from matches where lost_item_id = '11111111-0000-4000-8000-00000000000a' and found_item_id = '22222222-0000-4000-8000-00000000000a' and score >= 55),
  'match: AirPods ↔ AirPods matched', (select score::text from matches where found_item_id = '22222222-0000-4000-8000-00000000000a'));
select t.ok(not exists (select 1 from matches where lost_item_id = '11111111-0000-4000-8000-00000000000b'), 'match: laptop ↔ phone gated (no match)');
select t.ok(not exists (select 1 from matches where lost_item_id = '11111111-0000-4000-8000-00000000000c'), 'match: black ↔ white flask gated (no match)');
select t.ok(not exists (select 1 from matches where found_item_id = '22222222-0000-4000-8000-00000000000d'), 'match: umbrella matched nothing');
select t.ok((select count(*) from matches) = 1, 'match: exactly one match overall', (select count(*)::text from matches));

-- A re-running match from the lost side must upsert, not duplicate
:asA
select public.match_item('11111111-0000-4000-8000-00000000000a');
:asSuper
select t.ok((select count(*) from matches) = 1, 'match: re-matching from the other side upserts (no duplicate)');

-- visibility through the match
:asA
select t.ok((select count(*) from items where id = '22222222-0000-4000-8000-00000000000a') = 1, 'visibility: owner sees the matched found item');
select t.ok((select count(*) from items where id in ('22222222-0000-4000-8000-00000000000b', '22222222-0000-4000-8000-00000000000c', '22222222-0000-4000-8000-00000000000d')) = 0,
  'visibility: owner does not see unmatched found items');
select t.ok((select count(*) from matches) = 1, 'visibility: owner sees their match row');
:asC
select t.ok((select count(*) from matches) = 0, 'visibility: outsider sees no matches');
select t.ok((select count(*) from items) = 0, 'visibility: outsider sees no items');

-- ---- 4. chat --------------------------------------------------------------------
:asSuper
select id as mid from matches limit 1 \gset
:asA
insert into conversations (id, match_id, item_label, participant_a, participant_b)
  select '33333333-0000-4000-8000-00000000000a', id, '🎧 White AirPods Pro', :A, :B from matches limit 1;
select t.ok((select count(*) from conversations) = 1, 'chat: match party can open a conversation');
select pg_sleep(0.02);
insert into messages (conversation_id, sender_id, content) values ('33333333-0000-4000-8000-00000000000a', :A, 'hey, I think those are mine!');
select t.ok(t.raises($$insert into messages (conversation_id, sender_id, content) values ('33333333-0000-4000-8000-00000000000a', 'bbbbbbbb-0000-4000-8000-000000000002', 'spoofed')$$),
  'chat: cannot send a message as someone else');
:asB
select t.ok((select count(*) from messages where conversation_id = '33333333-0000-4000-8000-00000000000a') = 1, 'chat: other participant reads the message');
:asC
select t.ok((select count(*) from conversations) = 0, 'chat: outsider cannot see the conversation');
select t.ok((select count(*) from messages) = 0, 'chat: outsider cannot read messages');
select t.ok(t.raises($$insert into messages (conversation_id, sender_id, content) values ('33333333-0000-4000-8000-00000000000a', 'cccccccc-0000-4000-8000-000000000003', 'let me in')$$),
  'chat: outsider cannot post into the conversation');
-- spam: opening a DM with anyone, without a match
select t.ok(t.raises($$insert into conversations (participant_a, participant_b, item_label) values ('cccccccc-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'hi')$$),
  'chat: cannot open a conversation without a match (anti-spam)');
select t.ok(t.raises(format('insert into conversations (match_id, participant_a, participant_b) values (%L, %L, %L)', :'mid', 'cccccccc-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001')),
  'chat: cannot hijack someone else''s match to open a conversation');
:asA
select t.ok(t.raises(format('insert into conversations (match_id, participant_a, participant_b) values (%L, %L, %L)', :'mid', 'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000003')),
  'chat: cannot pull a stranger into a match conversation');

:asSuper
select t.ok((select c.last_message_at = (select max(created_at) from messages m where m.conversation_id = c.id)
             from conversations c where id = '33333333-0000-4000-8000-00000000000a'),
  'chat: sending a message bumps conversations.last_message_at (trigger under RLS)');

-- read receipts: only the recipient marks read, and nobody can edit message content
:asB
select t.ok(not t.raises($$select public.mark_conversation_read('33333333-0000-4000-8000-00000000000a')$$), 'chat: recipient can mark the conversation read');
select t.ok(t.affected($$update messages set content = 'edited' where conversation_id = '33333333-0000-4000-8000-00000000000a'$$) <= 0, 'chat: message content cannot be edited');
:asSuper
select t.ok((select read_at is not null from messages where conversation_id = '33333333-0000-4000-8000-00000000000a' limit 1), 'chat: read_at set for the recipient');
select t.ok((select content from messages where conversation_id = '33333333-0000-4000-8000-00000000000a' limit 1) = 'hey, I think those are mine!', 'chat: content unchanged');
select t.ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages'), 'chat: messages published to realtime');

-- ---- 5. karma (server-side only) ---------------------------------------------------
:asSuper
select t.ok((select karma from profiles where id = :B) = 100, 'karma: +25 per found report (B reported 4)', (select karma::text from profiles where id = :B));
select t.ok((select karma from profiles where id = :A) = 0, 'karma: lost reports earn nothing');
:asB
select t.ok(t.affected($$update profiles set karma = 99999 where id = 'bbbbbbbb-0000-4000-8000-000000000002'$$) <= 0, 'karma: users cannot write their own karma');
select t.ok(t.affected($$update profiles set name = 'Bobby' where id = 'bbbbbbbb-0000-4000-8000-000000000002'$$) = 1, 'profiles: users can still rename themselves');
select t.ok(t.affected($$update profiles set name = 'owned' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$) <= 0, 'profiles: cannot rename someone else');
:asC
select t.ok(t.raises(format('select public.mark_returned(%L)', :'mid')),
  'returned: outsider cannot mark a match returned');
:asB
select t.ok(not t.raises($$select public.mark_returned((select id from public.matches limit 1))$$), 'returned: finder can mark the match returned');
select t.raises($$select public.mark_returned((select id from public.matches limit 1))$$); -- idempotent: no double award
:asSuper
select t.ok((select karma from profiles where id = :B) = 150, 'returned: finder earns +50 once', (select karma::text from profiles where id = :B));
select t.ok((select items_returned from profiles where id = :B) = 1, 'returned: items_returned incremented once');
select t.ok((select status from items where id = '22222222-0000-4000-8000-00000000000a') = 'returned', 'returned: found item closed as returned');
select t.ok((select status from items where id = '11111111-0000-4000-8000-00000000000a') = 'recovered', 'returned: lost item closed as recovered');
select t.ok((select status from matches limit 1) = 'returned', 'returned: match closed');
-- rate limit: a burst of found reports can't farm karma
:asC
insert into items (user_id, kind, name, lat, lng) select :C, 'found', 'thing ' || g, 42.39, -72.53 from generate_series(1, 8) g;
:asSuper
select t.ok((select karma from profiles where id = :C) = 125, 'karma: found-report karma capped at 5 per 24h', (select karma::text from profiles where id = :C));

-- ---- 5b. item photos (005): private bucket, owner write, matched-party read -------
:asB
select t.ok(not t.raises($$insert into storage.objects (bucket_id, name, owner) values ('item-photos', 'bbbbbbbb-0000-4000-8000-000000000002/22222222-0000-4000-8000-00000000000a.jpg', 'bbbbbbbb-0000-4000-8000-000000000002')$$),
  'photos: owner can upload into their own folder');
select t.ok(t.raises($$insert into storage.objects (bucket_id, name) values ('item-photos', 'aaaaaaaa-0000-4000-8000-000000000001/x.jpg')$$),
  'photos: cannot upload into someone else''s folder');
:asA
select t.ok(t.n($$select count(*) from storage.objects where name = 'bbbbbbbb-0000-4000-8000-000000000002/22222222-0000-4000-8000-00000000000a.jpg'$$) = 1,
  'photos: owner of the matched lost item can read the finder''s photo');
:asC
select t.ok(t.n($$select count(*) from storage.objects where bucket_id = 'item-photos'$$) = 0, 'photos: unrelated user cannot read the photo');
:asAnon
select t.ok(t.n($$select count(*) from storage.objects where bucket_id = 'item-photos'$$) <= 0, 'photos: anon cannot read photos');
:asSuper
select t.ok((select not public from storage.buckets where id = 'item-photos'), 'photos: bucket is private');

-- ---- 5c. waitlist (006): anon RPCs only, umass-only referral credit, throttle, stats ---
:asAnon
select public.join_waitlist('First@Example.com', 'First', null, 'test') as j1 \gset w1_
select t.ok((:'w1_j1'::jsonb ->> 'position')::int = 1 and length(:'w1_j1'::jsonb ->> 'referral_code') > 0, 'waitlist: first join → position 1 + code', :'w1_j1');
select t.ok((:'w1_j1'::jsonb ->> 'founding')::boolean, 'founding: first joiner is a founding member');
select t.ok((:'w1_j1'::jsonb ->> 'join_order')::int = 1, 'join_order: first joiner = 1');
select t.ok((:'w1_j1'::jsonb ->> 'total')::int = 1 and (:'w1_j1'::jsonb ->> 'lost_item') is null, 'waitlist: standing carries total + (empty) lost_item');
select public.join_waitlist('first@example.com') as j1b \gset w1b_
select t.ok((:'w1b_j1b'::jsonb ->> 'existing')::boolean and (:'w1b_j1b'::jsonb ->> 'referral_code') = (:'w1_j1'::jsonb ->> 'referral_code'),
  'waitlist: re-join same email (case-insensitive) → existing, same code');
select public.join_waitlist('second@umass.edu', 'Second') as j2 \gset w2_
select t.ok((:'w2_j2'::jsonb ->> 'position')::int = 2 and (:'w2_j2'::jsonb ->> 'umass')::boolean, 'waitlist: second join → position 2, flagged umass');
select t.ok((:'w2_j2'::jsonb ->> 'join_order')::int = 2, 'join_order: second joiner = 2');
-- a throwaway gmail joining with Second's code earns Second nothing
select public.join_waitlist('farm1@gmail.com', null, :'w2_j2'::jsonb ->> 'referral_code') as j3 \gset w3_
select public.waitlist_standing(:'w2_j2'::jsonb ->> 'referral_code') as s2a \gset w2a_
select t.ok((:'w2a_s2a'::jsonb ->> 'referrals')::int = 0 and (:'w2a_s2a'::jsonb ->> 'position')::int = 2,
  'waitlist: gmail referred joiner does NOT bump the referrer', :'w2a_s2a');
select t.ok(not (:'w3_j3'::jsonb ->> 'umass')::boolean, 'waitlist: gmail joiner flagged non-umass');
-- a real campus address joining with the code (lower-cased, padded) does
select public.join_waitlist('third@students.umass.edu', null, ' ' || lower(:'w2_j2'::jsonb ->> 'referral_code') || ' ') as j4 \gset w4_
select public.waitlist_standing(:'w2_j2'::jsonb ->> 'referral_code') as s2 \gset w2s_
select t.ok((:'w2s_s2'::jsonb ->> 'referrals')::int = 1 and (:'w2s_s2'::jsonb ->> 'position')::int = 1,
  'waitlist: umass referred joiner bumps the referrer to position 1', :'w2s_s2');
select t.ok((:'w4_j4'::jsonb ->> 'umass')::boolean and (:'w4_j4'::jsonb ->> 'position')::int = 4, 'waitlist: referred joiner lands at the back (position 4)', :'w4_j4');
select t.ok((:'w4_j4'::jsonb ->> 'join_order')::int = 4, 'join_order: fourth joiner = 4');
select t.ok((:'w2s_s2'::jsonb ->> 'join_order')::int = 2 and (:'w2s_s2'::jsonb ->> 'position')::int = 1, 'join_order: fixed at join time even after a referral moves position to 1');
:asSuper
select t.ok((select referred_by from waitlist where email = 'third@students.umass.edu') = (select id from waitlist where email = 'second@umass.edu'), 'waitlist: referred_by recorded');
select t.ok((select referred_by from waitlist where email = 'farm1@gmail.com') = (select id from waitlist where email = 'second@umass.edu'), 'waitlist: gmail joiner still linked to referrer (just no credit)');
:asAnon
select t.ok(t.raises($$select public.join_waitlist('not-an-email')$$), 'waitlist: invalid email rejected');
select t.ok(t.raises($$select public.join_waitlist('someone@umass.edu', null, 'NOSUCHCODE')$$) = false, 'waitlist: unknown referral code is ignored, not an error'); -- (someone@umass.edu is now on the list)
select t.ok(t.raises($$select * from public.waitlist$$), 'waitlist: anon cannot read the table');
select t.ok(t.raises($$insert into public.waitlist (email, referral_code) values ('x@y.com', 'ZZZ')$$), 'waitlist: anon cannot insert directly');
select t.ok(t.raises($$select public.waitlist_new_code()$$), 'waitlist: anon cannot call waitlist_new_code');
select t.ok(t.raises($$select public.waitlist_rank_of(gen_random_uuid())$$), 'waitlist: anon cannot call waitlist_rank_of');
select t.ok(public.waitlist_count() = 5, 'waitlist: count RPC works for anon', public.waitlist_count()::text);
select t.ok(public.waitlist_standing('NOPE-NOT-A-CODE') is null, 'waitlist: unknown code → null');
:asB
select t.ok(t.raises($$select * from public.waitlist$$), 'waitlist: signed-in users cannot read the table either');
select t.ok(t.raises($$select public.waitlist_rank_of(gen_random_uuid())$$), 'waitlist: signed-in users cannot call internals');

-- live stats row (PII-free) ----------------------------------------------------------
:asAnon
select t.ok(t.n('select total from public.waitlist_stats') = 5, 'stats: anon reads total (= 5 joins)', t.n('select total from public.waitlist_stats')::text);
select t.ok(t.affected($$update public.waitlist_stats set total = 9999 where id = 1$$) <= 0, 'stats: anon cannot update the stats row');
select t.ok(t.affected($$delete from public.waitlist_stats$$) <= 0, 'stats: anon cannot delete the stats row');
select t.ok(t.raises($$insert into public.waitlist_stats (id, total) values (2, 0)$$), 'stats: anon cannot insert a stats row');
select t.ok(not has_function_privilege('anon', 'public.waitlist_standing_of(public.waitlist, boolean)', 'execute')
        and not has_function_privilege('authenticated', 'public.waitlist_standing_of(public.waitlist, boolean)', 'execute'),
  'stats: waitlist_standing_of not executable by anon/authenticated');
select t.ok(not has_function_privilege('anon', 'public.waitlist_refresh_stats()', 'execute')
        and not has_function_privilege('authenticated', 'public.waitlist_refresh_stats()', 'execute'),
  'stats: waitlist_refresh_stats not executable by anon/authenticated');
select t.ok(t.raises($$select public.waitlist_standing_of(null::public.waitlist, false)$$), 'stats: calling waitlist_standing_of as anon raises');
:asSuper
select t.ok((select total from waitlist_stats) = (select count(*) from waitlist), 'stats: total tracks count(*)');
select t.ok((select by_item from waitlist_stats) = '{}'::jsonb and (select last_item from waitlist_stats) is null, 'stats: no stickers yet → by_item {} + last_item null');

-- "what did you last lose?" sticker ------------------------------------------------------
:asAnon
select public.waitlist_set_lost_item(:'w1_j1'::jsonb ->> 'referral_code', 'airpods') as li \gset li_
select t.ok((:'li_li'::jsonb ->> 'item') = 'airpods' and (:'li_li'::jsonb ->> 'count')::int = 1, 'sticker: set airpods → {item, count 1}', :'li_li');
select t.ok(t.n($$select (by_item ->> 'airpods')::int from public.waitlist_stats$$) = 1, 'sticker: by_item.airpods = 1');
select t.ok((select last_item from public.waitlist_stats) = 'airpods', 'sticker: last_item = airpods');
select t.ok((public.waitlist_standing(:'w1_j1'::jsonb ->> 'referral_code') ->> 'lost_item') = 'airpods', 'sticker: my standing shows my lost_item');
select public.waitlist_set_lost_item(lower(:'w2_j2'::jsonb ->> 'referral_code'), 'airpods') as li2 \gset li2_
select t.ok((:'li2_li2'::jsonb ->> 'count')::int = 2 and t.n($$select (by_item ->> 'airpods')::int from public.waitlist_stats$$) = 2, 'sticker: second airpods → count 2 (code case-insensitive)');
select public.waitlist_set_lost_item(:'w2_j2'::jsonb ->> 'referral_code', 'keys') as li3 \gset li3_
select t.ok((:'li3_li3'::jsonb ->> 'count')::int = 1 and t.n($$select (by_item ->> 'airpods')::int from public.waitlist_stats$$) = 1
        and (select last_item from public.waitlist_stats) = 'keys', 'sticker: changing mine moves the count (airpods 1, keys 1) + last_item');
select t.ok(t.raises($$select public.waitlist_set_lost_item('ANYCODE', 'kidney')$$), 'sticker: unknown item raises');
select t.ok(public.waitlist_set_lost_item('NOPE-NOT-A-CODE', 'airpods') is null, 'sticker: unknown code → null');
select t.ok(t.n($$select (by_item ->> 'airpods')::int from public.waitlist_stats$$) = 1, 'sticker: failed calls leave stats untouched');
-- the ticker: a plain join (no sticker yet) must not blank the last sticker
select public.join_waitlist('fourth@umass.edu') as j5 \gset w5_
select t.ok((select last_item from public.waitlist_stats) = 'keys', 'sticker: a new join keeps last_item (ticker never blanks)', coalesce((select last_item from public.waitlist_stats), 'null'));
select t.ok(t.n('select total from public.waitlist_stats') = 6, 'stats: total = 6 after the 6th join');
select public.waitlist_set_lost_item(:'w1_j1'::jsonb ->> 'referral_code', null) as li4 \gset li4_
select t.ok((:'li4_li4'::jsonb ->> 'item') is null and (select by_item ? 'airpods' from public.waitlist_stats) = false, 'sticker: null clears mine and drops it from by_item');

-- founding: only the first 500 rows ---------------------------------------------------------
:asSuper
insert into public.waitlist (email, referral_code, created_at)
  select 'early' || g || '@umass.edu', 'E' || lpad(g::text, 5, '0'), now() - interval '2 hours' from generate_series(1, 500) g;
select t.ok((select total from waitlist_stats) = 506, 'stats: total tracks a bulk insert (506)');
select t.ok((select (public.waitlist_standing_of(w, false) ->> 'founding')::boolean from waitlist w where email = 'early500@umass.edu'), 'founding: the 500th row is founding');
:asAnon
select public.join_waitlist('late@umass.edu') as j6 \gset w6_
select t.ok(not (:'w6_j6'::jsonb ->> 'founding')::boolean and (:'w6_j6'::jsonb ->> 'total')::int = 507, 'founding: the 507th joiner is NOT founding', :'w6_j6');
select t.ok((:'w6_j6'::jsonb ->> 'join_order')::int = 507, 'join_order: 507th joiner = 507 (earlier-dated rows count)');
select t.ok(not (public.waitlist_standing(:'w1_j1'::jsonb ->> 'referral_code') ->> 'founding')::boolean, 'founding: first joiner drops out once 500 earlier rows exist');
-- re-arm the ticker right before the deletes so these checks isolate the DELETE branch
:asAnon
select public.waitlist_set_lost_item(:'w1_j1'::jsonb ->> 'referral_code', 'wallet');
select public.waitlist_set_lost_item(:'w5_j5'::jsonb ->> 'referral_code', 'bottle');
:asSuper
delete from public.waitlist where email like 'early%';
select t.ok((select total from waitlist_stats) = 7, 'stats: deletes keep total in sync (back to 7)');
select t.ok((select last_item from waitlist_stats) = 'bottle', 'stats: deleting unstickered rows keeps last_item');
delete from public.waitlist where email = 'fourth@umass.edu';
select t.ok((select by_item ? 'bottle' from waitlist_stats) = false and (select total from waitlist_stats) = 6, 'stats: deleting a stickered row drops it from by_item + total');
select t.ok((select last_item from waitlist_stats) = 'bottle', 'sticker: deleting a stickered row keeps last_item (ticker never blanks)', coalesce((select last_item from waitlist_stats), 'null'));
select t.ok((public.waitlist_standing(:'w1_j1'::jsonb ->> 'referral_code') ->> 'founding')::boolean, 'founding: first joiner is founding again (< 500 rows)');

-- throttle: 120 joins in the last minute → the next NEW join is refused, existing still answers
:asSuper
insert into public.waitlist (email, referral_code)
  select 'burst' || g || '@umass.edu', 'B' || lpad(g::text, 5, '0') from generate_series(1, 120) g;
:asAnon
select t.ok(t.raises($$select public.join_waitlist('toolate@umass.edu')$$), 'waitlist: 120/min throttle refuses a new join');
select t.ok(not t.raises($$select public.join_waitlist('first@example.com')$$), 'waitlist: throttle does not block an existing member re-checking');
:asSuper
delete from public.waitlist where email like 'burst%';

-- ---- 6. self-learning lexicon ---------------------------------------------------------
:asA
select public.bump_lexicon('squishmallow');
select public.bump_lexicon('squishmallow');
:asSuper
select t.ok((select status from lexicon where term = 'squishmallow') = 'pending', 'lexicon: one user repeating a word does not promote it');
:asB
select public.bump_lexicon('Squishmallow ');
:asSuper
select t.ok((select status from lexicon where term = 'squishmallow') = 'learned', 'lexicon: promoted once a second student uses it');
:asA
select public.bump_lexicon(repeat('x', 200));
select public.bump_lexicon('<script>alert(1)</script>');
:asSuper
select t.ok((select count(*) from lexicon where length(term) > 40 or term ~ '[^a-z0-9 -]') = 0, 'lexicon: junk / oversized terms ignored');
:asAnon
select t.ok(t.raises($$select public.bump_lexicon('anon')$$), 'lexicon: anon cannot bump');

-- ---- 7. invite-only sign-up gate (007) -------------------------------------------------
:asSuper
select public.set_signup_mode('invite'); -- back to the shipped default
select t.ok(position('signup_allowed' in pg_get_functiondef('public.handle_new_user()'::regprocedure)) > 0, 'gate: 007 handle_new_user is the live trigger body (survives the 001 re-apply)');
select t.ok((select count(*) from pg_trigger where tgname = 'on_auth_user_created' and not tgisinternal) = 1, 'gate: signup trigger still wired');
-- (a) invite mode: a umass email that never joined the waitlist is refused
select t.errmsg($$insert into auth.users (email) values ('nobody@umass.edu')$$) as m \gset ga_
select t.ok(:'ga_m' like 'Invite-only%', 'gate: invite mode refuses a umass email not on the waitlist', :'ga_m');
select t.ok((select count(*) from profiles) = 3, 'gate: refused signup left no profile behind');
:asAnon
select public.waitlist_standing(:'w2_j2'::jsonb ->> 'referral_code') as st \gset gs0_
select t.ok(not (:'gs0_st'::jsonb ->> 'approved')::boolean and not (:'gs0_st'::jsonb ->> 'activated')::boolean, 'standing: approved=false, activated=false while waiting in invite mode');
:asSuper
-- (b) approve → sign up → activated
select t.ok(public.approve_waitlist(array[' X@umass.edu '], 'pilot') = 1, 'approve: approving a never-joined email inserts + approves → 1');
select t.ok(public.approve_waitlist(array['x@umass.edu'], 'again') = 0, 'approve: second approval is a no-op → 0');
select t.ok((select approved_note from waitlist where email = 'x@umass.edu') = 'pilot', 'approve: first note kept');
select referral_code as xcode from waitlist where email = 'x@umass.edu' \gset gx_
:asAnon
select public.waitlist_standing(:'gx_xcode') as st \gset gs1_
select t.ok((:'gs1_st'::jsonb ->> 'approved')::boolean and not (:'gs1_st'::jsonb ->> 'activated')::boolean, 'standing: approved=true, activated=false right after approval');
:asSuper
insert into auth.users (id, email, raw_user_meta_data) values ('dddddddd-0000-4000-8000-000000000004', 'X@umass.edu', '{"name":"Dana"}');
select t.ok((select name from profiles where id = 'dddddddd-0000-4000-8000-000000000004') = 'Dana', 'approve: approved email signs up + gets a profile');
select t.ok((select activated_at is not null from waitlist where email = 'x@umass.edu'), 'approve: waitlist row marked activated');
:asAnon
select t.ok((public.waitlist_standing(:'gx_xcode') ->> 'activated')::boolean, 'standing: activated=true after sign-up');
:asSuper
select t.ok((select source from waitlist where email = 'x@umass.edu') = 'admin', 'approve: admin-added rows tagged source=admin');
-- (c) domain rule still wins over approval
select t.ok(public.approve_waitlist(array['outsider@gmail.com']) = 1, 'approve: a non-umass email can be approved…');
select t.errmsg($$insert into auth.users (email) values ('outsider@gmail.com')$$) as m \gset gc_
select t.ok(:'gc_m' like 'Only @umass.edu%', 'gate: …but still cannot sign up (domain check first)', :'gc_m');
select t.errmsg($$select public.approve_waitlist(array['ok@umass.edu', 'junk'])$$) as m \gset gj_
select t.ok(:'gj_m' like 'not an email:%', 'approve: a junk email raises', :'gj_m');
select t.ok(not exists (select 1 from waitlist where email in ('junk', 'ok@umass.edu')), 'approve: a bad email rolls back the whole batch');
-- (d) the pre-check the sign-up form uses
:asAnon
select t.ok(public.signup_allowed('unknown@umass.edu') = false, 'signup_allowed: false for an unknown email');
select t.ok(public.signup_allowed(' X@UMASS.EDU ') = true, 'signup_allowed: true for an approved email (case/space-insensitive)');
select t.ok(public.signup_allowed('outsider@gmail.com') = true, 'signup_allowed: reports approval only — the domain check is the trigger''s job');
:asSuper
select t.ok(public.set_signup_mode('open') = 'open', 'mode: set_signup_mode(open)');
:asAnon
select t.ok(public.signup_allowed('anyone@umass.edu') = true, 'signup_allowed: true for anyone in open mode');
select t.ok((public.waitlist_standing(:'w2_j2'::jsonb ->> 'referral_code') ->> 'approved')::boolean, 'standing: approved=true for everyone in open mode');
:asSuper
insert into auth.users (id, email) values ('eeeeeeee-0000-4000-8000-000000000005', 'nowait@umass.edu');
select t.ok((select count(*) from profiles where id = 'eeeeeeee-0000-4000-8000-000000000005') = 1, 'mode: open → a non-waitlisted umass email signs up');
select t.ok(t.errmsg($$insert into auth.users (email) values ('still@gmail.com')$$) like 'Only @umass.edu%', 'mode: open still enforces @umass.edu');
select t.ok(t.raises($$select public.set_signup_mode('sesame')$$), 'mode: invalid mode raises');
select t.ok((select value from app_settings where key = 'signup_mode') = 'open', 'mode: the invalid attempt left the mode unchanged');
select public.set_signup_mode('invite');
:asAnon
select t.ok(public.signup_allowed('anyone@umass.edu') = false, 'signup_allowed: false again after flipping back to invite');
select t.ok(not (public.waitlist_standing(:'w2_j2'::jsonb ->> 'referral_code') ->> 'approved')::boolean, 'standing: approved=false again in invite mode');
-- (e) admin helpers + settings are unreachable from the app roles
select t.ok(not has_function_privilege('anon', 'public.approve_waitlist(text[], text)', 'execute')
        and not has_function_privilege('anon', 'public.revoke_waitlist(text[])', 'execute')
        and not has_function_privilege('anon', 'public.approve_next_in_line(int, text)', 'execute')
        and not has_function_privilege('anon', 'public.set_signup_mode(text)', 'execute'), 'admin: anon has no execute on the four helpers');
select t.ok(not has_function_privilege('authenticated', 'public.approve_waitlist(text[], text)', 'execute')
        and not has_function_privilege('authenticated', 'public.revoke_waitlist(text[])', 'execute')
        and not has_function_privilege('authenticated', 'public.approve_next_in_line(int, text)', 'execute')
        and not has_function_privilege('authenticated', 'public.set_signup_mode(text)', 'execute'), 'admin: authenticated has no execute on the four helpers');
select t.ok(t.raises($$select public.approve_waitlist(array['me@umass.edu'])$$), 'admin: anon calling approve_waitlist raises');
select t.ok(t.raises($$select public.set_signup_mode('open')$$), 'admin: anon calling set_signup_mode raises');
select t.ok(t.raises($$select * from public.app_settings$$), 'admin: anon cannot read app_settings');
:asB
select t.ok(t.raises($$select public.approve_next_in_line(1)$$), 'admin: signed-in user calling approve_next_in_line raises');
select t.ok(t.raises($$select * from public.app_settings$$), 'admin: signed-in user cannot read app_settings');
select t.ok(t.raises($$update public.app_settings set value = 'open'$$), 'admin: signed-in user cannot flip the mode');
-- (f) batch approvals by position; revoke
:asSuper
-- unapproved umass rows right now, in line order: second@umass.edu (1 referral), then by
-- sign-up time third@students.umass.edu, someone@umass.edu, late@umass.edu
select t.ok(public.approve_next_in_line(2, 'wave test') = 2, 'batch: approve_next_in_line(2) → 2');
select t.ok((select approved_at is not null and approved_note = 'wave test' from waitlist where email = 'second@umass.edu'), 'batch: most-referred umass row approved first');
:asAnon
select t.ok((public.waitlist_standing(:'w2_j2'::jsonb ->> 'referral_code') ->> 'approved')::boolean, 'standing: approved flips to true after approve_next_in_line');
:asSuper
select t.ok((select approved_at is not null from waitlist where email = 'third@students.umass.edu'), 'batch: then the earliest sign-up');
select t.ok((select bool_and(approved_at is null) from waitlist where email in ('someone@umass.edu', 'late@umass.edu')), 'batch: the later two wait');
select t.ok((select bool_and(approved_at is null) from waitlist where email in ('first@example.com', 'farm1@gmail.com')), 'batch: non-umass rows skipped');
select t.ok(public.approve_next_in_line(5) = 2, 'batch: next call only finds the two left (skips approved) → 2');
select t.ok((select bool_and(approved_at is not null and approved_note = 'batch') from waitlist where email in ('someone@umass.edu', 'late@umass.edu')), 'batch: both approved with the default note');
select t.ok((select approved_note from waitlist where email = 'second@umass.edu') = 'wave test', 'batch: already-approved rows were not re-stamped');
select t.ok(public.approve_next_in_line(0) = 0 and public.approve_next_in_line(3) = 0, 'batch: nothing left → 0');
-- (separate statements: signup_allowed is STABLE, so in one statement it would read the pre-approve snapshot)
select t.ok(public.approve_waitlist(array['y@umass.edu']) = 1, 'revoke: setup — y approved');
select t.ok(public.signup_allowed('y@umass.edu'), 'revoke: setup — y allowed');
select t.ok(public.revoke_waitlist(array[' Y@UMASS.EDU ']) = 1, 'revoke: returns 1 (case/space-insensitive)');
select t.ok(public.signup_allowed('y@umass.edu') = false, 'revoke: no longer allowed');
select t.errmsg($$insert into auth.users (email) values ('y@umass.edu')$$) as m \gset gr_
select t.ok(:'gr_m' like 'Invite-only%', 'revoke: signup blocked again', :'gr_m');
select t.ok(public.revoke_waitlist(array['ghost@umass.edu']) = 0, 'revoke: unknown email → 0');
select t.ok(public.revoke_waitlist(array['first@example.com']) = 0, 'revoke: never-approved email → 0');
select t.ok(public.revoke_waitlist(array['y@umass.edu']) = 0, 'revoke: already-revoked email → 0');
select t.ok(public.revoke_waitlist(array['x@umass.edu']) = 1 and (select count(*) from profiles where id = 'dddddddd-0000-4000-8000-000000000004') = 1,
  'revoke: revoking an already-activated user keeps their account (only future sign-ups are blocked)');

-- ---- summary ------------------------------------------------------------------------
:asSuper
\o
\pset format aligned
select n, case when pass then 'PASS' else 'FAIL' end as result, label, coalesce(detail, '') as detail from t.results order by n;
select count(*) filter (where pass) as passed, count(*) filter (where not pass) as failed from t.results;
do $$ begin
  if exists (select 1 from t.results where not pass) and current_setting('ftl.strict', true) is distinct from 'off' then
    raise exception 'db tests failed';
  end if;
end $$;
