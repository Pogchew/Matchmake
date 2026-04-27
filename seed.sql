with
seed_users as (
  insert into public.users (
    id,
    email,
    account_type,
    display_name,
    linked_game_accounts,
    about_text,
    external_profile_urls
  )
  values
    (
      '11111111-1111-4111-8111-111111111111',
      'alex.coach@example.com',
      'org',
      'Alex Coach',
      '[{"provider":"riot","handle":"CoachAlex#NA1"}]'::jsonb,
      'Runs scholastic Valorant and League scrim programs.',
      '["https://example.com/alex"]'::jsonb
    ),
    (
      '22222222-2222-4222-8222-222222222222',
      'jamie.captain@example.com',
      'org',
      'Jamie Captain',
      '[{"provider":"steam","handle":"JamieCaptain"}]'::jsonb,
      'Captain looking for consistent evening practice blocks.',
      '["https://example.com/jamie"]'::jsonb
    )
  on conflict (id) do nothing
  returning id
),
seed_orgs as (
  insert into public.organizations (
    id,
    name,
    type,
    verified_flag,
    org_admin_id,
    school_domain,
    region,
    college_outreach_enabled
  )
  values
    (
      '33333333-3333-4333-8333-333333333333',
      'Saint Louis University',
      'collegiate',
      true,
      '11111111-1111-4111-8111-111111111111',
      'slu.edu',
      'NA-East',
      true
    ),
    (
      '44444444-4444-4444-8444-444444444444',
      'UCLA Esports',
      'collegiate',
      true,
      '22222222-2222-4222-8222-222222222222',
      'ucla.edu',
      'NA-West',
      true
    )
  on conflict (id) do nothing
  returning id
),
seed_teams as (
  insert into public.teams (
    id,
    org_id,
    name,
    game_title,
    mode,
    roster,
    captain_id,
    coach_poc_id,
    rank_tier,
    rank_verification_type,
    rank_updated_at,
    no_show_count,
    scrimgg_rating,
    region
  )
  values
    (
      '55555555-5555-4555-8555-555555555555',
      '33333333-3333-4333-8333-333333333333',
      'Rocket Rams',
      'Valorant',
      '5v5',
      array['11111111-1111-4111-8111-111111111111']::uuid[],
      '11111111-1111-4111-8111-111111111111',
      '11111111-1111-4111-8111-111111111111',
      'Diamond 3',
      'coach_declared',
      now(),
      0,
      4.90,
      'NA-East'
    ),
    (
      '66666666-6666-4666-8666-666666666666',
      '44444444-4444-4444-8444-444444444444',
      'Storm Breakers',
      'Valorant',
      '5v5',
      array['22222222-2222-4222-8222-222222222222']::uuid[],
      '22222222-2222-4222-8222-222222222222',
      '22222222-2222-4222-8222-222222222222',
      'Diamond 2',
      'coach_declared',
      now(),
      1,
      4.60,
      'NA-West'
    )
  on conflict (id) do nothing
  returning id
),
update_user_one as (
  update public.users
  set
    org_id = '33333333-3333-4333-8333-333333333333',
    team_ids = array['55555555-5555-4555-8555-555555555555']::uuid[],
    updated_at = now()
  where id = '11111111-1111-4111-8111-111111111111'
  returning id
),
update_user_two as (
  update public.users
  set
    org_id = '44444444-4444-4444-8444-444444444444',
    team_ids = array['66666666-6666-4666-8666-666666666666']::uuid[],
    updated_at = now()
  where id = '22222222-2222-4222-8222-222222222222'
  returning id
),
update_org_one as (
  update public.organizations
  set
    team_ids = array['55555555-5555-4555-8555-555555555555']::uuid[],
    updated_at = now()
  where id = '33333333-3333-4333-8333-333333333333'
  returning id
),
update_org_two as (
  update public.organizations
  set
    team_ids = array['66666666-6666-4666-8666-666666666666']::uuid[],
    updated_at = now()
  where id = '44444444-4444-4444-8444-444444444444'
  returning id
),
seed_scrims as (
  insert into public.scrim_requests (
    id,
    posting_team_id,
    game_title,
    scheduled_at,
    team_rank,
    opponent_rank_min,
    opponent_rank_max,
    status,
    matched_team_id,
    expires_at
  )
  values
    (
      '77777777-7777-4777-8777-777777777777',
      '55555555-5555-4555-8555-555555555555',
      'Valorant',
      now() + interval '1 day 19 hours',
      'Diamond 3',
      'Diamond 1',
      'Ascendant 2',
      'open',
      null,
      now() + interval '2 days'
    ),
    (
      '88888888-8888-4888-8888-888888888888',
      '66666666-6666-4666-8666-666666666666',
      'Valorant',
      now() + interval '1 day 22 hours',
      'Diamond 2',
      'Platinum 3',
      'Diamond 3',
      'open',
      null,
      now() + interval '2 days'
    ),
    (
      '99999999-9999-4999-8999-999999999999',
      '55555555-5555-4555-8555-555555555555',
      'Valorant',
      now() + interval '3 days 20 hours',
      'Diamond 3',
      'Diamond 2',
      'Immortal 1',
      'open',
      null,
      now() + interval '4 days'
    )
  on conflict (id) do nothing
  returning id
)
select
  (select count(*) from public.users where id in (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222'
  )) as users_seeded,
  (select count(*) from public.organizations where id in (
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444'
  )) as organizations_seeded,
  (select count(*) from public.teams where id in (
    '55555555-5555-4555-8555-555555555555',
    '66666666-6666-4666-8666-666666666666'
  )) as teams_seeded,
  (select count(*) from public.scrim_requests where id in (
    '77777777-7777-4777-8777-777777777777',
    '88888888-8888-4888-8888-888888888888',
    '99999999-9999-4999-8999-999999999999'
  )) as scrim_requests_seeded;
