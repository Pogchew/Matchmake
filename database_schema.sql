-- Matchmake core schema generated from PRD Section 05: Data Model - Core Entities.
-- Run this in the Supabase SQL editor when you are ready to create the tables.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  account_type text not null check (account_type in ('org', 'individual')),
  display_name text not null,
  linked_game_accounts jsonb not null default '[]'::jsonb,
  org_id uuid,
  team_ids uuid[] not null default '{}',
  about_text text,
  external_profile_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('high_school', 'collegiate', 'amateur')),
  verified_flag boolean not null default false,
  org_admin_id uuid not null references public.users(id) on delete restrict,
  school_domain text,
  region text,
  team_ids uuid[] not null default '{}',
  college_outreach_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_org_id_fkey'
  ) then
    alter table public.users
      add constraint users_org_id_fkey
      foreign key (org_id)
      references public.organizations(id)
      on delete set null;
  end if;
end $$;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  game_title text not null,
  mode text,
  roster uuid[] not null default '{}',
  roster_names text[] not null default '{}',
  roster_profiles jsonb not null default '[]'::jsonb,
  captain_id uuid references public.users(id) on delete set null,
  coach_poc_id uuid references public.users(id) on delete set null,
  rank_tier text,
  rank_verification_type text not null default 'none'
    check (rank_verification_type in ('api', 'coach_declared', 'profile_link', 'none')),
  rank_updated_at timestamptz,
  no_show_count integer not null default 0 check (no_show_count >= 0),
  scrimgg_rating numeric(3, 2) not null default 0 check (scrimgg_rating >= 0 and scrimgg_rating <= 5),
  region text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scrim_requests (
  id uuid primary key default gen_random_uuid(),
  posting_team_id uuid not null references public.teams(id) on delete cascade,
  game_title text not null,
  scheduled_at timestamptz not null,
  games_count integer not null default 3 check (games_count >= 1 and games_count <= 10),
  team_rank text,
  opponent_rank_min text,
  opponent_rank_max text,
  status text not null default 'open'
    check (status in ('open', 'pending', 'matched', 'accepted', 'declined', 'confirmed', 'completed', 'cancelled', 'expired')),
  matched_team_id uuid references public.teams(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (matched_team_id is null or matched_team_id <> posting_team_id)
);

create table if not exists public.team_match_reviews (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  scrim_request_id uuid references public.scrim_requests(id) on delete set null,
  scrim_game_number integer not null default 1 check (scrim_game_number >= 1),
  series_game_count integer,
  created_by uuid not null references auth.users(id) on delete cascade,
  game_title text not null,
  match_result text,
  final_score text,
  team_score integer,
  opponent_score integer,
  opponent_name text,
  map_or_mode text,
  played_at timestamptz,
  screenshot_url text,
  team_comp jsonb not null default '[]'::jsonb,
  opponent_comp jsonb not null default '[]'::jsonb,
  team_stats jsonb not null default '{}'::jsonb,
  opponent_stats jsonb not null default '{}'::jsonb,
  player_rows jsonb not null default '[]'::jsonb,
  opponent_rows jsonb not null default '[]'::jsonb,
  notes text,
  parser_status text not null default 'manual',
  parser_confidence numeric,
  manual_edit_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_org_id_idx on public.users(org_id);
create index if not exists organizations_org_admin_id_idx on public.organizations(org_admin_id);
create index if not exists teams_org_id_idx on public.teams(org_id);
create index if not exists teams_game_title_region_idx on public.teams(game_title, region);
create index if not exists scrim_requests_posting_team_id_idx on public.scrim_requests(posting_team_id);
create index if not exists scrim_requests_matched_team_id_idx on public.scrim_requests(matched_team_id);
create index if not exists scrim_requests_board_filter_idx on public.scrim_requests(game_title, status, scheduled_at, expires_at);
create index if not exists team_match_reviews_team_id_played_at_idx on public.team_match_reviews(team_id, played_at desc);
create unique index if not exists team_match_reviews_team_scrim_game_unique_idx
  on public.team_match_reviews(team_id, scrim_request_id, scrim_game_number)
  where scrim_request_id is not null;
