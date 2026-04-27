-- Temporary public read policies for local MVP preview.
-- Run this in Supabase if the unauthenticated Scrim Board can read scrim_requests
-- but joined team/org fields come back as null.

create policy "Anyone can read organizations for MVP preview"
  on public.organizations
  for select
  to anon
  using (true);

create policy "Anyone can read teams for MVP preview"
  on public.teams
  for select
  to anon
  using (true);

create policy "Anyone can read scrim requests for MVP preview"
  on public.scrim_requests
  for select
  to anon
  using (true);
