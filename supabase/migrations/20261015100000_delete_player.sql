-- Admins can delete a player for good: their sign-in, their profile and every row that mentions them.
-- remove_player only hides someone and keeps their history; delete_player erases it (ADR-0011).
--
-- Deleting the auth.users row cascades to profiles, and from there to progress, quiz_attempts (and
-- their keys), challenge_solves, duel_entries and duels (and their keys), including duels against
-- players who stay. A duel also counts as a quiz for both sides (quiz_attempts.source_duel); those
-- rows only lose their link on cascade, so the other side's duel-made attempts are deleted first:
-- the duel disappears for both players, with the XP it gave.
-- The invite goes too, so if they sign in again they start from zero, waiting to be let in.
-- Each delete leaves one private audit line (who deleted which username, when), and an admin can
-- delete only a few players a day, so a stolen session can't wipe everyone.

create table if not exists private.admin_log (
  id      bigint generated always as identity primary key,
  actor   uuid not null,          -- the admin's profile id (no foreign key: the log outlives profiles)
  action  text not null,
  target  text not null,
  at      timestamptz not null default now()
);
create index if not exists admin_log_actor_at_idx on private.admin_log (actor, at);
revoke all on private.admin_log from public, anon, authenticated;

create or replace function private.delete_limit()
returns int language sql immutable set search_path = ''
as $$ select 5 $$;
revoke all on function private.delete_limit() from public, anon, authenticated;

create or replace function public.delete_player(p_github text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text := trim(p_github);
  invites int;
  accounts int;
begin
  if not private.is_lab_admin() then
    raise exception 'Only admins can delete players';
  end if;
  if name is null or name !~ '^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$' then
    raise exception 'That is not a valid GitHub username';
  end if;
  if exists (select 1 from private.admins a where lower(a.github_username) = lower(name))
     or exists (select 1 from public.profiles p where lower(p.github_username) = lower(name) and p.is_admin) then
    raise exception 'Admins can''t be deleted';
  end if;
  if (select count(*) from private.admin_log l
       where l.actor = auth.uid() and l.action = 'delete_player' and l.at > now() - interval '24 hours')
     >= private.delete_limit() then
    raise exception 'You have deleted % players in 24 hours. Try again tomorrow.', private.delete_limit();
  end if;

  delete from private.members where lower(github_username) = lower(name);
  get diagnostics invites = row_count;

  delete from public.quiz_attempts q
   using public.duels d, public.profiles p
   where q.source_duel = d.id
     and p.id in (d.challenger, d.opponent)
     and lower(p.github_username) = lower(name);

  delete from auth.users u
   using public.profiles p
   where p.id = u.id and lower(p.github_username) = lower(name);
  get diagnostics accounts = row_count;

  if invites = 0 and accounts = 0 then
    raise exception 'Nobody with that username';
  end if;
  insert into private.admin_log (actor, action, target) values (auth.uid(), 'delete_player', name);
end;
$$;

revoke all on function public.delete_player(text) from public, anon;
grant execute on function public.delete_player(text) to authenticated;
