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
}: {
  memento: MementoEntryRow[];
  userId: string;
  supabase: Supabase;
  onChange: (rows: MementoEntryRow[]) => void;
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
      <div className="focal-home-memento focal-panel-static">
        <h2 className="focal-home-memento-title">Memento mori</h2>
        <p className="focal-home-memento-lead">Add your date of birth and an expected lifespan to see roughly how many days remain — framed as appreciation, not dread.</p>
        <button className="focal-btn primary" type="button" disabled={busy} onClick={() => void ensureSelf()}>
          {busy ? "Saving…" : "Enter my details"}
        </button>
      </div>
    );
  }

  const dobValue =
    primary.birth_date && primary.birth_date.length >= 10 ? primary.birth_date.slice(0, 10) : `${primary.birth_year}-01-01`;

  return (
    <div className="focal-home-memento focal-panel-static">
      <h2 className="focal-home-memento-title">Memento mori</h2>
      <p className="focal-home-memento-lead">A quiet estimate of the horizon — so today stays vivid.</p>
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
      {stats ? (
        <div className="focal-home-memento-stats">
          <div className="focal-home-memento-big">
            ~{stats.daysRemainingApprox.toLocaleString()}
            <small>days remaining</small>
          </div>
          <p className="focal-home-memento-sub">
            About {stats.yearsMonthsRemaining.years} years and {stats.yearsMonthsRemaining.months} months — and you&apos;ve
            lived roughly {stats.daysTogetherApprox.toLocaleString()} days so far.
          </p>
          <div className="focal-progress focal-home-memento-bar">
            <span style={{ width: `${Math.round(stats.progress * 100)}%` }} />
          </div>
          <p className="focal-home-memento-foot">Make them count.</p>
        </div>
      ) : null}
    </div>
  );
}
