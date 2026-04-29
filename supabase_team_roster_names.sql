-- Add owner-managed roster names to teams.
-- Run this in the Supabase SQL editor to enable roster editing on /team.

alter table public.teams
  add column if not exists roster_names text[] not null default '{}';

alter table public.teams
  add column if not exists roster_profiles jsonb not null default '[]'::jsonb;

drop policy if exists "Authenticated users can update teams in their org" on public.teams;

create policy "Authenticated users can update teams in their org"
  on public.teams
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.users owner
      where owner.id = auth.uid()
        and owner.org_id = public.teams.org_id
    )
  )
  with check (
    exists (
      select 1
      from public.users owner
      where owner.id = auth.uid()
        and owner.org_id = public.teams.org_id
    )
  );
