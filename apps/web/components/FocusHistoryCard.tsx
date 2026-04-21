"use client";

import { useEffect, useState } from "react";
import type { FocusLogRow } from "@focal/shared";
import { enqueuePending } from "@/lib/sync";
import type { createSupabaseBrowser } from "@/lib/supabase-browser";

export function FocusHistoryCard({
  log,
  supabase,
  onUpdated,
  onSyncError,
}: {
  log: FocusLogRow;
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onUpdated: (row: FocusLogRow) => void;
  onSyncError: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [intent, setIntent] = useState(log.intent ?? "");
  const [actual, setActual] = useState(log.actual_minutes);
  const [planned, setPlanned] = useState(log.planned_minutes);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIntent(log.intent ?? "");
    setActual(log.actual_minutes);
    setPlanned(log.planned_minutes);
  }, [log.id, log.intent, log.actual_minutes, log.planned_minutes]);

  const ended = new Date(log.ended_at);
  const raw = log.distractions as unknown;
  const dist = Array.isArray(raw) ? (raw as { note: string }[]) : [];

  const save = async () => {
    setSaving(true);
    const patch = {
      intent: intent.trim() || null,
      actual_minutes: Math.min(480, Math.max(0, Math.round(actual))),
      planned_minutes: Math.min(480, Math.max(1, Math.round(planned))),
    };
    try {
      const { data, error } = await supabase.from("focus_logs").update(patch).eq("id", log.id).select("*").maybeSingle();
      if (error) throw error;
      if (data) onUpdated(data as FocusLogRow);
      setEditing(false);
    } catch {
      enqueuePending({
        id: crypto.randomUUID(),
        table: "focus_logs",
        op: "update",
        payload: { id: log.id, patch },
        at: Date.now(),
      });
      onSyncError();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="focal-history-card">
      <div className="focal-history-meta">
        {ended.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · {log.actual_minutes}m focused
        {log.planned_minutes ? ` · ${log.planned_minutes}m planned` : ""}
        <button type="button" className="focal-history-edit-btn" onClick={() => setEditing((e) => !e)}>
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>
      {editing ? (
        <div className="focal-history-edit">
          <label className="focal-history-edit-label">
            Focus note
            <input className="focal-input" value={intent} onChange={(e) => setIntent(e.target.value)} />
          </label>
          <div className="focal-history-edit-row">
            <label className="focal-history-edit-label">
              Actual minutes
              <input
                className="focal-input"
                type="number"
                min={0}
                max={480}
                value={actual}
                onChange={(e) => setActual(Number(e.target.value))}
              />
            </label>
            <label className="focal-history-edit-label">
              Planned minutes
              <input
                className="focal-input"
                type="number"
                min={1}
                max={480}
                value={planned}
                onChange={(e) => setPlanned(Number(e.target.value))}
              />
            </label>
          </div>
          <button className="focal-btn primary" type="button" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      ) : (
        <>
          {log.intent ? <p className="focal-history-intent">{log.intent}</p> : <p className="focal-history-intent" style={{ opacity: 0.55 }}>No focus note</p>}
          {dist.length ? (
            <div style={{ marginTop: "0.35rem" }}>
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.25rem" }}>Distractions</div>
              {dist.map((d, i) => (
                <div key={i} className="focal-history-dist">
                  {d.note}
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
