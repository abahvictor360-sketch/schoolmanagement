-- A school's own colour.
--
-- One column is enough: the app derives the hover shade, the pale tint and a
-- contrast-checked foreground from it at render time, so there is nothing here
-- that can drift out of step with what is actually displayed.
--
-- The check constraint matters more than it looks. This value is interpolated
-- into a style attribute, so anything that is not a plain six-digit hex must
-- never reach the database in the first place.
alter table public.schools
  add column brand_color text
  check (brand_color is null or brand_color ~ '^#[0-9a-f]{6}$');

comment on column public.schools.brand_color is
  'Lower-case six-digit hex, or null for the platform default. Rendered into a
   style attribute, so the format check is a safety boundary, not a nicety.';
