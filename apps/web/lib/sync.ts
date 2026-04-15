import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import type {
  ProfileRow,
  DailyGoalRow,
  FocusSessionRow,
  FocusLogRow,
  BlockedSiteRow,
  MementoEntryRow,
  TaskListRow,
  TaskRow,
} from "@focal/shared";
import { CACHE_KEYS } from "@focal/shared";

export function cacheWrite(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function cacheRead<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export interface PendingWrite {
  id: string;
  table: string;
  op: "upsert" | "delete" | "insert";
  payload: unknown;
  at: number;
}

export function enqueuePending(write: PendingWrite) {
  const list = cacheRead<PendingWrite[]>(CACHE_KEYS.pendingWrites) ?? [];
  list.push(write);
  cacheWrite(CACHE_KEYS.pendingWrites, list);
}

export function readPending(): PendingWrite[] {
  return cacheRead<PendingWrite[]>(CACHE_KEYS.pendingWrites) ?? [];
}

export function drainPending(): PendingWrite[] {
  const list = cacheRead<PendingWrite[]>(CACHE_KEYS.pendingWrites) ?? [];
  cacheWrite(CACHE_KEYS.pendingWrites, []);
  return list;
}

export async function flushPending(client: SupabaseClient) {
  const pending = drainPending();
  for (const p of pending) {
    try {
      if (p.table === "daily_goals" && p.op === "upsert") {
        await client.from("daily_goals").upsert(p.payload as Record<string, unknown>);
      }
      if (p.table === "focus_sessions" && p.op === "upsert") {
        await client.from("focus_sessions").upsert(p.payload as Record<string, unknown>);
      }
      if (p.table === "blocked_sites" && p.op === "upsert") {
        await client.from("blocked_sites").upsert(p.payload as Record<string, unknown>);
      }
      if (p.table === "blocked_sites" && p.op === "delete") {
        const row = p.payload as { id: string };
        await client.from("blocked_sites").delete().eq("id", row.id);
      }
      if (p.table === "profiles" && p.op === "upsert") {
        await client.from("profiles").upsert(p.payload as Record<string, unknown>);
      }
      if (p.table === "memento_entries" && p.op === "upsert") {
        await client.from("memento_entries").upsert(p.payload as Record<string, unknown>);
      }
      if (p.table === "focus_logs" && p.op === "insert") {
        await client.from("focus_logs").insert(p.payload as Record<string, unknown>);
      }
      if (p.table === "task_lists" && p.op === "upsert") {
        await client.from("task_lists").upsert(p.payload as Record<string, unknown>);
      }
      if (p.table === "task_lists" && p.op === "delete") {
        const row = p.payload as { id: string };
        await client.from("task_lists").delete().eq("id", row.id);
      }
      if (p.table === "tasks" && p.op === "upsert") {
        await client.from("tasks").upsert(p.payload as Record<string, unknown>);
      }
      if (p.table === "tasks" && p.op === "delete") {
        const row = p.payload as { id: string };
        await client.from("tasks").delete().eq("id", row.id);
      }
    } catch {
      enqueuePending(p);
    }
  }
}

const LEGACY_TASKS_KEY = "focal_tasks_v1";

function readLegacyLocalTasks(): string[] {
  try {
    const raw = localStorage.getItem(LEGACY_TASKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  } catch {
    return [];
  }
}

/** Creates Today + Inbox when the user has no lists; migrates legacy localStorage tasks into Inbox. */
export async function seedDefaultTasksAndLists(
  client: SupabaseClient,
  userId: string
): Promise<{ lists: TaskListRow[]; tasks: TaskRow[] }> {
  const todayId = crypto.randomUUID();
  const inboxId = crypto.randomUUID();
  const lists: TaskListRow[] = [
    { id: todayId, user_id: userId, title: "Today", sort_index: 0 },
    { id: inboxId, user_id: userId, title: "Inbox", sort_index: 1 },
  ];
  const { error } = await client.from("task_lists").insert(lists);
  if (error) return { lists: [], tasks: [] };
  const legacy = readLegacyLocalTasks();
  try {
    localStorage.removeItem(LEGACY_TASKS_KEY);
  } catch {
    /* ignore */
  }
  const base = Date.now();
  const taskRows: TaskRow[] = legacy.map((title, i) => ({
    id: crypto.randomUUID(),
    user_id: userId,
    list_id: inboxId,
    title,
    done: false,
    priority: 0,
    sort_index: base + i,
  }));
  if (taskRows.length) {
    const { error: te } = await client.from("tasks").insert(taskRows);
    if (te) return { lists, tasks: [] };
  }
  return { lists, tasks: taskRows };
}

export async function loadBundle(client: SupabaseClient, userId: string) {
  const [
    { data: profile },
    { data: goals },
    { data: focus },
    { data: blocked },
    { data: memento },
    { data: focusLogs },
    taskListsRes,
    tasksRes,
  ] = await Promise.all([
    client.from("profiles").select("*").eq("id", userId).maybeSingle(),
    client.from("daily_goals").select("*").eq("user_id", userId),
    client.from("focus_sessions").select("*").eq("user_id", userId),
    client.from("blocked_sites").select("*").eq("user_id", userId),
    client.from("memento_entries").select("*").eq("user_id", userId),
    client
      .from("focus_logs")
      .select("*")
      .eq("user_id", userId)
      .order("ended_at", { ascending: false })
      .limit(120),
    client.from("task_lists").select("*").eq("user_id", userId).order("sort_index", { ascending: true }),
    client.from("tasks").select("*").eq("user_id", userId),
  ]);

  let taskLists = (taskListsRes.data ?? []) as TaskListRow[];
  let tasks = (tasksRes.data ?? []) as TaskRow[];
  if (taskListsRes.error || tasksRes.error) {
    taskLists = [];
    tasks = [];
  } else if (taskLists.length === 0) {
    const seeded = await seedDefaultTasksAndLists(client, userId);
    taskLists = seeded.lists;
    tasks = seeded.tasks;
  }

  const bundle = {
    profile: (profile ?? null) as ProfileRow | null,
    goals: (goals ?? []) as DailyGoalRow[],
    focus: (focus ?? []) as FocusSessionRow[],
    focusLogs: (focusLogs ?? []) as FocusLogRow[],
    blocked: (blocked ?? []) as BlockedSiteRow[],
    memento: (memento ?? []) as MementoEntryRow[],
    taskLists,
    tasks,
  };

  cacheWrite(CACHE_KEYS.profile, bundle.profile);
  cacheWrite(CACHE_KEYS.goals, bundle.goals);
  cacheWrite(CACHE_KEYS.focus, bundle.focus);
  cacheWrite(CACHE_KEYS.focusLogs, bundle.focusLogs);
  cacheWrite(CACHE_KEYS.blocked, bundle.blocked);
  cacheWrite(CACHE_KEYS.memento, bundle.memento);
  cacheWrite(CACHE_KEYS.taskLists, bundle.taskLists);
  cacheWrite(CACHE_KEYS.tasks, bundle.tasks);

  return bundle;
}

export function cachedBundle() {
  return {
    profile: cacheRead<ProfileRow | null>(CACHE_KEYS.profile),
    goals: cacheRead<DailyGoalRow[]>(CACHE_KEYS.goals) ?? [],
    focus: cacheRead<FocusSessionRow[]>(CACHE_KEYS.focus) ?? [],
    focusLogs: cacheRead<FocusLogRow[]>(CACHE_KEYS.focusLogs) ?? [],
    blocked: cacheRead<BlockedSiteRow[]>(CACHE_KEYS.blocked) ?? [],
    memento: cacheRead<MementoEntryRow[]>(CACHE_KEYS.memento) ?? [],
    taskLists: cacheRead<TaskListRow[]>(CACHE_KEYS.taskLists) ?? [],
    tasks: cacheRead<TaskRow[]>(CACHE_KEYS.tasks) ?? [],
  };
}

export function subscribeGoals(
  client: SupabaseClient,
  userId: string,
  onChange: (rows: DailyGoalRow[]) => void
): RealtimeChannel {
  return client
    .channel(`daily_goals:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "daily_goals", filter: `user_id=eq.${userId}` },
      async () => {
        const { data } = await client.from("daily_goals").select("*").eq("user_id", userId);
        const rows = (data ?? []) as DailyGoalRow[];
        cacheWrite(CACHE_KEYS.goals, rows);
        onChange(rows);
      }
    )
    .subscribe();
}

export function subscribeFocus(
  client: SupabaseClient,
  userId: string,
  onChange: (rows: FocusSessionRow[]) => void
): RealtimeChannel {
  return client
    .channel(`focus_sessions:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "focus_sessions", filter: `user_id=eq.${userId}` },
      async () => {
        const { data } = await client.from("focus_sessions").select("*").eq("user_id", userId);
        const rows = (data ?? []) as FocusSessionRow[];
        cacheWrite(CACHE_KEYS.focus, rows);
        onChange(rows);
      }
    )
    .subscribe();
}

export function todayIsoLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}
