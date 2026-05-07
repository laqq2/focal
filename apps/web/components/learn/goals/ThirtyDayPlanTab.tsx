"use client";

import { useCallback, useMemo, useState } from "react";
import type { GoalRow, PlanPerformanceGoalRow, ThirtyDayPlanRow } from "@focal/shared";
import type { createSupabaseBrowser } from "@/lib/supabase-browser";
import { addDaysIso } from "@/lib/learn-dates";

export type PlanWithPerformance = ThirtyDayPlanRow & {
  plan_performance_goals?: PlanPerformanceGoalRow[];
};

const TIME_OPTIONS = [
  { v: "none", label: "Absolutely 0 — no additional time" },
  { v: "very_little", label: "Very little — small amount weekly" },
  { v: "some", label: "Some — moderate time weekly" },
  { v: "decent", label: "Decent — multiple days, significant time" },
  { v: "free", label: "Free — majority of time for the next 30 days" },
] as const;

function emptySlots(
  rows: PlanPerformanceGoalRow[] | undefined,
  horizon: "30d" | "14d"
): (PlanPerformanceGoalRow | null)[] {
  const filtered = (rows ?? []).filter((r) => r.horizon === horizon).sort((a, b) => a.sort_index - b.sort_index);
  const out: (PlanPerformanceGoalRow | null)[] = [null, null, null];
  for (const r of filtered) {
    if (r.sort_index >= 0 && r.sort_index < 3) out[r.sort_index] = r;
  }
  return out;
}

export function ThirtyDayPlanTab({
  supabase,
  userId,
  goals,
  plans,
  onReload,
  onSyncError,
}: {
  supabase: ReturnType<typeof createSupabaseBrowser>;
  userId: string;
  goals: GoalRow[];
  plans: PlanWithPerformance[];
  onReload: () => void | Promise<void>;
  onSyncError: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const activeGoals = useMemo(() => goals.filter((g) => g.status === "active"), [goals]);

  const openNew = () => {
    const start = new Date();
    const y = start.getFullYear();
    const m = String(start.getMonth() + 1).padStart(2, "0");
    const d = String(start.getDate()).padStart(2, "0");
    const startIso = `${y}-${m}-${d}`;
    const endIso = addDaysIso(startIso, 29);
    setEditingId("new");
    setDraft({
      id: null,
      title: "30 day plan",
      period_start: startIso,
      period_end: endIso,
      strategic_goal_id: "",
      time_availability: "some",
      protect_time: "",
      limiting_habits: "",
      scripted_actions: "",
      environmental_optimisations: "",
      scheduling_notes: "",
      g30: ["", "", ""],
      g14: ["", "", ""],
      d30: ["", "", ""],
      d14: ["", "", ""],
    });
  };

  const [draft, setDraft] = useState<{
    id: string | null;
    title: string;
    period_start: string;
    period_end: string;
    strategic_goal_id: string;
    time_availability: string;
    protect_time: string;
    limiting_habits: string;
    scripted_actions: string;
    environmental_optimisations: string;
    scheduling_notes: string;
    g30: [string, string, string];
    g14: [string, string, string];
    d30: [string, string, string];
    d14: [string, string, string];
  } | null>(null);

  const loadDraftFromPlan = useCallback((p: PlanWithPerformance) => {
    const s30 = emptySlots(p.plan_performance_goals, "30d");
    const s14 = emptySlots(p.plan_performance_goals, "14d");
    const titles = (slot: (PlanPerformanceGoalRow | null)[]) =>
      [0, 1, 2].map((i) => slot[i]?.title ?? "") as [string, string, string];
    const details = (slot: (PlanPerformanceGoalRow | null)[]) =>
      [0, 1, 2].map((i) => slot[i]?.detail ?? "") as [string, string, string];
    setDraft({
      id: p.id,
      title: p.title,
      period_start: p.period_start,
      period_end: p.period_end,
      strategic_goal_id: p.strategic_goal_id ?? "",
      time_availability: p.time_availability ?? "some",
      protect_time: p.protect_time ?? "",
      limiting_habits: p.limiting_habits ?? "",
      scripted_actions: p.scripted_actions ?? "",
      environmental_optimisations: p.environmental_optimisations ?? "",
      scheduling_notes: p.scheduling_notes ?? "",
      g30: titles(s30),
      g14: titles(s14),
      d30: details(s30),
      d14: details(s14),
    });
    setEditingId(p.id);
  }, []);

  const savePlan = async () => {
    if (!draft) return;
    try {
      const base = {
        user_id: userId,
        title: draft.title.trim() || "30 day plan",
        period_start: draft.period_start,
        period_end: draft.period_end,
        strategic_goal_id: draft.strategic_goal_id || null,
        time_availability: draft.time_availability || null,
        protect_time: draft.protect_time.trim() || null,
        limiting_habits: draft.limiting_habits.trim() || null,
        scripted_actions: draft.scripted_actions.trim() || null,
        environmental_optimisations: draft.environmental_optimisations.trim() || null,
        scheduling_notes: draft.scheduling_notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      let planId = draft.id;
      if (!planId) {
        const { data: inserted, error } = await supabase.from("thirty_day_plans").insert(base).select("id").maybeSingle();
        if (error) throw error;
        planId = (inserted as { id: string }).id;
      } else {
        const { error } = await supabase.from("thirty_day_plans").update(base).eq("id", planId).eq("user_id", userId);
        if (error) throw error;
        await supabase.from("plan_performance_goals").delete().eq("plan_id", planId);
      }

      const perfRows: { plan_id: string; horizon: string; title: string; detail: string | null; sort_index: number }[] = [];
      for (let i = 0; i < 3; i++) {
        const t30 = draft.g30[i]?.trim();
        if (t30)
          perfRows.push({
            plan_id: planId!,
            horizon: "30d",
            title: t30,
            detail: draft.d30[i]?.trim() || null,
            sort_index: i,
          });
        const t14 = draft.g14[i]?.trim();
        if (t14)
          perfRows.push({
            plan_id: planId!,
            horizon: "14d",
            title: t14,
            detail: draft.d14[i]?.trim() || null,
            sort_index: i,
          });
      }
      if (perfRows.length) {
        const { error: pe } = await supabase.from("plan_performance_goals").insert(perfRows);
        if (pe) throw pe;
      }
      setEditingId(null);
      setDraft(null);
      void onReload();
    } catch {
      onSyncError();
    }
  };

  const closeEditor = () => {
    setEditingId(null);
    setDraft(null);
  };

  return (
    <>
      <header className="focal-goals-hero">
        <div className="focal-goals-hero__text">
          <p className="focal-kolbs-form-kicker">Execution window</p>
          <h2 className="focal-goals-hero__title">30-day plan</h2>
          <p className="focal-goals-hero__sub">
            Up to three measurable performance goals for 30 days and for 14 days, plus barriers and scheduling notes from
            your Notion template.
          </p>
        </div>
        <button type="button" className="focal-btn primary focal-goals-hero__cta" onClick={() => openNew()}>
          New plan
        </button>
      </header>

      {plans.length === 0 && !draft ? (
        <p className="focal-learn-empty focal-goals-empty-prompt">Create a 30-day plan and link it to a strategic goal when it helps.</p>
      ) : null}

      {plans.length > 0 ? (
        <ul className="focal-goals-ul">
          {plans.map((p) => (
            <li key={p.id} className="focal-goals-card">
              <div className="focal-goals-card-head">
                <strong className="focal-goals-card-title">{p.title}</strong>
                <span className="focal-goals-badge">
                  {p.period_start} → {p.period_end}
                </span>
              </div>
              <p className="focal-goals-metric">
                {(p.plan_performance_goals ?? []).filter((x) => x.horizon === "30d").length} × 30d goals ·{" "}
                {(p.plan_performance_goals ?? []).filter((x) => x.horizon === "14d").length} × 14d goals
              </p>
              <button type="button" className="focal-btn focal-goals-monthly" onClick={() => loadDraftFromPlan(p)}>
                Edit
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {draft && editingId ? (
        <div className="focal-plan30-editor focal-learn-panel">
          <div className="focal-sheet-head focal-goals-sheet-head" style={{ marginBottom: 12 }}>
            <strong className="focal-goals-sheet-title">{draft.id ? "Edit plan" : "New 30-day plan"}</strong>
            <button type="button" className="focal-learn-text-btn" onClick={closeEditor}>
              Close
            </button>
          </div>
          <label className="focal-learn-field">
            Title
            <input className="focal-input" value={draft.title} onChange={(e) => setDraft((d) => (d ? { ...d, title: e.target.value } : d))} />
          </label>
          <div className="focal-learn-row2">
            <label className="focal-learn-field">
              Start
              <input
                className="focal-input"
                type="date"
                value={draft.period_start}
                onChange={(e) => setDraft((d) => (d ? { ...d, period_start: e.target.value } : d))}
              />
            </label>
            <label className="focal-learn-field">
              End
              <input
                className="focal-input"
                type="date"
                value={draft.period_end}
                onChange={(e) => setDraft((d) => (d ? { ...d, period_end: e.target.value } : d))}
              />
            </label>
          </div>
          <label className="focal-learn-field">
            Linked strategic goal (optional)
            <select
              className="focal-learn-select"
              value={draft.strategic_goal_id}
              onChange={(e) => setDraft((d) => (d ? { ...d, strategic_goal_id: e.target.value } : d))}
            >
              <option value="">—</option>
              {activeGoals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </label>

          <h4 className="focal-learn-h" style={{ marginTop: 16 }}>
            Anticipated barriers
          </h4>
          <label className="focal-learn-field">
            Time availability
            <select
              className="focal-learn-select"
              value={draft.time_availability}
              onChange={(e) => setDraft((d) => (d ? { ...d, time_availability: e.target.value } : d))}
            >
              {TIME_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="focal-learn-field">
            What will you do to protect your time? (specific, actionable)
            <textarea
              className="focal-input focal-learn-textarea"
              value={draft.protect_time}
              onChange={(e) => setDraft((d) => (d ? { ...d, protect_time: e.target.value } : d))}
            />
          </label>
          <label className="focal-learn-field">
            Limiting habits
            <textarea
              className="focal-input focal-learn-textarea"
              value={draft.limiting_habits}
              onChange={(e) => setDraft((d) => (d ? { ...d, limiting_habits: e.target.value } : d))}
            />
          </label>
          <label className="focal-learn-field">
            Scripted actions
            <textarea
              className="focal-input focal-learn-textarea"
              value={draft.scripted_actions}
              onChange={(e) => setDraft((d) => (d ? { ...d, scripted_actions: e.target.value } : d))}
            />
          </label>
          <label className="focal-learn-field">
            Environmental optimisations
            <textarea
              className="focal-input focal-learn-textarea"
              value={draft.environmental_optimisations}
              onChange={(e) => setDraft((d) => (d ? { ...d, environmental_optimisations: e.target.value } : d))}
            />
          </label>
          <label className="focal-learn-field">
            Scheduling (checklist, calendar rules, links — paste from Notion)
            <textarea
              className="focal-input focal-learn-textarea"
              value={draft.scheduling_notes}
              onChange={(e) => setDraft((d) => (d ? { ...d, scheduling_notes: e.target.value } : d))}
              placeholder="e.g. Top two priorities first; 30-min blocks; buffer 25%…"
            />
          </label>

          <h4 className="focal-learn-h" style={{ marginTop: 16 }}>
            30-day performance goals
          </h4>
          <p className="focal-learn-hint focal-learn-hint--tight">Up to 3 — specific and measurable.</p>
          {[0, 1, 2].map((i) => (
            <div key={`30-${i}`} className="focal-plan30-goal-row">
              <label className="focal-learn-field">
                Goal {i + 1}
                <input
                  className="focal-input"
                  value={draft.g30[i]}
                  onChange={(e) =>
                    setDraft((d) => {
                      if (!d) return d;
                      const next = [...d.g30] as [string, string, string];
                      next[i] = e.target.value;
                      return { ...d, g30: next };
                    })
                  }
                />
              </label>
              <label className="focal-learn-field">
                Detail / metric
                <input
                  className="focal-input"
                  value={draft.d30[i]}
                  onChange={(e) =>
                    setDraft((d) => {
                      if (!d) return d;
                      const next = [...d.d30] as [string, string, string];
                      next[i] = e.target.value;
                      return { ...d, d30: next };
                    })
                  }
                />
              </label>
            </div>
          ))}

          <h4 className="focal-learn-h" style={{ marginTop: 16 }}>
            14-day performance goals
          </h4>
          <p className="focal-learn-hint focal-learn-hint--tight">Up to 3 — specific and measurable.</p>
          {[0, 1, 2].map((i) => (
            <div key={`14-${i}`} className="focal-plan30-goal-row">
              <label className="focal-learn-field">
                Goal {i + 1}
                <input
                  className="focal-input"
                  value={draft.g14[i]}
                  onChange={(e) =>
                    setDraft((d) => {
                      if (!d) return d;
                      const next = [...d.g14] as [string, string, string];
                      next[i] = e.target.value;
                      return { ...d, g14: next };
                    })
                  }
                />
              </label>
              <label className="focal-learn-field">
                Detail / metric
                <input
                  className="focal-input"
                  value={draft.d14[i]}
                  onChange={(e) =>
                    setDraft((d) => {
                      if (!d) return d;
                      const next = [...d.d14] as [string, string, string];
                      next[i] = e.target.value;
                      return { ...d, d14: next };
                    })
                  }
                />
              </label>
            </div>
          ))}

          <button type="button" className="focal-btn primary" style={{ marginTop: 16 }} onClick={() => void savePlan()}>
            Save plan
          </button>
        </div>
      ) : null}
    </>
  );
}
