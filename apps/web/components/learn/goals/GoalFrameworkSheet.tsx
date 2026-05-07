"use client";

import { useState } from "react";
import type { GoalFramework, GoalRow } from "@focal/shared";
import type { createSupabaseBrowser } from "@/lib/supabase-browser";

function readFramework(g: GoalRow): GoalFramework {
  const f = g.framework;
  if (f && typeof f === "object" && !Array.isArray(f)) return f as GoalFramework;
  return {};
}

const SECTIONS: { key: keyof GoalFramework; title: string; hint?: string }[] = [
  { key: "goalSettingProcess", title: "Goal setting process", hint: "Identify goal → examine motivation → stay open → gather info → periodic goals → short-term plan." },
  { key: "anchoredGoal", title: "Anchored goal — final GOAL (6m–3y)", hint: "Learn the goal, yourself, timeline, how to improve." },
  { key: "perfectPersonAttributes", title: "The perfect person — attributes", hint: "Time management, prioritisation, focus, skills, network, resilience…" },
  { key: "perfectPersonResources", title: "The perfect person — resources", hint: "Physical, time, money, people." },
  { key: "obstaclesRiskManagement", title: "Obstacles — risk management", hint: "Your 13-step style questions in prose." },
  { key: "obstaclesAnticipated", title: "Obstacles — anticipated barriers", hint: "Money, time, what stops you becoming that future self?" },
  { key: "obstaclesLimitingHabits", title: "Obstacles — limiting habits" },
  { key: "obstaclesOvercoming", title: "Obstacles — overcoming (resources)" },
  { key: "dissections", title: "Dissections", hint: "What you need to be good at — processes, not outcomes." },
  { key: "evaluations", title: "Evaluations", hint: "Target level, rating /10, justification, 1% gains next week." },
  { key: "smallerGoalsSmarter", title: "Breaking it down — SMARTER smaller goals" },
  { key: "shortTermActionPlan", title: "Breaking it down — short-term action plan" },
  { key: "projects", title: "Breaking it down — projects" },
  { key: "timeline", title: "Breaking it down — timeline", hint: "Realistic timeline; monthly / quarterly / bi-weekly reviews." },
];

export function GoalFrameworkSheet({
  goal,
  supabase,
  userId,
  onClose,
  onSaved,
  onSyncError,
}: {
  goal: GoalRow;
  supabase: ReturnType<typeof createSupabaseBrowser>;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
  onSyncError: () => void;
}) {
  const [fw, setFw] = useState<GoalFramework>(() => readFramework(goal));

  const setField = (key: keyof GoalFramework, value: string) => {
    setFw((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    try {
      const { error } = await supabase.from("goals").update({ framework: fw as Record<string, string> }).eq("id", goal.id).eq("user_id", userId);
      if (error) throw error;
      onSaved();
    } catch {
      onSyncError();
    }
  };

  return (
    <div className="focal-sheet-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="focal-sheet focal-sheet--wide focal-goals-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="focal-sheet-head focal-goals-sheet-head">
          <div>
            <p className="focal-kolbs-form-kicker">Notion → Focal</p>
            <strong className="focal-goals-sheet-title">Goal framework</strong>
            <p className="focal-goals-monthly-goalname">{goal.title}</p>
          </div>
          <button type="button" className="focal-learn-text-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="focal-sheet-body focal-goal-fw-body">
          <p className="focal-learn-muted">
            Paste from your Notion template. Everything is optional; use only the sections you keep up to date.
          </p>
          {SECTIONS.map(({ key, title, hint }) => (
            <label key={key} className="focal-learn-field focal-goal-fw-section">
              <span className="focal-goal-fw-title">{title}</span>
              {hint ? <span className="focal-learn-hint focal-learn-hint--tight">{hint}</span> : null}
              <textarea
                className="focal-input focal-learn-textarea focal-goal-fw-textarea"
                value={fw[key] ?? ""}
                onChange={(e) => setField(key, e.target.value)}
                rows={key === "obstaclesRiskManagement" || key === "goalSettingProcess" ? 6 : 4}
              />
            </label>
          ))}
          <button type="button" className="focal-btn primary" onClick={() => void save()}>
            Save framework
          </button>
        </div>
      </div>
    </div>
  );
}
