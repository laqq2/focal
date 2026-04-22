"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ExperimentRow,
  GoalAreaRow,
  GoalReviewRow,
  GoalRow,
  KolbsEntryRow,
  SkillLevelHistoryRow,
  SkillRow,
} from "@focal/shared";
import type { createSupabaseBrowser } from "@/lib/supabase-browser";
import { addDaysIso, weekStartMondayLocal } from "@/lib/learn-dates";
import { enqueuePending } from "@/lib/sync";

const PRESET_COLORS = [
  { label: "Rose", v: "#be7c7a" },
  { label: "Amber", v: "#c9a227" },
  { label: "Teal", v: "#5a9e9a" },
  { label: "Violet", v: "#8b7bb8" },
  { label: "Sky", v: "#6b9bd1" },
  { label: "Green", v: "#6b9b7a" },
];

type Tab = "goals" | "skills";

export function GoalsPage({
  supabase,
  userId,
  accessToken,
  onSyncError,
}: {
  supabase: ReturnType<typeof createSupabaseBrowser>;
  userId: string;
  accessToken: string;
  onSyncError: () => void;
}) {
  const [tab, setTab] = useState<Tab>("goals");
  const [areas, setAreas] = useState<GoalAreaRow[]>([]);
  const [goals, setGoals] = useState<(GoalRow & { area?: GoalAreaRow | null })[]>([]);
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [goalSkillsMap, setGoalSkillsMap] = useState<Record<string, { skill: SkillRow; expected_level: string | null }[]>>({});
  const [reviews, setReviews] = useState<Record<string, GoalReviewRow>>({});
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [experimentsBySkill, setExperimentsBySkill] = useState<Record<string, ExperimentRow[]>>({});
  const [kolbsBySkill, setKolbsBySkill] = useState<Record<string, KolbsEntryRow[]>>({});
  const [historyBySkill, setHistoryBySkill] = useState<Record<string, SkillLevelHistoryRow[]>>({});
  const [loading, setLoading] = useState(true);

  const [sheet, setSheet] = useState<"none" | "newGoal" | "monthly">("none");
  const [monthlyGoal, setMonthlyGoal] = useState<GoalRow | null>(null);

  const onSyncErrorRef = useRef(onSyncError);
  onSyncErrorRef.current = onSyncError;

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      if (!silent) setLoading(true);
      const weekStart = weekStartMondayLocal(new Date());
      const weekEnd = addDaysIso(weekStart, 6);
    try {
      const [{ data: a }, { data: g }, { data: s }, { data: gs }, { data: sl }] = await Promise.all([
        supabase.from("goal_areas").select("*").eq("user_id", userId).order("name"),
        supabase.from("goals").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("skills").select("*").eq("user_id", userId).order("name"),
        supabase.from("goal_skills").select("*, skill:skills(*)"),
        supabase
          .from("session_logs")
          .select("goal_id, duration_mins, date")
          .eq("user_id", userId)
          .gte("date", weekStart)
          .lte("date", weekEnd),
      ]);
      setAreas((a as GoalAreaRow[]) ?? []);
      const goalRows = (g as GoalRow[]) ?? [];
      const areaMap = Object.fromEntries((a as GoalAreaRow[])?.map((x) => [x.id, x]) ?? []);
      setGoals(goalRows.map((gr) => ({ ...gr, area: gr.goal_area_id ? areaMap[gr.goal_area_id] ?? null : null })));

      const gsm: Record<string, { skill: SkillRow; expected_level: string | null }[]> = {};
      for (const row of gs ?? []) {
        const r = row as { goal_id: string; expected_level: string | null; skill: SkillRow };
        if (!gsm[r.goal_id]) gsm[r.goal_id] = [];
        if (r.skill) gsm[r.goal_id].push({ skill: r.skill, expected_level: r.expected_level });
      }
      setGoalSkillsMap(gsm);
      setSkills((s as SkillRow[]) ?? []);

      const counts: Record<string, number> = {};
      for (const row of sl ?? []) {
        const gid = (row as { goal_id?: string }).goal_id;
        if (!gid) continue;
        counts[gid] = (counts[gid] ?? 0) + (row as { duration_mins: number }).duration_mins;
      }
      setSessionCounts(counts);

      const goalIds = goalRows.map((x) => x.id);
      if (goalIds.length) {
        const { data: rev } = await supabase.from("goal_reviews").select("*").in("goal_id", goalIds).order("review_month", { ascending: false });
        const rm: Record<string, GoalReviewRow> = {};
        for (const r of rev ?? []) {
          const row = r as GoalReviewRow;
          if (!rm[row.goal_id]) rm[row.goal_id] = row;
        }
        setReviews(rm);
      } else {
        setReviews({});
      }

      const skillIds = ((s as SkillRow[]) ?? []).map((x) => x.id);
      if (skillIds.length) {
        const [{ data: ex }, { data: kb }, { data: hist }] = await Promise.all([
          supabase.from("experiments").select("*").eq("user_id", userId).in("skill_id", skillIds),
          supabase.from("kolbs_entries").select("*").eq("user_id", userId).in("skill_id", skillIds).order("created_at", { ascending: false }),
          supabase.from("skill_level_history").select("*").eq("user_id", userId).in("skill_id", skillIds).order("changed_at", { ascending: false }),
        ]);
        const eb: Record<string, ExperimentRow[]> = {};
        for (const e of ex ?? []) {
          const sk = (e as ExperimentRow).skill_id;
          if (!sk) continue;
          if (!eb[sk]) eb[sk] = [];
          eb[sk].push(e as ExperimentRow);
        }
        setExperimentsBySkill(eb);
        const kbMap: Record<string, KolbsEntryRow[]> = {};
        for (const k of kb ?? []) {
          const sk = (k as KolbsEntryRow).skill_id;
          if (!sk) continue;
          if (!kbMap[sk]) kbMap[sk] = [];
          kbMap[sk].push(k as KolbsEntryRow);
        }
        setKolbsBySkill(kbMap);
        const hm: Record<string, SkillLevelHistoryRow[]> = {};
        for (const h of hist ?? []) {
          const sk = (h as SkillLevelHistoryRow).skill_id;
          if (!hm[sk]) hm[sk] = [];
          hm[sk].push(h as SkillLevelHistoryRow);
        }
        setHistoryBySkill(hm);
      } else {
        setExperimentsBySkill({});
        setKolbsBySkill({});
        setHistoryBySkill({});
      }
    } catch {
      onSyncErrorRef.current();
    } finally {
      setLoading(false);
    }
  },
  [supabase, userId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="focal-goals-root focal-goals-root--boot focal-learn-narrow">
        <div className="focal-goals-skeleton">
          <div className="focal-kolbs-skeleton-line" style={{ width: "40%" }} />
          <div className="focal-kolbs-skeleton-line" style={{ width: "70%" }} />
          <div className="focal-kolbs-skeleton-block" />
        </div>
      </div>
    );
  }

  return (
    <div className="focal-goals-root focal-learn-narrow">
      <div className="focal-goals-subtabs">
        <button type="button" className={tab === "goals" ? "active" : ""} onClick={() => setTab("goals")}>
          Goals
        </button>
        <button type="button" className={tab === "skills" ? "active" : ""} onClick={() => setTab("skills")}>
          Skills
        </button>
      </div>

      {tab === "goals" ? (
        <GoalsTab
          areas={areas}
          goals={goals}
          goalSkillsMap={goalSkillsMap}
          sessionCounts={sessionCounts}
          reviews={reviews}
          onOpenMonthly={(g) => {
            setMonthlyGoal(g);
            setSheet("monthly");
          }}
          onNewGoal={() => setSheet("newGoal")}
        />
      ) : (
        <SkillsTab
          skills={skills}
          goals={goals}
          experimentsBySkill={experimentsBySkill}
          kolbsBySkill={kolbsBySkill}
          historyBySkill={historyBySkill}
          supabase={supabase}
          userId={userId}
          onSyncError={onSyncError}
          onReload={() => void load({ silent: true })}
        />
      )}

      {sheet === "newGoal" ? (
        <NewGoalSheet
          areas={areas}
          skills={skills}
          supabase={supabase}
          userId={userId}
          onClose={() => setSheet("none")}
          onSaved={() => {
            setSheet("none");
            void load({ silent: true });
          }}
          onSyncError={onSyncError}
        />
      ) : null}
      {sheet === "monthly" && monthlyGoal ? (
        <MonthlyReviewSheet
          goal={monthlyGoal}
          accessToken={accessToken}
          supabase={supabase}
          userId={userId}
          onClose={() => {
            setSheet("none");
            setMonthlyGoal(null);
          }}
          onSaved={() => {
            setSheet("none");
            setMonthlyGoal(null);
            void load({ silent: true });
          }}
          onSyncError={onSyncError}
        />
      ) : null}
    </div>
  );
}

function GoalsTab({
  areas,
  goals,
  goalSkillsMap,
  sessionCounts,
  reviews,
  onOpenMonthly,
  onNewGoal,
}: {
  areas: GoalAreaRow[];
  goals: (GoalRow & { area?: GoalAreaRow | null })[];
  goalSkillsMap: Record<string, { skill: SkillRow; expected_level: string | null }[]>;
  sessionCounts: Record<string, number>;
  reviews: Record<string, GoalReviewRow>;
  onOpenMonthly: (g: GoalRow) => void;
  onNewGoal: () => void;
}) {
  const hasGoals = goals.filter((g) => g.status === "active").length > 0;
  return (
    <>
      <header className="focal-goals-hero">
        <div className="focal-goals-hero__text">
          <p className="focal-kolbs-form-kicker">Strategic learning</p>
          <h2 className="focal-goals-hero__title">Goals</h2>
          <p className="focal-goals-hero__sub">Name the outcome. Link the skills. Review with honesty.</p>
        </div>
        <button type="button" className="focal-btn primary focal-goals-hero__cta" onClick={onNewGoal}>
          New goal
        </button>
      </header>
      {!hasGoals ? (
        <p className="focal-learn-empty focal-goals-empty-prompt">Set your first goal. What are you building toward?</p>
      ) : null}
      {areas.map((area) => {
        const list = goals.filter((g) => g.goal_area_id === area.id && g.status === "active");
        if (!list.length) return null;
        return (
          <section key={area.id} className="focal-goals-area-block" style={{ borderLeftColor: area.color_tag }}>
            <h3 className="focal-goals-area-title">
              <span className="focal-goals-area-swatch" style={{ background: area.color_tag }} aria-hidden />
              {area.name}
            </h3>
            <ul className="focal-goals-ul">
              {list.map((g) => (
                <li key={g.id} className="focal-goals-card">
                  <div className="focal-goals-card-head">
                    <strong className="focal-goals-card-title">{g.title}</strong>
                    {g.timeframe_months ? <span className="focal-goals-badge">{g.timeframe_months} months</span> : null}
                  </div>
                  {g.success_metric ? <p className="focal-goals-metric">{g.success_metric}</p> : null}
                  <div className="focal-goals-tags">
                    {(goalSkillsMap[g.id] ?? []).map((gs) => (
                      <span key={gs.skill.id} className="focal-goals-skill-tag">
                        {gs.skill.name} · {gs.expected_level ?? gs.skill.current_level}
                      </span>
                    ))}
                  </div>
                  <p className="focal-goals-sessions-line">
                    Sessions this week: {Math.round((sessionCounts[g.id] ?? 0) / 60 * 10) / 10}h
                  </p>
                  {reviews[g.id]?.gemini_summary ? (
                    <p className="focal-goals-review-line">{reviews[g.id].gemini_summary?.split("\n")[0]}</p>
                  ) : null}
                  <button type="button" className="focal-btn focal-goals-monthly" onClick={() => onOpenMonthly(g)}>
                    Monthly review
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {goals.some((g) => !g.goal_area_id && g.status === "active") ? (
        <section className="focal-goals-area-block focal-goals-area-block--other">
          <h3 className="focal-goals-area-title">Other</h3>
          <ul className="focal-goals-ul">
            {goals
              .filter((g) => !g.goal_area_id && g.status === "active")
              .map((g) => (
                <li key={g.id} className="focal-goals-card">
                  <strong className="focal-goals-card-title">{g.title}</strong>
                  <button type="button" className="focal-btn focal-goals-monthly" onClick={() => onOpenMonthly(g)}>
                    Monthly review
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function NewGoalSheet({
  areas,
  skills,
  supabase,
  userId,
  onClose,
  onSaved,
  onSyncError,
}: {
  areas: GoalAreaRow[];
  skills: SkillRow[];
  supabase: ReturnType<typeof createSupabaseBrowser>;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
  onSyncError: () => void;
}) {
  const [step, setStep] = useState(1);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaColor, setNewAreaColor] = useState(PRESET_COLORS[0].v);
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [metric, setMetric] = useState("");
  const [months, setMonths] = useState(6);
  const [pickedSkills, setPickedSkills] = useState<{ id: string; level: string }[]>([]);
  const [skillSearch, setSkillSearch] = useState("");

  const save = async () => {
    let gid = areaId;
    try {
      if (!gid && newAreaName.trim()) {
        const { data: na, error } = await supabase
          .from("goal_areas")
          .insert({ user_id: userId, name: newAreaName.trim(), color_tag: newAreaColor, is_active: true })
          .select("*")
          .maybeSingle();
        if (error) throw error;
        gid = (na as GoalAreaRow).id;
      }
      const { data: goal, error: ge } = await supabase
        .from("goals")
        .insert({
          user_id: userId,
          goal_area_id: gid,
          title: title.trim(),
          why: why.trim() || null,
          success_metric: metric.trim() || null,
          timeframe_months: months,
          status: "active",
        })
        .select("*")
        .maybeSingle();
      if (ge) throw ge;
      const g = goal as GoalRow;
      if (pickedSkills.length) {
        await supabase.from("goal_skills").insert(
          pickedSkills.map((ps) => ({
            goal_id: g.id,
            skill_id: ps.id,
            expected_level: ps.level,
          }))
        );
      }
      onSaved();
    } catch {
      onSyncError();
    }
  };

  const filtered = skills.filter((s) => s.name.toLowerCase().includes(skillSearch.toLowerCase()));

  return (
    <div className="focal-sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="focal-new-goal-title" onClick={onClose}>
      <div className="focal-sheet focal-goals-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="focal-sheet-head focal-goals-sheet-head">
          <div>
            <p className="focal-kolbs-form-kicker">New commitment</p>
            <strong id="focal-new-goal-title" className="focal-goals-sheet-title">
              New goal
            </strong>
            <p className="focal-goals-step-label">
              Step {step} of 4
            </p>
          </div>
          <button type="button" className="focal-learn-text-btn" onClick={onClose}>
            Close
          </button>
        </div>
        {step === 1 ? (
          <div className="focal-sheet-body">
            <p className="focal-learn-hint">Life area</p>
            <select className="focal-learn-select" value={areaId ?? ""} onChange={(e) => setAreaId(e.target.value || null)}>
              <option value="">Create new…</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {!areaId ? (
              <>
                <input className="focal-input" placeholder="Area name" value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)} />
                <div className="focal-goals-swatches">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.v}
                      type="button"
                      title={c.label}
                      className={newAreaColor === c.v ? "active" : ""}
                      style={{ background: c.v }}
                      onClick={() => setNewAreaColor(c.v)}
                    />
                  ))}
                </div>
              </>
            ) : null}
            <button type="button" className="focal-btn primary" onClick={() => setStep(2)}>
              Next
            </button>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="focal-sheet-body">
            <label className="focal-learn-field">
              Title
              <input className="focal-input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="focal-learn-field">
              Why
              <textarea className="focal-input focal-learn-textarea" value={why} onChange={(e) => setWhy(e.target.value)} />
            </label>
            <label className="focal-learn-field">
              Success metric
              <input className="focal-input" value={metric} onChange={(e) => setMetric(e.target.value)} />
            </label>
            <label className="focal-learn-field">
              Timeframe (months)
              <input className="focal-input" type="number" min={1} max={120} value={months} onChange={(e) => setMonths(Number(e.target.value))} />
            </label>
            <button type="button" className="focal-btn" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="button" className="focal-btn primary" onClick={() => setStep(3)}>
              Next
            </button>
          </div>
        ) : null}
        {step === 3 ? (
          <div className="focal-sheet-body">
            <input className="focal-input" placeholder="Search skills" value={skillSearch} onChange={(e) => setSkillSearch(e.target.value)} />
            <div className="focal-goals-skill-pick">
              {filtered.map((s) => {
                const on = pickedSkills.find((p) => p.id === s.id);
                return (
                  <div key={s.id} className="focal-goals-skill-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(on)}
                        onChange={(e) => {
                          if (e.target.checked) setPickedSkills((p) => [...p, { id: s.id, level: "CC" }]);
                          else setPickedSkills((p) => p.filter((x) => x.id !== s.id));
                        }}
                      />{" "}
                      {s.name}
                    </label>
                    {on ? (
                      <select
                        className="focal-learn-select"
                        value={on.level}
                        onChange={(e) =>
                          setPickedSkills((p) => p.map((x) => (x.id === s.id ? { ...x, level: e.target.value } : x)))
                        }
                      >
                        {["UI", "CI", "CC", "UC"].map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <button type="button" className="focal-btn" onClick={() => setStep(2)}>
              Back
            </button>
            <button type="button" className="focal-btn primary" onClick={() => setStep(4)}>
              Next
            </button>
          </div>
        ) : null}
        {step === 4 ? (
          <div className="focal-sheet-body">
            <div className="focal-goals-confirm">
              <p>
                <strong>{title}</strong>
              </p>
              <p className="focal-learn-muted">{metric}</p>
            </div>
            <button type="button" className="focal-btn" onClick={() => setStep(3)}>
              Back
            </button>
            <button type="button" className="focal-btn primary" onClick={() => void save()}>
              Save goal
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MonthlyReviewSheet({
  goal,
  accessToken,
  supabase,
  userId,
  onClose,
  onSaved,
  onSyncError,
}: {
  goal: GoalRow;
  accessToken: string;
  supabase: ReturnType<typeof createSupabaseBrowser>;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
  onSyncError: () => void;
}) {
  const month = new Date();
  const reviewMonth = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-01`;
  const [rating, setRating] = useState(3);
  const [worked, setWorked] = useState("");
  const [didnt, setDidnt] = useState("");
  const [adjust, setAdjust] = useState("");
  const [gemini, setGemini] = useState<{ assessment: string; rootCause: string; nextMonth: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/learn/monthly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ goalId: goal.id, reviewMonth }),
      });
      const json = (await res.json()) as { error?: string; assessment?: string; rootCause?: string; nextMonth?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setGemini({
        assessment: json.assessment ?? "",
        rootCause: json.rootCause ?? "",
        nextMonth: json.nextMonth ?? "",
      });
    } catch {
      onSyncError();
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const summary = gemini ? `HONEST ASSESSMENT:\n${gemini.assessment}\n\nROOT CAUSE:\n${gemini.rootCause}\n\nNEXT MONTH:\n${gemini.nextMonth}` : null;
    try {
      await supabase.from("goal_reviews").insert({
        user_id: userId,
        goal_id: goal.id,
        review_month: reviewMonth,
        progress_rating: rating,
        what_worked: worked.trim() || null,
        what_didnt: didnt.trim() || null,
        adjustment: adjust.trim() || null,
        gemini_summary: summary,
      });
      onSaved();
    } catch {
      enqueuePending({
        id: crypto.randomUUID(),
        table: "goal_reviews",
        op: "insert",
        payload: { user_id: userId, goal_id: goal.id, review_month: reviewMonth },
        at: Date.now(),
      });
      onSyncError();
    }
  };

  return (
    <div className="focal-sheet-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="focal-sheet focal-sheet--wide focal-goals-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="focal-sheet-head focal-goals-sheet-head">
          <div>
            <p className="focal-kolbs-form-kicker">Month in review</p>
            <strong className="focal-goals-sheet-title">Monthly review</strong>
            <p className="focal-goals-monthly-goalname">{goal.title}</p>
          </div>
          <button type="button" className="focal-learn-text-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="focal-sheet-body">
          <p className="focal-learn-muted">{reviewMonth}</p>
          <label className="focal-learn-field">
            Progress (1–5)
            <input type="range" min={1} max={5} value={rating} onChange={(e) => setRating(Number(e.target.value))} />
            <span>{rating}</span>
          </label>
          <label className="focal-learn-field">
            What worked?
            <textarea className="focal-input focal-learn-textarea" value={worked} onChange={(e) => setWorked(e.target.value)} />
          </label>
          <label className="focal-learn-field">
            What didn&apos;t?
            <textarea className="focal-input focal-learn-textarea" value={didnt} onChange={(e) => setDidnt(e.target.value)} />
          </label>
          <label className="focal-learn-field">
            Adjustment next month
            <textarea className="focal-input focal-learn-textarea" value={adjust} onChange={(e) => setAdjust(e.target.value)} />
          </label>
          <button type="button" className="focal-btn" disabled={busy} onClick={() => void generate()}>
            {busy ? "…" : "Generate coaching note"}
          </button>
          {gemini ? (
            <div className="focal-monthly-gemini">
              <h4>HONEST ASSESSMENT</h4>
              <p>{gemini.assessment}</p>
              <h4>ROOT CAUSE</h4>
              <p>{gemini.rootCause}</p>
              <h4>NEXT MONTH</h4>
              <p>{gemini.nextMonth}</p>
            </div>
          ) : null}
          <button type="button" className="focal-btn primary" onClick={() => void save()}>
            Save review
          </button>
        </div>
      </div>
    </div>
  );
}

function SkillsTab({
  skills,
  goals,
  experimentsBySkill,
  kolbsBySkill,
  historyBySkill,
  supabase,
  userId,
  onSyncError,
  onReload,
}: {
  skills: SkillRow[];
  goals: GoalRow[];
  experimentsBySkill: Record<string, ExperimentRow[]>;
  kolbsBySkill: Record<string, KolbsEntryRow[]>;
  historyBySkill: Record<string, SkillLevelHistoryRow[]>;
  supabase: ReturnType<typeof createSupabaseBrowser>;
  userId: string;
  onSyncError: () => void;
  onReload: () => void | Promise<void>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [nName, setNName] = useState("");
  const [nCat, setNCat] = useState("Focus");
  const [nLev, setNLev] = useState("UI");

  const byCat = useMemo(() => {
    const m: Record<string, SkillRow[]> = {};
    for (const s of skills) {
      const c = s.ics_category || "Other";
      if (!m[c]) m[c] = [];
      m[c].push(s);
    }
    return m;
  }, [skills]);

  const goalTagsForSkill = (sid: string) => {
    return goals.filter((g) => g.status === "active");
  };

  const addSkill = async () => {
    if (!nName.trim()) return;
    try {
      await supabase.from("skills").insert({ user_id: userId, name: nName.trim(), ics_category: nCat, current_level: nLev });
      setNewOpen(false);
      setNName("");
      void onReload();
    } catch {
      onSyncError();
    }
  };

  return (
    <>
      <header className="focal-goals-hero">
        <div className="focal-goals-hero__text">
          <p className="focal-kolbs-form-kicker">Capability map</p>
          <h2 className="focal-goals-hero__title">Skill pool</h2>
          <p className="focal-goals-hero__sub">Levels, experiments, and Kolb&apos;s cycles in one place.</p>
        </div>
        <button type="button" className="focal-btn primary focal-goals-hero__cta" onClick={() => setNewOpen((o) => !o)}>
          New skill
        </button>
      </header>
      {newOpen ? (
        <div className="focal-goals-inline-new">
          <input className="focal-input" placeholder="Name" value={nName} onChange={(e) => setNName(e.target.value)} />
          <select className="focal-learn-select" value={nCat} onChange={(e) => setNCat(e.target.value)}>
            {["Time management", "Procrastination", "Note-taking", "Revision", "Focus", "Mindset", "Other"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select className="focal-learn-select" value={nLev} onChange={(e) => setNLev(e.target.value)}>
            {["UI", "CI", "CC", "UC"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button type="button" className="focal-btn primary" onClick={() => void addSkill()}>
            Save
          </button>
        </div>
      ) : null}
      {skills.length === 0 ? (
        <p className="focal-learn-empty">No skills tracked yet. Add your first skill or start a Kolb&apos;s reflection.</p>
      ) : null}
      {Object.entries(byCat).map(([cat, list]) => (
        <section key={cat} className="focal-goals-area-block">
          <h3 className="focal-learn-h">{cat}</h3>
          <ul className="focal-skills-ul">
            {list.map((s) => (
              <li key={s.id} className="focal-skill-row">
                <button type="button" className="focal-skill-row-btn" onClick={() => setExpanded((e) => (e === s.id ? null : s.id))}>
                  <span>{s.name}</span>
                  <span className={`focal-level-badge lvl-${s.current_level}`}>{s.current_level}</span>
                  <span className="focal-skill-spark">{(historyBySkill[s.id] ?? []).length} levels</span>
                </button>
                {expanded === s.id ? (
                  <div className="focal-skill-expand">
                    <p className="focal-learn-muted">Kolb&apos;s cycles: {(kolbsBySkill[s.id] ?? []).length}</p>
                    <ul className="focal-skill-exp-list">
                      {(experimentsBySkill[s.id] ?? []).map((e) => (
                        <li key={e.id}>
                          {e.description.slice(0, 80)} — {e.status}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="focal-btn"
                      onClick={() => {
                        const nl = window.prompt("New level UI/CI/CC/UC", s.current_level);
                        if (!nl || !["UI", "CI", "CC", "UC"].includes(nl.toUpperCase())) return;
                        const note = window.prompt("Note (optional)") ?? "";
                        void (async () => {
                          try {
                            await supabase.from("skill_level_history").insert({
                              user_id: userId,
                              skill_id: s.id,
                              level: nl.toUpperCase(),
                              note: note || null,
                            });
                            await supabase.from("skills").update({ current_level: nl.toUpperCase() }).eq("id", s.id);
                            void onReload();
                          } catch {
                            onSyncError();
                          }
                        })();
                      }}
                    >
                      Update level
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
