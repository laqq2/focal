"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClockFormat, ProfileRow, QuoteStyle, ThemeMode } from "@focal/shared";
import type { createSupabaseBrowser } from "@/lib/supabase-browser";
import { authRedirectToApp } from "@/lib/auth-origin";

export type SettingsNavSection = "general" | "account" | "focus" | "memento" | "calendar" | "help";

export const SETTINGS_NAV: { id: SettingsNavSection; label: string }[] = [
  { id: "general", label: "General" },
  { id: "account", label: "Account" },
  { id: "focus", label: "Focus" },
  { id: "memento", label: "Memento mori" },
  { id: "calendar", label: "Calendar" },
  { id: "help", label: "Help" },
];

export function GeneralSection({
  profile,
  onSave,
}: {
  profile: ProfileRow | null;
  onSave: (p: Partial<ProfileRow>) => Promise<void>;
}) {
  const [name, setName] = useState(profile?.name ?? "");
  const [greetingTemplate, setGreetingTemplate] = useState(profile?.greeting_template ?? "");
  const [clock, setClock] = useState(profile?.clock_format ?? "24hr");
  const [quoteStyle, setQuoteStyle] = useState<QuoteStyle>(profile?.quote_style ?? "motivational");
  const [customQuotes, setCustomQuotes] = useState(profile?.custom_quotes ?? "");
  const [theme, setTheme] = useState<ThemeMode>(profile?.theme ?? "photo");
  const [widget, setWidget] = useState(profile?.show_memento_widget ?? false);

  useEffect(() => {
    setName(profile?.name ?? "");
    setGreetingTemplate(profile?.greeting_template ?? "");
    setClock(profile?.clock_format ?? "24hr");
    setQuoteStyle(profile?.quote_style ?? "motivational");
    setCustomQuotes(profile?.custom_quotes ?? "");
    setTheme(profile?.theme ?? "photo");
    setWidget(profile?.show_memento_widget ?? false);
  }, [profile]);

  if (!profile) {
    return (
      <section className="focal-settings-section">
        <h1>General</h1>
        <p className="focal-settings-sub">Loading your profile…</p>
      </section>
    );
  }

  return (
    <section className="focal-settings-section">
      <h1>General</h1>
      <p className="focal-settings-sub">Basics that show on your dashboard.</p>
      <div className="focal-settings-card">
        <label className="focal-settings-label">
          Your name
          <input className="focal-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="focal-settings-label">
          Greeting line
          <textarea
            className="focal-input"
            rows={2}
            value={greetingTemplate}
            onChange={(e) => setGreetingTemplate(e.target.value)}
            placeholder='e.g. {greeting}, {name} — or write anything; leave blank for default.'
          />
          <span className="focal-settings-hint">Placeholders: {"{name}"}, {"{greeting}"} (morning / afternoon / evening).</span>
        </label>
        <label className="focal-settings-label">
          Clock format
          <select className="focal-input" value={clock} onChange={(e) => setClock(e.target.value as ClockFormat)}>
            <option value="24hr">24 hour</option>
            <option value="12hr">12 hour</option>
          </select>
        </label>
        <label className="focal-settings-label">
          Theme
          <select className="focal-input" value={theme} onChange={(e) => setTheme(e.target.value as ThemeMode)}>
            <option value="photo">Photo background</option>
            <option value="solid">Solid dark</option>
          </select>
        </label>
        <label className="focal-settings-label">
          Quote style
          <select className="focal-input" value={quoteStyle} onChange={(e) => setQuoteStyle(e.target.value as QuoteStyle)}>
            <option value="motivational">Motivational</option>
            <option value="stoic">Stoic</option>
            <option value="custom">Custom (one per line)</option>
          </select>
        </label>
        {quoteStyle === "custom" ? (
          <label className="focal-settings-label">
            Custom quotes
            <textarea className="focal-input" rows={4} value={customQuotes} onChange={(e) => setCustomQuotes(e.target.value)} />
          </label>
        ) : null}
        <label className="focal-settings-toggle">
          <input type="checkbox" checked={widget} onChange={(e) => setWidget(e.target.checked)} />
          <span>Show compact memento chip on dashboard (in addition to the home card)</span>
        </label>
        <button
          className="focal-btn primary"
          type="button"
          onClick={() =>
            void onSave({
              name,
              greeting_template: greetingTemplate.trim() || null,
              clock_format: clock,
              quote_style: quoteStyle,
              custom_quotes: customQuotes || null,
              theme,
              show_memento_widget: widget,
            })
          }
        >
          Save
        </button>
      </div>
    </section>
  );
}

export function AccountSection({
  email,
  supabase,
  onReset,
  onMessage,
  onError,
}: {
  email: string;
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onReset: () => void;
  onMessage: (s: string | null) => void;
  onError: (s: string | null) => void;
}) {
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const router = useRouter();

  const updatePassword = async () => {
    onError(null);
    onMessage(null);
    if (pw1.length < 8) {
      onError("Password must be at least 8 characters.");
      return;
    }
    if (pw1 !== pw2) {
      onError("Passwords do not match.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    if (error) onError(error.message);
    else {
      onMessage("Password updated.");
      setPw1("");
      setPw2("");
    }
  };

  const sendReset = async () => {
    onError(null);
    onMessage(null);
    if (!email) {
      onError("No email on this account.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirectToApp() });
    if (error) onError(error.message);
    else onMessage("Check your email for a password reset link.");
  };

  return (
    <section className="focal-settings-section">
      <h1>Account</h1>
      <p className="focal-settings-sub">Sign in state and password (email accounts).</p>
      <div className="focal-settings-card">
        <div className="focal-settings-row">
          <span className="focal-settings-row-label">Email</span>
          <span className="focal-settings-row-value">{email || "—"}</span>
        </div>
        <button className="focal-btn" type="button" onClick={() => void supabase.auth.signOut().then(() => router.replace("/app"))}>
          Sign out
        </button>
      </div>
      <h2 className="focal-settings-h2">Change password</h2>
      <p className="focal-settings-sub">Only applies if you use email & password with Supabase (not Google-only).</p>
      <div className="focal-settings-card">
        <label className="focal-settings-label">
          New password
          <input className="focal-input" type="password" autoComplete="new-password" value={pw1} onChange={(e) => setPw1(e.target.value)} />
        </label>
        <label className="focal-settings-label">
          Confirm
          <input className="focal-input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </label>
        <button className="focal-btn primary" type="button" onClick={() => void updatePassword()}>
          Update password
        </button>
      </div>
      <h2 className="focal-settings-h2">Forgot password</h2>
      <div className="focal-settings-card">
        <p style={{ color: "rgba(255,255,255,0.7)", marginTop: 0 }}>We&apos;ll email you a recovery link.</p>
        <button className="focal-btn" type="button" onClick={() => void sendReset()}>
          Send reset email
        </button>
      </div>
      <h2 className="focal-settings-h2">Danger zone</h2>
      <div className="focal-settings-card">
        <p style={{ color: "rgba(255,255,255,0.65)", marginTop: 0 }}>Clear this browser&apos;s cached Focal data and sign out.</p>
        <button className="focal-btn" type="button" onClick={onReset}>
          Reset local data &amp; sign out
        </button>
      </div>
    </section>
  );
}

export function FocusSection({
  profile,
  onSave,
}: {
  profile: ProfileRow | null;
  onSave: (p: Partial<ProfileRow>) => Promise<void>;
}) {
  const [focusMin, setFocusMin] = useState(profile?.focus_duration ?? 25);
  const [breakMin, setBreakMin] = useState(profile?.break_duration ?? 5);

  useEffect(() => {
    setFocusMin(profile?.focus_duration ?? 25);
    setBreakMin(profile?.break_duration ?? 5);
  }, [profile]);

  return (
    <section className="focal-settings-section">
      <h1>Focus</h1>
      <p className="focal-settings-sub">Default timer lengths for new focus sessions.</p>
      <div className="focal-settings-card">
        <label className="focal-settings-label">
          Focus length (minutes)
          <input className="focal-input" type="number" value={focusMin} onChange={(e) => setFocusMin(Number(e.target.value))} />
        </label>
        <label className="focal-settings-label">
          Break length (minutes)
          <input className="focal-input" type="number" value={breakMin} onChange={(e) => setBreakMin(Number(e.target.value))} />
        </label>
        <button className="focal-btn primary" type="button" onClick={() => void onSave({ focus_duration: focusMin, break_duration: breakMin })}>
          Save
        </button>
      </div>
    </section>
  );
}
