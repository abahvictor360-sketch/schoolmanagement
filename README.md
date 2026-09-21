# SchoolHub

Multi-tenant school management SaaS. One deployment serves many independent
schools; isolation is enforced by Postgres Row Level Security rather than by
application code.

Release 1 ships school administrators and teachers: school setup, student,
guardian and staff records with CSV import, the enrollment spine, and
attendance.

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

## The enrollment spine

A student is never "in JSS 2". `enrollments` binds a student to a class arm, in
a term, of an academic session, unique on `(student_id, term_id)`. Attendance
entries reference the enrollment, not the student, which is what makes history,
repeats, transfers and mid-term movement come out right. Rollover writes fresh
rows in the next term and closes the old ones; nothing is deleted.

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
psql "$DATABASE_URL" -f supabase/tests/rls_roles.sql         # role separation
```

The cross-tenant suite signs in as a Greenfield administrator and proves they
cannot read, update, delete or insert Brightstar rows on any table — including
through joins, aggregate counts and direct foreign-key probing. The role suite
proves an anonymous caller reads nothing at all, and that a teacher can take a
register but cannot edit records or read the audit log.

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
