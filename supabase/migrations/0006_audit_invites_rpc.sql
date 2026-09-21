-- Audit trail, invitation-based onboarding (no service_role in request paths),
-- and the set-based operations that need to be atomic.

-- ------------------------------------------------------------- audit trail
create or replace function app.write_audit()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  sid uuid;
  before_row jsonb;
  after_row jsonb;
begin
  if tg_op = 'DELETE' then
    before_row := to_jsonb(old); after_row := null; sid := (to_jsonb(old)->>'school_id')::uuid;
  elsif tg_op = 'UPDATE' then
    before_row := to_jsonb(old); after_row := to_jsonb(new); sid := (to_jsonb(new)->>'school_id')::uuid;
    if before_row - 'updated_at' = after_row - 'updated_at' then return new; end if;
  else
    before_row := null; after_row := to_jsonb(new); sid := (to_jsonb(new)->>'school_id')::uuid;
  end if;

  insert into public.audit_log (school_id, actor_id, entity, entity_id, action, before, after)
  values (sid, auth.uid(), tg_table_name,
          coalesce(after_row->>'id', before_row->>'id'), lower(tg_op), before_row, after_row);

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['students','guardians','student_guardians','staff','enrollments',
                           'attendance_registers','attendance_entries','memberships',
                           'class_arms','class_levels','subjects','terms','academic_sessions'] loop
    execute format(
      'create trigger audit_%1$s after insert or update or delete on public.%1$s
         for each row execute function app.write_audit()', t);
  end loop;
end $$;

-- ------------------------------------------------------------- invitations
create table public.school_invitations (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  email      citext not null,
  role       app.user_role not null,
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (school_id, email)
);
create index school_invitations_email_idx on public.school_invitations (email) where accepted_at is null;

alter table public.school_invitations enable row level security;
alter table public.school_invitations force row level security;
create policy school_invitations_read on public.school_invitations for select to authenticated
  using (app.can_admin(school_id) or email = (select u.email from auth.users u where u.id = auth.uid()));
create policy school_invitations_write on public.school_invitations for all to authenticated
  using (app.can_admin(school_id)) with check (app.can_admin(school_id));

-- When an invited person signs up, their membership materialises. This is why
-- the app never needs the service_role key to onboard a school admin.
create or replace function app.redeem_invitations()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.memberships (user_id, school_id, role, status)
  select new.id, i.school_id, i.role, 'active'
  from public.school_invitations i
  where i.email = new.email and i.accepted_at is null
  on conflict (user_id, school_id) do nothing;

  update public.school_invitations set accepted_at = now()
  where email = new.email and accepted_at is null;

  return new;
end;
$$;
create trigger on_auth_user_redeem_invites after insert on auth.users
  for each row execute function app.redeem_invitations();

-- ------------------------------------------------------------- operations
-- Platform admin creates a school, its settings and the first admin invite in
-- one transaction.
create or replace function public.create_school(
  p_name text, p_slug text, p_admin_email text, p_config jsonb, p_preset text default 'NG'
) returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare new_id uuid;
begin
  if not app.is_platform_admin() then
    raise exception 'only platform admins may create schools' using errcode = '42501';
  end if;
  insert into public.schools (name, slug) values (p_name, lower(p_slug)) returning id into new_id;
  insert into public.school_settings (school_id, preset_key, academic_config)
    values (new_id, p_preset, p_config);
  insert into public.school_invitations (school_id, email, role, invited_by)
    values (new_id, p_admin_email, 'school_admin', auth.uid());
  insert into public.audit_log (school_id, actor_id, entity, entity_id, action, after)
    values (new_id, auth.uid(), 'schools', new_id::text, 'create_school',
            jsonb_build_object('name', p_name, 'slug', p_slug, 'admin_email', p_admin_email));
  return new_id;
end;
$$;

-- Bulk enrollment: idempotent, moves a student's arm if they are already
-- enrolled for that term rather than erroring.
create or replace function public.enroll_students(
  p_school_id uuid, p_term_id uuid, p_class_arm_id uuid, p_student_ids uuid[]
) returns integer language plpgsql security invoker set search_path = public, pg_temp as $$
declare affected integer;
begin
  insert into public.enrollments (school_id, student_id, class_arm_id, term_id, status)
  select p_school_id, sid, p_class_arm_id, p_term_id, 'active'
  from unnest(p_student_ids) as sid
  on conflict (student_id, term_id)
    do update set class_arm_id = excluded.class_arm_id, status = 'active';
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- End-of-term rollover. Carries an arm's active cohort into the next term,
-- preserving the closed term's rows as history.
create or replace function public.rollover_term(
  p_school_id uuid, p_from_term uuid, p_to_term uuid,
  p_promote jsonb   -- { "<from_class_arm_id>": "<to_class_arm_id>" }
) returns integer language plpgsql security invoker set search_path = public, pg_temp as $$
declare moved integer := 0;
begin
  if not app.can_admin(p_school_id) then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  insert into public.enrollments (school_id, student_id, class_arm_id, term_id, status)
  select e.school_id, e.student_id, (p_promote->>e.class_arm_id::text)::uuid, p_to_term, 'active'
  from public.enrollments e
  where e.school_id = p_school_id and e.term_id = p_from_term and e.status = 'active'
    and p_promote ? e.class_arm_id::text
  on conflict (student_id, term_id) do nothing;
  get diagnostics moved = row_count;

  update public.enrollments e set status = 'promoted'
  where e.school_id = p_school_id and e.term_id = p_from_term and e.status = 'active'
    and p_promote ? e.class_arm_id::text;

  return moved;
end;
$$;

-- Save a whole register in one statement so a patchy connection cannot leave a
-- half-marked class behind.
create or replace function public.save_attendance(
  p_school_id uuid, p_class_arm_id uuid, p_term_id uuid, p_date date, p_entries jsonb
) returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare reg_id uuid;
begin
  insert into public.attendance_registers (school_id, class_arm_id, term_id, register_date, taken_by)
  values (p_school_id, p_class_arm_id, p_term_id, p_date, auth.uid())
  on conflict (class_arm_id, register_date)
    do update set taken_by = auth.uid(), taken_at = now()
  returning id into reg_id;

  insert into public.attendance_entries (school_id, register_id, enrollment_id, status, note)
  select p_school_id, reg_id, (e->>'enrollment_id')::uuid,
         (e->>'status')::app.attendance_status, nullif(e->>'note', '')
  from jsonb_array_elements(p_entries) as e
  on conflict (register_id, enrollment_id)
    do update set status = excluded.status, note = excluded.note;

  return reg_id;
end;
$$;

grant execute on function public.create_school(text, text, text, jsonb, text),
  public.enroll_students(uuid, uuid, uuid, uuid[]),
  public.rollover_term(uuid, uuid, uuid, jsonb),
  public.save_attendance(uuid, uuid, uuid, date, jsonb) to authenticated;

-- ------------------------------------------------------------- storage
insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', false)
on conflict (id) do nothing;

-- Objects are keyed <school_id>/<student_id>.<ext>, so the first path segment
-- carries the tenant.
create policy "student photos read" on storage.objects for select to authenticated
  using (bucket_id = 'student-photos' and app.can_read(((storage.foldername(name))[1])::uuid));
create policy "student photos write" on storage.objects for insert to authenticated
  with check (bucket_id = 'student-photos' and app.can_admin(((storage.foldername(name))[1])::uuid));
create policy "student photos update" on storage.objects for update to authenticated
  using (bucket_id = 'student-photos' and app.can_admin(((storage.foldername(name))[1])::uuid));
create policy "student photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'student-photos' and app.can_admin(((storage.foldername(name))[1])::uuid));
