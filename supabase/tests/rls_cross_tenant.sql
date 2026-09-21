-- The test that matters: prove a member of one school can neither read nor
-- write another school's rows, including through joins, aggregates and
-- foreign-key probing. Run against a database seeded with supabase/seed/demo.sql.
--
--   psql "$DATABASE_URL" -f supabase/tests/rls_cross_tenant.sql
--
-- Any failure raises, so a non-zero exit is a genuine isolation breach.

do $$
declare
  greenfield uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  brightstar uuid := 'bbbbbbbb-0000-4000-8000-000000000002';
  gf_admin   uuid := '22222222-2222-4222-8222-222222222222';
  tbl text;
  leaked bigint;
  affected bigint;
  victim uuid;
  failures text[] := '{}';
begin
  select id into victim from public.students where school_id = brightstar limit 1;

  perform set_config('request.jwt.claims',
    json_build_object('sub', gf_admin, 'role', 'authenticated',
                      'email', 'admin@greenfield.test')::text, true);
  set local role authenticated;

  if auth.uid() <> gf_admin then
    raise exception 'test harness failed: auth.uid() is %', auth.uid();
  end if;

  -- 1. Every table: a SELECT scoped to the other school returns nothing.
  foreach tbl in array array['schools','school_settings','students','guardians',
      'student_guardians','staff','class_levels','class_arms','subjects','class_subjects',
      'academic_sessions','terms','enrollments','attendance_registers','attendance_entries',
      'memberships','audit_log','school_invitations'] loop
    execute format('select count(*) from public.%I where %s = $1',
                   tbl, case when tbl = 'schools' then 'id' else 'school_id' end)
      into leaked using brightstar;
    if leaked <> 0 then
      failures := failures || format('SELECT leak: %s returned %s foreign rows', tbl, leaked);
    end if;
  end loop;

  -- 2. Aggregates do not leak: an unfiltered count equals the own-school count.
  select count(*) into leaked from public.students;
  select count(*) into affected from public.students where school_id = greenfield;
  if leaked <> affected then
    failures := failures || format('aggregate leak: students total %s vs own %s', leaked, affected);
  end if;

  -- 3. Joins are not a side channel.
  select count(*) into leaked
  from public.enrollments e
  join public.students s on s.id = e.student_id
  join public.class_arms a on a.id = e.class_arm_id
  where s.school_id = brightstar or a.school_id = brightstar;
  if leaked <> 0 then
    failures := failures || format('join leak: %s foreign enrollment rows', leaked);
  end if;

  -- 4. Naming a foreign primary key directly still returns nothing.
  select count(*) into leaked from public.students where id = victim;
  if leaked <> 0 then failures := failures || 'fk probe leak: fetched a foreign student by id'; end if;

  -- 5. Writes against another school affect zero rows.
  update public.students set last_name = 'HACKED' where id = victim;
  get diagnostics affected = row_count;
  if affected <> 0 then failures := failures || 'UPDATE crossed tenants'; end if;

  delete from public.students where id = victim;
  get diagnostics affected = row_count;
  if affected <> 0 then failures := failures || 'DELETE crossed tenants'; end if;

  -- 6. Inserting into another school is rejected by the WITH CHECK clause.
  begin
    insert into public.students (school_id, admission_number, first_name, last_name)
    values (brightstar, 'INJECTED/001', 'Mallory', 'Cross');
    failures := failures || 'INSERT crossed tenants';
  exception when insufficient_privilege or check_violation then null;
  end;

  -- 7. Moving one's own row into another school is rejected too.
  begin
    update public.students set school_id = brightstar where school_id = greenfield;
    get diagnostics affected = row_count;
    if affected <> 0 then failures := failures || 'tenant reassignment allowed'; end if;
  exception when insufficient_privilege or check_violation then null;
  end;

  reset role;

  if array_length(failures, 1) is null then
    raise notice 'RLS cross-tenant suite: all checks passed';
  else
    raise exception 'RLS FAILURES: %', array_to_string(failures, ' | ');
  end if;
end $$;
