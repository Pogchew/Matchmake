-- Matchmake MVP Row Level Security policies.
-- Paste this into the Supabase SQL Editor after creating the core tables.

alter table public.users enable row level security;
alter table public.organizations enable row level security;
alter table public.teams enable row level security;
alter table public.scrim_requests enable row level security;

create policy "Authenticated users can read users"
  on public.users
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert users"
  on public.users
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update users"
  on public.users
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can read organizations"
  on public.organizations
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert organizations"
  on public.organizations
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update organizations"
  on public.organizations
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can read teams"
  on public.teams
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert teams"
  on public.teams
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update teams"
  on public.teams
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can read scrim requests"
  on public.scrim_requests
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert scrim requests"
  on public.scrim_requests
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update scrim requests"
  on public.scrim_requests
  for update
  to authenticated
  using (true)
  with check (true);
