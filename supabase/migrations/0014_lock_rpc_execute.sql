-- Deny by default, applied to functions as well as tables.
--
-- Postgres grants EXECUTE on a new function to PUBLIC, and PostgREST exposes
-- everything in the public schema at /rest/v1/rpc/<name>. Granting EXECUTE to
-- `authenticated` therefore did not take it away from `anon`: every RPC was
-- reachable without signing in.
--
-- In practice each one refused an anonymous caller — they all resolve
-- auth.uid() and find nothing — but "it happens to fail" is not a permission
-- model. These revokes make the refusal structural.

do $$
declare fn text;
begin
  foreach fn in array array[
    'public.create_school(text, text, text, jsonb, text)',
    'public.enroll_students(uuid, uuid, uuid, uuid[])',
    'public.rollover_term(uuid, uuid, uuid, jsonb)',
    'public.save_attendance(uuid, uuid, uuid, date, jsonb)',
    'public.result_sheet(uuid)',
    'public.start_cbt_attempt(uuid)',
    'public.save_cbt_answers(uuid, jsonb)',
    'public.submit_cbt_attempt(uuid, jsonb)',
    'public.start_thread(uuid, text, uuid, text)',
    'public.post_message(uuid, text)',
    'public.messageable_staff(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- New functions added later should not have to remember this.
alter default privileges in schema public revoke execute on functions from public;
