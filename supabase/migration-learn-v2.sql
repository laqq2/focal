-- LEARN v2: skills, goals, experiments, kolbs extensions, session/daily links.
-- Run after migration-learn-ics.sql. Order: skills first (kolbs references skills).

-- ---------------------------------------------------------------------------
-- Skills pool (before kolbs_entries.skill_id FK)
-- ---------------------------------------------------------------------------
create table if not exists skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  ics_category text,
  current_level text default 'UI',
  created_at timestamptz default now()
);

create index if not exists skills_user_idx on skills (user_id);

alter table skills enable row level security;
create policy "skills are self" on skills
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Kolbs extensions + backward-compat data copy
-- ---------------------------------------------------------------------------
alter table kolbs_entries add column if not exists skill_id uuid references skills(id) on delete set null;
alter table kolbs_entries add column if not exists previous_kolbs_id uuid references kolbs_entries(id) on delete set null;
alter table kolbs_entries add column if not exists spawned_kolbs_id uuid references kolbs_entries(id) on delete set null;
alter table kolbs_entries add column if not exists is_reflecting_on_experiment boolean default false;
alter table kolbs_entries add column if not exists competency_level_at_time text;
alter table kolbs_entries add column if not exists event_sequence text;
alter table kolbs_entries add column if not exists emotions text;
alter table kolbs_entries add column if not exists difficult_aspects text;
alter table kolbs_entries add column if not exists easy_aspects text;
alter table kolbs_entries add column if not exists response_to_challenges text;
alter table kolbs_entries add column if not exists triggers text;
alter table kolbs_entries add column if not exists why_i_acted text;
alter table kolbs_entries add column if not exists habits_and_beliefs text;
alter table kolbs_entries add column if not exists appears_in_other_areas boolean default false;
alter table kolbs_entries add column if not exists other_areas_detail text;

update kolbs_entries set event_sequence = coalesce(event_sequence, observations) where event_sequence is null and observations is not null and trim(observations) <> '';
update kolbs_entries set habits_and_beliefs = coalesce(habits_and_beliefs, learnings) where habits_and_beliefs is null and learnings is not null and trim(learnings) <> '';

-- ---------------------------------------------------------------------------
-- Goal areas & goals
-- ---------------------------------------------------------------------------
create table if not exists goal_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  color_tag text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create index if not exists goal_areas_user_idx on goal_areas (user_id);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  goal_area_id uuid references goal_areas(id) on delete set null,
  title text not null,
  timeframe_months int,
  why text,
  success_metric text,
  status text default 'active',
  created_at timestamptz default now()
);

create index if not exists goals_user_idx on goals (user_id);

create table if not exists goal_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  goal_id uuid references goals(id) on delete cascade not null,
  review_month date not null,
  progress_rating int,
  what_worked text,
  what_didnt text,
  adjustment text,
  gemini_summary text,
  created_at timestamptz default now()
);

create index if not exists goal_reviews_goal_idx on goal_reviews (goal_id, review_month desc);

create table if not exists goal_skills (
  goal_id uuid references goals(id) on delete cascade not null,
  skill_id uuid references skills(id) on delete cascade not null,
  expected_level text,
  primary key (goal_id, skill_id)
);

create table if not exists skill_level_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  skill_id uuid references skills(id) on delete cascade not null,
  level text not null,
  changed_at timestamptz default now(),
  note text
);

create index if not exists skill_level_history_skill_idx on skill_level_history (skill_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- Experiments (after kolbs + skills)
-- ---------------------------------------------------------------------------
create table if not exists experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  kolbs_id uuid references kolbs_entries(id) on delete cascade not null,
  skill_id uuid references skills(id) on delete set null,
  description text not null,
  status text default 'pending',
  outcome text,
  spawned_kolbs_id uuid references kolbs_entries(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists experiments_user_status_idx on experiments (user_id, status);
create index if not exists experiments_kolbs_idx on experiments (kolbs_id);

-- ---------------------------------------------------------------------------
-- Session & daily links
-- ---------------------------------------------------------------------------
alter table session_logs add column if not exists goal_id uuid references goals(id) on delete set null;
alter table session_logs add column if not exists experiment_id uuid references experiments(id) on delete set null;

alter table daily_priorities add column if not exists priority_1_goal_id uuid references goals(id) on delete set null;
alter table daily_priorities add column if not exists priority_2_goal_id uuid references goals(id) on delete set null;
alter table daily_priorities add column if not exists experiment_notes text;

-- ---------------------------------------------------------------------------
-- RLS: new tables
-- ---------------------------------------------------------------------------
alter table goal_areas enable row level security;
create policy "goal_areas are self" on goal_areas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table goals enable row level security;
create policy "goals are self" on goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table goal_reviews enable row level security;
create policy "goal_reviews are self" on goal_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table goal_skills enable row level security;
create policy "goal_skills via goal" on goal_skills
  for all using (
    exists (select 1 from goals g where g.id = goal_skills.goal_id and g.user_id = auth.uid())
  )
  with check (
    exists (select 1 from goals g where g.id = goal_skills.goal_id and g.user_id = auth.uid())
  );

alter table skill_level_history enable row level security;
create policy "skill_level_history are self" on skill_level_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table experiments enable row level security;
create policy "experiments are self" on experiments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
