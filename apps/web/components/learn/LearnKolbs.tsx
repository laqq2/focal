"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { KolbsEntryRow } from "@focal/shared";
import type { createSupabaseBrowser } from "@/lib/supabase-browser";
import { enqueuePending } from "@/lib/sync";
import { computeKolbStreak, weekStartMondayLocal } from "@/lib/learn-dates";

const TAGS = [
  "Time management",
  "Procrastination",
  "Note-taking",
  "Revision",
  "Focus",
  "Mindset",
  "Other",
];

export function LearnKolbs({
  supabase,
  userId,
  onSyncError,
}: {
  supabase: ReturnType<typeof createSupabaseBrowser>;
  userId: string;
  onSyncError: () => void;
}) {
  const weekStart = weekStartMondayLocal(new Date());
  const [entries, setEntries] = useState<KolbsEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [experience, setExperience] = useState("");
  const [observations, setObservations] = useState("");
  const [learnings, setLearnings] = useState("");
  const [experiment, setExperiment] = useState("");
  const [tag, setTag] = useState<string>("Focus");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("kolbs_entries")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      setEntries((data as KolbsEntryRow[]) ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const streak = useMemo(() => computeKolbStreak(entries.map((e) => e.week_start_date)), [entries]);

  const save = async () => {
    if (!experience.trim() && !observations.trim() && !learnings.trim() && !experiment.trim()) return;
    const row = {
      user_id: userId,
      week_start_date: weekStart,
      experience: experience.trim(),
      observations: observations.trim(),
      learnings: learnings.trim(),
      experiment: experiment.trim(),
      ics_technique_tag: tag === "Other" ? "Other" : tag,
    };
    try {
      const { data, error } = await supabase.from("kolbs_entries").insert(row).select("*").maybeSingle();
      if (error) throw error;
      if (data) {
        setEntries((prev) => [data as KolbsEntryRow, ...prev]);
        setExperience("");
        setObservations("");
        setLearnings("");
        setExperiment("");
      }
    } catch {
      enqueuePending({
        id: crypto.randomUUID(),
        table: "kolbs_entries",
        op: "insert",
        payload: row,
        at: Date.now(),
      });
      onSyncError();
    }
  };

  return (
    <div className="focal-learn-page focal-learn-fade">
      <div className="focal-learn-streak-row">
        <span className="focal-learn-streak-label">Week streak</span>
        <span className="focal-learn-streak-val">{streak} week{streak === 1 ? "" : "s"}</span>
      </div>

      <section className="focal-learn-section">
        <h3 className="focal-learn-h">This week&apos;s loop</h3>
        <p className="focal-learn-hint">Week of {weekStart} · add another entry anytime.</p>

        <label className="focal-learn-field">
          Technique (optional)
          <select className="focal-learn-select" value={tag} onChange={(e) => setTag(e.target.value)}>
            {TAGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="focal-learn-field">
          1 · Experience — what did you actually do?
          <textarea className="focal-input focal-learn-textarea" value={experience} onChange={(e) => setExperience(e.target.value)} rows={3} />
        </label>
        <label className="focal-learn-field">
          2 · Observe — what happened?
          <textarea className="focal-input focal-learn-textarea" value={observations} onChange={(e) => setObservations(e.target.value)} rows={3} />
        </label>
        <label className="focal-learn-field">
          3 · Learn — what principle emerges?
          <textarea className="focal-input focal-learn-textarea" value={learnings} onChange={(e) => setLearnings(e.target.value)} rows={3} />
        </label>
        <label className="focal-learn-field">
          4 · Experiment — what will you try next week?
          <textarea className="focal-input focal-learn-textarea" value={experiment} onChange={(e) => setExperiment(e.target.value)} rows={3} />
        </label>

        <button type="button" className="focal-btn primary" onClick={() => void save()}>
          Save entry
        </button>
      </section>

      <section className="focal-learn-section">
        <h3 className="focal-learn-h">Past entries</h3>
        {loading ? (
          <p className="focal-learn-muted">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="focal-learn-empty">Your reflections will stack here — start with one honest paragraph.</p>
        ) : (
          <div className="focal-learn-kolb-list">
            {entries.map((e) => (
              <details key={e.id} className="focal-learn-kolb-item">
                <summary>
                  <span>{e.week_start_date}</span>
                  <span className="focal-learn-muted">{e.ics_technique_tag ?? ""}</span>
                </summary>
                <div className="focal-learn-kolb-body">
                  <p>
                    <strong>Experience</strong> {e.experience}
                  </p>
                  <p>
                    <strong>Observe</strong> {e.observations}
                  </p>
                  <p>
                    <strong>Learn</strong> {e.learnings}
                  </p>
                  <p>
                    <strong>Experiment</strong> {e.experiment}
                  </p>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
