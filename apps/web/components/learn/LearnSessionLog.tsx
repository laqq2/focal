"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FocusLogRow, SessionLogRow } from "@focal/shared";
import type { createSupabaseBrowser } from "@/lib/supabase-browser";
import { enqueuePending } from "@/lib/sync";
import { todayIsoLocal } from "@/lib/sync";
import { addDaysIso, weekStartMondayLocal } from "@/lib/learn-dates";
import { FocusHistoryCard } from "@/components/FocusHistoryCard";

const GOAL_HIT = ["yes", "partial", "no"] as const;

export function LearnSessionLog({
  supabase,
  userId,
  focusLogs,
  onFocusLogUpdated,
  onSyncError,
}: {
  supabase: ReturnType<typeof createSupabaseBrowser>;
  userId: string;
  focusLogs: FocusLogRow[];
  onFocusLogUpdated: (row: FocusLogRow) => void;
  onSyncError: () => void;
}) {
  const today = todayIsoLocal();
  const weekStart = weekStartMondayLocal(new Date());
  const weekEnd = addDaysIso(weekStart, 6);

  const [sessions, setSessions] = useState<SessionLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [durationMins, setDurationMins] = useState(25);
  const [focusQuality, setFocusQuality] = useState(3);
  const [sessionGoal, setSessionGoal] = useState("");
  const [goalHit, setGoalHit] = useState<(typeof GOAL_HIT)[number] | "">("");
  const [distractions, setDistractions] = useState("");
  const [sessionType, setSessionType] = useState<"theory" | "practice">("practice");
  const [timerRun, setTimerRun] = useState(false);
  const [timerSec, setTimerSec] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("session_logs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setSessions((data as SessionLogRow[]) ?? []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!timerRun) return;
    const id = window.setInterval(() => setTimerSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [timerRun]);

  const recents = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of sessions) {
      const t = s.subject?.trim();
      if (t && !seen.has(t)) {
        seen.add(t);
        out.push(t);
        if (out.length >= 8) break;
      }
    }
    return out;
  }, [sessions]);

  const todaySessions = useMemo(() => sessions.filter((s) => s.date === today), [sessions, today]);

  const todayMins = useMemo(() => todaySessions.reduce((a, s) => a + s.duration_mins, 0), [todaySessions]);

  const weekSessions = useMemo(
    () => sessions.filter((s) => s.date >= weekStart && s.date <= weekEnd),
    [sessions, weekStart, weekEnd]
  );

  const dayTotals = useMemo(() => {
    const m: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      m[addDaysIso(weekStart, i)] = 0;
    }
    for (const s of weekSessions) {
      m[s.date] = (m[s.date] ?? 0) + s.duration_mins;
    }
    return m;
  }, [weekSessions, weekStart]);

  const { theoryM, practiceM, ratioLabel, ratioWarn } = useMemo(() => {
    let theoryM = 0;
    let practiceM = 0;
    for (const s of weekSessions) {
      if (s.session_type === "theory") theoryM += s.duration_mins;
      else practiceM += s.duration_mins;
    }
    const ratio = theoryM > 0 ? practiceM / theoryM : practiceM > 0 ? Infinity : 0;
    const ratioLabel =
      theoryM === 0 && practiceM === 0 ? "—" : theoryM === 0 ? "∞ : 1" : `${(practiceM / theoryM).toFixed(1)} : 1`;
    const ratioWarn = theoryM > 0 && practiceM / theoryM < 5;
    return { theoryM, practiceM, ratioLabel, ratioWarn };
  }, [weekSessions]);

  const submitSession = async () => {
    if (!subject.trim() || !goalHit) return;
    const mins = timerRun ? Math.max(1, Math.round(timerSec / 60)) : Math.max(1, Math.round(durationMins));
    const row = {
      user_id: userId,
      date: today,
      subject: subject.trim(),
      duration_mins: mins,
      focus_quality: focusQuality,
      session_goal: sessionGoal.trim() || null,
      goal_hit: goalHit,
      distractions: distractions.trim() || null,
      session_type: sessionType,
    };
    try {
      const { data, error } = await supabase.from("session_logs").insert(row).select("*").maybeSingle();
      if (error) throw error;
      if (data) setSessions((prev) => [data as SessionLogRow, ...prev]);
      setSubject("");
      setSessionGoal("");
      setGoalHit("");
      setDistractions("");
      setTimerRun(false);
      setTimerSec(0);
      setDurationMins(25);
    } catch {
      enqueuePending({
        id: crypto.randomUUID(),
        table: "session_logs",
        op: "insert",
        payload: row,
        at: Date.now(),
      });
      onSyncError();
    }
  };

  const maxDay = Math.max(1, ...Object.values(dayTotals));

  return (
    <div className="focal-learn-page focal-learn-fade">
      <section className="focal-learn-section">
        <h3 className="focal-learn-h">Log a session</h3>
        <p className="focal-learn-hint">Measurable goal, then honest close-out.</p>
        <div className="focal-learn-form">
          <label className="focal-learn-field">
            Subject / project
            <input
              className="focal-input focal-learn-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What did you work on?"
              autoFocus
            />
          </label>
          {recents.length ? (
            <div className="focal-learn-chips">
              {recents.map((r) => (
                <button key={r} type="button" className="focal-learn-chip" onClick={() => setSubject(r)}>
                  {r}
                </button>
              ))}
            </div>
          ) : null}

          <div className="focal-learn-row2">
            <label className="focal-learn-field">
              Minutes
              <input
                className="focal-input focal-learn-input"
                type="number"
                min={1}
                max={720}
                disabled={timerRun}
                value={timerRun ? Math.max(1, Math.round(timerSec / 60)) : durationMins}
                onChange={(e) => setDurationMins(Number(e.target.value))}
              />
            </label>
            <div className="focal-learn-timer-block">
              <span className="focal-learn-muted">Timer</span>
              <button
                type="button"
                className={`focal-learn-timer-btn ${timerRun ? "on" : ""}`}
                onClick={() => {
                  if (timerRun) {
                    setTimerRun(false);
                  } else {
                    setTimerSec(0);
                    setTimerRun(true);
                  }
                }}
              >
                {timerRun ? `Stop (${Math.floor(timerSec / 60)}:${String(timerSec % 60).padStart(2, "0")})` : "Start"}
              </button>
            </div>
          </div>

          <label className="focal-learn-field">
            Focus quality (1–5)
            <input
              type="range"
              min={1}
              max={5}
              value={focusQuality}
              onChange={(e) => setFocusQuality(Number(e.target.value))}
            />
            <span className="focal-learn-muted">{focusQuality}</span>
          </label>

          <label className="focal-learn-field">
            Session goal (ICS: measurable, action-based)
            <input
              className="focal-input focal-learn-input"
              value={sessionGoal}
              onChange={(e) => setSessionGoal(e.target.value)}
              placeholder="e.g. Finish 10 flashcards with recall"
            />
          </label>

          <label className="focal-learn-field">
            Hit the goal?
            <select className="focal-learn-select" value={goalHit} onChange={(e) => setGoalHit(e.target.value as typeof goalHit)}>
              <option value="">—</option>
              {GOAL_HIT.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>

          <label className="focal-learn-field">
            Distractions (optional)
            <input className="focal-input focal-learn-input" value={distractions} onChange={(e) => setDistractions(e.target.value)} />
          </label>

          <div className="focal-learn-theory-row">
            <span className="focal-learn-muted">Type</span>
            <div className="focal-learn-toggle">
              <button type="button" className={sessionType === "theory" ? "active" : ""} onClick={() => setSessionType("theory")}>
                Theory
              </button>
              <button type="button" className={sessionType === "practice" ? "active" : ""} onClick={() => setSessionType("practice")}>
                Practice
              </button>
            </div>
          </div>

          <button
            type="button"
            className="focal-btn primary"
            disabled={!subject.trim() || !goalHit}
            onClick={() => void submitSession()}
            onKeyDown={(e) => {
              if (e.key === "Enter" && subject.trim() && goalHit) void submitSession();
            }}
          >
            Save session
          </button>
        </div>
      </section>

      <section className="focal-learn-section">
        <h3 className="focal-learn-h">Today</h3>
        <p className="focal-learn-stat-line">
          <strong>{(todayMins / 60).toFixed(1)}</strong> hours focused today (study sessions)
        </p>
        {loading ? (
          <p className="focal-learn-muted">Loading…</p>
        ) : todaySessions.length === 0 ? (
          <p className="focal-learn-empty">No sessions yet today. What are you working on?</p>
        ) : (
          <ul className="focal-learn-session-list">
            {todaySessions.map((s) => (
              <li key={s.id} className="focal-learn-session-item">
                <div className="focal-learn-session-top">
                  <span>{s.subject}</span>
                  <span className="focal-learn-muted">
                    {s.duration_mins}m · Q{s.focus_quality} · {s.session_type}
                  </span>
                </div>
                {s.session_goal ? <p className="focal-learn-session-goal">{s.session_goal}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="focal-learn-section">
        <h3 className="focal-learn-h">This week</h3>
        <p className="focal-learn-muted">
          Practice : theory (mins) — {practiceM} : {theoryM}. Target at least <strong>5 : 1</strong> practice to theory.
        </p>
        <p className={`focal-learn-ratio ${ratioWarn ? "warn" : ""}`}>
          Current ratio {ratioLabel}
          {ratioWarn ? " — add more deliberate practice before more theory." : ""}
        </p>
        <div className="focal-learn-bars" role="img" aria-label="Hours per day this week">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDaysIso(weekStart, i);
            const mins = dayTotals[d] ?? 0;
            const h = maxDay ? (mins / maxDay) * 100 : 0;
            const label = new Date(d + "T12:00:00");
            const dow = label.toLocaleDateString(undefined, { weekday: "short" });
            return (
              <div key={d} className="focal-learn-bar-wrap">
                <div className="focal-learn-bar-track">
                  <div className="focal-learn-bar-fill" style={{ height: `${h}%` }} />
                </div>
                <span className="focal-learn-bar-label">{dow}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="focal-learn-section">
        <h3 className="focal-learn-h">Focal focus archive</h3>
        <p className="focal-learn-hint">Sessions from the built-in focus timer.</p>
        {focusLogs.length === 0 ? (
          <p className="focal-learn-empty">Completed focus sessions will appear here.</p>
        ) : (
          <div className="focal-obs-archive-list">
            {focusLogs.map((log) => (
              <FocusHistoryCard key={log.id} log={log} supabase={supabase} onUpdated={onFocusLogUpdated} onSyncError={onSyncError} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
