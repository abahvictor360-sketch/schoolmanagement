-- Guards the seed against the failure mode that is hardest to diagnose from the
-- outside: a hand-written auth.users row that looks fine in SQL but makes
-- GoTrue answer every sign-in with "Database error querying schema".
--
-- GoTrue scans several auth.users columns into a Go `string` rather than a
-- `*string`. Four of them have no column default, so an INSERT that omits them
-- leaves a NULL, and the row scan fails for the whole users table.

do $$
declare
  offenders text;
  missing_identities text;
begin
  select string_agg(email, ', ') into offenders
  from auth.users
  where confirmation_token is null
     or recovery_token is null
     or email_change_token_new is null
     or email_change is null
     or email_change_token_current is null
     or phone_change is null
     or phone_change_token is null
     or reauthentication_token is null
     or aud is null
     or role is null
     or raw_app_meta_data is null
     or raw_user_meta_data is null;

  if offenders is not null then
    raise exception
      'auth.users rows with NULL in a column GoTrue scans as a string: %', offenders;
  end if;

  select string_agg(u.email, ', ') into missing_identities
  from auth.users u
  where u.is_sso_user = false
    and not exists (
      select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

  if missing_identities is not null then
    raise exception 'password users with no email identity: %', missing_identities;
  end if;

  raise notice 'auth seed sanity: all users are shaped the way GoTrue expects';
end $$;
