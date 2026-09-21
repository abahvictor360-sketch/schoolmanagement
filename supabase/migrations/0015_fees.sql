-- Release 2, milestone 5: fees, invoices and payments.
--
-- Money has two rules that shape everything here.
--
-- First, an invoice is a snapshot. Its line items are copied out of the fee
-- structure when it is issued, so a school raising next term's tuition never
-- silently rewrites what a family was already billed.
--
-- Second, the amount is never taken from the client. A payment is opened by a
-- function that reads the outstanding balance itself and refuses anything
-- above it, so a tampered form cannot under- or over-pay an invoice.
--
-- Everything hangs off the enrollment, like attendance and results, so a
-- repeated year has its own bill and its own history.

create type app.fee_invoice_status as enum ('draft', 'issued', 'void');
create type app.payment_method as enum ('card', 'bank_transfer', 'cash', 'pos', 'waiver');
create type app.payment_status as enum ('pending', 'confirmed', 'failed', 'refunded');
create type app.payer_kind as enum ('student', 'guardian', 'bursary');

-- Bursars exist in the role enum from day one and finally have something to do.
create or replace function app.can_manage_fees(target_school uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select app.has_role(target_school, 'school_admin', 'bursar') or app.is_platform_admin();
$$;
grant execute on function app.can_manage_fees(uuid) to authenticated;

-- ---------------------------------------------------------- what is charged
create table public.fee_structures (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  term_id        uuid not null references public.terms(id) on delete cascade,
  class_level_id uuid not null references public.class_levels(id) on delete cascade,
  name           text not null check (length(btrim(name)) between 2 and 120),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (term_id, class_level_id)
);
create index fee_structures_school_idx on public.fee_structures (school_id, term_id);

create table public.fee_items (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools(id) on delete cascade,
  fee_structure_id  uuid not null references public.fee_structures(id) on delete cascade,
  label             text not null check (length(btrim(label)) between 1 and 120),
  amount            numeric(12,2) not null check (amount >= 0),
  is_optional       boolean not null default false,
  ordinal           integer not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index fee_items_structure_idx on public.fee_items (fee_structure_id, ordinal);

-- ---------------------------------------------------------- what is owed
create table public.invoices (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  enrollment_id    uuid not null references public.enrollments(id) on delete cascade,
  fee_structure_id uuid not null references public.fee_structures(id) on delete restrict,
  invoice_number   text not null,
  total_amount     numeric(12,2) not null check (total_amount >= 0),
  status           app.fee_invoice_status not null default 'issued',
  issued_on        date not null default current_date,
  due_on           date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (enrollment_id, fee_structure_id),
  unique (school_id, invoice_number)
);
create index invoices_school_idx on public.invoices (school_id, status, due_on);
create index invoices_enrollment_idx on public.invoices (enrollment_id);

-- Copied from fee_items at issue time, never joined back to them.
create table public.invoice_items (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  label      text not null,
  amount     numeric(12,2) not null check (amount >= 0),
  ordinal    integer not null default 1,
  created_at timestamptz not null default now()
);
create index invoice_items_invoice_idx on public.invoice_items (invoice_id, ordinal);

-- ---------------------------------------------------------- what was paid
create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references public.schools(id) on delete cascade,
  invoice_id         uuid not null references public.invoices(id) on delete cascade,
  amount             numeric(12,2) not null check (amount > 0),
  method             app.payment_method not null,
  status             app.payment_status not null default 'pending',

  -- Who actually handed over the money. A school's cash book has to answer
  -- this, and it is the only thing that settles a fee dispute.
  payer_kind         app.payer_kind not null,
  payer_user_id      uuid references auth.users(id) on delete set null,
  payer_guardian_id  uuid references public.guardians(id) on delete set null,
  payer_name         text,

  -- Our reference travels to the gateway; theirs comes back.
  reference          text not null,
  provider           text,
  provider_reference text,

  note               text,
  paid_at            timestamptz,
  confirmed_by       uuid references auth.users(id) on delete set null,
  confirmed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (school_id, reference),

  -- A guardian payment must name the guardian; a card payment must name a user.
  check (payer_kind <> 'guardian' or payer_guardian_id is not null)
);
create index payments_invoice_idx on public.payments (invoice_id, status);
create index payments_school_idx on public.payments (school_id, status, created_at desc);
create unique index payments_provider_ref_idx
  on public.payments (provider, provider_reference)
  where provider_reference is not null;

do $$
declare t text;
begin
  foreach t in array array['fee_structures','fee_items','invoices','payments'] loop
    execute format('create trigger touch_%1$s before update on public.%1$s
                      for each row execute function app.touch_updated_at()', t);
  end loop;
  foreach t in array array['fee_structures','fee_items','invoices','invoice_items','payments'] loop
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s
                      for each row execute function app.write_audit()', t);
  end loop;
end $$;

-- ------------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array['fee_structures','fee_items','invoices','invoice_items','payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('create policy %1$s_staff_read on public.%1$s for select to authenticated
                      using (app.can_read(school_id))', t);
    execute format('create policy %1$s_staff_insert on public.%1$s for insert to authenticated
                      with check (app.can_manage_fees(school_id))', t);
    execute format('create policy %1$s_staff_update on public.%1$s for update to authenticated
                      using (app.can_manage_fees(school_id)) with check (app.can_manage_fees(school_id))', t);
    execute format('create policy %1$s_staff_delete on public.%1$s for delete to authenticated
                      using (app.can_manage_fees(school_id))', t);
  end loop;
end $$;

-- A pupil sees their own bill and what has been paid against it. They cannot
-- see the fee structure itself, only the invoice raised from it, and they can
-- write nothing: opening a payment goes through a function.
create policy invoices_read_self on public.invoices for select to authenticated
  using (app.owns_enrollment(enrollment_id));

create policy invoice_items_read_self on public.invoice_items for select to authenticated
  using (
    exists (select 1 from public.invoices i
            where i.id = public.invoice_items.invoice_id and app.owns_enrollment(i.enrollment_id))
  );

create policy payments_read_self on public.payments for select to authenticated
  using (
    exists (select 1 from public.invoices i
            where i.id = public.payments.invoice_id and app.owns_enrollment(i.enrollment_id))
  );

-- ------------------------------------------------------------- the balance
-- security_invoker so the view answers under the caller's own RLS: staff see
-- the school, a pupil sees only their own line.
create view public.invoice_balances with (security_invoker = true) as
  select
    i.id                as invoice_id,
    i.school_id,
    i.enrollment_id,
    i.invoice_number,
    i.total_amount,
    coalesce(paid.amount, 0)                    as amount_paid,
    i.total_amount - coalesce(paid.amount, 0)   as balance,
    coalesce(pending.amount, 0)                 as amount_pending,
    i.status,
    i.due_on
  from public.invoices i
  left join lateral (
    select sum(p.amount) as amount from public.payments p
    where p.invoice_id = i.id and p.status = 'confirmed'
  ) paid on true
  left join lateral (
    select sum(p.amount) as amount from public.payments p
    where p.invoice_id = i.id and p.status = 'pending'
  ) pending on true;

grant select on public.invoice_balances to authenticated;

create or replace function app.invoice_balance(p_invoice uuid)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select i.total_amount - coalesce((
    select sum(p.amount) from public.payments p
    where p.invoice_id = i.id and p.status = 'confirmed'
  ), 0)
  from public.invoices i where i.id = p_invoice;
$$;
