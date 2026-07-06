-- 0002: auth + stats (additive only — 0001 may already be applied; never edit it).
-- Everything here is inert until the app feature flags are turned on.

-- === profiles: streaks / survival / freshness ===
alter table public.profiles
  add column if not exists current_win_streak  int not null default 0,
  add column if not exists current_loss_streak int not null default 0,
  add column if not exists best_win_streak     int not null default 0,
  add column if not exists survived_games      int not null default 0,
  add column if not exists updated_at          timestamptz not null default now();

-- === per-character / per-faction (ก๊ก) aggregates ===
create table if not exists public.profile_characters (
  user_id uuid not null references public.profiles on delete cascade,
  character_id text not null,
  character_name text,
  games int not null default 0,
  wins int not null default 0,
  primary key (user_id, character_id)
);
create table if not exists public.profile_factions (
  user_id uuid not null references public.profiles on delete cascade,
  faction text not null,
  games int not null default 0,
  wins int not null default 0,
  primary key (user_id, faction)
);

-- === session/participant detail ===
alter table public.game_sessions
  add column if not exists room_id text,
  add column if not exists player_count int,
  add column if not exists duration_seconds int;
alter table public.game_participants
  add column if not exists faction text,
  add column if not exists survived boolean,
  add column if not exists seat_index int;
create index if not exists idx_game_participants_user on public.game_participants (user_id);

-- === RLS hardening ===
-- 0001's "users update self" policy row-gates updates but lets a user rewrite their own
-- stat counters. Close that with column-level grants: only cosmetic fields stay writable.
revoke update on public.profiles from anon, authenticated;
grant update (username, avatar) on public.profiles to authenticated;

alter table public.game_sessions      enable row level security;
alter table public.game_participants  enable row level security;
alter table public.game_actions       enable row level security;
alter table public.profile_characters enable row level security;
alter table public.profile_factions   enable row level security;
create policy "sessions readable"      on public.game_sessions      for select using (true);
create policy "participants readable"  on public.game_participants  for select using (true);
create policy "char stats readable"    on public.profile_characters for select using (true);
create policy "faction stats readable" on public.profile_factions   for select using (true);
-- game_actions: no policy at all → deny anon/authenticated entirely.
-- No insert/update/delete policy anywhere → only the service role writes.

-- === auto-create a profile on first Google sign-in ===
-- Username from Google metadata; on collision retry with -1..-20 then a uuid fragment.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare base text; candidate text; n int := 0;
begin
  if exists (select 1 from public.profiles where id = new.id) then return new; end if;
  base := left(coalesce(nullif(new.raw_user_meta_data->>'name',''),
                        nullif(new.raw_user_meta_data->>'full_name',''),
                        nullif(split_part(coalesce(new.email,''),'@',1),''),
                        'player'), 24);
  candidate := base;
  loop
    begin
      insert into public.profiles (id, google_id, username, avatar)
      values (new.id,
              coalesce(new.raw_user_meta_data->>'provider_id', new.raw_user_meta_data->>'sub'),
              candidate,
              new.raw_user_meta_data->>'avatar_url');
      return new;
    exception when unique_violation then
      n := n + 1;
      if n <= 20 then candidate := base || '-' || n::text;
      elsif n = 21 then candidate := base || '-' || substr(new.id::text, 1, 8);
      else raise;
      end if;
    end;
  end loop;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- === record_game_result: the ONLY write path for stats ===
-- Called once per finished game by the game server (service role). Transactional;
-- the on-conflict return on game_sessions.id is the DB-level exactly-once gate,
-- so server-side retries and replayed calls are harmless.
create or replace function public.record_game_result(
  p_session_id uuid,
  p_room_id text,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_turns int,
  p_player_count int,
  p_winner_roles text[],
  p_participants jsonb  -- [{user_id, role, character_id, character_name, faction, won, survived, seat_index}]
) returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid; p jsonb; v_uid uuid; v_role text; v_won boolean; v_survived boolean;
begin
  insert into public.game_sessions
    (id, status, room_id, started_at, ended_at, turns, winner_roles, player_count, duration_seconds)
  values
    (p_session_id, 'finished', p_room_id, p_started_at, p_ended_at, p_turns, p_winner_roles, p_player_count,
     extract(epoch from (p_ended_at - p_started_at))::int)
  on conflict (id) do nothing
  returning id into v_id;
  if v_id is null then return; end if;  -- already recorded

  for p in select * from jsonb_array_elements(p_participants) loop
    v_uid := (p->>'user_id')::uuid;
    v_role := p->>'role';
    v_won := coalesce((p->>'won')::boolean, false);
    v_survived := coalesce((p->>'survived')::boolean, false);
    continue when v_uid is null or not exists (select 1 from public.profiles where id = v_uid);

    insert into public.game_participants (game_id, user_id, role, character_id, faction, won, survived, seat_index)
    values (p_session_id, v_uid, v_role, p->>'character_id', p->>'faction', v_won, v_survived, (p->>'seat_index')::int)
    on conflict do nothing;

    update public.profiles set
      total_games = total_games + 1,
      total_wins  = total_wins + v_won::int,
      emperor_games  = emperor_games  + (v_role = 'emperor')::int,
      emperor_wins   = emperor_wins   + (v_role = 'emperor'  and v_won)::int,
      rebel_games    = rebel_games    + (v_role = 'rebel')::int,
      rebel_wins     = rebel_wins     + (v_role = 'rebel'    and v_won)::int,
      loyalist_games = loyalist_games + (v_role = 'loyalist')::int,
      loyalist_wins  = loyalist_wins  + (v_role = 'loyalist' and v_won)::int,
      traitor_games  = traitor_games  + (v_role = 'traitor')::int,
      traitor_wins   = traitor_wins   + (v_role = 'traitor'  and v_won)::int,
      survived_games = survived_games + v_survived::int,
      current_win_streak  = case when v_won then current_win_streak + 1 else 0 end,
      current_loss_streak = case when v_won then 0 else current_loss_streak + 1 end,
      best_win_streak = greatest(best_win_streak, case when v_won then current_win_streak + 1 else best_win_streak end),
      updated_at = now()
    where id = v_uid;

    insert into public.profile_characters (user_id, character_id, character_name, games, wins)
    values (v_uid, coalesce(p->>'character_id', 'unknown'), p->>'character_name', 1, v_won::int)
    on conflict (user_id, character_id) do update
      set games = profile_characters.games + 1,
          wins  = profile_characters.wins + excluded.wins,
          character_name = coalesce(excluded.character_name, profile_characters.character_name);

    insert into public.profile_factions (user_id, faction, games, wins)
    values (v_uid, coalesce(p->>'faction', 'unknown'), 1, v_won::int)
    on conflict (user_id, faction) do update
      set games = profile_factions.games + 1,
          wins  = profile_factions.wins + excluded.wins;

    update public.profiles pr set
      most_played_role = (
        select r from (values
          ('emperor', pr.emperor_games), ('rebel', pr.rebel_games),
          ('loyalist', pr.loyalist_games), ('traitor', pr.traitor_games)
        ) t(r, g) where g > 0 order by g desc limit 1),
      best_role = (
        select r from (values
          ('emperor', pr.emperor_games, pr.emperor_wins), ('rebel', pr.rebel_games, pr.rebel_wins),
          ('loyalist', pr.loyalist_games, pr.loyalist_wins), ('traitor', pr.traitor_games, pr.traitor_wins)
        ) t(r, g, w) where g >= 5 order by w::numeric / g desc, g desc limit 1),
      favorite_character = (
        select character_id from public.profile_characters
        where user_id = v_uid order by games desc, wins desc limit 1)
    where pr.id = v_uid;
  end loop;
end $$;

-- Functions default to EXECUTE for public — without this revoke, anyone with the anon
-- key could call the RPC and inflate stats.
revoke execute on function public.record_game_result(uuid, text, timestamptz, timestamptz, int, int, text[], jsonb)
  from public, anon, authenticated;
