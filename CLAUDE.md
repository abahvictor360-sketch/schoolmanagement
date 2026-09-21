# SchoolHub — working rules

Distilled from SPEC.md. These survive context compaction; read SPEC.md for the
full brief.

## Non-negotiables

1. **One database, many tenants.** Every domain table carries `school_id`.
   Isolation is enforced by Postgres RLS, never by application code. No
   schema-per-tenant, no database-per-tenant.
2. **Enrollment is the spine.** A student is never "in JSS 2". A student has an
   enrollment binding them to a class arm, in a term, of a session. Attendance,
   results and fees hang off the enrollment, never off `students`.
3. **Academic rules are data.** Terms per session, CA weighting, grade bands,
   pass marks, promotion rules, currency, locale, date format all live in
   `school_settings.academic_config`. Never hardcode "3 terms", "40/60" or
   "A1–F9" in application logic. A new country is a new preset in
   `src/lib/academic-config.ts`, not a new branch.
4. **Deny by default.** Every table has RLS enabled *and* forced, with no
   permissive default. A missing policy must return nothing, never everything.
   The `service_role` key is never used in a request-handling path — only in
   migrations, seeds and audited background jobs.
5. **Scope discipline.** Release 1 is milestones 1–6 in SPEC.md §7 and is
   complete. **Release 2 was opened deliberately by the owner** and covers the
   student portal, assessments and results, CBT, and messaging — all of which
   SPEC.md §8 had excluded from R1. Everything still in §8 (fees and invoicing,
   guardian portal, SMS, timetabling, library, transport, hostel, analytics
   dashboards, native apps, billing) remains out of scope. Adjacent and cheap
   is still out of scope.

6. **A pupil is a member, so "member" is not a permission.** `app.can_read()`
   means *staff* (school_admin, teacher, bursar). `app.can_read_reference()` is
   the wider one for the school, calendar, class structure and subject list.
   Anything a pupil may see of their own is an explicit policy naming
   `app.my_student_id()` or `app.owns_enrollment()`. Never widen a read policy
   back to `app.is_member()` without checking what it hands a child.

7. **The CBT answer key is not a column.** RLS is row-level, so correctness
   lives in `cbt_answer_keys`, which has no student-readable policy at all.
   Marking runs in a security definer function. Never add an `is_correct`
   column to anything a candidate can select.

## Order of work within a feature

migration → RLS policies → RLS tests → generated types → server actions → UI.
Never UI first.

## Definition of done

Migration applied · RLS policies written and tested cross-tenant · Zod schema
shared by client and server · loading, empty and error states · keyboard
accessible · works at 360px · audit log written for mutations · tests passing.

## Conventions

- **No ORM.** Hand-written SQL migrations in `supabase/migrations`, strictly
  sequential, checked into git. Types in `src/lib/database.types.ts`.
- **RLS helpers** live in the `app` schema: `app.can_read(school_id)`,
  `app.can_admin(school_id)`, `app.can_take_attendance(school_id)`. They are
  `security definer` so policies can read `memberships` without recursing.
- **Server actions** validate with the same Zod schema the form used
  (`src/lib/validation.ts`) and return `ActionResult`, never throw for user
  error.
- **Never mock or stub to make a test pass.** If something is not ready, skip
  the test with a reason.
- **Do not scaffold ahead.** No placeholder pages, no empty modules, no
  "TODO: phase 2" files.
- **Small commits.** Each leaves the app runnable and the tests green.
  Conventional commit messages.
- **Report honestly.** Half-working is described as half-working.
- **Seeding `auth.users` by hand** must set `confirmation_token`,
  `recovery_token`, `email_change_token_new` and `email_change` to `''` (they
  have no default, and GoTrue scans them as non-nullable strings) and insert a
  matching `auth.identities` row. Otherwise every sign-in fails with
  "Database error querying schema". `supabase/tests/auth_seed_sanity.sql`
  guards this.

## Design constraints that outrank aesthetics

- **Mobile-real.** Attendance and roster screens are designed at 360px and
  widened, not the reverse. Teachers use cheap phones on patchy connections, so
  a register saves in one request or not at all.
- **Print matters.** Any list or record an administrator would plausibly print
  has a working print stylesheet (`.no-print`, `.print-only` in globals.css).

## Commands

```
npm run dev         # local dev server
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm test            # vitest unit suite
psql "$DATABASE_URL" -f supabase/tests/rls_cross_tenant.sql   # isolation suite
psql "$DATABASE_URL" -f supabase/tests/rls_roles.sql          # role separation
psql "$DATABASE_URL" -f supabase/tests/rls_student.sql        # a pupil sees only themselves
psql "$DATABASE_URL" -f supabase/tests/rls_student_academics.sql  # answer key stays hidden
psql "$DATABASE_URL" -f supabase/tests/rls_messaging.sql      # who may write to whom
psql "$DATABASE_URL" -f supabase/tests/auth_seed_sanity.sql   # seeded users are loginable
```
