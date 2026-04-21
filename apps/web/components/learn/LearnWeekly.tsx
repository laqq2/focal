"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { WeeklySummaryRow } from "@focal/shared";
import type { createSupabaseBrowser } from "@/lib/supabase-browser";
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

  const displayBlocks = (text: string) => {
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    return (
      <div className="focal-learn-summary-blocks">
        {lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    );
  };

  return (
    <div className="focal-learn-page focal-learn-fade">
      <section className="focal-learn-section">
        <h3 className="focal-learn-h">This week</h3>
        <p className="focal-learn-hint">Uses Gemini with your week&apos;s priorities, sessions, Kolb&apos;s, and check-ins.</p>
        <button type="button" className="focal-btn primary" disabled={busy} onClick={() => void generate(thisWeek)}>
          {busy ? "Generating…" : current ? "Regenerate this week" : "Generate summary"}
        </button>
        {err ? <p className="focal-learn-error">{err}</p> : null}
        {current ? (
          <article className="focal-learn-summary-card">{displayBlocks(current.gemini_response)}</article>
        ) : (
          <p className="focal-learn-muted">No summary for this week yet.</p>
        )}
      </section>

      <section className="focal-learn-section">
        <h3 className="focal-learn-h">History</h3>
        {loading ? (
          <p className="focal-learn-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="focal-learn-empty">Past reviews land here — run one when you’re ready.</p>
        ) : (
          <ul className="focal-learn-summary-history">
            {rows.map((r) => (
              <li key={r.id}>
                <details className="focal-learn-summary-hist-item">
                  <summary>{r.week_start_date}</summary>
                  <div className="focal-learn-summary-card subtle">{displayBlocks(r.gemini_response)}</div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
