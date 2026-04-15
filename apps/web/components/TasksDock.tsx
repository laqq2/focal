"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TaskListRow, TaskRow } from "@focal/shared";
import type { createSupabaseBrowser } from "@/lib/supabase-browser";
import { enqueuePending } from "@/lib/sync";

type Supabase = ReturnType<typeof createSupabaseBrowser>;

function sortTasksForList(list: TaskRow[]): TaskRow[] {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return a.sort_index - b.sort_index;
  });
}

export function TasksDock({
  supabase,
  userId,
  taskLists,
  tasks,
  onListsChange,
  onTasksChange,
  onSyncError,
}: {
  supabase: Supabase;
  userId: string;
  taskLists: TaskListRow[];
  tasks: TaskRow[];
  onListsChange: (rows: TaskListRow[]) => void;
  onTasksChange: (rows: TaskRow[]) => void;
  onSyncError: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [listMenu, setListMenu] = useState(false);
  const [moreMenu, setMoreMenu] = useState(false);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const sortedLists = useMemo(
    () => [...taskLists].sort((a, b) => a.sort_index - b.sort_index),
    [taskLists]
  );
  const [activeListId, setActiveListId] = useState<string | null>(null);

  useEffect(() => {
    if (!sortedLists.length) {
      setActiveListId(null);
      return;
    }
    setActiveListId((cur) => {
      if (cur && sortedLists.some((l) => l.id === cur)) return cur;
      return sortedLists[0]?.id ?? null;
    });
  }, [sortedLists]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setListMenu(false);
        setMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const activeList = sortedLists.find((l) => l.id === activeListId) ?? null;
  const inboxList = sortedLists.find((l) => l.title === "Inbox") ?? sortedLists[1] ?? sortedLists[0];
  const listTasks = useMemo(() => {
    if (!activeListId) return [];
    return sortTasksForList(tasks.filter((t) => t.list_id === activeListId));
  }, [tasks, activeListId]);

  const persistTask = useCallback(
    async (row: TaskRow) => {
      const payload = {
        ...row,
        updated_at: new Date().toISOString(),
      };
      try {
        const { error } = await supabase.from("tasks").upsert(payload, { onConflict: "id" });
        if (error) throw error;
      } catch {
        enqueuePending({ id: crypto.randomUUID(), table: "tasks", op: "upsert", payload, at: Date.now() });
        onSyncError();
      }
    },
    [supabase, onSyncError]
  );

  const persistList = useCallback(
    async (row: TaskListRow) => {
      const payload = { ...row, updated_at: new Date().toISOString() };
      try {
        const { error } = await supabase.from("task_lists").upsert(payload, { onConflict: "id" });
        if (error) throw error;
      } catch {
        enqueuePending({ id: crypto.randomUUID(), table: "task_lists", op: "upsert", payload, at: Date.now() });
        onSyncError();
      }
    },
    [supabase, onSyncError]
  );

  const deleteTaskRemote = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase.from("tasks").delete().eq("id", id);
        if (error) throw error;
      } catch {
        enqueuePending({ id: crypto.randomUUID(), table: "tasks", op: "delete", payload: { id }, at: Date.now() });
        onSyncError();
      }
    },
    [supabase, onSyncError]
  );

  const deleteListRemote = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase.from("task_lists").delete().eq("id", id);
        if (error) throw error;
      } catch {
        enqueuePending({ id: crypto.randomUUID(), table: "task_lists", op: "delete", payload: { id }, at: Date.now() });
        onSyncError();
      }
    },
    [supabase, onSyncError]
  );

  const addTask = async () => {
    const title = draft.trim();
    if (!title || !activeListId) return;
    setAdding(true);
    const row: TaskRow = {
      id: crypto.randomUUID(),
      user_id: userId,
      list_id: activeListId,
      title,
      done: false,
      priority: 0,
      sort_index: Date.now(),
    };
    const next = [...tasks, row];
    onTasksChange(next);
    setDraft("");
    setAdding(false);
    await persistTask(row);
  };

  const toggleDone = async (row: TaskRow) => {
    const nextRow = { ...row, done: !row.done, sort_index: Date.now() };
    onTasksChange(tasks.map((t) => (t.id === row.id ? nextRow : t)));
    await persistTask(nextRow);
  };

  const togglePriority = async (row: TaskRow) => {
    const nextRow = { ...row, priority: row.priority >= 1 ? 0 : 1 };
    onTasksChange(tasks.map((t) => (t.id === row.id ? nextRow : t)));
    await persistTask(nextRow);
  };

  const removeTask = async (id: string) => {
    onTasksChange(tasks.filter((t) => t.id !== id));
    await deleteTaskRemote(id);
  };

  const clearCompleted = async () => {
    if (!activeListId) return;
    const doneIds = tasks.filter((t) => t.list_id === activeListId && t.done).map((t) => t.id);
    onTasksChange(tasks.filter((t) => !doneIds.includes(t.id)));
    for (const id of doneIds) await deleteTaskRemote(id);
    setMoreMenu(false);
  };

  const addList = async () => {
    const title = window.prompt("List name");
    if (!title?.trim()) return;
    const maxSort = sortedLists.reduce((m, l) => Math.max(m, l.sort_index), -1);
    const row: TaskListRow = {
      id: crypto.randomUUID(),
      user_id: userId,
      title: title.trim(),
      sort_index: maxSort + 1,
    };
    onListsChange([...taskLists, row]);
    setActiveListId(row.id);
    await persistList(row);
    setMoreMenu(false);
  };

  const renameList = async () => {
    if (!activeList) return;
    const title = window.prompt("Rename list", activeList.title);
    if (!title?.trim()) return;
    const next = taskLists.map((l) => (l.id === activeList.id ? { ...l, title: title.trim() } : l));
    onListsChange(next);
    await persistList({ ...activeList, title: title.trim() });
    setMoreMenu(false);
  };

  const deleteList = async () => {
    if (!activeList || sortedLists.length <= 1) return;
    if (!window.confirm(`Delete “${activeList.title}” and all its tasks?`)) return;
    const lid = activeList.id;
    onTasksChange(tasks.filter((t) => t.list_id !== lid));
    onListsChange(taskLists.filter((l) => l.id !== lid));
    if (activeListId === lid) {
      const next = sortedLists.find((l) => l.id !== lid);
      setActiveListId(next?.id ?? null);
    }
    await deleteListRemote(lid);
    setMoreMenu(false);
  };

  const showInboxHint = activeList?.title === "Today" && inboxList && inboxList.id !== activeList.id;

  return (
    <div className="focal-tasks-dock-root" ref={rootRef}>
      {open ? (
        <div className="focal-tasks-dock-panel">
          <div className="focal-tasks-dock-banner">
            <span className="focal-tasks-dock-banner-ico" aria-hidden>
              ✓
            </span>
            <span>Tasks stay synced with your account.</span>
          </div>
          <div className="focal-tasks-dock-head">
            <div className="focal-tasks-dock-title-wrap">
              <button
                type="button"
                className="focal-tasks-dock-title-btn"
                onClick={() => {
                  setListMenu((v) => !v);
                  setMoreMenu(false);
                }}
              >
                <span>{activeList?.title ?? "Tasks"}</span>
                <span className="focal-tasks-dock-chev" aria-hidden>
                  ▾
                </span>
              </button>
              {listMenu ? (
                <div className="focal-tasks-dock-dropdown">
                  {sortedLists.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className={l.id === activeListId ? "active" : ""}
                      onClick={() => {
                        setActiveListId(l.id);
                        setListMenu(false);
                      }}
                    >
                      {l.title}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="focal-tasks-dock-more"
              aria-label="List options"
              onClick={() => {
                setMoreMenu((v) => !v);
                setListMenu(false);
              }}
            >
              ⋯
            </button>
            {moreMenu ? (
              <div className="focal-tasks-dock-more-menu">
                <button type="button" onClick={() => void addList()}>
                  New list
                </button>
                <button type="button" onClick={() => void renameList()}>
                  Rename list
                </button>
                <button type="button" onClick={() => void clearCompleted()}>
                  Clear completed
                </button>
                <button type="button" className="danger" onClick={() => void deleteList()} disabled={sortedLists.length <= 1}>
                  Delete list
                </button>
              </div>
            ) : null}
          </div>

          <div className="focal-tasks-dock-body">
            {listTasks.length === 0 ? (
              <div className="focal-tasks-dock-empty">
                <p>Add a task to get started</p>
                {showInboxHint ? (
                  <button type="button" className="focal-tasks-dock-inbox-link" onClick={() => setActiveListId(inboxList.id)}>
                    Switch to Inbox ›
                  </button>
                ) : null}
              </div>
            ) : (
              <ul className="focal-tasks-dock-list">
                {listTasks.map((t) => (
                  <li key={t.id} className={t.done ? "done" : ""}>
                    <button
                      type="button"
                      className={`focal-tasks-check ${t.done ? "on" : ""}`}
                      aria-label={t.done ? "Mark not done" : "Mark done"}
                      onClick={() => void toggleDone(t)}
                    />
                    <span className="focal-tasks-title">{t.title}</span>
                    <button
                      type="button"
                      className={`focal-tasks-star ${t.priority >= 1 ? "on" : ""}`}
                      aria-label={t.priority >= 1 ? "Remove priority" : "Prioritize"}
                      title="Prioritize"
                      onClick={() => void togglePriority(t)}
                    >
                      ★
                    </button>
                    <button type="button" className="focal-tasks-del" aria-label="Remove task" onClick={() => void removeTask(t.id)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="focal-tasks-dock-foot">
            <input
              className="focal-tasks-dock-input"
              placeholder="New task…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addTask();
              }}
              disabled={!activeListId || adding}
            />
            <button type="button" className="focal-tasks-new-pill" onClick={() => void addTask()} disabled={!draft.trim() || !activeListId}>
              New Task
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="focal-tasks-fab"
        aria-expanded={open}
        aria-label={open ? "Close tasks" : "Open tasks"}
        onClick={() => {
          setOpen((v) => !v);
          setListMenu(false);
          setMoreMenu(false);
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
