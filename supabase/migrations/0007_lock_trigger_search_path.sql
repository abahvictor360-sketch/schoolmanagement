-- Linter: pin the trigger helper's search_path.
create or replace function app.touch_updated_at()
returns trigger language plpgsql set search_path = pg_temp as $$
begin new.updated_at = now(); return new; end;
$$;
