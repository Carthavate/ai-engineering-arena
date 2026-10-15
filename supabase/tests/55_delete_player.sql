-- Admins can delete a player for good: the account and every row that mentions them, duels against others included.
begin;
select tests.user('boss', true, true) as boss \gset
select tests.user('pal') as pal \gset
select tests.user('ally') as ally \gset
-- pal was invited by username, as players are.
select tests.as_user(:'boss');
select public.invite_player('pal');

-- pal's history: a passed quiz (which completes the lecture), a solve, and a finished duel against ally.
select tests.as_user(:'pal');
select public.start_quiz('rag-1') ->> 'id' as attempt \gset
select tests.as_postgres();
select tests.quiz_answers(:'attempt') as key \gset
select tests.as_user(:'pal');
select public.submit_quiz(:'attempt', :'key');
insert into public.challenge_solves (user_id, challenge_id) values (:'pal', 'bm25');

select public.create_duel('rag-3', :'ally') ->> 'id' as duel \gset
select tests.as_user(:'ally');
select public.respond_duel(:'duel', true);
select tests.as_postgres();
update public.duels set starts_at = now() - interval '1 second' where id = :'duel';
select tests.as_user(:'pal');
select public.start_duel(:'duel');
select tests.as_user(:'ally');
select public.start_duel(:'duel');
select tests.as_postgres();
select tests.duel_answers(:'duel') as dkey \gset
select tests.as_user(:'ally');
select public.submit_duel(:'duel', :'dkey');
select tests.as_user(:'pal');
select public.submit_duel(:'duel', array[-1,-1,-1,-1,-1]);
-- ally also has history of their own that must survive: a solve, a quiz of their own, a duel with boss.
select tests.as_user(:'ally');
insert into public.challenge_solves (user_id, challenge_id) values (:'ally', 'rrf');
select public.start_quiz('rag-2') ->> 'id' as own_attempt \gset
select tests.as_postgres();
select tests.quiz_answers(:'own_attempt') as own_key \gset
select tests.as_user(:'ally');
select public.submit_quiz(:'own_attempt', :'own_key');
select tests.as_user(:'boss');
select public.create_duel('rag-4', :'ally') ->> 'id' as boss_duel \gset
select public.cancel_duel(:'boss_duel');
-- And pal has a race invite out to ally.
select tests.as_user(:'pal');
select public.create_race(:'ally') ->> 'id' as race \gset
select tests.as_postgres();
select tests.eq((select status from public.duels where id = :'duel'), 'done', 'setup: duel decided');
select tests.eq((select count(*) from public.quiz_attempts where source_duel = :'duel')::int, 2, 'setup: both duel sheets saved as quizzes');

-- Only admins may delete, and admins themselves can't be deleted.
select tests.as_user(:'ally');
select tests.throws($$select public.delete_player('pal')$$, 'Only admins');
select tests.as_anon();
select tests.throws($$select public.delete_player('pal')$$, 'permission denied');
select tests.as_user(:'boss');
select tests.throws($$select public.delete_player('boss')$$, 'can''t be deleted');
select tests.throws($$select public.delete_player('twadi')$$, 'can''t be deleted');
select tests.throws($$select public.delete_player('  ')$$, 'not a valid');
select tests.throws($$select public.delete_player('nobody-here')$$, 'Nobody with that username');

-- Delete pal (case-insensitive): everything with their name on it goes.
select public.delete_player(' PAL ');
select tests.as_postgres();
select tests.eq((select count(*) from auth.users where id = :'pal')::int, 0, 'sign-in deleted');
select tests.eq((select count(*) from public.profiles where id = :'pal')::int, 0, 'profile deleted');
select tests.eq((select count(*) from public.progress where user_id = :'pal')::int, 0, 'progress deleted');
select tests.eq((select count(*) from public.quiz_attempts where user_id = :'pal')::int, 0, 'quizzes deleted');
select tests.eq((select count(*) from private.quiz_keys where attempt_id = :'attempt')::int, 0, 'quiz keys deleted');
select tests.eq((select count(*) from public.challenge_solves where user_id = :'pal')::int, 0, 'solves deleted');
select tests.eq((select count(*) from public.duels where id = :'duel')::int, 0, 'duel against another player deleted');
select tests.eq((select count(*) from public.duel_entries where duel_id = :'duel')::int, 0, 'duel entries deleted');
select tests.eq((select count(*) from private.duel_keys where duel_id = :'duel')::int, 0, 'duel keys deleted');
select tests.eq((select count(*) from public.quiz_attempts where user_id = :'ally' and source_duel is not null)::int, 0,
                'the other side''s duel sheet deleted too');
select tests.eq((select count(*) from public.duels where id = :'race')::int, 0, 'race invite deleted');

-- Everyone else keeps their own history.
select tests.eq((select count(*) from public.profiles where id in (:'boss', :'ally'))::int, 2, 'others stay');
select tests.eq((select count(*) from public.challenge_solves where user_id = :'ally')::int, 1, 'others keep their solves');
select tests.eq((select count(*) from public.quiz_attempts where id = :'own_attempt')::int, 1, 'others keep their own quizzes');
select tests.eq((select count(*) from public.duels where id = :'boss_duel')::int, 1, 'duels between others stay');
select tests.eq((select count(*) from public.progress where user_id = :'ally' and item_id = 'rag-3')::int, 1, 'a lecture done stays done');

-- Signing in again starts from zero, waiting to be let in.
insert into auth.users (raw_user_meta_data, raw_app_meta_data) values ('{"user_name": "pal"}', '{"provider": "github"}');
select tests.eq((select is_member from public.profiles where github_username = 'pal'), false, 'a returning player waits again');
select tests.eq((select count(*) from public.progress p join public.profiles f on f.id = p.user_id
                  where f.github_username = 'pal')::int, 0, 'with no history');

-- An invite nobody used yet can be deleted too.
select tests.as_user(:'boss');
select public.invite_player('later-friend');
select public.delete_player('later-friend');
select tests.eq((public.lab_admin_overview() -> 'invited') ? 'later-friend', false, 'invite deleted');

-- Every delete leaves one private audit line, and an admin can delete only 5 players a day.
select tests.as_postgres();
select tests.eq((select string_agg(target, ',' order by id) from private.admin_log where actor = :'boss' and action = 'delete_player'),
                'PAL,later-friend', 'audit lines');
insert into private.admin_log (actor, action, target) select :'boss', 'delete_player', 'old-' || g from generate_series(1, 3) g;
select tests.as_user(:'boss');
select public.invite_player('one-more');
select tests.throws($$select public.delete_player('one-more')$$, 'deleted 5 players in 24 hours');
select tests.as_postgres();
rollback;
