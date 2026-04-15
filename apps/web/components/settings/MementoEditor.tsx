"use client";

import { useCallback, useEffect, useRef } from "react";
import type { MementoEntryRow } from "@focal/shared";
import { computeMementoStats, yearFromBirthDate } from "@focal/shared";
import type { createSupabaseBrowser } from "@/lib/supabase-browser";

type Supabase = ReturnType<typeof createSupabaseBrowser>;

export function MementoEditor({
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
  /** Latest rows for merges (avoids stale `memento` when saving quickly). */
  const mementoRef = useRef(memento);
  useEffect(() => {
    mementoRef.current = memento;
  }, [memento]);
  const seedDefaults = async () => {
    const seeds: MementoEntryRow[] = [
      {
        id: crypto.randomUUID(),
        user_id: userId,
        label: "Mum",
        birth_year: 1960,
        birth_date: null,
        life_expectancy: 82,
      },
      {
        id: crypto.randomUUID(),
        user_id: userId,
        label: "Dad",
        birth_year: 1962,
        birth_date: null,
        life_expectancy: 82,
      },
    ];
    const { data, error } = await supabase.from("memento_entries").insert(seeds).select("*");
    if (!error && data) {
      const next = [...(data as MementoEntryRow[]), ...mementoRef.current];
      mementoRef.current = next;
      onChange(next);
    } else {
      const next = [...seeds, ...mementoRef.current];
      mementoRef.current = next;
      onChange(next);
    }
  };

  const updateRow = useCallback(
    async (id: string, patch: Partial<MementoEntryRow>) => {
      const source = mementoRef.current;
      const next = source.map((r) => {
        if (r.id !== id) return r;
        const u = { ...r, ...patch };
        if (patch.birth_date !== undefined) {
          u.birth_year = yearFromBirthDate(patch.birth_date ?? null, r.birth_year);
        }
        return u;
      });
      const updated = next.find((r) => r.id === id);
      if (!updated) return;
      mementoRef.current = next;
      onChange(next);
      try {
        await supabase.from("memento_entries").upsert(updated, { onConflict: "id" });
      } catch {
        mementoRef.current = source;
        onChange(source);
      }
    },
    [onChange, supabase]
  );

  return (
    <div>
      <p style={{ color: "rgba(255,255,255,0.7)", marginTop: 0 }}>
        A gentle reminder to cherish the days you still get to share. Use full date of birth when you can — estimates
        are more meaningful.
      </p>
      {!memento.length ? (
        <button className="focal-btn primary" type="button" onClick={() => void seedDefaults()}>
          Add Mum &amp; Dad templates
        </button>
      ) : null}
      {memento.map((m) => {
        const stats = computeMementoStats({
          label: m.label,
          birthYear: m.birth_year,
          birthDate: m.birth_date ?? null,
          lifeExpectancy: m.life_expectancy ?? 82,
        });
        const ageYears = Math.max(0, Math.floor(stats.daysTogetherApprox / 365.25));
        const dobValue = m.birth_date && m.birth_date.length >= 10 ? m.birth_date.slice(0, 10) : `${m.birth_year}-01-01`;
        return (
          <div key={m.id} className="focal-settings-memento-block">
            <div className="focal-settings-field-grid">
              <label>
                Name
                <input className="focal-input" value={m.label} onChange={(e) => void updateRow(m.id, { label: e.target.value })} />
              </label>
              <label>
                Date of birth
                <input
                  className="focal-input"
                  type="date"
                  value={dobValue}
                  onChange={(e) => {
                    const v = e.target.value;
                    void updateRow(m.id, {
                      birth_date: v || null,
                      birth_year: yearFromBirthDate(v || null, m.birth_year),
                    });
                  }}
                />
              </label>
              <label>
                Life expectancy (years)
                <input
                  className="focal-input"
                  type="number"
                  min={60}
                  max={120}
                  value={m.life_expectancy ?? 82}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") return;
                    const n = Number(raw);
                    if (Number.isNaN(n)) return;
                    void updateRow(m.id, { life_expectancy: Math.min(120, Math.max(60, n)) });
                  }}
                />
              </label>
              <label>
                Approx. age (years)
                <input className="focal-input" type="number" value={ageYears} readOnly />
              </label>
            </div>
            <p className="focal-settings-statline">
              {m.label} has approximately <strong>{stats.daysRemainingApprox.toLocaleString()}</strong> days remaining.
            </p>
            <p className="focal-settings-statline muted">
              That&apos;s {stats.yearsMonthsRemaining.years} years and {stats.yearsMonthsRemaining.months} months — and
              you&apos;ve already shared {stats.daysTogetherApprox.toLocaleString()} days.
            </p>
            <div className="focal-progress" style={{ marginTop: "0.5rem" }}>
              <span style={{ width: `${Math.round(stats.progress * 100)}%` }} />
            </div>
            <div style={{ marginTop: "0.35rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.55)" }}>Make them count.</div>
          </div>
        );
      })}
    </div>
  );
}
