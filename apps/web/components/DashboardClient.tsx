"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import {
  BLOCKER_PRESETS,
  computeMementoStats,
  formatGreetingLine,
  pickDailyQuote,
  type BlockedSiteRow,
  type ClockFormat,
  type DailyGoalRow,
  type FocusLogRow,
  type FocusSessionRow,
  type MementoEntryRow,
  type ProfileRow,
  type QuoteStyle,
  type TaskListRow,
  type TaskRow,
  type ThemeMode,
} from "@focal/shared";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import {
  announceChildReady,
  isEmbeddedExtension,
  notifyExtensionBlocker,
  notifyExtensionSession,
  openExtensionLoginTab,
  requestSessionFromExtension,
} from "@/lib/extension-bridge";
import {
  cachedBundle,
  enqueuePending,
  flushPending,
  loadBundle,
  subscribeFocus,
  subscribeGoals,
  todayIsoLocal,
} from "@/lib/sync";
import { fetchTodayEvents, type CalendarEventItem } from "@/lib/calendar";
import { authLoginPageUrl, authRedirectToApp } from "@/lib/auth-origin";
import { signInWithGoogleOAuth } from "@/lib/google-oauth";
import { FocusOverlay, type FocusSessionEndPayload } from "@/components/FocusOverlay";
import { TasksDock } from "@/components/TasksDock";
import { DashboardSettingsPanel } from "@/components/DashboardSettingsPanel";

const MAIN_TAB_KEY = "focal_obs_main_tab";
type MainTab = "focus" | "archive" | "wisdom";

function readMainTab(): MainTab {
  try {
    const v = localStorage.getItem(MAIN_TAB_KEY);
    if (v === "focus" || v === "archive" || v === "wisdom") return v;
  } catch {
    /* ignore */
  }
  return "wisdom";
}

function splitQuoteAttribution(text: string): { body: string; author: string | null } {
  const em = text.lastIndexOf("—");
  if (em >= 0) {
    const body = text.slice(0, em).trim();
    const author = text.slice(em + 1).trim() || null;
    return { body: body || text, author };
  }
  const en = text.lastIndexOf("–");
  if (en >= 0) {
    const body = text.slice(0, en).trim();
    const author = text.slice(en + 1).trim() || null;
    return { body: body || text, author };
  }
  return { body: text, author: null };
}

function formatClock(date: Date, format: ClockFormat) {
  const h24 = date.getHours();
  const m = date.getMinutes();
  if (format === "24hr") {
    return `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function defaultProfile(userId: string): ProfileRow {
  return {
    id: userId,
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
}

export default function DashboardClient() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [offlineFlash, setOfflineFlash] = useState(false);

  useEffect(() => {
    if (!offlineFlash) return;
    const t = window.setTimeout(() => setOfflineFlash(false), 3200);
    return () => window.clearTimeout(t);
  }, [offlineFlash]);
  const [clock, setClock] = useState(() => new Date());
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [goalText, setGoalText] = useState("");
  const [goalsRows, setGoalsRows] = useState<DailyGoalRow[]>([]);
  const [focusRows, setFocusRows] = useState<FocusSessionRow[]>([]);
  const [blocked, setBlocked] = useState<BlockedSiteRow[]>([]);
  const [blockerActive, setBlockerActive] = useState(false);
  const [memento, setMemento] = useState<MementoEntryRow[]>([]);
  const [bgBroken, setBgBroken] = useState(false);

  const [panel, setPanel] = useState<"none" | "calendar" | "settings">("none");
  const [mainTab, setMainTab] = useState<MainTab>(() => (typeof window !== "undefined" ? readMainTab() : "wisdom"));
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusLogs, setFocusLogs] = useState<FocusLogRow[]>([]);
  const [taskLists, setTaskLists] = useState<TaskListRow[]>([]);
  const [taskRows, setTaskRows] = useState<TaskRow[]>([]);

  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[] | null>(null);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [authInlineError, setAuthInlineError] = useState<string | null>(null);
  const [extensionLoginTabOpenedAt, setExtensionLoginTabOpenedAt] = useState<number | null>(null);
  const [extensionLoginRefreshHint, setExtensionLoginRefreshHint] = useState(false);

  const goalDebounce = useRef<number | null>(null);

  const today = todayIsoLocal();

  const focusMinutesToday = useMemo(() => {
    const row = focusRows.find((r) => r.date === today);
    return row?.minutes_focused ?? 0;
  }, [focusRows, today]);

  const quote = useMemo(() => {
    const style = (profile?.quote_style ?? "theology") as QuoteStyle;
    const custom = profile?.custom_quotes
      ?.split("\n")
      .map((l) => l.trim())
      .filter(Boolean) ?? null;
    return pickDailyQuote(style, custom);
  }, [profile]);

  const quoteParts = useMemo(() => splitQuoteAttribution(quote), [quote]);

  const name = profile?.name?.trim() || "Friend";

  const setMainTabPersist = useCallback((t: MainTab) => {
    setMainTab(t);
    try {
      localStorage.setItem(MAIN_TAB_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const mementoPrimary = memento[0];
  const mementoStats = useMemo(() => {
    if (!mementoPrimary) return null;
    return computeMementoStats({
      label: mementoPrimary.label,
      birthYear: mementoPrimary.birth_year,
      birthDate: mementoPrimary.birth_date ?? null,
      lifeExpectancy: mementoPrimary.life_expectancy ?? 82,
    });
  }, [mementoPrimary]);

  const weeksMemento = useMemo(() => {
    if (!mementoStats) return null;
    const lived = Math.max(0, Math.floor(mementoStats.daysTogetherApprox / 7));
    const left = Math.max(0, Math.floor(mementoStats.daysRemainingApprox / 7));
    const span = Math.max(1, lived + left);
    const livedRatio = Math.min(1, lived / span);
    return { lived, left, livedRatio };
  }, [mementoStats]);

  useEffect(() => {
    setClock(new Date());
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (isEmbeddedExtension()) {
      announceChildReady();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setBooting(true);
      try {
        let extSession = null as Awaited<ReturnType<typeof requestSessionFromExtension>>;
        if (isEmbeddedExtension()) {
          extSession = await requestSessionFromExtension();
        }
        const { data } = await supabase.auth.getSession();
        let active = data.session;
        if (!active && extSession?.access_token) {
          const { data: setData, error } = await supabase.auth.setSession({
            access_token: extSession.access_token,
            refresh_token: extSession.refresh_token,
          });
          if (!error) active = setData.session;
        }
        if (cancelled) return;
        setSession(active);
        if (active?.user) {
          notifyExtensionSession({
            access_token: active.access_token,
            refresh_token: active.refresh_token,
            expires_at: active.expires_at ?? undefined,
          });
          try {
            await flushPending(supabase);
            const bundle = await loadBundle(supabase, active.user.id);
            if (bundle.profile) {
              setProfile(bundle.profile);
            } else {
              const seed = defaultProfile(active.user.id);
              await supabase.from("profiles").upsert(seed);
              setProfile(seed);
            }
            setGoalsRows(bundle.goals);
            setFocusRows(bundle.focus);
            setFocusLogs(bundle.focusLogs ?? []);
            setBlocked(bundle.blocked);
            setMemento(bundle.memento);
            setTaskLists(bundle.taskLists ?? []);
            setTaskRows(bundle.tasks ?? []);
            const g = bundle.goals.find((x) => x.date === today);
            setGoalText(g?.goal ?? "");
          } catch {
            const cache = cachedBundle();
            if (cache.profile) setProfile(cache.profile);
            setGoalsRows(cache.goals);
            setFocusRows(cache.focus);
            setFocusLogs(cache.focusLogs ?? []);
            setBlocked(cache.blocked);
            setMemento(cache.memento);
            setTaskLists(cache.taskLists ?? []);
            setTaskRows(cache.tasks ?? []);
            const g = cache.goals.find((x) => x.date === today);
            setGoalText(g?.goal ?? "");
            setOfflineFlash(true);
          }
        } else {
          const cache = cachedBundle();
          if (cache.profile) setProfile(cache.profile);
          setGoalsRows(cache.goals);
          setFocusRows(cache.focus);
          setFocusLogs(cache.focusLogs ?? []);
          setBlocked(cache.blocked);
          setMemento(cache.memento);
          setTaskLists(cache.taskLists ?? []);
          setTaskRows(cache.tasks ?? []);
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess) {
        notifyExtensionSession({
          access_token: sess.access_token,
          refresh_token: sess.refresh_token,
          expires_at: sess.expires_at ?? undefined,
        });
      } else {
        notifyExtensionSession(null);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase, today]);

  /** Extension iframe: backup sync if localStorage is shared with the login tab. */
  useEffect(() => {
    if (!isEmbeddedExtension()) return;
    const lastRef = { token: null as string | null };
    const sync = () => {
      void supabase.auth.getSession().then(({ data }) => {
        const next = data.session ?? null;
        const tok = next?.access_token ?? null;
        if (tok === lastRef.token) return;
        lastRef.token = tok;
        setSession(next);
        if (next) {
          notifyExtensionSession({
            access_token: next.access_token,
            refresh_token: next.refresh_token,
            expires_at: next.expires_at ?? undefined,
          });
        } else {
          notifyExtensionSession(null);
        }
      });
    };
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage) return;
      if (!e.key) return;
      if (e.key.includes("supabase") || e.key.includes("sb-")) sync();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", sync);
    const poll = window.setInterval(sync, 3000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", sync);
      window.clearInterval(poll);
    };
  }, [supabase]);

  useEffect(() => {
    if (session) {
      setExtensionLoginTabOpenedAt(null);
      setExtensionLoginRefreshHint(false);
    }
  }, [session]);

  useEffect(() => {
    if (!extensionLoginTabOpenedAt || session) return;
    setExtensionLoginRefreshHint(false);
    const t = window.setTimeout(() => setExtensionLoginRefreshHint(true), 10_000);
    return () => window.clearTimeout(t);
  }, [extensionLoginTabOpenedAt, session]);

  useEffect(() => {
    if (!session?.user) return;
    const g = subscribeGoals(supabase, session.user.id, (rows) => {
      setGoalsRows(rows);
      const row = rows.find((x) => x.date === today);
      if (row?.goal != null) setGoalText(row.goal);
    });
    const f = subscribeFocus(supabase, session.user.id, (rows) => setFocusRows(rows));
    return () => {
      supabase.removeChannel(g);
      supabase.removeChannel(f);
    };
  }, [session, supabase, today]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("focal_blocker_active");
      setBlockerActive(raw === "1");
    } catch {
      setBlockerActive(false);
    }
  }, []);

  useEffect(() => {
    notifyExtensionBlocker({
      domains: blocked.map((b) => b.domain),
      active: blockerActive,
    });
  }, [blocked, blockerActive]);

  const persistGoalRemote = useCallback(
    async (text: string) => {
      if (!session?.user) return;
      const payload = {
        user_id: session.user.id,
        date: today,
        goal: text,
        updated_at: new Date().toISOString(),
      };
      try {
        await supabase.from("daily_goals").upsert(payload, { onConflict: "user_id,date" });
      } catch {
        enqueuePending({
          id: crypto.randomUUID(),
          table: "daily_goals",
          op: "upsert",
          payload,
          at: Date.now(),
        });
        setOfflineFlash(true);
      }
    },
    [session, supabase, today]
  );

  const onGoalChange = (v: string) => {
    setGoalText(v);
    if (goalDebounce.current) window.clearTimeout(goalDebounce.current);
    goalDebounce.current = window.setTimeout(() => {
      void persistGoalRemote(v);
    }, 450);
  };

  const flushGoalNow = useCallback(() => {
    if (goalDebounce.current) {
      window.clearTimeout(goalDebounce.current);
      goalDebounce.current = null;
    }
    void persistGoalRemote(goalText);
  }, [goalText, persistGoalRemote]);

  const handleFocusSessionEnd = useCallback(
    async (payload: FocusSessionEndPayload) => {
      if (!session?.user) return;
      const hasBody =
        payload.actualMinutes > 0 ||
        Boolean(payload.intent?.trim()) ||
        (payload.distractions?.length ?? 0) > 0;
      if (!hasBody) return;

      const logInsert = {
        user_id: session.user.id,
        started_at: payload.startedAt,
        ended_at: payload.endedAt,
        planned_minutes: payload.plannedMinutes,
        actual_minutes: payload.actualMinutes,
        intent: payload.intent?.trim() || null,
        distractions: payload.distractions ?? [],
      };

      try {
        const { data, error } = await supabase.from("focus_logs").insert(logInsert).select("*").maybeSingle();
        if (!error && data) {
          setFocusLogs((rows) => [data as FocusLogRow, ...rows]);
        }
      } catch {
        enqueuePending({
          id: crypto.randomUUID(),
          table: "focus_logs",
          op: "insert",
          payload: logInsert,
          at: Date.now(),
        });
        setOfflineFlash(true);
      }

      if (payload.actualMinutes > 0) {
        const nextVal = focusMinutesToday + payload.actualMinutes;
        const sessionPayload = {
          user_id: session.user.id,
          date: today,
          minutes_focused: nextVal,
          updated_at: new Date().toISOString(),
        };
        setFocusRows((rows) => {
          const others = rows.filter((r) => r.date !== today);
          return [...others, { ...sessionPayload, id: rows.find((r) => r.date === today)?.id ?? crypto.randomUUID() }];
        });
        try {
          await supabase.from("focus_sessions").upsert(sessionPayload, { onConflict: "user_id,date" });
        } catch {
          enqueuePending({
            id: crypto.randomUUID(),
            table: "focus_sessions",
            op: "upsert",
            payload: sessionPayload,
            at: Date.now(),
          });
          setOfflineFlash(true);
        }
      }
    },
    [focusMinutesToday, session, supabase, today]
  );

  const saveProfilePatch = async (patch: Partial<ProfileRow>) => {
    if (!session?.user) return;
    const next = { ...(profile ?? defaultProfile(session.user.id)), ...patch, id: session.user.id };
    setProfile(next);
    try {
      await supabase.from("profiles").upsert(next);
    } catch {
      setOfflineFlash(true);
    }
  };

  const resetAllFromSettings = async () => {
    if (!confirm("Clear local caches and sign out?")) return;
    localStorage.clear();
    sessionStorage.clear();
    await supabase.auth.signOut();
    setPanel("none");
    router.replace("/app");
  };

  const addBlocked = async (domain: string) => {
    const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
    if (!clean || !session?.user) return;
    if (blocked.some((b) => b.domain === clean)) return;
    const row: BlockedSiteRow = {
      id: crypto.randomUUID(),
      user_id: session.user.id,
      domain: clean,
    };
    setBlocked((b) => [...b, row]);
    try {
      await supabase.from("blocked_sites").insert(row);
    } catch {
      setOfflineFlash(true);
    }
  };

  const removeBlocked = async (id: string) => {
    setBlocked((b) => b.filter((x) => x.id !== id));
    try {
      await supabase.from("blocked_sites").delete().eq("id", id);
    } catch {
      setOfflineFlash(true);
    }
  };

  const addPreset = (key: keyof typeof BLOCKER_PRESETS) => {
    for (const d of BLOCKER_PRESETS[key]) void addBlocked(d);
  };

  const toggleBlocker = (on: boolean) => {
    setBlockerActive(on);
    try {
      localStorage.setItem("focal_blocker_active", on ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const refreshCalendar = useCallback(
    async (opts?: { interactive?: boolean }) => {
      const interactive = opts?.interactive ?? false;
      if (interactive) {
        setCalendarBusy(true);
        setCalendarError(null);
      }
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.provider_token;
        if (!token) {
          if (interactive) {
            setCalendarError("missing_token");
            setCalendarEvents([]);
          }
          return;
        }
        const cacheKey = "focal_cal_" + today;
        const raw = sessionStorage.getItem(cacheKey);
        const ts = sessionStorage.getItem(cacheKey + "_ts");
        if (raw && ts && Date.now() - Number(ts) < 15 * 60 * 1000) {
          const parsed = JSON.parse(raw) as CalendarEventItem[];
          setCalendarEvents(
            parsed.map((e) => ({
              ...e,
              start: new Date(e.start as unknown as string),
              end: new Date(e.end as unknown as string),
            }))
          );
          return;
        }
        const evs = await fetchTodayEvents(token);
        setCalendarEvents(evs);
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify(evs.map((e) => ({ ...e, start: e.start.toISOString(), end: e.end.toISOString() })))
        );
        sessionStorage.setItem(cacheKey + "_ts", String(Date.now()));
      } catch (e) {
        if (interactive) {
          setCalendarError((e as Error).message);
          setCalendarEvents([]);
        }
      } finally {
        if (interactive) setCalendarBusy(false);
      }
    },
    [supabase, today]
  );

  useEffect(() => {
    if (panel === "calendar" && session) void refreshCalendar({ interactive: true });
  }, [panel, session, refreshCalendar]);

  useEffect(() => {
    if (!session?.user) return;
    void refreshCalendar();
    const id = window.setInterval(() => void refreshCalendar(), 15 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [session?.user, refreshCalendar]);

  const theme: ThemeMode = profile?.theme ?? "photo";

  if (booting) {
    return (
      <div className="focal-root">
        <div className="focal-bg solid-theme" />
        <div className="focal-content" style={{ justifyContent: "center", color: "rgba(255,255,255,0.7)" }}>
          Loading…
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="focal-root">
        <div
          className={`focal-bg ${theme === "solid" || bgBroken ? "solid-theme" : ""}`}
          style={
            theme === "photo" && !bgBroken
              ? { backgroundImage: "url('/background.jpg')" }
              : undefined
          }
        />
        <div className="focal-content" style={{ justifyContent: "center" }}>
          <div className="focal-panel focal-login-card">
            <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.6rem" }}>Welcome to Focal</h1>
            <p style={{ margin: "0 0 1rem", color: "rgba(255,255,255,0.7)" }}>Sign in to sync across Chrome, Safari, and the web.</p>
            {isEmbeddedExtension() ? (
              <>
                <button
                  className="focal-btn primary"
                  type="button"
                  onClick={() => {
                    setAuthInlineError(null);
                    setExtensionLoginTabOpenedAt(Date.now());
                    setExtensionLoginRefreshHint(false);
                    openExtensionLoginTab(authLoginPageUrl());
                  }}
                >
                  Sign in to Focal
                </button>
                <p style={{ margin: "0.65rem 0 0", fontSize: "0.8rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.45 }}>
                  Opens a normal browser tab (Chrome blocks popups on the new tab page). Finish Google or email sign-in there;
                  this tab should connect automatically when you return.
                </p>
                {extensionLoginRefreshHint ? (
                  <button className="focal-btn" type="button" style={{ marginTop: "0.75rem", width: "100%" }} onClick={() => window.location.reload()}>
                    I&apos;ve signed in — refresh
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <button
                  className="focal-btn primary"
                  type="button"
                  onClick={() => {
                    setAuthInlineError(null);
                    void signInWithGoogleOAuth(supabase).then(({ error }) => {
                      setAuthInlineError(error?.message ?? null);
                    });
                  }}
                >
                  Continue with Google
                </button>
                {authInlineError ? (
                  <p style={{ margin: "0.65rem 0 0", fontSize: "0.82rem", color: "#fecaca", lineHeight: 1.4 }}>{authInlineError}</p>
                ) : null}
              </>
            )}
            <div style={{ margin: "1rem 0", color: "rgba(255,255,255,0.45)", fontSize: "0.85rem" }}>or</div>
            <MagicLink supabase={supabase} />
            {!isEmbeddedExtension() ? (
              <button className="focal-btn" type="button" style={{ marginTop: "0.75rem" }} onClick={() => (window.location.href = "/login")}>
                Open full login page
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="focal-root">
      <div
        className={`focal-bg ${theme === "solid" || bgBroken ? "solid-theme" : ""}`}
        style={theme === "photo" && !bgBroken ? { backgroundImage: "url('/background.jpg')" } : undefined}
      >
        {theme === "photo" && !bgBroken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            src="/background.jpg"
            style={{ display: "none" }}
            onError={() => setBgBroken(true)}
          />
        ) : null}
      </div>
      <div className="focal-content focal-obs">
        <aside className="focal-obs-sidebar">
          <div className="focal-obs-brand">Focal</div>
          {focusRunning ? (
            <div className="focal-obs-live-pill" aria-live="polite">
              Focusing
            </div>
          ) : null}
          <div className="focal-obs-date-block">
            <div className="focal-obs-date-kicker">Today</div>
            <div className="focal-obs-date-long">
              {clock.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </div>
            <p className="focal-obs-greeting">{formatGreetingLine(profile?.greeting_template ?? null, name, clock.getHours())}</p>
          </div>

          <section className="focal-obs-side-section" aria-labelledby="focal-obs-now-h">
            <h2 id="focal-obs-now-h" className="focal-obs-side-label">
              Now
            </h2>
            <div className="focal-obs-side-value">{formatClock(clock, profile?.clock_format ?? "24hr")}</div>
          </section>

          <p className="focal-obs-focus-stat">{focusMinutesToday}m focused today</p>
        </aside>

        <main className="focal-obs-main">
          <div className="focal-obs-main-top">
            <nav className="focal-obs-main-tabs" aria-label="Main views">
              {(["wisdom", "archive", "focus"] as const).map((t) => (
                <button key={t} type="button" className={mainTab === t ? "active" : ""} onClick={() => setMainTabPersist(t)}>
                  {t === "focus" ? "Focus" : t === "archive" ? "Archive" : "Wisdom"}
                </button>
              ))}
            </nav>
            <div className="focal-obs-top-right">
              <button
                type="button"
                className="focal-obs-icon-btn"
                aria-label="Today on calendar"
                onClick={() => setPanel("calendar")}
                title="Calendar"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
                </svg>
              </button>
              <button
                type="button"
                className="focal-obs-icon-btn"
                aria-label="Open settings"
                aria-expanded={panel === "settings"}
                onClick={() => setPanel((p) => (p === "settings" ? "none" : "settings"))}
                title="Settings"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {mainTab === "wisdom" ? (
            <div className="focal-obs-tab-panel focal-obs-tab-wisdom">
              <div className="focal-obs-hero-wrap">
                <p className="focal-obs-hero-eyebrow focal-obs-eyebrow-gold">Remaining time</p>
                {weeksMemento ? (
                  <div className="focal-obs-life-bar-block">
                    <div className="focal-obs-life-bar" role="img" aria-label="Weeks lived versus weeks that may remain in your model">
                      <div className="focal-obs-life-bar-track">
                        <div
                          className="focal-obs-life-bar-lived"
                          style={{ flexGrow: Math.max(0.04, weeksMemento.livedRatio), flexShrink: 1, flexBasis: 0 }}
                        />
                        <div
                          className="focal-obs-life-bar-left"
                          style={{ flexGrow: Math.max(0.04, 1 - weeksMemento.livedRatio), flexShrink: 1, flexBasis: 0 }}
                        />
                      </div>
                    </div>
                    <div className="focal-obs-life-bar-labels">
                      <div className="focal-obs-life-stat focal-obs-life-stat--past">
                        <span className="focal-obs-life-num">{weeksMemento.lived.toLocaleString("en-US")}</span>
                        <span className="focal-obs-life-caption">weeks lived</span>
                      </div>
                      <div className="focal-obs-life-stat focal-obs-life-stat--future">
                        <span className="focal-obs-life-num">{weeksMemento.left.toLocaleString("en-US")}</span>
                        <span className="focal-obs-life-caption">weeks still yours</span>
                      </div>
                    </div>
                    <p className="focal-obs-life-urgency">The right side is not guaranteed — only gone is certain.</p>
                  </div>
                ) : (
                  <p className="focal-obs-hero-hint">Add your birth date under Settings → Memento mori to see your modeled weeks.</p>
                )}
              </div>

              <figure className="focal-obs-quote">
                <blockquote className="focal-obs-quote-body">
                  {"\u201C"}
                  {quoteParts.body}
                  {"\u201D"}
                </blockquote>
                {quoteParts.author ? <figcaption className="focal-obs-quote-by">— {quoteParts.author.toUpperCase()}</figcaption> : null}
              </figure>

              <div className="focal-obs-goal">
                <label className="focal-obs-goal-label" htmlFor="focal-main-goal">
                  What is your main goal for today?
                </label>
                <div className="focal-obs-goal-row">
                  <input
                    id="focal-main-goal"
                    value={goalText}
                    onChange={(e) => onGoalChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        flushGoalNow();
                      }
                    }}
                    placeholder="Enter silence and focus…"
                    autoComplete="off"
                  />
                  <span className="focal-obs-goal-return" aria-hidden title="Press Enter to save">
                    ↵
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {mainTab === "archive" ? (
            <div className="focal-obs-tab-panel focal-obs-tab-archive">
              <h2 className="focal-obs-archive-title">Session archive</h2>
              {focusLogs.length === 0 ? (
                <p className="focal-obs-archive-empty">Completed focus sessions will appear here.</p>
              ) : (
                <div className="focal-obs-archive-list">
                  {focusLogs.map((log) => (
                    <FocusHistoryCard key={log.id} log={log} />
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="focal-obs-tab-panel focal-obs-tab-focus" hidden={mainTab !== "focus"}>
            <FocusOverlay
              variant="inline"
              open={mainTab === "focus"}
              onClose={() => setMainTabPersist("wisdom")}
              defaultFocusMinutes={profile?.focus_duration ?? 25}
              defaultBreakMinutes={profile?.break_duration ?? 5}
              onSessionEnd={(p) => void handleFocusSessionEnd(p)}
              onRunningChange={setFocusRunning}
              onOpenHistory={() => setMainTabPersist("archive")}
            />
            <details className="focal-obs-focus-blocker">
              <summary>Site blocker</summary>
              <div className="focal-obs-focus-blocker-body">
                <p className="focal-obs-blocker-intro">
                  {isEmbeddedExtension()
                    ? "Blocking runs inside the browser extension."
                    : "Install the Focal extension to enforce blocks. You can still manage your list here."}
                </p>
                <div className="focal-obs-blocker-toggle-row">
                  <span>Blocker active</span>
                  <button
                    type="button"
                    className={`focal-switch ${blockerActive ? "on" : ""}`}
                    aria-pressed={blockerActive}
                    onClick={() => toggleBlocker(!blockerActive)}
                  />
                </div>
                <BlockerForm onAdd={(d) => void addBlocked(d)} />
                <div className="focal-obs-blocker-presets">
                  {(Object.keys(BLOCKER_PRESETS) as (keyof typeof BLOCKER_PRESETS)[]).map((k) => (
                    <button key={k} className="focal-btn" type="button" onClick={() => addPreset(k)}>
                      {k}
                    </button>
                  ))}
                </div>
                {blocked.map((b) => (
                  <div key={b.id} className="focal-list-row">
                    <span>{b.domain}</span>
                    <button className="focal-btn" type="button" onClick={() => void removeBlocked(b.id)}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </main>
      </div>

      <div className="focal-bottom">
        <div className="focal-credit">
          <span>Li Jiang, China</span>
        </div>
      </div>

      {offlineFlash ? <div className="focal-offline">Offline — changes will sync</div> : null}

      <SlidePanel open={panel === "calendar"} onClose={() => setPanel("none")} anchor="right" title="Today">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
          <button className="focal-btn" type="button" onClick={() => void refreshCalendar({ interactive: true })}>
            Refresh
          </button>
        </div>
        {calendarBusy ? <p>Loading…</p> : null}
        {calendarError === "missing_token" ? (
          <div>
            <p>Connect Google Calendar by signing in with Google (with calendar access).</p>
            <button
              className="focal-btn primary"
              type="button"
              onClick={() => {
                if (isEmbeddedExtension()) openExtensionLoginTab(authLoginPageUrl());
                else void signInWithGoogleOAuth(supabase);
              }}
            >
              {isEmbeddedExtension() ? "Sign in to Focal (opens tab)" : "Sign in with Google"}
            </button>
          </div>
        ) : null}
        {calendarError && calendarError !== "missing_token" ? <p style={{ color: "#fecaca" }}>{calendarError}</p> : null}
        {calendarEvents ? <CalendarList events={calendarEvents} /> : null}
      </SlidePanel>

      <SlidePanel
        open={panel === "settings"}
        onClose={() => setPanel("none")}
        anchor="bottomLeft"
        hideHeader
        wide
      >
        {session?.user ? (
          <DashboardSettingsPanel
            session={session}
            supabase={supabase}
            profile={profile}
            memento={memento}
            onSaveProfile={saveProfilePatch}
            onMementoChange={setMemento}
            onResetAll={() => void resetAllFromSettings()}
            onClose={() => setPanel("none")}
          />
        ) : null}
      </SlidePanel>

      {session?.user && taskLists.length > 0 ? (
        <TasksDock
          supabase={supabase}
          userId={session.user.id}
          taskLists={taskLists}
          tasks={taskRows}
          onListsChange={setTaskLists}
          onTasksChange={setTaskRows}
          onSyncError={() => setOfflineFlash(true)}
        />
      ) : null}
    </div>
  );
}

function FocusHistoryCard({ log }: { log: FocusLogRow }) {
  const ended = new Date(log.ended_at);
  const raw = log.distractions as unknown;
  const dist = Array.isArray(raw) ? (raw as { note: string }[]) : [];
  return (
    <div className="focal-history-card">
      <div className="focal-history-meta">
        {ended.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · {log.actual_minutes}m focused
        {log.planned_minutes ? ` · ${log.planned_minutes}m planned` : ""}
      </div>
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
    </div>
  );
}

function MagicLink({ supabase }: { supabase: ReturnType<typeof createSupabaseBrowser> }) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <input className="focal-input" placeholder="Email for magic link" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button
        className="focal-btn"
        type="button"
        style={{ width: "100%", marginTop: "0.5rem" }}
        onClick={async () => {
          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: authRedirectToApp() },
          });
          setMsg(error ? error.message : "Check your email.");
        }}
      >
        Send magic link
      </button>
      {msg ? <p style={{ color: "rgba(255,255,255,0.75)" }}>{msg}</p> : null}
    </div>
  );
}

function SlidePanel({
  open,
  onClose,
  anchor,
  title,
  wide,
  hideHeader,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchor: "left" | "right" | "bottomLeft";
  title?: string;
  wide?: boolean;
  hideHeader?: boolean;
  children: React.ReactNode;
}) {
  if (!open) return null;
  const positionStyle =
    anchor === "bottomLeft"
      ? {
          top: "auto" as const,
          bottom: "max(5.5rem, calc(env(safe-area-inset-bottom, 0px) + 4.5rem))",
          left: 16,
          right: "auto" as const,
          width: wide ? "min(520px, calc(100vw - 32px))" : "min(480px, calc(100vw - 32px))",
          maxHeight: "min(76vh, 700px)",
        }
      : {
          top: 88,
          [anchor]: 16,
          width: wide ? "min(560px, 94vw)" : "min(420px, 94vw)",
          maxHeight: "78vh",
        };
  return (
    <>
      <div className="focal-panel-backdrop" onClick={onClose} />
      <div className="focal-panel" style={positionStyle}>
        {hideHeader ? null : (
          <div className="focal-panel-header">
            <strong>{title}</strong>
            <button className="focal-btn" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        )}
        <div className={hideHeader ? "focal-panel-body focal-panel-body--flush" : "focal-panel-body"}>{children}</div>
      </div>
    </>
  );
}

function BlockerForm({ onAdd }: { onAdd: (d: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div style={{ display: "flex", gap: "0.35rem" }}>
      <input className="focal-input" placeholder="Block a site…" value={val} onChange={(e) => setVal(e.target.value)} />
      <button
        className="focal-btn primary"
        type="button"
        onClick={() => {
          onAdd(val);
          setVal("");
        }}
      >
        Add
      </button>
    </div>
  );
}

function CalendarList({ events }: { events: CalendarEventItem[] }) {
  const now = new Date();
  if (!events.length) return <p style={{ color: "rgba(255,255,255,0.75)" }}>You&apos;re free today 🎉</p>;
  const earlier = events.filter((e) => e.end.getTime() <= now.getTime());
  const current = events.filter((e) => e.start.getTime() <= now.getTime() && e.end.getTime() > now.getTime());
  const upcoming = events.filter((e) => e.start.getTime() > now.getTime());
  const fmt = (d: Date) =>
    d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  const row = (e: CalendarEventItem, highlight: boolean) => (
    <div key={e.id} className={`focal-list-row ${highlight ? "focal-event-accent" : ""}`} style={{ alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.65)" }}>
          {fmt(e.start)} – {fmt(e.end)}
        </div>
        <div>{e.title}</div>
      </div>
      <span title={e.calendarId} style={{ fontSize: "1.1rem" }}>
        ●
      </span>
    </div>
  );
  return (
    <div>
      {earlier.length ? (
        <>
          <h4 style={{ margin: "0.5rem 0" }}>Earlier</h4>
          {earlier.map((e) => row(e, false))}
        </>
      ) : null}
      {current.length ? (
        <>
          <h4 style={{ margin: "0.5rem 0" }}>Now</h4>
          {current.map((e) => row(e, true))}
        </>
      ) : null}
      {upcoming.length ? (
        <>
          <h4 style={{ margin: "0.5rem 0" }}>Upcoming</h4>
          {upcoming.map((e) => row(e, upcoming[0]?.id === e.id))}
        </>
      ) : null}
    </div>
  );
}

