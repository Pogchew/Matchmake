-- Matchmake normalized analytics foundation for saved match reviews.
-- Safe/additive migration:
-- - Keeps public.team_match_reviews JSONB/raw storage intact.
-- - Adds query-friendly mirror tables for player rows and team/opponent stats.
-- - Backfills from existing saved reviews.
-- - Adds a trigger to keep analytics rows synced after future review saves.
--
-- Raw JSONB remains the source of truth for extraction/review editing.
-- These tables are read-optimized mirrors for dashboards, trends, filters, and reports.

create table if not exists public.match_review_players (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.team_match_reviews(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  game_title text not null,
  side text not null check (side in ('team', 'opponent')),
  row_index integer not null check (row_index >= 1),
  slot integer,
  player_name text,
  role text,
  character_name text,
  character_type text,
  kills numeric,
  deaths numeric,
  assists numeric,
  kda_text text,
  core_stats jsonb not null default '{}'::jsonb,
  raw_row jsonb not null default '{}'::jsonb,
  played_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists match_review_players_review_side_row_unique_idx
  on public.match_review_players(review_id, side, row_index);

create index if not exists match_review_players_team_game_played_idx
  on public.match_review_players(team_id, game_title, played_at desc);

create index if not exists match_review_players_character_idx
  on public.match_review_players(game_title, character_name)
  where character_name is not null;

create index if not exists match_review_players_player_name_idx
  on public.match_review_players(team_id, lower(player_name))
  where player_name is not null;

create table if not exists public.match_review_team_stats (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.team_match_reviews(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  game_title text not null,
  side text not null check (side in ('team', 'opponent')),
  stat_key text not null,
  stat_value numeric,
  stat_text text,
  raw_stats jsonb not null default '{}'::jsonb,
  played_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists match_review_team_stats_review_side_key_unique_idx
  on public.match_review_team_stats(review_id, side, stat_key);

create index if not exists match_review_team_stats_team_game_key_played_idx
  on public.match_review_team_stats(team_id, game_title, stat_key, played_at desc);

alter table public.match_review_players enable row level security;
alter table public.match_review_team_stats enable row level security;

drop policy if exists "Users can read analytics players for teams in their org" on public.match_review_players;
drop policy if exists "Users can read analytics team stats for teams in their org" on public.match_review_team_stats;

create policy "Users can read analytics players for teams in their org"
  on public.match_review_players
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.users app_user
      join public.teams team
        on team.org_id = app_user.org_id
      where app_user.id = auth.uid()
        and team.id = public.match_review_players.team_id
    )
  );

create policy "Users can read analytics team stats for teams in their org"
  on public.match_review_team_stats
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.users app_user
      join public.teams team
        on team.org_id = app_user.org_id
      where app_user.id = auth.uid()
        and team.id = public.match_review_team_stats.team_id
    )
  );

create or replace function public.matchmake_numeric_from_jsonb(value jsonb)
returns numeric
language sql
immutable
as $$
  select case
    when value is null or value = 'null'::jsonb then null
    when jsonb_typeof(value) = 'number' then (value #>> '{}')::numeric
    when jsonb_typeof(value) = 'string'
      and nullif(regexp_replace(value #>> '{}', '[^0-9.\-]', '', 'g'), '') is not null
      and regexp_replace(value #>> '{}', '[^0-9.\-]', '', 'g') ~ '^-?[0-9]+(\.[0-9]+)?$'
      then regexp_replace(value #>> '{}', '[^0-9.\-]', '', 'g')::numeric
    else null
  end;
$$;

create or replace function public.matchmake_character_name_from_row(row_data jsonb)
returns text
language sql
immutable
as $$
  select nullif(coalesce(
    row_data ->> 'champion',
    row_data ->> 'agent',
    row_data ->> 'hero_confirmed',
    row_data ->> 'hero',
    row_data ->> 'hero_guess',
    row_data ->> 'character',
    row_data ->> 'car'
  ), '');
$$;

create or replace function public.matchmake_character_type_for_game(game_title text)
returns text
language sql
immutable
as $$
  select case
    when game_title = 'League of Legends' then 'champion'
    when game_title = 'Valorant' then 'agent'
    when game_title in ('Marvel Rivals', 'Overwatch', 'Overwatch 2', 'Deadlock', 'Honor of Kings', 'HOK') then 'hero'
    when game_title = 'Rocket League' then 'car'
    when game_title = 'SSBU' then 'character'
    else 'character'
  end;
$$;

create or replace function public.sync_match_review_analytics(review_row public.team_match_reviews)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.match_review_players
  where review_id = review_row.id;

  delete from public.match_review_team_stats
  where review_id = review_row.id;

  insert into public.match_review_players (
    review_id,
    team_id,
    game_title,
    side,
    row_index,
    slot,
    player_name,
    role,
    character_name,
    character_type,
    kills,
    deaths,
    assists,
    kda_text,
    core_stats,
    raw_row,
    played_at,
    updated_at
  )
  select
    review_row.id,
    review_row.team_id,
    review_row.game_title,
    source_rows.side,
    source_rows.ordinality::integer,
    public.matchmake_numeric_from_jsonb(source_rows.row_data -> 'slot')::integer,
    nullif(source_rows.row_data ->> 'player_name', ''),
    nullif(source_rows.row_data ->> 'role', ''),
    public.matchmake_character_name_from_row(source_rows.row_data),
    public.matchmake_character_type_for_game(review_row.game_title),
    coalesce(
      public.matchmake_numeric_from_jsonb(source_rows.row_data -> 'kills'),
      public.matchmake_numeric_from_jsonb(source_rows.row_data -> 'k')
    ),
    coalesce(
      public.matchmake_numeric_from_jsonb(source_rows.row_data -> 'deaths'),
      public.matchmake_numeric_from_jsonb(source_rows.row_data -> 'd')
    ),
    coalesce(
      public.matchmake_numeric_from_jsonb(source_rows.row_data -> 'assists'),
      public.matchmake_numeric_from_jsonb(source_rows.row_data -> 'a')
    ),
    nullif(source_rows.row_data ->> 'kda_text', ''),
    source_rows.row_data - array[
      'player_name',
      'role',
      'champion',
      'agent',
      'hero_confirmed',
      'hero',
      'hero_guess',
      'character',
      'car'
    ],
    source_rows.row_data,
    review_row.played_at,
    now()
  from (
    select 'team'::text as side, row_data, ordinality
    from jsonb_array_elements(
      case
        when jsonb_typeof(review_row.player_rows) = 'array' and jsonb_array_length(review_row.player_rows) > 0 then review_row.player_rows
        when jsonb_typeof(review_row.team_comp) = 'array' then review_row.team_comp
        else '[]'::jsonb
      end
    ) with ordinality as team_rows(row_data, ordinality)
    union all
    select 'opponent'::text as side, row_data, ordinality
    from jsonb_array_elements(
      case
        when jsonb_typeof(review_row.opponent_rows) = 'array' and jsonb_array_length(review_row.opponent_rows) > 0 then review_row.opponent_rows
        when jsonb_typeof(review_row.opponent_comp) = 'array' then review_row.opponent_comp
        else '[]'::jsonb
      end
    ) with ordinality as opponent_rows(row_data, ordinality)
  ) source_rows
  where jsonb_typeof(source_rows.row_data) = 'object';

  insert into public.match_review_team_stats (
    review_id,
    team_id,
    game_title,
    side,
    stat_key,
    stat_value,
    stat_text,
    raw_stats,
    played_at,
    updated_at
  )
  select
    review_row.id,
    review_row.team_id,
    review_row.game_title,
    source_stats.side,
    source_stats.stat_key,
    public.matchmake_numeric_from_jsonb(source_stats.stat_value),
    case
      when jsonb_typeof(source_stats.stat_value) in ('string', 'number', 'boolean') then source_stats.stat_value #>> '{}'
      else null
    end,
    source_stats.raw_stats,
    review_row.played_at,
    now()
  from (
    select 'team'::text as side, key as stat_key, value as stat_value, review_row.team_stats as raw_stats
    from jsonb_each(
      case when jsonb_typeof(review_row.team_stats) = 'object' then review_row.team_stats else '{}'::jsonb end
    )
    union all
    select 'opponent'::text as side, key as stat_key, value as stat_value, review_row.opponent_stats as raw_stats
    from jsonb_each(
      case when jsonb_typeof(review_row.opponent_stats) = 'object' then review_row.opponent_stats else '{}'::jsonb end
    )
  ) source_stats;
end;
$$;

create or replace function public.team_match_reviews_sync_analytics_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_match_review_analytics(new);
  return new;
end;
$$;

drop trigger if exists team_match_reviews_sync_analytics_after_write on public.team_match_reviews;

create trigger team_match_reviews_sync_analytics_after_write
after insert or update of
  game_title,
  team_comp,
  opponent_comp,
  team_stats,
  opponent_stats,
  player_rows,
  opponent_rows,
  played_at
on public.team_match_reviews
for each row
execute function public.team_match_reviews_sync_analytics_trigger();

do $$
declare
  review_record public.team_match_reviews%rowtype;
begin
  for review_record in
    select *
    from public.team_match_reviews
  loop
    perform public.sync_match_review_analytics(review_record);
  end loop;
end $$;
