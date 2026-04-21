"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ClockFormat, ProfileRow, QuoteStyle, ThemeMode } from "@focal/shared";
import type { createSupabaseBrowser } from "@/lib/supabase-browser";
import { authRedirectToApp } from "@/lib/auth-origin";

export function SettingsAppRow({
  title,
  description,
  control,
}: {
  title: string;
  description: string;
  control: ReactNode;
}) {
  return (
    <div className="focal-settings-app-row">
      <div className="focal-settings-app-row-text">
        <div className="focal-settings-app-row-title">{title}</div>
        <p className="focal-settings-app-row-desc">{description}</p>
      </div>
      <div className="focal-settings-app-row-control">{control}</div>
    </div>
  );
}

export type SettingsNavSection = "general" | "account" | "focus" | "learn" | "memento" | "calendar" | "help";

export const SETTINGS_NAV: { id: SettingsNavSection; label: string }[] = [
  { id: "general", label: "General" },
  { id: "account", label: "Account" },
  { id: "focus", label: "Focus" },
  { id: "learn", label: "Learn" },
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
  const [quoteStyle, setQuoteStyle] = useState<QuoteStyle>(profile?.quote_style ?? "theology");
  const [customQuotes, setCustomQuotes] = useState(profile?.custom_quotes ?? "");
  const [theme, setTheme] = useState<ThemeMode>(profile?.theme ?? "photo");
  const [widget, setWidget] = useState(profile?.show_memento_widget ?? false);

  useEffect(() => {
    setName(profile?.name ?? "");
    setGreetingTemplate(profile?.greeting_template ?? "");
    setClock(profile?.clock_format ?? "24hr");
    setQuoteStyle(profile?.quote_style ?? "theology");
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
      <p className="focal-settings-sub">Customize your dashboard.</p>
      <div className="focal-settings-card focal-settings-card--apps">
        <SettingsAppRow
          title="Theme"
          description="Photo backdrop or a calm solid dark canvas."
          control={
            <select className="focal-input focal-settings-input-inline" value={theme} onChange={(e) => setTheme(e.target.value as ThemeMode)}>
              <option value="photo">Photo</option>
              <option value="solid">Solid</option>
            </select>
          }
        />
        <SettingsAppRow
          title="Clock"
          description="How the time reads in the sidebar."
          control={
            <select className="focal-input focal-settings-input-inline" value={clock} onChange={(e) => setClock(e.target.value as ClockFormat)}>
              <option value="24hr">24h</option>
              <option value="12hr">12h</option>
            </select>
          }
        />
        <SettingsAppRow
          title="Quotes"
          description="Quote style for custom lines below (choose Custom to edit)."
          control={
            <select className="focal-input focal-settings-input-inline" value={quoteStyle} onChange={(e) => setQuoteStyle(e.target.value as QuoteStyle)}>
              <option value="theology">Theology</option>
              <option value="motivational">Motivational</option>
              <option value="stoic">Stoic</option>
              <option value="custom">Custom</option>
            </select>
          }
        />
        <SettingsAppRow
          title="Memento chip"
          description="Optional compact reminder alongside the main view."
          control={
            <button
              type="button"
              className={`focal-switch ${widget ? "on" : ""}`}
              aria-pressed={widget}
              onClick={() => setWidget((w) => !w)}
            />
          }
        />
        <div className="focal-settings-app-field-block">
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
          {quoteStyle === "custom" ? (
            <label className="focal-settings-label">
              Custom quotes
              <textarea className="focal-input" rows={4} value={customQuotes} onChange={(e) => setCustomQuotes(e.target.value)} />
            </label>
          ) : null}
        </div>
        <div className="focal-settings-app-actions">
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
            Save changes
          </button>
        </div>
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

export function LearnSection({
  profile,
  onSave,
}: {
  profile: ProfileRow | null;
  onSave: (p: Partial<ProfileRow>) => Promise<void>;
}) {
  const [key, setKey] = useState(profile?.learn_gemini_api_key ?? "");

  useEffect(() => {
    setKey(profile?.learn_gemini_api_key ?? "");
  }, [profile?.learn_gemini_api_key]);

  if (!profile) {
    return (
      <section className="focal-settings-section">
        <h1>Learn</h1>
        <p className="focal-settings-sub">Loading…</p>
      </section>
    );
  }

  return (
    <section className="focal-settings-section">
      <h1>Learn</h1>
      <p className="focal-settings-sub">Weekly AI summaries (Gemini). You can also set GEMINI_API_KEY on the server instead.</p>
      <div className="focal-settings-card focal-settings-card--apps">
        <SettingsAppRow
          title="Gemini API key"
          description="Stored with your profile for generating LEARN weekly reviews. Leave blank to use only the server env var."
          control={
            <input
              className="focal-input focal-settings-input-inline"
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Optional"
            />
          }
        />
        <div className="focal-settings-app-actions">
          <button
            className="focal-btn primary"
            type="button"
            onClick={() => void onSave({ learn_gemini_api_key: key.trim() || null })}
          >
            Save
          </button>
        </div>
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
      <p className="focal-settings-sub">Default timer lengths when you start a session.</p>
      <div className="focal-settings-card focal-settings-card--apps">
        <SettingsAppRow
          title="Focus length"
          description="Minutes for a standard focus block."
          control={
            <input
              className="focal-input focal-settings-input-inline focal-settings-input-number"
              type="number"
              min={5}
              max={120}
              value={focusMin}
              onChange={(e) => setFocusMin(Number(e.target.value))}
            />
          }
        />
        <SettingsAppRow
          title="Break length"
          description="Short pause after a focus round."
          control={
            <input
              className="focal-input focal-settings-input-inline focal-settings-input-number"
              type="number"
              min={1}
              max={60}
              value={breakMin}
              onChange={(e) => setBreakMin(Number(e.target.value))}
            />
          }
        />
        <div className="focal-settings-app-actions">
          <button className="focal-btn primary" type="button" onClick={() => void onSave({ focus_duration: focusMin, break_duration: breakMin })}>
            Save changes
          </button>
        </div>
      </div>
    </section>
  );
}
