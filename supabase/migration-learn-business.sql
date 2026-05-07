-- Business focus: 30-day plans + performance goals, goal framework (Notion), session type = work.
-- Run after migration-learn-v2.sql.

-- ---------------------------------------------------------------------------
-- Session log: drop theory / practice split
-- ---------------------------------------------------------------------------
alter table session_logs drop constraint if exists session_logs_session_type_check;
update session_logs set session_type = 'work' where session_type in ('theory', 'practice');
alter table session_logs
  add constraint session_logs_session_type_check check (session_type = 'work');
alter table session_logs alter column session_type set default 'work';

-- ---------------------------------------------------------------------------
-- Strategic goal: full Notion-style framework (paste-friendly text blocks)
-- ---------------------------------------------------------------------------
alter table goals add column if not exists framework jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- 30-day plan + linked performance targets (30d / 14d, up to 3 each)
-- ---------------------------------------------------------------------------
create table if not exists thirty_day_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  strategic_goal_id uuid references goals(id) on delete set null,
  title text not null default '30 day plan',
  period_start date not null,
  period_end date not null,
  time_availability text,
  protect_time text,
  limiting_habits text,
  scripted_actions text,
  environmental_optimisations text,
  scheduling_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists thirty_day_plans_user_idx on thirty_day_plans (user_id, period_start desc);

create table if not exists plan_performance_goals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references thirty_day_plans(id) on delete cascade not null,
  horizon text not null check (horizon in ('30d', '14d')),
  title text not null,
  detail text,
  sort_index int not null default 0 check (sort_index >= 0 and sort_index < 3),
  unique (plan_id, horizon, sort_index)
);

create index if not exists plan_performance_goals_plan_idx on plan_performance_goals (plan_id, horizon, sort_index);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table thirty_day_plans enable row level security;
create policy "thirty_day_plans are self" on thirty_day_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table plan_performance_goals enable row level security;
create policy "plan_performance_goals via plan" on plan_performance_goals
  for all using (
    exists (select 1 from thirty_day_plans p where p.id = plan_performance_goals.plan_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from thirty_day_plans p where p.id = plan_performance_goals.plan_id and p.user_id = auth.uid())
  );
