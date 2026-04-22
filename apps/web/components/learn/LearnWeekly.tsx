"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { WeeklySummaryRow } from "@focal/shared";
import type { createSupabaseBrowser } from "@/lib/supabase-browser";
import { parseWeeklyGeminiResponse } from "@/lib/learn-weekly-parse";
import { weekStartMondayLocal } from "@/lib/learn-dates";

export function LearnWeekly({
  supabase,
  accessToken,
  onSyncError,
}: {
  supabase: ReturnType<typeof createSupabaseBrowser>;
  accessToken: string | null;
  onSyncError: () => void;
}) {
  const [rows, setRows] = useState<WeeklySummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const thisWeek = weekStartMondayLocal(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("weekly_summaries").select("*").order("week_start_date", { ascending: false }).limit(24);
      if (error) throw error;
      setRows((data as WeeklySummaryRow[]) ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = useMemo(() => rows.find((r) => r.week_start_date === thisWeek) ?? null, [rows, thisWeek]);

  const generate = async (weekStart: string) => {
    if (!accessToken) {
      setErr("Sign in required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/learn/weekly-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ weekStartDate: weekStart }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      setErr(msg);
      onSyncError();
    } finally {
      setBusy(false);
    }
  };

  const renderSummary = (text: string) => {
    const sec = parseWeeklyGeminiResponse(text);
    const hasExp = sec.experimentCheck.trim().length > 0 && !/^\(none\)$/i.test(sec.experimentCheck.trim());
    return (
      <div className="focal-learn-weekly-structured">
        <section className="focal-learn-summary-block">
          <h4 className="focal-learn-summary-label">Patterns</h4>
          <p>{sec.patterns || sec.raw}</p>
        </section>
        {hasExp ? (
          <section className="focal-learn-summary-block focal-learn-summary-block--accent">
            <h4 className="focal-learn-summary-label">Experiment check</h4>
            <p>{sec.experimentCheck}</p>
          </section>
        ) : null}
        <section className="focal-learn-summary-block">
          <h4 className="focal-learn-summary-label">Lever</h4>
          <p>{sec.lever}</p>
        </section>
        <section className="focal-learn-summary-block">
          <h4 className="focal-learn-summary-label">Question</h4>
          <p>{sec.question}</p>
        </section>
      </div>
    );
  };

  return (
    <div className="focal-learn-page focal-learn-fade">
      <header className="focal-learn-hero">
        <p className="focal-learn-hero__kicker">Synthesis</p>
        <h2 className="focal-learn-hero__title">Weekly review</h2>
        <p className="focal-learn-hero__sub">
          Gemini weaves your week&apos;s priorities, sessions, Kolb&apos;s reflections, experiments, and check-ins into one narrative.
        </p>
      </header>

      <section className="focal-learn-section focal-learn-section-panel focal-learn-section-panel--weekly">
        <div className="focal-learn-section-head">
          <span className="focal-learn-section-eyebrow">This week</span>
          <h3 className="focal-learn-section-title">Current summary</h3>
        </div>
        <p className="focal-learn-hint focal-learn-hint--tight">Regenerate if your week&apos;s data changed. Section 3 checks active experiments when present.</p>
        <button
          type="button"
          className="focal-btn primary focal-learn-weekly-generate"
          disabled={busy}
          onClick={() => void generate(thisWeek)}
        >
          {busy ? "Generating…" : current ? "Regenerate this week" : "Generate summary"}
        </button>
        {err ? <p className="focal-learn-error">{err}</p> : null}
        {current ? (
          <article className="focal-learn-summary-card focal-learn-summary-card--raised">{renderSummary(current.gemini_response)}</article>
        ) : (
          <p className="focal-learn-muted">No summary for this week yet.</p>
        )}
      </section>

      <section className="focal-learn-section">
        <div className="focal-learn-section-head">
          <span className="focal-learn-section-eyebrow">Archive</span>
          <h3 className="focal-learn-section-title">History</h3>
        </div>
        {loading ? (
          <p className="focal-learn-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="focal-learn-empty">Past reviews land here — run one when you are ready.</p>
        ) : (
          <ul className="focal-learn-summary-history">
            {rows.map((r) => (
              <li key={r.id}>
                <details className="focal-learn-summary-hist-item">
                  <summary>
                    <span className="focal-learn-hist-date">{r.week_start_date}</span>
                    <span className="focal-learn-hist-hint">Expand</span>
                  </summary>
                  <div className="focal-learn-summary-card subtle">{renderSummary(r.gemini_response)}</div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
