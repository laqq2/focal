-- Run in Supabase SQL editor. Adjust policies to taste.

create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  clock_format text default '24hr' check (clock_format in ('12hr', '24hr')),
  focus_duration int default 25,
  break_duration int default 5,
  quote_style text default 'theology' check (quote_style in ('motivational', 'stoic', 'theology', 'custom')),
  custom_quotes text,
  show_memento_widget boolean default false,
  theme text default 'photo' check (theme in ('photo', 'solid')),
  greeting_template text,
  updated_at timestamptz default now()
);

create table if not exists daily_goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  "date" date not null default (timezone('utc', now()))::date,
  goal text,
  updated_at timestamptz default now(),
  unique(user_id, "date")
);

create table if not exists focus_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  "date" date not null default (timezone('utc', now()))::date,
  minutes_focused int default 0,
  updated_at timestamptz default now(),
  unique(user_id, "date")
);

create table if not exists focus_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  started_at timestamptz,
  ended_at timestamptz not null default now(),
  planned_minutes int not null,
  actual_minutes int not null,
  intent text,
  distractions jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists blocked_sites (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  domain text not null,
  created_at timestamptz default now()
);

create table if not exists memento_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  label text not null,
  birth_year int not null,
  birth_date date,
  life_expectancy int default 82,
  updated_at timestamptz default now()
);

create table if not exists task_lists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  sort_index int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  list_id uuid references task_lists on delete cascade not null,
  title text not null,
  done boolean not null default false,
  priority int not null default 0,
  sort_index bigint not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;
alter table daily_goals enable row level security;
alter table focus_sessions enable row level security;
alter table focus_logs enable row level security;
alter table blocked_sites enable row level security;
alter table memento_entries enable row level security;
alter table task_lists enable row level security;
alter table tasks enable row level security;

create policy "profiles are self" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "daily_goals are self" on daily_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "focus_sessions are self" on focus_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "focus_logs are self" on focus_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "blocked_sites are self" on blocked_sites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "memento_entries are self" on memento_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "task_lists are self" on task_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tasks are self" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- In Supabase Dashboard → Database → Replication, enable Realtime for:
--   daily_goals
--   focus_sessions
