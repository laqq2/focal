-- Additive migration for existing Focal databases.

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

alter table focus_logs enable row level security;

create policy "focus_logs are self" on focus_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
