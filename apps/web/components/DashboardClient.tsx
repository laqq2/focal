"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import {
  BLOCKER_PRESETS,
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
import { fetchMelbourneWeather, fetchWeatherByCoords, type WeatherState } from "@/lib/weather";
import { fetchTodayEvents, type CalendarEventItem } from "@/lib/calendar";
import { FocusOverlay, type FocusSessionEndPayload } from "@/components/FocusOverlay";
import { HomeMementoCard } from "@/components/HomeMementoCard";
import { TasksDock } from "@/components/TasksDock";

const LINKS_KEY = "focal_links_v1";

type LinkItem = { label: string; url: string };

function readLinks(): LinkItem[] {
  try {
    const raw = localStorage.getItem(LINKS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LinkItem[];
  } catch {
    return [];
  }
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
    quote_style: "motivational",
    custom_quotes: null,
    show_memento_widget: false,
    theme: "photo",
  };
}

export default function DashboardClient() {
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
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [bgBroken, setBgBroken] = useState(false);

  const [panel, setPanel] = useState<"none" | "blocker" | "calendar" | "links" | "focusHistory">("none");
  const [focusOpen, setFocusOpen] = useState(false);
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusLogs, setFocusLogs] = useState<FocusLogRow[]>([]);

  const [links, setLinks] = useState<LinkItem[]>([]);
  const [taskLists, setTaskLists] = useState<TaskListRow[]>([]);
  const [taskRows, setTaskRows] = useState<TaskRow[]>([]);

  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[] | null>(null);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const goalDebounce = useRef<number | null>(null);

  const today = todayIsoLocal();

  const focusMinutesToday = useMemo(() => {
    const row = focusRows.find((r) => r.date === today);
    return row?.minutes_focused ?? 0;
  }, [focusRows, today]);

  const quote = useMemo(() => {
    const style = (profile?.quote_style ?? "motivational") as QuoteStyle;
    const custom = profile?.custom_quotes
      ?.split("\n")
      .map((l) => l.trim())
      .filter(Boolean) ?? null;
    return pickDailyQuote(style, custom);
  }, [profile]);

  const name = profile?.name?.trim() || "Friend";

  useEffect(() => {
    setClock(new Date());
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setLinks(readLinks());
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        if (navigator.geolocation) {
          await new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                try {
                  const w = await fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude, "Here");
                  setWeather(w);
                } catch {
                  setWeather(await fetchMelbourneWeather());
                }
                resolve();
              },
              async () => {
                try {
                  setWeather(await fetchMelbourneWeather());
                } catch {
                  setWeather({ label: "Melbourne", tempC: 0, icon: "⛅" });
                }
                resolve();
              },
              { maximumAge: 60_000, timeout: 8000 }
            );
          });
        } else {
          setWeather(await fetchMelbourneWeather());
        }
      } catch {
        setWeather({ label: "Melbourne", tempC: 0, icon: "⛅" });
      }
    })();
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

  const loadCalendar = useCallback(async () => {
    setCalendarBusy(true);
    setCalendarError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.provider_token;
      if (!token) {
        setCalendarError("missing_token");
        setCalendarEvents([]);
        setCalendarBusy(false);
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
        setCalendarBusy(false);
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
      setCalendarError((e as Error).message);
      setCalendarEvents([]);
    } finally {
      setCalendarBusy(false);
    }
  }, [supabase, today]);

  useEffect(() => {
    if (panel === "calendar" && session) void loadCalendar();
  }, [panel, session, loadCalendar]);

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
            <button
              className="focal-btn primary"
              type="button"
              onClick={() =>
                void supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: {
                    redirectTo: `${process.env.NEXT_PUBLIC_APP_ORIGIN ?? window.location.origin}/app`,
                    scopes: "https://www.googleapis.com/auth/calendar.readonly",
                    queryParams: { access_type: "offline", prompt: "consent" },
                  },
                })
              }
            >
              Continue with Google
            </button>
            <div style={{ margin: "1rem 0", color: "rgba(255,255,255,0.45)", fontSize: "0.85rem" }}>or</div>
            <MagicLink supabase={supabase} />
            <button className="focal-btn" type="button" style={{ marginTop: "0.75rem" }} onClick={() => (window.location.href = "/login")}>
              Open full login page
            </button>
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
      <div className="focal-content">
        <div className="focal-topbar">
          <div className="focal-top-wrap">
            <div className="focal-corner-nav">
              <button className="focal-corner-btn" type="button" onClick={() => setPanel("links")}>
                <span className="focal-corner-ico" aria-hidden>
                  🔗
                </span>
                Links
              </button>
              <button className="focal-corner-btn" type="button" onClick={() => setFocusOpen(true)}>
                <span className="focal-corner-ico" aria-hidden>
                  🎯
                </span>
                Focus
              </button>
              <button className="focal-corner-btn" type="button" onClick={() => setPanel("blocker")}>
                <span className="focal-corner-ico" aria-hidden>
                  🛑
                </span>
                Blocker
              </button>
            </div>
            {focusOpen && focusRunning ? (
              <div className="focal-top-center">
                <div className="focal-pill live">Focusing</div>
              </div>
            ) : null}
            <div className="focal-top-right">
              <div className="focal-pill muted">
                <span aria-hidden>⏱</span>
                {focusMinutesToday}m Focused Today
              </div>
              {weather ? (
                <div className="focal-pill muted">
                  <span aria-hidden>{weather.icon}</span>
                  {weather.tempC}° {weather.label}
                </div>
              ) : null}
              <button className="focal-corner-btn" type="button" aria-label="Calendar" onClick={() => setPanel("calendar")}>
                <span className="focal-corner-ico" aria-hidden>
                  📅
                </span>
                Cal
              </button>
              <Link href="/settings" className="focal-corner-btn" aria-label="Settings">
                <span className="focal-corner-ico" aria-hidden>
                  ⚙️
                </span>
                Settings
              </Link>
            </div>
          </div>
        </div>

        <div className="focal-clock">{formatClock(clock, profile?.clock_format ?? "24hr")}</div>
        <div className="focal-greeting">
          {formatGreetingLine(profile?.greeting_template ?? null, name, clock.getHours())}
        </div>
        <div className="focal-goal">
          <input
            value={goalText}
            onChange={(e) => onGoalChange(e.target.value)}
            placeholder="What is your main goal for today?"
          />
        </div>
        {session?.user ? (
          <HomeMementoCard memento={memento} userId={session.user.id} supabase={supabase} onChange={setMemento} />
        ) : null}
      </div>

      <div className="focal-bottom">
        <div className="focal-credit">
          <span>Li Jiang, China</span>
          <Link href="/settings" className="focal-icon-btn focal-bottom-settings" aria-label="Open settings">
            ⚙️
          </Link>
        </div>
      </div>

      <div className="focal-quote">{quote}</div>

      {offlineFlash ? <div className="focal-offline">Offline — changes will sync</div> : null}

      <SlidePanel open={panel === "blocker"} onClose={() => setPanel("none")} anchor="left" title="Site blocker">
        <p style={{ color: "rgba(255,255,255,0.7)", marginTop: 0 }}>
          {isEmbeddedExtension()
            ? "Blocking runs inside the browser extension."
            : "Install the Focal extension to enforce blocks. You can still manage your list here."}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "0.75rem" }}>
          <span>Blocker Active</span>
          <button
            type="button"
            className={`focal-switch ${blockerActive ? "on" : ""}`}
            aria-pressed={blockerActive}
            onClick={() => toggleBlocker(!blockerActive)}
          />
        </div>
        <BlockerForm onAdd={(d) => void addBlocked(d)} />
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", margin: "0.75rem 0" }}>
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
      </SlidePanel>

      <SlidePanel open={panel === "calendar"} onClose={() => setPanel("none")} anchor="right" title="Today">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
          <button className="focal-btn" type="button" onClick={() => void loadCalendar()}>
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
              onClick={() =>
                void supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: {
                    redirectTo: `${process.env.NEXT_PUBLIC_APP_ORIGIN ?? window.location.origin}/app`,
                    scopes: "https://www.googleapis.com/auth/calendar.readonly",
                    queryParams: { access_type: "offline", prompt: "consent" },
                  },
                })
              }
            >
              Sign in with Google
            </button>
          </div>
        ) : null}
        {calendarError && calendarError !== "missing_token" ? <p style={{ color: "#fecaca" }}>{calendarError}</p> : null}
        {calendarEvents ? <CalendarList events={calendarEvents} /> : null}
      </SlidePanel>

      <SlidePanel open={panel === "links"} onClose={() => setPanel("none")} anchor="left" title="Links">
        <LinksEditor
          items={links}
          onChange={(next) => {
            setLinks(next);
            localStorage.setItem(LINKS_KEY, JSON.stringify(next));
          }}
        />
      </SlidePanel>

      <SlidePanel open={panel === "focusHistory"} onClose={() => setPanel("none")} anchor="right" title="Focus history">
        {focusLogs.length === 0 ? (
          <p style={{ color: "rgba(255,255,255,0.65)", marginTop: 0 }}>Completed sessions will appear here.</p>
        ) : (
          focusLogs.map((log) => (
            <FocusHistoryCard key={log.id} log={log} />
          ))
        )}
      </SlidePanel>

      <FocusOverlay
        open={focusOpen}
        onClose={() => setFocusOpen(false)}
        defaultFocusMinutes={profile?.focus_duration ?? 25}
        defaultBreakMinutes={profile?.break_duration ?? 5}
        onSessionEnd={(p) => void handleFocusSessionEnd(p)}
        onRunningChange={setFocusRunning}
        onOpenHistory={() => {
          setPanel("focusHistory");
        }}
      />

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
          const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? window.location.origin;
          const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/app` } });
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
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchor: "left" | "right";
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div className="focal-panel-backdrop" onClick={onClose} />
      <div
        className="focal-panel"
        style={{
          top: 88,
          [anchor]: 16,
          width: wide ? "min(560px, 94vw)" : "min(420px, 94vw)",
          maxHeight: "78vh",
        }}
      >
        <div className="focal-panel-header">
          <strong>{title}</strong>
          <button className="focal-btn" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="focal-panel-body">{children}</div>
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

function LinksEditor({ items, onChange }: { items: LinkItem[]; onChange: (n: LinkItem[]) => void }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  return (
    <div>
      <div style={{ display: "flex", gap: "0.35rem", flexDirection: "column" }}>
        <input className="focal-input" placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className="focal-input" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button
          className="focal-btn primary"
          type="button"
          onClick={() => {
            if (!url.trim()) return;
            onChange([...items, { label: label.trim() || url.trim(), url: url.trim() }]);
            setLabel("");
            setUrl("");
          }}
        >
          Add link
        </button>
      </div>
      {items.map((l, i) => (
        <div key={`${l.url}-${i}`} className="focal-list-row">
          <a href={l.url} target="_blank" rel="noreferrer">
            {l.label}
          </a>
          <button className="focal-btn" type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
