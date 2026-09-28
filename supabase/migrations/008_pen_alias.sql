-- ============================================================================
-- foundthelost — vocabulary fix, Sept 2026. Run AFTER 007. Safe to re-run.
-- "pen" / "pencil" used to be aliases of pencil_case, so a found pen became a
-- "Pencil case" (and matched against pencil cases). Pens are their own item now.
-- Mirrors the change in src/data/dictionary.js (keep both in sync).
-- ============================================================================

delete from public.ftl_aliases where kind = 'item' and term in ('pen', 'pencil');

insert into public.ftl_aliases (term, kind, canonical, category) values
  ('pen', 'item', 'pen', 'other'),
  ('pens', 'item', 'pen', 'other'),
  ('pencil', 'item', 'pen', 'other'),
  ('mechanical pencil', 'item', 'pen', 'other'),
  ('marker', 'item', 'pen', 'other'),
  ('highlighter', 'item', 'pen', 'other'),
  ('sharpie', 'item', 'pen', 'other'),
  ('fountain pen', 'item', 'pen', 'other'),
  ('stylus', 'item', 'pen', 'other'),
  ('apple pencil', 'item', 'pen', 'other'),
  ('pen case', 'item', 'pencil_case', 'other'),
  ('pen pouch', 'item', 'pencil_case', 'other')
on conflict (term, kind) do update set canonical = excluded.canonical, category = excluded.category;
