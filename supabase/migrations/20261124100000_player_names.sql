-- Players can also sign in with Google (ADR-0013). Until now a player was named by their GitHub username;
-- a Google account has none, so every profile now has a player name (handle), unique ignoring case:
--   - GitHub sign-ups get their username, unless someone already holds it: then they pick one, like Google players.
--   - Google sign-ups pick one (claim_handle) and wait for an admin to let them in (let_in_player).
-- Admin actions now name players by handle. Inviting ahead of sign-up stays GitHub-only (invite_player), since
-- only a GitHub username can be known before someone signs in; cancel_invite takes such an invite back.
-- Google profiles store no name or photo: member profiles are public, and a Google account's name and photo
-- aren't. Admins see the Google account's name in lab_admin_overview, to know who is asking to join.
--
-- Deploy: apply this before the site that uses it (the current site keeps working on it, except that
-- Decline, Remove and Delete in the Players panel fail until the new site is live).

alter table public.profiles add column if not exists handle text not null default '';
update public.profiles set handle = github_username where handle = '' and github_username <> '';
create unique index if not exists profiles_handle_lower_key on public.profiles (lower(handle)) where handle <> '';

-- ── Sign-up ───────────────────────────────────────────────────────────────────────────────────────────
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  from_github boolean := coalesce(new.raw_app_meta_data ->> 'provider', '') = 'github'
                         or coalesce(new.raw_app_meta_data -> 'providers', '[]'::jsonb) ? 'github';
  uname text := case when from_github then nullif(trim(new.raw_user_meta_data ->> 'user_name'), '') end;
  name_free boolean := uname is not null and not exists (select 1 from public.profiles p where lower(p.handle) = lower(uname));
begin
  insert into public.profiles (id, github_username, handle, display_name, avatar_url, is_member, is_admin)
  values (
    new.id,
    coalesce(uname, ''),
    case when name_free then uname else '' end,
    -- Only GitHub's public name and avatar are copied; other accounts start without a name or photo.
    case when from_github then new.raw_user_meta_data ->> 'full_name' end,
    case when from_github then new.raw_user_meta_data ->> 'avatar_url' end,
    uname is not null and exists (select 1 from private.members m where lower(m.github_username) = lower(uname)),
    uname is not null and exists (select 1 from private.admins a where lower(a.github_username) = lower(uname))
  );
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

-- ── Picking a player name ─────────────────────────────────────────────────────────────────────────────
create or replace function private.handle_pattern()
returns text language sql immutable set search_path = ''
as $$ select '^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){2,38}$' $$;
revoke all on function private.handle_pattern() from public, anon, authenticated;

create or replace function public.claim_handle(p_handle text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  name text := trim(p_handle);
  app jsonb;
begin
  if uid is null then
    raise exception 'Sign in first';
  end if;
  if not exists (select 1 from public.profiles p where p.id = uid and p.handle = '') then
    raise exception 'You already have a player name';
  end if;
  -- Only GitHub and Google sign-ins can play (Supabase Auth records the provider; the client can't set it).
  select u.raw_app_meta_data into app from auth.users u where u.id = uid;
  if not (coalesce(app ->> 'provider', '') in ('github', 'google')
          or coalesce(app -> 'providers', '[]'::jsonb) ?| array['github', 'google']) then
    raise exception 'Sign in with GitHub or Google to play';
  end if;
  if name is null or name !~ private.handle_pattern() then
    raise exception 'A player name is 3 to 39 letters, digits or single hyphens';
  end if;
  -- Taken: another player's name, or a GitHub username an admin invited or made admin (its owner may sign in later).
  if exists (select 1 from public.profiles p where lower(p.handle) = lower(name))
     or exists (select 1 from private.members m where lower(m.github_username) = lower(name))
     or exists (select 1 from private.admins a where lower(a.github_username) = lower(name)) then
    raise exception 'That player name is taken';
  end if;
  update public.profiles set handle = name where id = uid and handle = '';
  return name;
exception when unique_violation then
  raise exception 'That player name is taken';
end;
$$;
revoke all on function public.claim_handle(text) from public, anon;
grant execute on function public.claim_handle(text) to authenticated;

-- ── Admins: let in, decline, remove and delete by player name ─────────────────────────────────────────
create or replace function public.let_in_player(p_handle text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.profiles%rowtype;
begin
  if not private.is_lab_admin() then
    raise exception 'Only admins can let players in';
  end if;
  select * into target from public.profiles p
   where p.handle <> '' and lower(p.handle) = lower(trim(p_handle)) and not p.is_member;
  if not found then
    raise exception 'Nobody with that player name is waiting';
  end if;
  -- A GitHub player also goes on the members list, as an invite would have put them.
  if target.github_username <> '' then
    insert into private.members (github_username) values (target.github_username) on conflict do nothing;
  end if;
  update public.profiles set is_member = true, declined_at = null where id = target.id;
end;
$$;
revoke all on function public.let_in_player(text) from public, anon;
grant execute on function public.let_in_player(text) to authenticated;

drop function if exists public.decline_player(text);
create function public.decline_player(p_handle text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_lab_admin() then
    raise exception 'Only admins can decline players';
  end if;
  update public.profiles set declined_at = now()
   where handle <> '' and lower(handle) = lower(trim(p_handle)) and not is_member;
  if not found then
    raise exception 'Nobody with that player name is waiting';
  end if;
end;
$$;
revoke all on function public.decline_player(text) from public, anon;
grant execute on function public.decline_player(text) to authenticated;

drop function if exists public.remove_player(text);
create function public.remove_player(p_handle text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.profiles%rowtype;
begin
  if not private.is_lab_admin() then
    raise exception 'Only admins can remove players';
  end if;
  select * into target from public.profiles p where p.handle <> '' and lower(p.handle) = lower(trim(p_handle));
  if not found then
    raise exception 'Nobody with that player name';
  end if;
  if target.is_admin then
    raise exception 'Admins can''t be removed here';
  end if;
  if target.github_username <> '' then
    delete from private.members where lower(github_username) = lower(target.github_username);
  end if;
  update public.profiles set is_member = false where id = target.id;
end;
$$;
revoke all on function public.remove_player(text) from public, anon;
grant execute on function public.remove_player(text) to authenticated;

-- Take back an invite for a GitHub username nobody has signed in with yet.
create or replace function public.cancel_invite(p_github text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_lab_admin() then
    raise exception 'Only admins can cancel invites';
  end if;
  delete from private.members m
   where lower(m.github_username) = lower(trim(p_github))
     and not exists (select 1 from public.profiles p where lower(p.github_username) = lower(m.github_username));
  if not found then
    raise exception 'No open invite for that username';
  end if;
end;
$$;
revoke all on function public.cancel_invite(text) from public, anon;
grant execute on function public.cancel_invite(text) to authenticated;

-- As before (ADR-0011): the account and every row that mentions it, rate-limited and logged.
drop function if exists public.delete_player(text);
create function public.delete_player(p_handle text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text := trim(p_handle);
  target public.profiles%rowtype;
begin
  if not private.is_lab_admin() then
    raise exception 'Only admins can delete players';
  end if;
  if name is null or name = '' then
    raise exception 'That is not a valid player name';
  end if;
  if exists (select 1 from private.admins a where lower(a.github_username) = lower(name)) then
    raise exception 'Admins can''t be deleted';
  end if;
  select * into target from public.profiles p where p.handle <> '' and lower(p.handle) = lower(name);
  if not found then
    raise exception 'Nobody with that player name';
  end if;
  if target.is_admin
     or exists (select 1 from private.admins a where lower(a.github_username) = lower(target.github_username)) then
    raise exception 'Admins can''t be deleted';
  end if;
  if (select count(*) from private.admin_log l
       where l.actor = auth.uid() and l.action = 'delete_player' and l.at > now() - interval '24 hours')
     >= private.delete_limit() then
    raise exception 'You have deleted % players in 24 hours. Try again tomorrow.', private.delete_limit();
  end if;

  -- Their invite goes too, so if they sign in again they start from zero, waiting to be let in.
  if target.github_username <> '' then
    delete from private.members where lower(github_username) = lower(target.github_username);
  end if;
  -- Duel sheets saved as quizzes only lose their link on cascade: delete the other side's first.
  delete from public.quiz_attempts q
   using public.duels d
   where q.source_duel = d.id and target.id in (d.challenger, d.opponent);
  delete from auth.users u where u.id = target.id;
  insert into private.admin_log (actor, action, target) values (auth.uid(), 'delete_player', target.handle);
end;
$$;
revoke all on function public.delete_player(text) from public, anon;
grant execute on function public.delete_player(text) to authenticated;

-- ── The admins' overview ──────────────────────────────────────────────────────────────────────────────
-- provider: 'github' or the sign-in's provider; account_name: GitHub's public name, or the Google account's
-- name (only admins see it, here).
create or replace function private.waiting_entry(p public.profiles, app jsonb, meta jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'handle', p.handle,
    'github_username', p.github_username,
    'provider', case when p.github_username <> '' then 'github' else coalesce(app ->> 'provider', '') end,
    'account_name', coalesce(p.display_name, meta ->> 'full_name', meta ->> 'name'),
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'signed_in_at', p.created_at)
$$;
revoke all on function private.waiting_entry(public.profiles, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.lab_admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_lab_admin() then
    raise exception 'Only admins can manage players';
  end if;
  return jsonb_build_object(
    'waiting', coalesce((
      select jsonb_agg(private.waiting_entry(p, u.raw_app_meta_data, u.raw_user_meta_data) order by p.created_at desc)
        from public.profiles p left join auth.users u on u.id = p.id
       where not p.is_member and p.declined_at is null and p.handle <> ''), '[]'::jsonb),
    'declined', coalesce((
      select jsonb_agg(private.waiting_entry(p, u.raw_app_meta_data, u.raw_user_meta_data) order by p.declined_at desc)
        from public.profiles p left join auth.users u on u.id = p.id
       where not p.is_member and p.declined_at is not null and p.handle <> ''), '[]'::jsonb),
    'invited', coalesce((
      select jsonb_agg(m.github_username order by m.github_username)
        from private.members m
       where not exists (select 1 from public.profiles p where lower(p.github_username) = lower(m.github_username))), '[]'::jsonb)
  );
end;
$$;
