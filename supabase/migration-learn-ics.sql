-- ICS / LEARN tables + optional Gemini key on profiles. Run after schema.sql.

alter table profiles
  add column if not exists learn_gemini_api_key text;

create table if not exists daily_priorities (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  "date" date not null,
  priority_1_title text,
  priority_1_mvg text,
  priority_1_quadrant text,
  priority_1_status text default 'not_started' check (priority_1_status in ('not_started', 'in_progress', 'done')),
  priority_2_title text,
  priority_2_mvg text,
  priority_2_quadrant text,
  priority_2_status text default 'not_started' check (priority_2_status in ('not_started', 'in_progress', 'done')),
  disruption_mode_activated boolean default false,
  important_not_urgent_task text,
  important_not_urgent_scheduled boolean default false,
  off_track_reason text,
  eod_p1_result text check (eod_p1_result is null or eod_p1_result in ('yes', 'partial', 'no')),
  eod_p2_result text check (eod_p2_result is null or eod_p2_result in ('yes', 'partial', 'no')),
  eod_completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, "date")
);

create table if not exists session_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  "date" date not null,
  subject text not null,
  duration_mins int not null check (duration_mins >= 0 and duration_mins <= 1440),
  focus_quality int not null check (focus_quality >= 1 and focus_quality <= 5),
  session_goal text,
  goal_hit text check (goal_hit is null or goal_hit in ('yes', 'partial', 'no')),
  distractions text,
  session_type text not null default 'practice' check (session_type in ('theory', 'practice')),
  created_at timestamptz default now()
);

create table if not exists kolbs_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  week_start_date date not null,
  experience text not null default '',
  observations text not null default '',
  learnings text not null default '',
  experiment text not null default '',
  ics_technique_tag text,
  created_at timestamptz default now()
);

create index if not exists kolbs_entries_user_week_idx on kolbs_entries (user_id, week_start_date desc);

create table if not exists weekly_summaries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  week_start_date date not null,
  gemini_response text not null,
  raw_data_snapshot jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique(user_id, week_start_date)
);

alter table daily_priorities enable row level security;
alter table session_logs enable row level security;
alter table kolbs_entries enable row level security;
alter table weekly_summaries enable row level security;

create policy "daily_priorities are self" on daily_priorities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "session_logs are self" on session_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "kolbs_entries are self" on kolbs_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "weekly_summaries are self" on weekly_summaries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
