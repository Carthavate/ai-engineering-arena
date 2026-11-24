-- Player names (ADR-0013): Google sign-ups pick a name and wait to be let in; admins act by player name.
begin;
select tests.user('boss', true, true) as boss \gset
select tests.user('pal') as pal \gset

-- A GitHub sign-up is named after its username.
select tests.as_postgres();
select tests.eq((select handle from public.profiles where id = :'pal'), 'pal', 'GitHub players are named after their username');

-- A Google sign-up starts without a name, photo or membership, whatever its metadata says.
insert into auth.users (raw_user_meta_data, raw_app_meta_data) values (
  '{"full_name": "Jane Doe", "name": "Jane Doe", "user_name": "boss", "avatar_url": "https://lh3.googleusercontent.com/a/x"}',
  '{"provider": "google", "providers": ["google"]}') returning id as jane \gset
select tests.eq((select handle || '|' || github_username from public.profiles where id = :'jane'), '|', 'no name yet');
select tests.eq((select display_name is null and avatar_url is null from public.profiles where id = :'jane'), true,
                'the Google name and photo are not copied into the public profile');
select tests.eq((select is_member or is_admin from public.profiles where id = :'jane'), false, 'not a player, not an admin');
select tests.as_user(:'boss');
select tests.eq(jsonb_array_length(public.lab_admin_overview() -> 'waiting'), 0, 'nameless sign-ups are not listed yet');

-- Picking a name: valid, free, and not a GitHub username an admin invited or made admin.
select tests.as_anon();
select tests.throws($$select public.claim_handle('someone')$$, 'permission denied');
select tests.as_user(:'boss');
select public.invite_player('future-friend');
select tests.as_user(:'jane');
select tests.throws($$select public.claim_handle('ab')$$, '3 to 39');
select tests.throws($$select public.claim_handle('-bad')$$, '3 to 39');
select tests.throws($$select public.claim_handle('a--b')$$, '3 to 39');
select tests.throws($$select public.claim_handle('sky walker')$$, '3 to 39');
select tests.throws($$select public.claim_handle(repeat('a', 40))$$, '3 to 39');
select tests.throws($$select public.claim_handle('PAL')$$, 'taken');
select tests.throws($$select public.claim_handle('Future-Friend')$$, 'taken');
select tests.throws($$select public.claim_handle('twadi')$$, 'taken');
select tests.eq(public.claim_handle('  Skywalker '), 'Skywalker', 'name claimed');
select tests.throws($$select public.claim_handle('another-name')$$, 'already have a player name');
select tests.throws($$update public.profiles set handle = 'renamed' where id = auth.uid()$$, 'permission denied');

-- Other sign-ins (an email account, say) can't play.
select tests.as_postgres();
insert into auth.users (raw_user_meta_data, raw_app_meta_data) values ('{}', '{"provider": "email", "providers": ["email"]}')
  returning id as mailer \gset
select tests.as_user(:'mailer');
select tests.throws($$select public.claim_handle('mailer')$$, 'GitHub or Google');

-- Admins see who is asking: the player name, the provider and (only here) the Google account's name.
select tests.as_user(:'pal');
select tests.throws($$select public.let_in_player('skywalker')$$, 'Only admins');
select tests.throws($$select public.cancel_invite('future-friend')$$, 'Only admins');
select tests.as_user(:'boss');
select tests.eq((public.lab_admin_overview() -> 'waiting' -> 0) - 'signed_in_at',
  '{"handle": "Skywalker", "github_username": "", "provider": "google", "account_name": "Jane Doe", "display_name": null, "avatar_url": null}'::jsonb,
  'waiting entry');
select tests.throws($$select public.let_in_player('nobody-here')$$, 'Nobody with that player name is waiting');

-- Decline, let in (case-insensitive), then she is a player like any other, shown by her player name only.
select public.decline_player('SKYWALKER');
select tests.eq((public.lab_admin_overview() -> 'declined' -> 0 ->> 'handle'), 'Skywalker', 'declined by name');
select public.let_in_player('skywalker');
select tests.as_anon();
select tests.eq((select handle from public.profiles where id = :'jane'), 'Skywalker', 'members see her by name');
select tests.eq((select display_name from public.profiles where id = :'jane'), null, 'and nothing from her Google account');
select tests.as_user(:'boss');
select tests.throws($$select public.let_in_player('Skywalker')$$, 'Nobody with that player name is waiting');

-- A GitHub user whose username a Google player already holds signs in nameless and picks another name.
select tests.as_postgres();
insert into auth.users (raw_user_meta_data, raw_app_meta_data) values ('{"user_name": "skywalker"}', '{"provider": "github"}')
  returning id as gh_sky \gset
select tests.eq((select handle || '|' || github_username from public.profiles where id = :'gh_sky'), '|skywalker',
                'the GitHub username is kept, the name is not');
select tests.as_user(:'gh_sky');
select tests.eq(public.claim_handle('sky-gh'), 'sky-gh', 'GitHub players can pick a name too');
select tests.as_user(:'boss');
select public.let_in_player('sky-gh');
select tests.as_postgres();
select tests.eq((select count(*) from private.members where github_username = 'skywalker')::int, 1,
                'letting in a GitHub player also puts their username on the members list');

-- Remove and delete work by player name, for Google players too.
select tests.as_user(:'boss');
select tests.throws($$select public.remove_player('nobody-here')$$, 'Nobody with that player name');
select public.remove_player('Skywalker');
select tests.as_anon();
select tests.eq((select count(*) from public.profiles where id = :'jane')::int, 0, 'removed: hidden again');
select tests.as_user(:'boss');
select public.delete_player('skywalker');
select tests.as_postgres();
select tests.eq((select count(*) from auth.users where id = :'jane')::int, 0, 'deleted: account gone');
select tests.eq((select count(*) from public.profiles where id = :'gh_sky')::int, 1, 'the GitHub skywalker stays');

-- An invite nobody used yet can be taken back; one that was used can't.
select tests.as_user(:'boss');
select public.cancel_invite(' FUTURE-FRIEND ');
select tests.eq((public.lab_admin_overview() -> 'invited') ? 'future-friend', false, 'invite cancelled');
select tests.throws($$select public.cancel_invite('future-friend')$$, 'No open invite');
select tests.throws($$select public.cancel_invite('skywalker')$$, 'No open invite');
select tests.as_postgres();
rollback;
