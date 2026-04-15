"use client";

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { MementoEntryRow, ProfileRow } from "@focal/shared";
import type { createSupabaseBrowser } from "@/lib/supabase-browser";
import { MementoEditor } from "@/components/settings/MementoEditor";
import {
  AccountSection,
  FocusSection,
  GeneralSection,
  SETTINGS_NAV,
  type SettingsNavSection,
} from "@/components/settings/SettingsFormSections";

type Supabase = ReturnType<typeof createSupabaseBrowser>;

export function DashboardSettingsPanel({
  session,
  supabase,
  profile,
  memento,
  onSaveProfile,
  onMementoChange,
  onResetAll,
  onClose,
}: {
  session: Session;
  supabase: Supabase;
  profile: ProfileRow | null;
  memento: MementoEntryRow[];
  onSaveProfile: (patch: Partial<ProfileRow>) => Promise<void>;
  onMementoChange: (rows: MementoEntryRow[]) => void;
  onResetAll: () => void;
  onClose: () => void;
}) {
  const [section, setSection] = useState<SettingsNavSection>("general");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const email = session.user.email ?? "";

  return (
    <div className="focal-settings-popup">
      <div className="focal-settings-popup-top">
        <strong className="focal-settings-popup-title">Settings</strong>
        <button className="focal-btn primary" type="button" onClick={onClose}>
          Done
        </button>
      </div>
      <div className="focal-settings-popup-grid">
        <nav className="focal-settings-popup-nav" aria-label="Settings sections">
          {SETTINGS_NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              className={section === n.id ? "active" : ""}
              onClick={() => {
                setSection(n.id);
                setMsg(null);
                setErr(null);
              }}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <div className="focal-settings-popup-scroll">
          {section === "general" ? <GeneralSection profile={profile} onSave={onSaveProfile} /> : null}
          {section === "account" ? (
            <AccountSection
              email={email}
              supabase={supabase}
              onReset={onResetAll}
              onMessage={(m) => {
                setMsg(m);
                setErr(null);
              }}
              onError={(m) => {
                setErr(m);
                setMsg(null);
              }}
            />
          ) : null}
          {section === "focus" ? <FocusSection profile={profile} onSave={onSaveProfile} /> : null}
          {section === "memento" ? (
            <section className="focal-settings-section">
              <h1>Memento mori</h1>
              <p className="focal-settings-sub">People you want to stay present for.</p>
              <div className="focal-settings-card">
                <MementoEditor memento={memento} userId={session.user.id} supabase={supabase} onChange={onMementoChange} />
              </div>
            </section>
          ) : null}
          {section === "calendar" ? (
            <section className="focal-settings-section">
              <h1>Calendar</h1>
              <p className="focal-settings-sub">Google Calendar uses your Google sign-in from the dashboard.</p>
              <div className="focal-settings-card">
                <p style={{ color: "rgba(255,255,255,0.75)", margin: 0 }}>
                  Open the calendar panel from the main dashboard after signing in with Google (calendar scope). Events refresh every fifteen minutes.
                </p>
              </div>
            </section>
          ) : null}
          {section === "help" ? (
            <section className="focal-settings-section">
              <h1>Help</h1>
              <p className="focal-settings-sub">Focal keeps your goals, focus time, and lists in sync.</p>
              <div className="focal-settings-card">
                <p style={{ color: "rgba(255,255,255,0.75)", margin: 0 }}>
                  See the project README for Supabase setup, the browser extension, and deployment notes.
                </p>
              </div>
            </section>
          ) : null}
          {msg ? <p className="focal-settings-banner ok">{msg}</p> : null}
          {err ? <p className="focal-settings-banner err">{err}</p> : null}
        </div>
      </div>
    </div>
  );
}
