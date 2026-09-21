-- Performance pass against a school of a few thousand students.
--
-- Three findings from the database linter, all of which bite at scale:
--   1. `for all` write policies are also evaluated on every SELECT, so each
--      read paid for two policies instead of one. Split them per command.
--   2. `auth.uid()` inside a policy is re-evaluated per row unless wrapped in a
--      scalar subquery, which the planner hoists to an InitPlan.
--   3. Several foreign keys had no covering index, so a parent delete and any
--      join through them fell back to a sequential scan.

-- ------------------------------------------- 1. one policy per command
do $$
declare t text;
begin
  foreach t in array array['school_settings','academic_sessions','terms','class_levels',
      'class_arms','subjects','staff','class_subjects','students','guardians',
      'student_guardians','enrollments','school_invitations'] loop
    execute format('drop policy if exists %1$s_write on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated
                      with check (app.can_admin(school_id))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated
                      using (app.can_admin(school_id)) with check (app.can_admin(school_id))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated
                      using (app.can_admin(school_id))', t);
  end loop;

  foreach t in array array['attendance_registers','attendance_entries'] loop
    execute format('drop policy if exists %1$s_write on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated
                      with check (app.can_take_attendance(school_id))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated
                      using (app.can_take_attendance(school_id))
                      with check (app.can_take_attendance(school_id))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated
                      using (app.can_take_attendance(school_id))', t);
  end loop;
end $$;

drop policy if exists memberships_write on public.memberships;
create policy memberships_insert on public.memberships for insert to authenticated
  with check (app.can_admin(school_id));
create policy memberships_update on public.memberships for update to authenticated
  using (app.can_admin(school_id)) with check (app.can_admin(school_id));
create policy memberships_delete on public.memberships for delete to authenticated
  using (app.can_admin(school_id));

drop policy if exists schools_platform_write on public.schools;
create policy schools_platform_insert on public.schools for insert to authenticated
  with check (app.is_platform_admin());
create policy schools_platform_delete on public.schools for delete to authenticated
  using (app.is_platform_admin());
drop policy if exists schools_admin_update on public.schools;
create policy schools_update on public.schools for update to authenticated
  using (app.can_admin(id)) with check (app.can_admin(id));

-- --------------------------------- 2. hoist auth.uid() out of the row loop
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or app.is_platform_admin()
    or exists (
      select 1
      from public.memberships mine
      join public.memberships theirs on theirs.school_id = mine.school_id
      where mine.user_id = (select auth.uid()) and mine.status = 'active'
        and theirs.user_id = public.profiles.id and theirs.status = 'active')
  );

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists memberships_read on public.memberships;
create policy memberships_read on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or app.can_read(school_id));

drop policy if exists school_invitations_read on public.school_invitations;
create policy school_invitations_read on public.school_invitations for select to authenticated
  using (
    app.can_admin(school_id)
    or lower(email::text) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );

-- ------------------------------------------- 3. cover the foreign keys
create index if not exists attendance_entries_enrollment_fk_idx
  on public.attendance_entries (enrollment_id);
create index if not exists attendance_registers_term_fk_idx
  on public.attendance_registers (term_id);
create index if not exists attendance_registers_taken_by_idx
  on public.attendance_registers (taken_by) where taken_by is not null;
create index if not exists audit_log_actor_idx
  on public.audit_log (actor_id) where actor_id is not null;
create index if not exists class_arms_form_teacher_fk_idx
  on public.class_arms (form_teacher_id) where form_teacher_id is not null;
create index if not exists class_subjects_level_fk_idx
  on public.class_subjects (class_level_id);
create index if not exists class_subjects_subject_fk_idx
  on public.class_subjects (subject_id);
create index if not exists enrollments_class_arm_fk_idx
  on public.enrollments (class_arm_id);
create index if not exists enrollments_term_fk_idx
  on public.enrollments (term_id);
create index if not exists school_invitations_invited_by_idx
  on public.school_invitations (invited_by) where invited_by is not null;
create index if not exists student_guardians_guardian_fk_idx
  on public.student_guardians (guardian_id);

analyze;
