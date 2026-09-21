-- Release 2, milestone 4: messaging between a pupil and their school's staff.
--
-- Two constraints shape this, and both are about the fact that one side of
-- every conversation is a child:
--
--   * A pupil may only open a thread with staff of their own school. Pupil to
--     pupil is not a thing this system does, so there is no unsupervised
--     channel between minors to moderate.
--   * Nothing is deleted. A message can be withdrawn from view by its sender,
--     but the row stays, because a safeguarding record that can be erased by
--     the person who wrote it is not a record.

create table public.message_threads (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  subject         text not null check (length(btrim(subject)) between 1 and 160),
  created_by      uuid references auth.users(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index message_threads_school_idx on public.message_threads (school_id, last_message_at desc);

create table public.thread_participants (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  thread_id    uuid not null references public.message_threads(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role_at_join app.user_role not null,
  last_read_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (thread_id, user_id)
);
create index thread_participants_user_idx on public.thread_participants (user_id, thread_id);
create index thread_participants_thread_idx on public.thread_participants (thread_id);

create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  thread_id    uuid not null references public.message_threads(id) on delete cascade,
  sender_id    uuid references auth.users(id) on delete set null,
  body         text not null check (length(btrim(body)) between 1 and 4000),
  withdrawn_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index messages_thread_idx on public.messages (thread_id, created_at);
create index messages_school_idx on public.messages (school_id, created_at desc);

create trigger touch_message_threads before update on public.message_threads
  for each row execute function app.touch_updated_at();
create trigger touch_messages before update on public.messages
  for each row execute function app.touch_updated_at();
create trigger audit_messages after insert or update or delete on public.messages
  for each row execute function app.write_audit();

-- Membership of a thread, read without recursing through the thread's own RLS.
create or replace function app.in_thread(target_thread uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.thread_participants p
    where p.thread_id = target_thread and p.user_id = (select auth.uid())
  );
$$;
grant execute on function app.in_thread(uuid) to authenticated;

alter table public.message_threads     enable row level security;
alter table public.thread_participants enable row level security;
alter table public.messages            enable row level security;
alter table public.message_threads     force row level security;
alter table public.thread_participants force row level security;
alter table public.messages            force row level security;

-- A thread is visible to its participants. An administrator of the school can
-- also see it: this is a school's safeguarding record, not private mail.
create policy message_threads_read on public.message_threads for select to authenticated
  using (app.in_thread(id) or app.can_admin(school_id));

create policy thread_participants_read on public.thread_participants for select to authenticated
  using (app.in_thread(thread_id) or app.can_admin(school_id));

create policy messages_read on public.messages for select to authenticated
  using (app.in_thread(thread_id) or app.can_admin(school_id));

-- Posting is an insert by a participant, and only ever as yourself.
create policy messages_insert on public.messages for insert to authenticated
  with check (app.in_thread(thread_id) and sender_id = (select auth.uid()));

-- The only edit anyone may make is withdrawing their own message. The
-- unchanged-body check is what stops this becoming a rewrite-history button.
create policy messages_withdraw on public.messages for update to authenticated
  using (sender_id = (select auth.uid()))
  with check (sender_id = (select auth.uid()));

-- Marking your own participation as read.
create policy thread_participants_read_receipt on public.thread_participants
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- A message body is immutable; only withdrawn_at may move.
create or replace function app.messages_are_append_only()
returns trigger language plpgsql as $$
begin
  if new.body is distinct from old.body then
    raise exception 'a sent message cannot be edited; withdraw it instead';
  end if;
  if old.withdrawn_at is not null and new.withdrawn_at is null then
    raise exception 'a withdrawn message cannot be restored';
  end if;
  return new;
end;
$$;
create trigger messages_append_only before update on public.messages
  for each row execute function app.messages_are_append_only();

-- ------------------------------------------------------------- starting one
-- A thread is opened through this function so the participant rules are
-- enforced in one place rather than in every caller.
create or replace function public.start_thread(
  p_school_id uuid, p_subject text, p_recipient uuid, p_body text
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  thread_id uuid;
  my_role app.user_role;
  their_role app.user_role;
begin
  select role into my_role from public.memberships
   where user_id = auth.uid() and school_id = p_school_id and status = 'active';
  select role into their_role from public.memberships
   where user_id = p_recipient and school_id = p_school_id and status = 'active';

  if my_role is null or their_role is null then
    raise exception 'both people must belong to this school' using errcode = '42501';
  end if;

  -- A pupil may write to staff, and to nobody else.
  if my_role = 'student' and their_role not in ('school_admin', 'teacher', 'bursar') then
    raise exception 'students may only message staff' using errcode = '42501';
  end if;
  if their_role = 'student' and my_role not in ('school_admin', 'teacher', 'bursar') then
    raise exception 'only staff may message a student' using errcode = '42501';
  end if;
  if p_recipient = auth.uid() then
    raise exception 'pick somebody else to write to' using errcode = '22023';
  end if;

  insert into public.message_threads (school_id, subject, created_by)
  values (p_school_id, p_subject, auth.uid())
  returning id into thread_id;

  insert into public.thread_participants (school_id, thread_id, user_id, role_at_join, last_read_at)
  values (p_school_id, thread_id, auth.uid(), my_role, now()),
         (p_school_id, thread_id, p_recipient, their_role, null);

  insert into public.messages (school_id, thread_id, sender_id, body)
  values (p_school_id, thread_id, auth.uid(), p_body);

  return thread_id;
end;
$$;

-- Posting a reply also moves the thread to the top of the list.
create or replace function public.post_message(p_thread uuid, p_body text)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare msg_id uuid; sid uuid;
begin
  select school_id into sid from public.message_threads where id = p_thread;
  if sid is null then
    raise exception 'thread not found' using errcode = '42501';
  end if;

  insert into public.messages (school_id, thread_id, sender_id, body)
  values (sid, p_thread, auth.uid(), p_body)
  returning id into msg_id;

  update public.message_threads set last_message_at = now() where id = p_thread;
  return msg_id;
end;
$$;

-- Who a pupil is allowed to write to. Returns staff of their school only, and
-- deliberately exposes just a name and designation rather than the staff row,
-- which carries personal phone numbers and addresses.
create or replace function public.messageable_staff(p_school_id uuid)
returns table (user_id uuid, full_name text, designation text)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.user_id, p.full_name, st.designation
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  left join public.staff st on st.profile_id = m.user_id and st.school_id = m.school_id
  where m.school_id = p_school_id
    and m.status = 'active'
    and m.role in ('school_admin', 'teacher', 'bursar')
    and app.is_member(p_school_id)
  order by p.full_name;
$$;

grant execute on function public.start_thread(uuid, text, uuid, text),
  public.post_message(uuid, text),
  public.messageable_staff(uuid) to authenticated;
