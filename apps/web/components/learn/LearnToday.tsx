"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DailyPrioritiesRow,
  EisenhowerQuadrant,
  EodResult,
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
  } as DailyPrioritiesRow;
}

export function LearnToday({
  supabase,
  userId,
  displayName,
  clock,
  onSyncError,
  onUpdated,
}: {
  supabase: ReturnType<typeof createSupabaseBrowser>;
  userId: string;
  displayName: string;
  clock: Date;
  onSyncError: () => void;
  onUpdated: () => void;
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

  useEffect(() => {
    void load();
  }, [load]);

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
    return <p className="focal-learn-muted">Loading today…</p>;
  }

  const r = row;

  return (
    <div className="focal-learn-page focal-learn-fade">
      <h2 className="focal-learn-greeting">
        Good {greeting}, {displayName}
      </h2>

      <section className="focal-learn-section">
        <h3 className="focal-learn-h">Priorities</h3>
        <div className={`focal-learn-priority-grid ${disruptionUi ? "focal-learn-priority-grid--dim" : ""}`}>
          {[1, 2].map((n) => {
            const title = n === 1 ? r.priority_1_title : r.priority_2_title;
            const mvg = n === 1 ? r.priority_1_mvg : r.priority_2_mvg;
            const quad = (n === 1 ? r.priority_1_quadrant : r.priority_2_quadrant) as EisenhowerQuadrant;
            const st = (n === 1 ? r.priority_1_status : r.priority_2_status) as PriorityStatus;
            const set = (patch: Partial<DailyPrioritiesRow>) => void persist(patch);
            return (
              <div key={n} className="focal-learn-card">
                <div className="focal-learn-priority-head">
                  <span className="focal-learn-priority-label">Priority {n}</span>
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

      <section className="focal-learn-section">
        <h3 className="focal-learn-h">Important · not urgent</h3>
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

      <section className="focal-learn-section">
        <div className="focal-learn-eod-head">
          <h3 className="focal-learn-h">End of day check-in</h3>
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
                className="focal-btn primary focal-learn-eod-submit"
                disabled={!eodP1 || !eodP2 || !nextP1.trim() || !nextP2.trim()}
                onClick={() => void submitEod()}
              >
                Save check-in (&lt;60s)
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
