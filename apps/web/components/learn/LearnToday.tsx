"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DailyPrioritiesRow,
  EisenhowerQuadrant,
  EodResult,
  ExperimentRow,
  GoalRow,
  PriorityStatus,
} from "@focal/shared";
import { EISENHOWER_LABELS } from "@focal/shared";
import type { createSupabaseBrowser } from "@/lib/supabase-browser";
import { enqueuePending } from "@/lib/sync";
import { addDaysIso, localIsoDate, timeGreeting } from "@/lib/learn-dates";
import { todayIsoLocal } from "@/lib/sync";

const QUADS: EisenhowerQuadrant[] = ["IU", "INU", "NIU", "NINU"];
const STATUSES: PriorityStatus[] = ["not_started", "in_progress", "done"];
const EOD_OPTS: EodResult[] = ["yes", "partial", "no"];

function emptyRow(userId: string, date: string): DailyPrioritiesRow {
  return {
    user_id: userId,
    date,
    priority_1_title: "",
    priority_1_mvg: "",
    priority_1_quadrant: "INU",
    priority_1_status: "not_started",
    priority_2_title: "",
    priority_2_mvg: "",
    priority_2_quadrant: "INU",
    priority_2_status: "not_started",
    disruption_mode_activated: false,
    important_not_urgent_task: "",
    important_not_urgent_scheduled: false,
    off_track_reason: "",
    eod_p1_result: null,
    eod_p2_result: null,
    eod_completed_at: null,
    priority_1_goal_id: null,
    priority_2_goal_id: null,
    experiment_notes: null,
  } as DailyPrioritiesRow;
}

export function LearnToday({
  supabase,
  userId,
  displayName,
  clock,
  onSyncError,
  onUpdated,
  onOpenKolbs,
}: {
  supabase: ReturnType<typeof createSupabaseBrowser>;
  userId: string;
  displayName: string;
  clock: Date;
  onSyncError: () => void;
  onUpdated: () => void;
  onOpenKolbs?: () => void;
}) {
  const today = todayIsoLocal();
  const tomorrow = addDaysIso(today, 1);
  const hour = clock.getHours();
  const [row, setRow] = useState<DailyPrioritiesRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [disruptionUi, setDisruptionUi] = useState(false);
  const [eodOpen, setEodOpen] = useState(false);

  const [eodP1, setEodP1] = useState<EodResult | "">("");
  const [eodP2, setEodP2] = useState<EodResult | "">("");
  const [eodOff, setEodOff] = useState("");
  const [nextP1, setNextP1] = useState("");
  const [nextP2, setNextP2] = useState("");
  const [eodExperimentNotes, setEodExperimentNotes] = useState("");
  const [activeGoals, setActiveGoals] = useState<GoalRow[]>([]);
  const [testingEx, setTestingEx] = useState<(ExperimentRow & { skill?: { name: string } | null })[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("daily_priorities")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();
      if (error) throw error;
      const r = (data as DailyPrioritiesRow) || emptyRow(userId, today);
      setRow(r);
      setDisruptionUi(false);
      if (data) {
        setEodP1((data.eod_p1_result as EodResult) || "");
        setEodP2((data.eod_p2_result as EodResult) || "");
        setEodOff(data.off_track_reason || "");
        setEodExperimentNotes((data as DailyPrioritiesRow).experiment_notes || "");
      }
      const { data: trow } = await supabase
        .from("daily_priorities")
        .select("priority_1_title,priority_2_title")
        .eq("user_id", userId)
        .eq("date", tomorrow)
        .maybeSingle();
      if (trow) {
        setNextP1(trow.priority_1_title || "");
        setNextP2(trow.priority_2_title || "");
      }
    } catch {
      setRow(emptyRow(userId, today));
    } finally {
      setLoading(false);
    }
  }, [supabase, userId, today, tomorrow]);

  const loadGoalsExperiments = useCallback(async () => {
    try {
      const [{ data: g }, { data: ex }] = await Promise.all([
        supabase.from("goals").select("*").eq("user_id", userId).eq("status", "active").order("title"),
        supabase.from("experiments").select("*, skill:skills(name)").eq("user_id", userId).eq("status", "testing").limit(12),
      ]);
      setActiveGoals((g as GoalRow[]) ?? []);
      setTestingEx((ex as typeof testingEx) ?? []);
    } catch {
      setActiveGoals([]);
      setTestingEx([]);
    }
  }, [supabase, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadGoalsExperiments();
  }, [loadGoalsExperiments]);

  useEffect(() => {
    if (hour >= 19) setEodOpen(true);
  }, [hour]);

  const persist = async (patch: Partial<DailyPrioritiesRow> & { date?: string }) => {
    const base = row ?? emptyRow(userId, today);
    const next = { ...base, ...patch, user_id: userId, date: patch.date ?? base.date, updated_at: new Date().toISOString() };
    setRow(next);
    try {
      const payload: Record<string, unknown> = { ...next };
      if (!next.id) delete payload.id;
      const { data, error } = await supabase
        .from("daily_priorities")
        .upsert(payload, { onConflict: "user_id,date" })
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (data) setRow(data as DailyPrioritiesRow);
      onUpdated();
    } catch {
      enqueuePending({
        id: crypto.randomUUID(),
        table: "daily_priorities",
        op: "upsert",
        payload: next,
        at: Date.now(),
      });
      onSyncError();
    }
  };

  const greeting = useMemo(() => timeGreeting(hour), [hour]);
  const showEod = hour >= 19 || eodOpen;
  const eodDone = Boolean(row?.eod_completed_at);

  const submitEod = async () => {
    if (!eodP1 || !eodP2 || !nextP1.trim() || !nextP2.trim()) return;
    const now = new Date().toISOString();
    await persist({
      eod_p1_result: eodP1,
      eod_p2_result: eodP2,
      off_track_reason: eodOff.trim() || null,
      eod_completed_at: now,
      experiment_notes: eodExperimentNotes.trim() || null,
    });
    await supabase.from("daily_priorities").upsert(
      {
        user_id: userId,
        date: tomorrow,
        priority_1_title: nextP1.trim(),
        priority_2_title: nextP2.trim(),
        updated_at: now,
      },
      { onConflict: "user_id,date" }
    );
    await load();
  };

  const toggleDisruption = () => {
    const next = !disruptionUi;
    setDisruptionUi(next);
    if (next) void persist({ disruption_mode_activated: true });
    /* Exit is UI-only so the day still counts as a disruption in weekly data. */
  };

  if (loading || !row) {
    return (
      <div className="focal-learn-page focal-learn-fade focal-learn-today-boot" aria-busy="true">
        <div className="focal-goals-skeleton">
          <div className="focal-kolbs-skeleton-line" style={{ width: "50%" }} />
          <div className="focal-kolbs-skeleton-line" style={{ width: "85%" }} />
          <div className="focal-kolbs-skeleton-block" />
          <div className="focal-kolbs-skeleton-block focal-kolbs-skeleton-block--short" />
        </div>
      </div>
    );
  }

  const r = row;
  const timeLabel = clock.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <div className="focal-learn-page focal-learn-fade">
      <header className="focal-learn-hero">
        <p className="focal-learn-hero__kicker">Command center</p>
        <h2 className="focal-learn-hero__title">
          Good {greeting}, {displayName}
        </h2>
        <p className="focal-learn-hero__meta">{timeLabel}</p>
      </header>

      <section className="focal-learn-section focal-learn-section--anchor">
        <div className="focal-learn-section-head">
          <span className="focal-learn-section-eyebrow">Focus</span>
          <h3 className="focal-learn-section-title">Two priorities</h3>
        </div>
        <p className="focal-learn-hint focal-learn-hint--tight">Name what moves the needle. MVG is your floor, not the ceiling.</p>
        <div className={`focal-learn-priority-grid ${disruptionUi ? "focal-learn-priority-grid--dim" : ""}`}>
          {[1, 2].map((n) => {
            const title = n === 1 ? r.priority_1_title : r.priority_2_title;
            const mvg = n === 1 ? r.priority_1_mvg : r.priority_2_mvg;
            const quad = (n === 1 ? r.priority_1_quadrant : r.priority_2_quadrant) as EisenhowerQuadrant;
            const st = (n === 1 ? r.priority_1_status : r.priority_2_status) as PriorityStatus;
            const set = (patch: Partial<DailyPrioritiesRow>) => void persist(patch);
            return (
              <div
                key={n}
                className={`focal-learn-card focal-learn-priority-card ${n === 1 ? "focal-learn-priority-card--p1" : "focal-learn-priority-card--p2"}`}
              >
                <div className="focal-learn-priority-head">
                  <div className="focal-learn-priority-label-row">
                    <span className="focal-learn-priority-label">Priority {n}</span>
                    <span className={`focal-learn-quad-badge focal-learn-quad-badge--${quad}`} title={EISENHOWER_LABELS[quad]}>
                      {quad}
                    </span>
                  </div>
                  <select
                    className="focal-learn-select"
                    value={st}
                    onChange={(e) =>
                      set(
                        n === 1
                          ? { priority_1_status: e.target.value as PriorityStatus }
                          : { priority_2_status: e.target.value as PriorityStatus }
                      )
                    }
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                {disruptionUi ? (
                  <p className="focal-learn-mvg-only">{mvg?.trim() || "— set an MVG above"}</p>
                ) : (
                  <>
                    <label className="focal-learn-field">
                      Title
                      <input
                        className="focal-input focal-learn-input"
                        value={title ?? ""}
                        autoFocus={n === 1}
                        onChange={(e) =>
                          set(n === 1 ? { priority_1_title: e.target.value } : { priority_2_title: e.target.value })
                        }
                        placeholder="What matters today?"
                      />
                    </label>
                    <label className="focal-learn-field">
                      Quadrant
                      <select
                        className="focal-learn-select"
                        value={quad || "INU"}
                        onChange={(e) =>
                          set(
                            n === 1
                              ? { priority_1_quadrant: e.target.value as EisenhowerQuadrant }
                              : { priority_2_quadrant: e.target.value as EisenhowerQuadrant }
                          )
                        }
                      >
                        {QUADS.map((q) => (
                          <option key={q} value={q}>
                            {EISENHOWER_LABELS[q]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="focal-learn-field">
                      MVG
                      <input
                        className="focal-input focal-learn-input"
                        value={mvg ?? ""}
                        onChange={(e) =>
                          set(n === 1 ? { priority_1_mvg: e.target.value } : { priority_2_mvg: e.target.value })
                        }
                        placeholder="Minimum if the day collapses"
                      />
                    </label>
                    <label className="focal-learn-field">
                      Link to goal (optional)
                      <select
                        className="focal-learn-select"
                        value={(n === 1 ? r.priority_1_goal_id : r.priority_2_goal_id) ?? ""}
                        onChange={(e) =>
                          set(
                            n === 1
                              ? { priority_1_goal_id: e.target.value || null }
                              : { priority_2_goal_id: e.target.value || null }
                          )
                        }
                      >
                        <option value="">—</option>
                        {activeGoals.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {disruptionUi ? (
          <p className="focal-learn-disruption-msg">Stripped to essentials. Just do the MVG.</p>
        ) : null}

        <button type="button" className={`focal-learn-disruption-btn ${disruptionUi ? "active" : ""}`} onClick={toggleDisruption}>
          {disruptionUi ? "Exit disruption mode" : "Disruption mode"}
        </button>
      </section>

      {testingEx.length > 0 ? (
        <section className="focal-learn-section focal-learn-experiments-today">
          <div className="focal-learn-eod-head">
            <div>
              <span className="focal-learn-section-eyebrow">Experiments</span>
              <h3 className="focal-learn-section-title focal-learn-section-title--sm">Currently testing</h3>
            </div>
            <button type="button" className="focal-learn-text-btn" onClick={() => onOpenKolbs?.()}>
              See all in Kolb&apos;s
            </button>
          </div>
          <ul className="focal-today-ex-list">
            {testingEx.slice(0, 3).map((ex) => (
              <li key={ex.id}>
                <button type="button" className="focal-today-ex-row" onClick={() => onOpenKolbs?.()}>
                  <span className="focal-level-badge subtle">{ex.skill?.name ?? "Skill"}</span>
                  <span className="focal-today-ex-desc">{ex.description.length > 90 ? `${ex.description.slice(0, 90)}…` : ex.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="focal-learn-section focal-learn-section-panel focal-learn-section-panel--inu">
        <div className="focal-learn-section-head">
          <span className="focal-learn-section-eyebrow">Quadrant II</span>
          <h3 className="focal-learn-section-title">Important · not urgent</h3>
        </div>
        <p className="focal-learn-hint">Protect one non-urgent important block this week.</p>
        <label className="focal-learn-check">
          <input
            type="checkbox"
            checked={r.important_not_urgent_scheduled}
            onChange={(e) => void persist({ important_not_urgent_scheduled: e.target.checked })}
          />
          <span>Scheduled this week</span>
        </label>
        <label className="focal-learn-field">
          Task
          <input
            className="focal-input focal-learn-input"
            value={r.important_not_urgent_task ?? ""}
            onChange={(e) => void persist({ important_not_urgent_task: e.target.value })}
            placeholder="e.g. Deep reading block Thursday 7am"
          />
        </label>
      </section>

      <section className="focal-learn-section focal-learn-section-panel focal-learn-section-panel--eod">
        <div className="focal-learn-eod-head">
          <div>
            <span className="focal-learn-section-eyebrow">Closure</span>
            <h3 className="focal-learn-section-title">End of day check-in</h3>
          </div>
          {hour < 19 ? (
            <button type="button" className="focal-learn-text-btn" onClick={() => setEodOpen((o) => !o)}>
              {showEod ? "Hide" : "Open now"}
            </button>
          ) : null}
        </div>
        {showEod ? (
          eodDone ? (
            <p className="focal-learn-muted">Check-in saved for {localIsoDate(clock)}.</p>
          ) : (
            <div className="focal-learn-eod">
              <label className="focal-learn-field">
                Priority 1 — done?
                <select className="focal-learn-select" value={eodP1} onChange={(e) => setEodP1(e.target.value as EodResult)}>
                  <option value="">—</option>
                  {EOD_OPTS.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </label>
              <label className="focal-learn-field">
                Priority 2 — done?
                <select className="focal-learn-select" value={eodP2} onChange={(e) => setEodP2(e.target.value as EodResult)}>
                  <option value="">—</option>
                  {EOD_OPTS.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </label>
              <label className="focal-learn-field">
                What pulled you off track? (optional)
                <input className="focal-input focal-learn-input" value={eodOff} onChange={(e) => setEodOff(e.target.value)} />
              </label>
              <label className="focal-learn-field">
                Any experiment observations today? (optional)
                <textarea
                  className="focal-input focal-learn-textarea"
                  rows={2}
                  value={eodExperimentNotes}
                  onChange={(e) => setEodExperimentNotes(e.target.value)}
                />
              </label>
              <label className="focal-learn-field">
                Tomorrow priority 1
                <input
                  className="focal-input focal-learn-input"
                  value={nextP1}
                  onChange={(e) => setNextP1(e.target.value)}
                  placeholder="Sets tomorrow’s first priority"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                />
              </label>
              <label className="focal-learn-field">
                Tomorrow priority 2
                <input className="focal-input focal-learn-input" value={nextP2} onChange={(e) => setNextP2(e.target.value)} />
              </label>
              <button
                type="button"
                className="focal-btn primary focal-learn-eod-submit focal-learn-seal-day"
                disabled={!eodP1 || !eodP2 || !nextP1.trim() || !nextP2.trim()}
                onClick={() => void submitEod()}
              >
                Seal the day
              </button>
            </div>
          )
        ) : (
          <p className="focal-learn-muted">Opens after 7pm or when you choose.</p>
        )}
      </section>
    </div>
  );
}
