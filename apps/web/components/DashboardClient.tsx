"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import {
  BLOCKER_PRESETS,
  formatGreetingLine,
  type BlockedSiteRow,
  type ClockFormat,
  type FocusLogRow,
  type FocusSessionRow,
  type MementoEntryRow,
  type ProfileRow,
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
  todayIsoLocal,
} from "@/lib/sync";
import { fetchUpcomingEvents, type CalendarEventItem } from "@/lib/calendar";
import { authLoginPageUrl } from "@/lib/auth-origin";
import { signInWithGoogleOAuth } from "@/lib/google-oauth";
import { FocusOverlay, type FocusHeroTelemetry, type FocusSessionEndPayload } from "@/components/FocusOverlay";
import { TasksDock } from "@/components/TasksDock";
import { DashboardSettingsPanel } from "@/components/DashboardSettingsPanel";
import { LearnPanel } from "@/components/learn/LearnPanel";

const MAIN_TAB_KEY = "focal_obs_main_tab";
type MainTab = "focus" | "learn";

function readMainTab(): MainTab {
  try {
    const v = localStorage.getItem(MAIN_TAB_KEY);
    if (v === "focus" || v === "learn") return v;
    if (v === "archive" || v === "wisdom") return "learn";
  } catch {
    /* ignore */
  }
  return "focus";
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

function formatEventSidebarWhen(e: CalendarEventItem, now: Date): string {
  const optsTime: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  const sameDay =
    e.start.getFullYear() === now.getFullYear() &&
    e.start.getMonth() === now.getMonth() &&
    e.start.getDate() === now.getDate();
  const timeStr = `${e.start.toLocaleTimeString(undefined, optsTime)}–${e.end.toLocaleTimeString(undefined, optsTime)}`;
  if (sameDay) return timeStr;
  const dateStr = e.start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `${dateStr} · ${timeStr}`;
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
    learn_gemini_api_key: null,
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

  const onSyncErrorFlash = useCallback(() => {
    setOfflineFlash(true);
  }, []);

  const [clock, setClock] = useState(() => new Date());
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [focusRows, setFocusRows] = useState<FocusSessionRow[]>([]);
  const [blocked, setBlocked] = useState<BlockedSiteRow[]>([]);
  const [blockerActive, setBlockerActive] = useState(false);
  const [memento, setMemento] = useState<MementoEntryRow[]>([]);
  const [bgBroken, setBgBroken] = useState(false);

  const [panel, setPanel] = useState<"none" | "calendar" | "settings">("none");
  const [mainTab, setMainTab] = useState<MainTab>(() => (typeof window !== "undefined" ? readMainTab() : "focus"));
  const [learnNeedsAttention, setLearnNeedsAttention] = useState(false);
  const [focusHud, setFocusHud] = useState<FocusHeroTelemetry | null>(null);
  const [focusLogs, setFocusLogs] = useState<FocusLogRow[]>([]);
  const [taskLists, setTaskLists] = useState<TaskListRow[]>([]);
  const [taskRows, setTaskRows] = useState<TaskRow[]>([]);

  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[] | null>(null);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [extensionLoginTabOpenedAt, setExtensionLoginTabOpenedAt] = useState<number | null>(null);
  const [extensionLoginRefreshHint, setExtensionLoginRefreshHint] = useState(false);

  const settingsAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [settingsDropdownLayout, setSettingsDropdownLayout] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const today = todayIsoLocal();

  const focusMinutesToday = useMemo(() => {
    const row = focusRows.find((r) => r.date === today);
    return row?.minutes_focused ?? 0;
  }, [focusRows, today]);

  const name = profile?.name?.trim() || "Friend";

  const setMainTabPersist = useCallback((t: MainTab) => {
    setMainTab(t);
    try {
      localStorage.setItem(MAIN_TAB_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const upcomingSidebarEvents = useMemo(() => {
    if (!calendarEvents?.length) return [];
    const t = clock.getTime();
    return calendarEvents
      .filter((e) => e.end.getTime() > t)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 4);
  }, [calendarEvents, clock]);

  useEffect(() => {
    setClock(new Date());
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useLayoutEffect(() => {
    if (panel !== "settings" || !session?.user) {
      setSettingsDropdownLayout(null);
      return;
    }
    const el = settingsAnchorRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const pad = 12;
      const w = Math.min(560, Math.max(300, window.innerWidth - pad * 2));
      let left = r.right - w;
      if (left < pad) left = pad;
      if (left + w > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - pad - w);
      const top = r.bottom + 8;
      const maxHeight = Math.max(260, Math.min(580, window.innerHeight - top - pad));
      setSettingsDropdownLayout({ top, left, width: w, maxHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [panel, session?.user]);

  useEffect(() => {
    if (panel !== "settings") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel("none");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

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
            setFocusRows(bundle.focus);
            setFocusLogs(bundle.focusLogs ?? []);
            setBlocked(bundle.blocked);
            setMemento(bundle.memento);
            setTaskLists(bundle.taskLists ?? []);
            setTaskRows(bundle.tasks ?? []);
          } catch {
            const cache = cachedBundle();
            if (cache.profile) setProfile(cache.profile);
            setFocusRows(cache.focus);
            setFocusLogs(cache.focusLogs ?? []);
            setBlocked(cache.blocked);
            setMemento(cache.memento);
            setTaskLists(cache.taskLists ?? []);
            setTaskRows(cache.tasks ?? []);
            setOfflineFlash(true);
          }
        } else {
          const cache = cachedBundle();
          if (cache.profile) setProfile(cache.profile);
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
    const f = subscribeFocus(supabase, session.user.id, (rows) => setFocusRows(rows));
    return () => {
      supabase.removeChannel(f);
    };
  }, [session, supabase]);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    const tick = async () => {
      const { data } = await supabase
        .from("daily_priorities")
        .select("priority_1_title,priority_2_title,eod_completed_at")
        .eq("user_id", session.user.id)
        .eq("date", today)
        .maybeSingle();
      if (cancelled) return;
      if (!data) {
        setLearnNeedsAttention(true);
        return;
      }
      const missing = !data.priority_1_title?.trim() || !data.priority_2_title?.trim();
      const eodPending = new Date().getHours() >= 19 && !data.eod_completed_at;
      setLearnNeedsAttention(missing || Boolean(eodPending));
    };
    void tick();
    const id = window.setInterval(() => void tick(), 60000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
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
    router.replace("/");
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
        const cacheKey = "focal_cal_up_" + today;
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
        const evs = await fetchUpcomingEvents(token, 14);
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

  /** Web dashboard: send unauthenticated users to the public landing page (extension iframe keeps inline sign-in). */
  useEffect(() => {
    if (booting) return;
    if (session) return;
    if (isEmbeddedExtension()) return;
    router.replace("/");
  }, [booting, session, router]);

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

  if (!booting && !session && !isEmbeddedExtension()) {
    return (
      <div className="focal-root">
        <div className="focal-bg solid-theme" />
        <div className="focal-content" style={{ justifyContent: "center", color: "rgba(255,255,255,0.7)" }}>
          Redirecting…
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
            <>
              <button
                className="focal-btn primary"
                type="button"
                onClick={() => {
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
          {focusHud?.running || focusHud?.focusSessionActive ? (
            <div className="focal-obs-live-pill" aria-live="polite">
              <span className="focal-obs-live-pill-main">{focusHud.running ? "Focusing" : "Paused"}</span>
              {mainTab !== "focus" && focusHud ? (
                <span className="focal-obs-live-pill-time">
                  {`${String(Math.floor(focusHud.remainingSec / 60)).padStart(2, "0")}:${String(focusHud.remainingSec % 60).padStart(2, "0")}`}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="focal-obs-datetime-block">
            <div className="focal-obs-datetime-date">
              {clock.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </div>
            <div className="focal-obs-datetime-time">{formatClock(clock, profile?.clock_format ?? "24hr")}</div>
          </div>
          <p className="focal-obs-greeting">{formatGreetingLine(profile?.greeting_template ?? null, name, clock.getHours())}</p>

          <section className="focal-obs-schedule" aria-labelledby="focal-obs-schedule-h">
            <h2 id="focal-obs-schedule-h" className="focal-obs-side-label">
              Next up
            </h2>
            {calendarEvents === null ? (
              <p className="focal-obs-schedule-hint">Connect Google Calendar to see what&apos;s ahead.</p>
            ) : upcomingSidebarEvents.length === 0 ? (
              <p className="focal-obs-schedule-hint">Nothing scheduled in the next two weeks.</p>
            ) : (
              <ul className="focal-obs-schedule-list">
                {upcomingSidebarEvents.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      className="focal-obs-schedule-row"
                      onClick={() => setPanel("calendar")}
                      title="Open calendar"
                    >
                      <span className="focal-obs-schedule-title">{e.title}</span>
                      <span className="focal-obs-schedule-when">{formatEventSidebarWhen(e, clock)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <main className="focal-obs-main">
          <div className="focal-obs-main-top">
            <nav className="focal-obs-main-tabs" aria-label="Main views">
              {(["focus", "learn"] as const).map((t) => (
                <button key={t} type="button" className={mainTab === t ? "active" : ""} onClick={() => setMainTabPersist(t)}>
                  {t === "focus" ? (
                    "Focus"
                  ) : (
                    <span className="focal-obs-main-tab-label">
                      Learn
                      {learnNeedsAttention ? <span className="focal-obs-main-tab-dot" aria-hidden /> : null}
                    </span>
                  )}
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
                ref={settingsAnchorRef}
                type="button"
                className="focal-obs-icon-btn focal-obs-icon-btn--settings"
                aria-label="Open settings"
                aria-expanded={panel === "settings"}
                aria-haspopup="dialog"
                onClick={() => setPanel((p) => (p === "settings" ? "none" : "settings"))}
                title="Settings"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </div>

          {mainTab === "learn" && session?.user ? (
            <div className="focal-obs-tab-panel focal-obs-tab-learn">
              <LearnPanel
                supabase={supabase}
                userId={session.user.id}
                displayName={name}
                clock={clock}
                focusLogs={focusLogs}
                onFocusLogUpdated={(row) => setFocusLogs((rows) => rows.map((r) => (r.id === row.id ? row : r)))}
                onSyncError={onSyncErrorFlash}
                accessToken={session.access_token}
                onAttentionChange={setLearnNeedsAttention}
              />
            </div>
          ) : null}

          <div className="focal-obs-tab-panel focal-obs-tab-focus" hidden={mainTab !== "focus"}>
            <FocusOverlay
              variant="inline"
              open={mainTab === "focus"}
              onClose={() => setMainTabPersist("focus")}
              defaultFocusMinutes={profile?.focus_duration ?? 25}
              defaultBreakMinutes={profile?.break_duration ?? 5}
              onSessionEnd={(p) => void handleFocusSessionEnd(p)}
              onHeroTelemetry={setFocusHud}
              onOpenHistory={() => {
                try {
                  localStorage.setItem("focal_learn_sub_tab", "sessions");
                } catch {
                  /* ignore */
                }
                setMainTabPersist("learn");
              }}
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

      <div className="focal-bottom focal-bottom--obs">
        <div className="focal-bottom-slot focal-bottom-slot--left">
          <span className="focal-credit">Li Jiang, China</span>
        </div>
        <div className="focal-bottom-slot focal-bottom-slot--center">
          <span className="focal-obs-focus-stat-pill" aria-live="polite">
            {focusMinutesToday}m focused today
          </span>
        </div>
        <div className="focal-bottom-slot focal-bottom-slot--right" aria-hidden="true" />
      </div>

      {offlineFlash ? <div className="focal-offline">Offline — changes will sync</div> : null}

      <SlidePanel open={panel === "calendar"} onClose={() => setPanel("none")} anchor="right" title="Calendar">
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

      {panel === "settings" && session?.user && settingsDropdownLayout && typeof document !== "undefined"
        ? createPortal(
            <>
              <div
                className="focal-settings-drop-backdrop"
                aria-hidden
                onClick={() => setPanel("none")}
              />
              <div
                className="focal-settings-dropdown"
                role="dialog"
                aria-modal="true"
                aria-label="Settings"
                style={{
                  position: "fixed",
                  top: settingsDropdownLayout.top,
                  left: settingsDropdownLayout.left,
                  width: settingsDropdownLayout.width,
                  maxHeight: settingsDropdownLayout.maxHeight,
                }}
              >
                <button
                  type="button"
                  className="focal-settings-dropdown-close"
                  aria-label="Close settings"
                  onClick={() => setPanel("none")}
                >
                  ×
                </button>
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
              </div>
            </>,
            document.body
          )
        : null}

      {session?.user && taskLists.length > 0 ? (
        <TasksDock
          supabase={supabase}
          userId={session.user.id}
          taskLists={taskLists}
          tasks={taskRows}
          onListsChange={setTaskLists}
          onTasksChange={setTaskRows}
          onSyncError={onSyncErrorFlash}
        />
      ) : null}
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
  if (!events.length) return <p style={{ color: "rgba(255,255,255,0.75)" }}>Nothing scheduled in this window.</p>;
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

