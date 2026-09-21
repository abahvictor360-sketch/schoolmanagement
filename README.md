# SchoolHub

Multi-tenant school management SaaS. One deployment serves many independent
schools; isolation is enforced by Postgres Row Level Security rather than by
application code.

Release 1 ships school administrators and teachers: school setup, student,
guardian and staff records with CSV import, the enrollment spine, and
attendance.

Release 2 adds pupils: a student portal, assessments and results with
printable report cards, computer-based tests, and messaging between pupils and
staff.

## Stack

Next.js (App Router, TypeScript strict) · Supabase Postgres, Auth and Storage ·
Tailwind CSS · React Hook Form + Zod · TanStack Query · Vercel. No ORM — the
schema is hand-written SQL, because the data model is the product.

## How multi-tenancy works

Every domain table carries `school_id`, and every table has RLS **enabled and
forced** with no permissive default. Policies call three `security definer`
helpers in the `app` schema:

| Helper | Grants |
|---|---|
| `app.can_read(school_id)` | any active member of that school, or a platform admin |
| `app.can_admin(school_id)` | school administrators, or a platform admin |
| `app.can_take_attendance(school_id)` | additionally, teachers |

A user authenticates once; `memberships` maps them to one or more schools with a
role, so a teacher working at two schools is one account. The active school is
resolved from the subdomain (`greenfield.example.com`); an unrecognised
subdomain is a 404 and never falls back to a default tenant. Where wildcard DNS
is not available, the app falls back to an explicit school switcher — the cookie
only records a preference, and membership is re-checked server-side on every
request and again by RLS.

`src/lib/auth.ts` never trusts a client-supplied school id. The JWT hook
(`app.custom_access_token_hook`) stamps memberships into the token for
role-aware UI only; policies re-read `memberships` themselves.

**The `service_role` key is never used in a request-handling path.** Creating a
school writes an invitation row instead of an admin user; the membership
materialises through an `auth.users` trigger the moment that person signs up.

## Academic rules are configuration

Terms per session, assessment components and weights, grade bands, pass mark,
promotion rule, currency, locale, timezone and date format live in
`school_settings.academic_config` as JSONB, validated by
`academicConfigSchema`. Nigeria, Ghana and Kenya presets ship in
`src/lib/academic-config.ts`. A new country is a new preset entry, not a branch.
Nothing in application logic assumes three terms, a 40/60 split, or A1–F9.

## What a pupil can see

Granting a student a login is the one change in this codebase that could turn
the whole school inside out, because every read policy was built on "any
active member of this school" and a pupil is a member. So `app.can_read()` now
means *staff*; reference data (the school, its calendar, class structure and
subject list) moved to `app.can_read_reference()`, which any member may use;
and everything a pupil sees of their own is an explicit policy naming
`app.my_student_id()` or `app.owns_enrollment()`.

A pupil can read their own record, their own enrollments, their own attendance
marks, the subjects offered to their class level, their own published results,
papers set for their class, and threads they take part in. They can read
nothing about another pupil — not even a classmate's name — and no staff or
guardian record at all. The portal is read-only except for sitting a test and
sending a message.

### The CBT answer key

A candidate has to read the options to answer, and RLS is row-level rather
than column-level, so an `is_correct` column would be one `select *` away from
the person sitting the paper. Correctness therefore lives in
`cbt_answer_keys`, a table with no student-readable policy at all. Marking
runs inside a `security definer` function that can see the key even though the
caller never can, and the clock is set server-side when an attempt starts, so
reloading buys no extra minutes.

### Messaging a child

A pupil may open a thread with staff of their own school and with nobody else,
enforced in `start_thread()` rather than in the UI. A sent message cannot be
edited; it can be withdrawn from view by its sender, but the row stays and the
withdrawal cannot be reversed. The school's administrators can read any thread
in their school, because this is a safeguarding record rather than private
mail.

## The enrollment spine

A student is never "in JSS 2". `enrollments` binds a student to a class arm, in
a term, of an academic session, unique on `(student_id, term_id)`. Attendance
entries reference the enrollment, not the student, which is what makes history,
repeats, transfers and mid-term movement come out right. Rollover writes fresh
rows in the next term and closes the old ones; nothing is deleted.

## Deployed

| | |
|---|---|
| App | https://schoolhub-abahvictor360-3017s-projects.vercel.app |
| Supabase project | `rxzecdhzyrsoylaqqzjg` (eu-west-1) |
| Functions region | `fra1` — closest to the first market |

The database is seeded with two independent schools so the isolation story is
visible rather than described. Every seeded account uses the password
`SchoolHub#2026`.

| Account | Role | What it is for |
|---|---|---|
| `platform@schoolhub.test` | platform admin | Create a school and invite its first administrator |
| `admin@greenfield.test` | Greenfield Academy admin | Full school: records, import, enrollment, settings, audit log |
| `teacher@greenfield.test` | Greenfield teacher | Attendance only — proves the role boundary |
| `admin@brightstar.test` | Brightstar College admin | The other tenant, to check nothing bleeds across |
| `teacher@brightstar.test` | Brightstar teacher | Teacher view on the second tenant |
| `student@greenfield.test` | Greenfield pupil | The portal: own attendance, results, a live CBT paper, messaging |
| `student@brightstar.test` | Brightstar pupil | The portal on the second tenant |

A useful ten-minute pass: sign in as each administrator in turn and note that
both see 240 students, 12 staff and 80 guardians, and neither sees the other's
— RLS, not the UI, decides what a query returns. Then sign in as a teacher: the
sidebar drops to Dashboard and Attendance, and the pages behind the missing
links refuse the request rather than merely hiding it.

### Promoting a real account

Never put a real address or a shared password in the seed file. Sign the person
up at `/signup`, then promote them once:

```sql
update public.profiles set is_platform_admin = true
where id = (select id from auth.users where email = 'person@example.com');

-- Optional: also make them an administrator of a specific school.
insert into public.memberships (user_id, school_id, role)
select u.id, s.id, 'school_admin'
from auth.users u, public.schools s
where u.email = 'person@example.com' and s.slug = 'greenfield'
on conflict (user_id, school_id) do update set role = excluded.role;
```

They need to sign out and back in for the change to take effect, because the
platform-admin flag is read once per request from `profiles`.

**Before a pilot:** delete these demo accounts and the demo schools, point
`NEXT_PUBLIC_ROOT_DOMAIN` at a real apex domain with wildcard DNS so each school
gets its own subdomain, and turn on Supabase point-in-time recovery.

## Getting started

```bash
npm install
cp .env.example .env.local        # fill in your Supabase URL and anon key
npm run dev
```

Apply migrations in order with the Supabase CLI:

```bash
supabase link --project-ref <ref>
supabase db push
```

Seed a realistic two-school demo (service-role connection only):

```bash
psql "$DATABASE_URL" -f supabase/seed/demo.sql
```

## Tests

```bash
npm test                                                     # unit suite
psql "$DATABASE_URL" -f supabase/tests/rls_cross_tenant.sql  # isolation
psql "$DATABASE_URL" -f supabase/tests/rls_roles.sql         # role separation + RPC grants
psql "$DATABASE_URL" -f supabase/tests/rls_student.sql       # a pupil sees only themselves
psql "$DATABASE_URL" -f supabase/tests/rls_student_academics.sql  # the answer key stays hidden
psql "$DATABASE_URL" -f supabase/tests/rls_messaging.sql     # who may write to whom
psql "$DATABASE_URL" -f supabase/tests/auth_seed_sanity.sql  # seeded users can sign in
```

The cross-tenant suite signs in as a Greenfield administrator and proves they
cannot read, update, delete or insert Brightstar rows on any table — including
through joins, aggregate counts and direct foreign-key probing. The role suite
proves an anonymous caller reads nothing at all, that a teacher can take a
register but cannot edit records or read the audit log, and that no RPC is
callable without signing in. The student suites prove a pupil sees exactly one
student row, cannot read an answer key or write one, and cannot message
another pupil.

## Environment

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Apex domain for tenant subdomains. Unset: use the school switcher |

## Layout

```
src/app/(app)/        authenticated school-scoped pages
src/app/actions/      server actions; every mutation re-validates with Zod
src/app/platform/     platform-admin route: create a school and invite its first admin
src/lib/              auth, tenant resolution, academic config, validation, types
supabase/migrations/  hand-written SQL, strictly sequential
supabase/tests/       RLS suites
supabase/seed/        demo data
```
