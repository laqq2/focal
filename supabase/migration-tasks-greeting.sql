-- Add custom greeting + Google Tasks–style lists (run on existing projects).

alter table profiles add column if not exists greeting_template text;

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

alter table task_lists enable row level security;
alter table tasks enable row level security;

drop policy if exists "task_lists are self" on task_lists;
create policy "task_lists are self" on task_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "tasks are self" on tasks;
create policy "tasks are self" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
