-- Matchmake pending/confirmed scrim chat schema and RLS policies.
-- Run this in the Supabase SQL Editor after the core schema.

create table if not exists public.scrim_messages (
  id uuid primary key default gen_random_uuid(),
  scrim_request_id uuid not null references public.scrim_requests(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_display_name text,
  sender_team_id uuid references public.teams(id) on delete set null,
  body text not null check (char_length(body) > 0 and char_length(body) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists scrim_messages_scrim_request_id_created_at_idx
  on public.scrim_messages(scrim_request_id, created_at);

alter table public.scrim_messages enable row level security;

drop policy if exists "Confirmed scrim participants can read messages" on public.scrim_messages;
drop policy if exists "Confirmed scrim participants can insert messages" on public.scrim_messages;
drop policy if exists "Active scrim participants can read messages" on public.scrim_messages;
drop policy if exists "Active scrim participants can insert messages" on public.scrim_messages;

create policy "Active scrim participants can read messages"
  on public.scrim_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.scrim_requests sr
      join public.users viewer
        on viewer.id = auth.uid()
      join public.teams participant_team
        on participant_team.org_id = viewer.org_id
      where sr.id = public.scrim_messages.scrim_request_id
        and sr.status in ('pending', 'confirmed')
        and viewer.org_id is not null
        and (
          participant_team.id = sr.posting_team_id
          or participant_team.id = sr.matched_team_id
        )
    )
  );

create policy "Active scrim participants can insert messages"
  on public.scrim_messages
  for insert
  to authenticated
  with check (
    auth.uid() = sender_user_id
    and char_length(body) > 0
    and char_length(body) <= 1000
    and exists (
      select 1
      from public.scrim_requests sr
      join public.users sender
        on sender.id = auth.uid()
      join public.teams participant_team
        on participant_team.org_id = sender.org_id
      where sr.id = public.scrim_messages.scrim_request_id
        and sr.status in ('pending', 'confirmed')
        and sender.org_id is not null
        and (
          participant_team.id = sr.posting_team_id
          or participant_team.id = sr.matched_team_id
        )
        and (
          public.scrim_messages.sender_team_id is null
          or public.scrim_messages.sender_team_id = participant_team.id
        )
    )
  );
