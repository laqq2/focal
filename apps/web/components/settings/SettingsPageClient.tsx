"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import type { MementoEntryRow, ProfileRow } from "@focal/shared";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { cachedBundle, flushPending, loadBundle } from "@/lib/sync";
import { MementoEditor } from "@/components/settings/MementoEditor";
import {
  AccountSection,
  FocusSection,
  GeneralSection,
  SETTINGS_NAV,
  type SettingsNavSection,
} from "@/components/settings/SettingsFormSections";

export default function SettingsPageClient() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [section, setSection] = useState<SettingsNavSection>("general");
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [memento, setMemento] = useState<MementoEntryRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        router.replace("/app");
        return;
      }
      setSession(data.session);
      try {
        await flushPending(supabase);
        const bundle = await loadBundle(supabase, data.session.user.id);
        if (bundle.profile) {
          setProfile(bundle.profile);
        } else {
          const seed: ProfileRow = {
            id: data.session.user.id,
            name: "Friend",
            greeting_template: null,
            clock_format: "24hr",
            focus_duration: 25,
            break_duration: 5,
            quote_style: "theology",
            custom_quotes: null,
            show_memento_widget: false,
            theme: "photo",
          };
          await supabase.from("profiles").upsert(seed);
          setProfile(seed);
        }
        setMemento(bundle.memento ?? []);
      } catch {
        const c = cachedBundle();
        if (c.profile) setProfile(c.profile);
        setMemento(c.memento ?? []);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) router.replace("/app");
      setSession(s);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [router, supabase]);

  const saveProfile = async (patch: Partial<ProfileRow>) => {
    if (!session?.user || !profile) return;
    const next = { ...profile, ...patch, id: session.user.id };
    setProfile(next);
    await supabase.from("profiles").upsert(next);
  };

  const resetAll = async () => {
    if (!confirm("Clear local caches and sign out?")) return;
    localStorage.clear();
    sessionStorage.clear();
    await supabase.auth.signOut();
    router.replace("/app");
  };

  if (booting || !session?.user) {
    return (
      <div className="focal-settings-page">
        <div className="focal-settings-loading">Loading…</div>
      </div>
    );
  }

  const email = session.user.email ?? "";

  return (
    <div className="focal-settings-page">
      <aside className="focal-settings-sidebar">
        <Link href="/app" className="focal-settings-back">
          ← Dashboard
        </Link>
        <div className="focal-settings-brand">Settings</div>
        <nav className="focal-settings-nav">
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
        <div className="focal-settings-sidebar-foot">
          <p className="focal-settings-sync">Sync your data</p>
          <p className="focal-settings-sync-sub">Signed in as {email || "account"}</p>
        </div>
      </aside>
      <main className="focal-settings-main">
        {section === "general" ? <GeneralSection profile={profile} onSave={saveProfile} /> : null}
        {section === "account" ? (
          <AccountSection
            email={email}
            supabase={supabase}
            onReset={() => void resetAll()}
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
        {section === "focus" ? <FocusSection profile={profile} onSave={saveProfile} /> : null}
        {section === "memento" ? (
          <section className="focal-settings-section">
            <h1>Memento mori</h1>
            <p className="focal-settings-sub">People you want to stay present for.</p>
            <div className="focal-settings-card">
              <MementoEditor memento={memento} userId={session.user.id} supabase={supabase} onChange={setMemento} />
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
      </main>
    </div>
  );
}
