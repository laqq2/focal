"use client";

import { useMemo, useState } from "react";
import type { MementoEntryRow } from "@focal/shared";
import { computeMementoStats, yearFromBirthDate } from "@focal/shared";
import type { createSupabaseBrowser } from "@/lib/supabase-browser";

type Supabase = ReturnType<typeof createSupabaseBrowser>;

export function HomeMementoCard({
  memento,
  userId,
  supabase,
  onChange,
  compact = false,
}: {
  memento: MementoEntryRow[];
  userId: string;
  supabase: Supabase;
  onChange: (rows: MementoEntryRow[]) => void;
  /** Sidebar: hide large duplicate hero; keep model + settings. */
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const primary = memento[0];

  const stats = useMemo(() => {
    if (!primary) return null;
    return computeMementoStats({
      label: primary.label,
      birthYear: primary.birth_year,
      birthDate: primary.birth_date ?? null,
      lifeExpectancy: primary.life_expectancy ?? 82,
    });
  }, [primary]);

  const ensureSelf = async () => {
    setBusy(true);
    try {
      const row: MementoEntryRow = {
        id: crypto.randomUUID(),
        user_id: userId,
        label: "You",
        birth_year: 1995,
        birth_date: "1995-01-01",
        life_expectancy: 82,
      };
      const { data, error } = await supabase.from("memento_entries").insert(row).select("*");
      const created = data?.[0] as MementoEntryRow | undefined;
      if (!error && created) onChange([created, ...memento]);
      else onChange([row, ...memento]);
    } finally {
      setBusy(false);
    }
  };

  const patchPrimary = async (patch: Partial<MementoEntryRow>) => {
    if (!primary) return;
    const row = { ...primary, ...patch };
    if (patch.birth_date !== undefined) {
      row.birth_year = yearFromBirthDate(patch.birth_date ?? null, primary.birth_year);
    }
    const next = [row, ...memento.slice(1)];
    onChange(next);
    await supabase.from("memento_entries").upsert(row, { onConflict: "id" });
  };

  if (!primary) {
    return (
      <div className="focal-home-memento focal-memento-urgent">
        <div className="focal-memento-urgent-strip" aria-hidden />
        <p className="focal-memento-urgent-eyebrow">Memento mori</p>
        <h2 className="focal-memento-urgent-head">You haven&apos;t faced the clock yet.</h2>
        <p className="focal-memento-urgent-body">
          Most people drift until time announces itself. Put in your birth date and a life expectancy — not to despair, but
          to <strong>decide</strong> what today is worth.
        </p>
        <button className="focal-memento-urgent-btn" type="button" disabled={busy} onClick={() => void ensureSelf()}>
          {busy ? "Saving…" : "Enter my numbers — start the clock"}
        </button>
      </div>
    );
  }

  const dobValue =
    primary.birth_date && primary.birth_date.length >= 10 ? primary.birth_date.slice(0, 10) : `${primary.birth_year}-01-01`;

  const daysLeft = stats?.daysRemainingApprox ?? 0;
  const progressPct = stats ? Math.round(stats.progress * 100) : 0;

  return (
    <div className="focal-home-memento focal-memento-urgent">
      <div className="focal-memento-urgent-strip" aria-hidden />
      <p className="focal-memento-urgent-eyebrow">Memento mori · {primary.label}</p>

      {stats && compact ? (
        <p className="focal-memento-sidebar-brief">
          ~{daysLeft.toLocaleString()} days in model · {progressPct}% of expected life lived
        </p>
      ) : null}
      {stats && !compact ? (
        <div className="focal-memento-urgent-hero">
          <div className="focal-memento-urgent-huge-wrap" title="Approximate days left in your modeled lifespan">
            <span className="focal-memento-urgent-huge">{daysLeft.toLocaleString()}</span>
            <span className="focal-memento-urgent-unit">days left</span>
          </div>
          <p className="focal-memento-urgent-shout">This number only goes down.</p>
          <p className="focal-memento-urgent-hook">
            About {stats.yearsMonthsRemaining.years}y {stats.yearsMonthsRemaining.months}m remaining · you have already lived
            roughly <strong>{stats.daysTogetherApprox.toLocaleString()}</strong> days. What will you do with the next one?
          </p>
          <div className="focal-memento-urgent-bar-wrap">
            <div className="focal-memento-urgent-bar">
              <span style={{ width: `${progressPct}%` }} />
            </div>
            <span className="focal-memento-urgent-bar-label">{progressPct}% of expected life lived (model)</span>
          </div>
        </div>
      ) : null}

      <details className="focal-memento-urgent-details">
        <summary>Adjust dates &amp; expectancy</summary>
        <div className="focal-home-memento-grid">
          <label>
            <span>Label</span>
            <input className="focal-input" value={primary.label} onChange={(e) => void patchPrimary({ label: e.target.value })} />
          </label>
          <label>
            <span>Date of birth</span>
            <input
              className="focal-input"
              type="date"
              value={dobValue}
              onChange={(e) => {
                const v = e.target.value;
                void patchPrimary({ birth_date: v || null });
              }}
            />
          </label>
          <label>
            <span>Life expectancy (years)</span>
            <input
              className="focal-input"
              type="number"
              min={60}
              max={120}
              value={primary.life_expectancy ?? 82}
              onChange={(e) => void patchPrimary({ life_expectancy: Number(e.target.value) })}
            />
          </label>
        </div>
      </details>
    </div>
  );
}
