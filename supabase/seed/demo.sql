-- Demo seed: two independent schools with overlapping shapes, so that any
-- cross-tenant leak shows up as a wrong-but-plausible row rather than an error.
-- Run with the service_role connection only. Never in a request path.

begin;

-- ------------------------------------------------------------------- users
-- Password for every demo account: "SchoolHub#2026".
--
-- These are throwaway .test addresses on purpose: no real address, and no
-- password anyone should reuse, belongs in a file that lives in git. To give a
-- real person platform-admin access, sign them up through /signup and then run
-- the one-liner under "Promoting a real account" in the README.
-- Two things a hand-written user INSERT has to do that signing up through the
-- API does for you, and which both surface at sign-in as the unhelpful
-- "Database error querying schema":
--
--   1. confirmation_token, recovery_token, email_change_token_new and
--      email_change have no column default. GoTrue scans them into a Go
--      `string`, not a `*string`, so a NULL aborts the whole row scan. They
--      must be set to '' explicitly.
--   2. A password user needs a matching row in auth.identities. Without it the
--      account exists but has no linked email identity.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  crypt('SchoolHub#2026', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', u.full_name), now(), now(),
  '', '', '', '', '', '', '', ''
from (values
  ('11111111-1111-4111-8111-111111111111'::uuid, 'platform@schoolhub.test',  'Platform Operator'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'admin@greenfield.test',    'Adaeze Obi'),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'teacher@greenfield.test',  'Musa Bello'),
  ('44444444-4444-4444-8444-444444444444'::uuid, 'admin@brightstar.test',    'Ifeoma Eze'),
  ('55555555-5555-4555-8555-555555555555'::uuid, 'teacher@brightstar.test',  'Fatima Sani')
) as u(id, email, full_name)
on conflict (id) do nothing;

-- auth.identities.email is a generated column, so it is never inserted.
insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email,
                          'email_verified', true, 'phone_verified', false),
       'email', now(), now(), now()
from auth.users u
where not exists (
  select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'
);

update public.profiles set is_platform_admin = true
where id = '11111111-1111-4111-8111-111111111111';

-- ----------------------------------------------------------------- schools
insert into public.schools (id, name, slug, phone, email, address) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Greenfield Academy',  'greenfield',
   '+234 803 000 0001', 'office@greenfield.test', '12 Awolowo Road, Ikoyi, Lagos'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Brightstar College',  'brightstar',
   '+234 803 000 0002', 'office@brightstar.test', '8 Ahmadu Bello Way, Kaduna')
on conflict (id) do nothing;

insert into public.school_settings (school_id, preset_key, academic_config, onboarded_at)
select s.id, 'NG', $cfg${
  "terms_per_session": 3,
  "term_templates": [
    {"ordinal": 1, "label": "First Term"},
    {"ordinal": 2, "label": "Second Term"},
    {"ordinal": 3, "label": "Third Term"}
  ],
  "assessment_components": [
    {"key": "ca1", "label": "First CA", "weight": 20, "max_score": 20},
    {"key": "ca2", "label": "Second CA", "weight": 20, "max_score": 20},
    {"key": "exam", "label": "Examination", "weight": 60, "max_score": 60}
  ],
  "grade_bands": [
    {"label": "A1", "min_score": 75, "max_score": 100, "remark": "Excellent", "is_pass": true},
    {"label": "B2", "min_score": 70, "max_score": 74, "remark": "Very Good", "is_pass": true},
    {"label": "B3", "min_score": 65, "max_score": 69, "remark": "Good", "is_pass": true},
    {"label": "C4", "min_score": 60, "max_score": 64, "remark": "Credit", "is_pass": true},
    {"label": "C5", "min_score": 55, "max_score": 59, "remark": "Credit", "is_pass": true},
    {"label": "C6", "min_score": 50, "max_score": 54, "remark": "Credit", "is_pass": true},
    {"label": "D7", "min_score": 45, "max_score": 49, "remark": "Pass", "is_pass": true},
    {"label": "E8", "min_score": 40, "max_score": 44, "remark": "Pass", "is_pass": true},
    {"label": "F9", "min_score": 0,  "max_score": 39, "remark": "Fail", "is_pass": false}
  ],
  "pass_mark": 40,
  "promotion_rule": {"kind": "average_at_least", "threshold": 40},
  "currency": "NGN",
  "locale": "en-NG",
  "timezone": "Africa/Lagos",
  "date_format": "dd/MM/yyyy",
  "class_level_templates": [],
  "subject_templates": []
}$cfg$::jsonb, now()
from public.schools s
where s.slug in ('greenfield', 'brightstar')
on conflict (school_id) do nothing;

insert into public.memberships (user_id, school_id, role) values
  ('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-0000-4000-8000-000000000001', 'school_admin'),
  ('33333333-3333-4333-8333-333333333333', 'aaaaaaaa-0000-4000-8000-000000000001', 'teacher'),
  ('44444444-4444-4444-8444-444444444444', 'bbbbbbbb-0000-4000-8000-000000000002', 'school_admin'),
  ('55555555-5555-4555-8555-555555555555', 'bbbbbbbb-0000-4000-8000-000000000002', 'teacher')
on conflict (user_id, school_id) do nothing;

-- -------------------------------------------------- calendar and structure
insert into public.academic_sessions (id, school_id, label, starts_on, ends_on, is_current)
values
  ('a5e55101-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '2025/2026', '2025-09-01', '2026-07-31', true),
  ('a5e55102-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', '2025/2026', '2025-09-08', '2026-07-24', true)
on conflict (school_id, label) do nothing;

insert into public.terms (school_id, academic_session_id, ordinal, label, starts_on, ends_on, is_current)
select s.school_id, s.id, t.ordinal, t.label, t.starts_on, t.ends_on, t.ordinal = 1
from public.academic_sessions s
cross join (values
  (1, 'First Term',  date '2025-09-01', date '2025-12-12'),
  (2, 'Second Term', date '2026-01-07', date '2026-04-03'),
  (3, 'Third Term',  date '2026-04-20', date '2026-07-24')
) as t(ordinal, label, starts_on, ends_on)
on conflict (academic_session_id, ordinal) do nothing;

insert into public.class_levels (school_id, label, ordinal)
select s.id, l.label, l.ordinal
from public.schools s
cross join (values
  ('Primary 5', 5), ('Primary 6', 6), ('JSS 1', 7), ('JSS 2', 8), ('JSS 3', 9)
) as l(label, ordinal)
where s.slug in ('greenfield', 'brightstar')
on conflict (school_id, label) do nothing;

insert into public.class_arms (school_id, class_level_id, label, capacity)
select cl.school_id, cl.id, a.label, 40
from public.class_levels cl
cross join (values ('A'), ('B')) as a(label)
on conflict (class_level_id, label) do nothing;

insert into public.subjects (school_id, name, code, is_core)
select s.id, x.name, x.code, x.is_core
from public.schools s
cross join (values
  ('English Language', 'ENG', true),
  ('Mathematics', 'MTH', true),
  ('Basic Science', 'BSC', true),
  ('Civic Education', 'CIV', true),
  ('Computer Studies', 'CMP', false)
) as x(name, code, is_core)
where s.slug in ('greenfield', 'brightstar')
on conflict (school_id, code) do nothing;

insert into public.staff (school_id, staff_number, full_name, email, designation)
select s.id,
       'STF/' || s.slug || '/' || lpad(g::text, 3, '0'),
       (array['Musa Bello','Amaka Nwosu','Tunde Balogun','Grace Udo','Sadiq Lawal',
              'Ngozi Ibe','Peter Ajayi','Halima Yusuf'])[1 + (g % 8)],
       'staff' || g || '@' || s.slug || '.test',
       (array['Mathematics teacher','English teacher','Science teacher','Form teacher'])[1 + (g % 4)]
from public.schools s, generate_series(1, 12) g
where s.slug in ('greenfield', 'brightstar')
on conflict (school_id, staff_number) do nothing;

-- ---------------------------------------------------------------- students
insert into public.students (school_id, admission_number, first_name, last_name, sex, date_of_birth, admitted_on)
select
  s.id,
  upper(s.slug) || '/2025/' || lpad(g::text, 4, '0'),
  (array['Chidi','Amara','Emeka','Zainab','Tobi','Ifeoma','Bashir','Ngozi','Segun','Aisha',
         'Kelechi','Fatima','Obinna','Halima','Yemi','Chiamaka'])[1 + (g % 16)],
  (array['Okafor','Bello','Adeyemi','Eze','Lawal','Nwosu','Ibrahim','Udo','Balogun','Sani',
         'Onyeka','Abubakar','Chukwu','Musa','Adebayo','Ekwueme'])[1 + ((g * 7) % 16)],
  (case when g % 2 = 0 then 'male' else 'female' end)::app.sex,
  date '2011-01-01' + ((g * 13) % 1200),
  date '2025-09-01'
from public.schools s, generate_series(1, 240) g
where s.slug in ('greenfield', 'brightstar')
on conflict (school_id, admission_number) do nothing;

insert into public.guardians (school_id, full_name, phone, email, occupation)
select s.id,
       'Guardian ' || g || ' ' || initcap(s.slug),
       '+23480' || lpad((10000000 + g)::text, 8, '0'),
       'guardian' || g || '@' || s.slug || '.test',
       (array['Trader','Civil servant','Engineer','Nurse','Farmer'])[1 + (g % 5)]
from public.schools s, generate_series(1, 80) g
where s.slug in ('greenfield', 'brightstar');

-- One primary guardian each for the first 80 students of each school.
insert into public.student_guardians (school_id, student_id, guardian_id, relationship, is_primary)
select st.school_id, st.id, gd.id, 'Parent', true
from (
  select id, school_id, row_number() over (partition by school_id order by admission_number) as rn
  from public.students
) st
join (
  select id, school_id, row_number() over (partition by school_id order by full_name) as rn
  from public.guardians
) gd on gd.school_id = st.school_id and gd.rn = st.rn
where st.rn <= 80
on conflict (student_id, guardian_id) do nothing;

-- -------------------------------------------------------------- enrollment
insert into public.enrollments (school_id, student_id, class_arm_id, term_id, status)
select st.school_id, st.id, arm.id, t.id, 'active'
from (
  select id, school_id, row_number() over (partition by school_id order by admission_number) as rn
  from public.students
) st
join lateral (
  select a.id, row_number() over (order by cl.ordinal, a.label) as arm_rn
  from public.class_arms a
  join public.class_levels cl on cl.id = a.class_level_id
  where a.school_id = st.school_id
) arm on arm.arm_rn = 1 + ((st.rn - 1) % 10)
join public.terms t on t.school_id = st.school_id and t.is_current
on conflict (student_id, term_id) do nothing;

-- -------------------------------------------------------------- attendance
insert into public.attendance_registers (school_id, class_arm_id, term_id, register_date)
select distinct e.school_id, e.class_arm_id, e.term_id, d::date
from public.enrollments e
join public.terms t on t.id = e.term_id and t.is_current
cross join generate_series(current_date - 9, current_date, interval '1 day') d
where extract(isodow from d) between 1 and 5
on conflict (class_arm_id, register_date) do nothing;

insert into public.attendance_entries (school_id, register_id, enrollment_id, status)
select r.school_id, r.id, e.id,
       (case
          when (hashtext(e.id::text || r.register_date::text) % 20) = 0 then 'absent'
          when (hashtext(e.id::text || r.register_date::text) % 37) = 0 then 'late'
          else 'present'
        end)::app.attendance_status
from public.attendance_registers r
join public.enrollments e
  on e.class_arm_id = r.class_arm_id and e.term_id = r.term_id and e.status = 'active'
on conflict (register_id, enrollment_id) do nothing;

commit;
