-- Per-school choice of payment gateway, and a school's own logo.
--
-- On credentials, deliberately: this table holds a school's PUBLIC key and its
-- provider choice, and no secret key at all. Inline checkout at all four
-- gateways needs only the public key, and the secret is needed solely to
-- verify a transaction afterwards.
--
-- Secrets therefore live in environment variables, one set per provider, which
-- means money lands in the platform's merchant account and is remitted to
-- schools. Giving each school its own merchant account would mean storing their
-- secret key, and the only caller that could decrypt it during a pupil's
-- payment is one holding the service_role key — which non-negotiable 4 forbids
-- in a request path. That needs a secrets manager and a deliberate decision,
-- so it is not pretended at here.

create type app.payment_provider as enum ('paystack', 'flutterwave', 'remita', 'stripe');

create table public.school_payment_settings (
  school_id   uuid primary key references public.schools(id) on delete cascade,
  provider    app.payment_provider not null default 'paystack',
  is_enabled  boolean not null default false,
  is_live     boolean not null default false,
  -- Safe to expose: inline checkout puts this in the browser by design.
  public_key  text,
  -- Remita identifies a merchant by code and service type rather than a key.
  merchant_code    text,
  service_type_id  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger touch_school_payment_settings before update on public.school_payment_settings
  for each row execute function app.touch_updated_at();
create trigger audit_school_payment_settings
  after insert or update or delete on public.school_payment_settings
  for each row execute function app.write_audit();

alter table public.school_payment_settings enable row level security;
alter table public.school_payment_settings force row level security;

-- Any member may read it, including a pupil: the portal cannot render the right
-- checkout button without knowing the provider and its public key, and neither
-- value is a secret.
create policy school_payment_settings_read on public.school_payment_settings
  for select to authenticated using (app.can_read_reference(school_id));

create policy school_payment_settings_insert on public.school_payment_settings
  for insert to authenticated with check (app.can_manage_fees(school_id));
create policy school_payment_settings_update on public.school_payment_settings
  for update to authenticated
  using (app.can_manage_fees(school_id)) with check (app.can_manage_fees(school_id));
create policy school_payment_settings_delete on public.school_payment_settings
  for delete to authenticated using (app.can_manage_fees(school_id));

-- Every school that already exists gets a disabled default row, so the settings
-- screen has something to edit rather than an absent state to special-case.
insert into public.school_payment_settings (school_id)
select id from public.schools
on conflict (school_id) do nothing;

-- Newly created schools get one too.
create or replace function app.seed_payment_settings()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.school_payment_settings (school_id) values (new.id)
  on conflict (school_id) do nothing;
  return new;
end;
$$;
create trigger schools_seed_payment_settings after insert on public.schools
  for each row execute function app.seed_payment_settings();

-- ------------------------------------------------------------------ branding
-- A logo is shown in the sidebar, on a printed report card and on an invoice,
-- so it is world-readable by design. Writing one is confined to the school's
-- own folder, which is what stops a school replacing another's badge.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('school-logos', 'school-logos', true, 2097152,
        array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

create policy "school logos are public" on storage.objects for select
  using (bucket_id = 'school-logos');

create policy "school logo insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'school-logos'
    and app.can_admin(((storage.foldername(name))[1])::uuid)
  );
create policy "school logo update" on storage.objects for update to authenticated
  using (
    bucket_id = 'school-logos'
    and app.can_admin(((storage.foldername(name))[1])::uuid)
  );
create policy "school logo delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'school-logos'
    and app.can_admin(((storage.foldername(name))[1])::uuid)
  );
