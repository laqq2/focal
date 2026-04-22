"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FocusLogRow } from "@focal/shared";
import type { createSupabaseBrowser } from "@/lib/supabase-browser";
import { todayIsoLocal } from "@/lib/sync";
import { LearnToday } from "./LearnToday";
import { LearnSessionLog } from "./LearnSessionLog";
import { KolbsLoopPage } from "./kolbs/KolbsLoopPage";
import { GoalsPage } from "./goals/GoalsPage";
import { LearnWeekly } from "./LearnWeekly";

const SUB_KEY = "focal_learn_sub_tab";
export type LearnSubTab = "today" | "sessions" | "kolbs" | "goals" | "weekly";

function readSub(): LearnSubTab {
  try {
    const v = localStorage.getItem(SUB_KEY);
    if (v === "today" || v === "sessions" || v === "kolbs" || v === "goals" || v === "weekly") return v;
  } catch {
    /* ignore */
  }
  return "today";
}

export function LearnPanel({
  supabase,
  userId,
  displayName,
  clock,
  focusLogs,
  onFocusLogUpdated,
  onSyncError,
  accessToken,
  onAttentionChange,
}: {
  supabase: ReturnType<typeof createSupabaseBrowser>;
  userId: string;
  displayName: string;
  clock: Date;
  focusLogs: FocusLogRow[];
  onFocusLogUpdated: (row: FocusLogRow) => void;
  onSyncError: () => void;
  accessToken: string | null;
  onAttentionChange: (needs: boolean) => void;
}) {
  const [sub, setSub] = useState<LearnSubTab>(() => (typeof window !== "undefined" ? readSub() : "today"));
  const today = todayIsoLocal();
  const hour = clock.getHours();

  const setSubPersist = useCallback((t: LearnSubTab) => {
    setSub(t);
    try {
      localStorage.setItem(SUB_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshAttention = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("daily_priorities")
        .select("priority_1_title,priority_2_title,eod_completed_at")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();
      if (error) {
        onAttentionChange(true);
        return;
      }
      if (!data) {
        onAttentionChange(true);
        return;
      }
      const missing = !data.priority_1_title?.trim() || !data.priority_2_title?.trim();
      const eodPending = hour >= 19 && !data.eod_completed_at;
      onAttentionChange(missing || Boolean(eodPending));
    } catch {
      onAttentionChange(true);
    }
  }, [supabase, userId, today, hour, onAttentionChange]);

  useEffect(() => {
    void refreshAttention();
  }, [refreshAttention, sub]);

  useEffect(() => {
    const id = window.setInterval(() => void refreshAttention(), 45000);
    return () => window.clearInterval(id);
  }, [refreshAttention]);

  const tabs = useMemo(
    () =>
      [
        { id: "today" as const, label: "Today" },
        { id: "sessions" as const, label: "Sessions" },
        { id: "kolbs" as const, label: "Kolb's" },
        { id: "goals" as const, label: "Goals" },
        { id: "weekly" as const, label: "Weekly" },
      ] as const,
    []
  );

  return (
    <div className="focal-learn-root">
      <nav className="focal-learn-subtabs" aria-label="Learn sections">
        {tabs.map((t) => (
          <button key={t.id} type="button" className={sub === t.id ? "active" : ""} onClick={() => setSubPersist(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="focal-learn-body focal-learn-shell">
        {sub === "today" ? (
          <LearnToday
            supabase={supabase}
            userId={userId}
            displayName={displayName}
            clock={clock}
            onSyncError={onSyncError}
            onUpdated={refreshAttention}
            onOpenKolbs={() => setSubPersist("kolbs")}
          />
        ) : null}
        {sub === "sessions" ? (
          <LearnSessionLog
            supabase={supabase}
            userId={userId}
            focusLogs={focusLogs}
            onFocusLogUpdated={onFocusLogUpdated}
            onSyncError={onSyncError}
          />
        ) : null}
        {sub === "kolbs" ? <KolbsLoopPage supabase={supabase} userId={userId} onSyncError={onSyncError} /> : null}
        {sub === "goals" ? <GoalsPage supabase={supabase} userId={userId} accessToken={accessToken ?? ""} onSyncError={onSyncError} /> : null}
        {sub === "weekly" ? <LearnWeekly supabase={supabase} accessToken={accessToken} onSyncError={onSyncError} /> : null}
      </div>
    </div>
  );
}
