# Build Prompt — Multi-Tenant School Management SaaS (Release 1)

> **How to use this file:** save it at the repo root as `SPEC.md`. Start your Claude
> Code session with:
> *"Read SPEC.md in full. Do not write any code yet. Ask me the questions in the
> 'Before You Start' section, then propose a plan for Milestone 1."*
> Once you've agreed a plan, ask Claude Code to generate a `CLAUDE.md` distilled
> from the Working Agreement and Non-Negotiables sections so the rules survive
> context compaction.

---

## 1. What we're building

A multi-tenant SaaS platform that primary and secondary schools use to run their
day-to-day administration. One deployment serves many independent schools. First
market is Nigeria, but the system must be configurable enough to serve other
African markets and eventually schools anywhere, **without forking the codebase**.

Four user types eventually get their own login: school administrators, teachers,
students, and guardians. Release 1 (this spec) ships administrators and teachers
only.

This is a real commercial product, not a demo. Pilot schools will put live student
records into it.

---

## 2. Non-negotiables

These are settled decisions. Do not propose alternatives unless you find a concrete
technical blocker, in which case stop and raise it before writing code.

**2.1 — Every tenant shares one database.**
Single Postgres instance. Every domain table carries a `school_id` column.
Isolation is enforced by Postgres Row Level Security, not by application code.
No schema-per-tenant, no database-per-tenant.

**2.2 — Enrollment is the spine of the data model.**
A student is never "in JSS2". A student has an *enrollment record* that binds them
to a specific class arm, in a specific term, of a specific academic session. Class
membership, attendance, results, and fees all hang off the enrollment, never off
the student row. This is what makes history, repeats, transfers, and mid-term
movement work correctly. Getting this wrong is the single most expensive mistake
available in this project.

**2.3 — Academic rules are data, not code.**
Number of terms per session, continuous-assessment vs exam weighting, grade bands
and their labels, pass marks, promotion rules, currency, date format, and report
card layout are all stored per school as configuration. Nigeria ships as a default
preset. A new country is a new preset row, not a new branch.
Never hardcode "3 terms", "40/60", or "A1–F9" anywhere in application logic.

**2.4 — Deny by default.**
Every table gets RLS enabled with no permissive default. A missing policy must
cause a query to return nothing, never to return everything. The `service_role`
key is never used in a request-handling path — only in migrations, seeds, and
explicitly-audited background jobs.

**2.5 — Scope discipline.**
Release 1 is defined in section 7. Anything in section 8 is out of scope. If a
feature feels adjacent and cheap, it is still out of scope. Note it and move on.

---

## 3. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript in strict mode |
| Database | Supabase Postgres |
| Auth | Supabase Auth, email + password, with custom JWT claims |
| Files | Supabase Storage (passport photos, documents) |
| Styling | Tailwind CSS + shadcn/ui |
| Forms | React Hook Form + Zod, sharing schemas with server validation |
| Server state | TanStack Query |
| Tables | TanStack Table |
| Migrations | Supabase CLI SQL migrations, checked into git, strictly sequential |
| Testing | Vitest for units, Playwright for critical flows, plus SQL-level RLS tests |
| Hosting | Vercel |

No ORM. Write SQL migrations by hand and generate TypeScript types from the
database schema. The data model is the product; it should be readable as SQL.

---

## 4. Multi-tenancy mechanics

**Tenant resolution.** Each school gets a subdomain: `greenfield.app.com`. Next.js
middleware reads the host header, resolves the subdomain to a `school_id`, and
attaches it to the request context. An unrecognised subdomain returns 404, never a
fallback to a default tenant.

**Identity.** A user authenticates once against Supabase Auth. A `memberships`
table maps a user to one or more schools, each with a role. A user may legitimately
belong to two schools (a teacher moonlighting, a guardian with children in two
schools on the platform), so `user → school` is many-to-many.

**Claims.** Use a Supabase custom access token hook to stamp the active
`school_id` and `role` into the JWT. RLS policies read those claims. Switching
active school re-issues the token; it never just changes a cookie the client
controls.

**Roles for R1:** `platform_admin`, `school_admin`, `teacher`.
Define `bursar`, `student`, `guardian` in the enum now so later migrations don't
have to alter it, but grant them nothing yet.

**The test that matters.** For every table, there must be an automated test that
signs in as a user from School A and proves they cannot read, update, or delete a
row belonging to School B — including via joins, aggregate counts, and foreign-key
probing. Write these tests as you write each table, not at the end.

---

## 5. Data model — Release 1

Design the full schema before writing any of it, and show it to me for review.
Below is the required shape, not a complete DDL. Add columns you need; do not
remove entities.

**Platform**
- `schools` — name, slug/subdomain, logo, address, contact, status, created_at
- `school_settings` — one row per school; JSONB `academic_config` holding terms per
  session, assessment components and weights, grade bands, pass mark, promotion
  rule, currency, locale, timezone
- `audit_log` — actor, school, entity, action, before/after, timestamp. Write to it
  from day one for anything that mutates student or staff records.

**Identity**
- `profiles` — extends Supabase `auth.users` with name, phone, photo
- `memberships` — user, school, role, status

**Academic structure**
- `academic_sessions` — school, label ("2025/2026"), start/end, is_current
  *(name it `academic_sessions`, never `sessions` — it will collide with auth
  concepts and confuse everyone including you)*
- `terms` — academic_session, ordinal, label, start/end, is_current
- `class_levels` — school, label ("Primary 4", "JSS 2"), ordinal for promotion order
- `class_arms` — class_level, label ("A", "Gold"), form teacher, capacity
- `subjects` — school, name, code, is_core
- `class_subjects` — subject offered to a class_level in a session, with assigned
  teacher

**People**
- `students` — school, admission number, name, DOB, sex, photo, admission date,
  status (active / graduated / withdrawn / transferred)
- `guardians` — school, name, phone, email, occupation, address
- `student_guardians` — join table with relationship and `is_primary`
- `staff` — school, profile, staff number, role/designation, subjects,
  employment status

**The spine**
- `enrollments` — student, class_arm, term, status (active / promoted / repeated /
  withdrawn), enrolled_at. Unique on (student, term). Everything downstream
  references this.

**Attendance**
- `attendance_registers` — class_arm, date, taken_by, taken_at
- `attendance_entries` — register, enrollment, status (present / absent / late /
  excused), note

Add appropriate indexes, particularly composite indexes leading with `school_id`,
since RLS predicates will filter on it constantly.

---

## 6. Working agreement

**Plan before building.** For each milestone, produce a written plan and wait for
my approval. For each migration, show me the SQL and wait. Migrations are the one
thing that is genuinely painful to undo once pilot data exists.

**Ask rather than assume.** If a requirement is ambiguous, stop and ask. A wrong
assumption buried in the schema costs more than a round trip.

**Small, working commits.** Each commit leaves the app runnable and the tests
green. Conventional commit messages. Never a commit that spans three features.

**Order of work within a feature:** migration → RLS policies → RLS tests →
generated types → server functions → UI. Not UI first.

**Never mock or stub to make a test pass.** If something isn't ready, the test is
skipped with a reason, not faked.

**Don't scaffold ahead.** No placeholder pages, no empty modules for future
features, no "TODO: phase 2" files. The repo should contain only what's built.

**Report honestly.** If something is half-working, say so plainly. Don't describe
partial work as complete.

**Definition of done for a feature:** migration applied, RLS policies written and
tested cross-tenant, Zod validation shared client and server, loading and empty and
error states in the UI, keyboard accessible, works at 360px width, audit log
written for mutations, tests passing.

---

## 7. Release 1 scope

**Milestone 1 — Foundation**
Project setup, Supabase local dev, CI. Subdomain resolution middleware. Auth,
memberships, JWT claims hook, role-based route protection. `schools`,
`school_settings`, `profiles`, `memberships`, `audit_log` with full RLS and
cross-tenant tests. A platform-admin route to create a school and its first admin.

**Milestone 2 — School setup**
Onboarding wizard a new school admin completes on first login: school profile,
choose academic preset (Nigeria default), academic session and terms, class levels
and arms, subjects. Settings screens to edit all of it afterwards.

**Milestone 3 — People**
Student records with photo upload and admission numbers. Guardian records and
linking. Staff records. CSV import for students and staff with a preview-and-fix
step before commit — schools arrive with spreadsheets and will not retype 600
students. Search, filter, pagination, detail views.

**Milestone 4 — Enrollment**
Enroll students into class arms for the current term. Bulk enroll. Move a student
between arms mid-term. Class roster views. End-of-term rollover: promote, repeat,
or graduate a cohort into the next term, preserving history.

**Milestone 5 — Attendance**
Teacher takes a register for their class arm for a date. Bulk mark-all-present then
adjust. Edit window with audit trail. Per-student and per-class attendance summary
for a term. Admin view across the school.

**Milestone 6 — Hardening**
Full cross-tenant RLS test sweep. Playwright coverage of the critical paths. Seed
script generating a realistic demo school. Performance pass against 2,000 students.
Deployment, backups, error monitoring.

---

## 8. Explicitly out of scope for Release 1

Assessments, grading, report cards. Fees, invoicing, payments. Parent and student
portals. Messaging, SMS, notices. Timetabling. Library, transport, hostel. CBT.
Analytics dashboards. Native mobile apps. Billing and subscriptions.

Build nothing toward these. Only make sure the schema doesn't block them — the
enrollment spine and the academic config already handle that.

---

## 9. Design direction

Clean, card-based admin UI. Generous whitespace, soft neutral background, one
restrained accent colour, rounded corners, light borders over heavy shadows. Data
tables are dense and legible rather than airy. Think a calm modern dashboard, not a
colourful consumer app.

Two constraints that matter more than aesthetics:

- **Mobile-real, not mobile-responsive.** Teachers will take attendance on a phone,
  often a cheap one on a patchy connection. Attendance and roster screens are
  designed at 360px first and widened, not the reverse.
- **Print matters.** Nigerian schools print everything. Any list or record view
  that an administrator would plausibly print needs a working print stylesheet.

---

## 10. Before you start

Ask me these, then wait:

1. Is there an existing repo and Supabase project, or are we starting clean?
2. Confirm the subdomain strategy and what domain we're deploying to.
3. Should platform admin live on a reserved subdomain or a separate app entirely?
4. How should I handle a user belonging to more than one school in the UI —
   explicit school switcher, or separate logins per school?
5. What's the realistic upper bound on students per school, so I can size indexes
   and pagination sensibly?
6. Do you want me to write the Nigeria academic preset from scratch, or will you
   supply the exact grade bands, CA weighting, and promotion rules?

Then propose the Milestone 1 plan.
