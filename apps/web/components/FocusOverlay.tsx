"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FocusDistraction } from "@focal/shared";
import { FocalAudioEngine } from "@/lib/sounds-engine";
import { SoundsPanel } from "@/components/SoundsPanel";

type Tab = "focus" | "break";

export interface FocusSessionEndPayload {
  plannedMinutes: number;
  actualMinutes: number;
  intent: string;
  distractions: FocusDistraction[];
  startedAt: string | null;
  endedAt: string;
  completedNaturally: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  defaultFocusMinutes: number;
  defaultBreakMinutes: number;
  onSessionEnd: (payload: FocusSessionEndPayload) => void;
  onRunningChange?: (running: boolean) => void;
  onOpenHistory?: () => void;
}

const engineSingleton = typeof window !== "undefined" ? new FocalAudioEngine() : null;

const DURATION_CHIPS = [15, 25, 45, 60];

function playChime(ctx: AudioContext) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(880, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35);
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
  o.connect(g);
  g.connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + 0.5);
}

export function FocusOverlay({
  open,
  onClose,
  defaultFocusMinutes,
  defaultBreakMinutes,
  onSessionEnd,
  onRunningChange,
  onOpenHistory,
}: Props) {
  const [tab, setTab] = useState<Tab>("focus");
  const [focusLen, setFocusLen] = useState(defaultFocusMinutes);
  const [breakLen, setBreakLen] = useState(defaultBreakMinutes);
  const [remaining, setRemaining] = useState(defaultFocusMinutes * 60);
  const [running, setRunning] = useState(false);
  const [intent, setIntent] = useState("");
  const [distractionDraft, setDistractionDraft] = useState("");
  const [distractions, setDistractions] = useState<FocusDistraction[]>([]);
  const [soundsOpen, setSoundsOpen] = useState(false);

  const tickRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const baseRemainingRef = useRef<number>(defaultFocusMinutes * 60);
  const handledZeroRef = useRef(false);
  const focusSessionStartedAtIso = useRef<string | null>(null);

  const plannedSeconds = tab === "focus" ? focusLen * 60 : breakLen * 60;

  const radius = 118;
  const size = 280;
  const circumference = 2 * Math.PI * radius;
  const progress = plannedSeconds > 0 ? 1 - remaining / plannedSeconds : 0;
  const dashOffset = circumference * progress;

  useEffect(() => {
    onRunningChange?.(running);
  }, [running, onRunningChange]);

  useEffect(() => {
    if (!open) onRunningChange?.(false);
  }, [open, onRunningChange]);

  useEffect(() => {
    if (!open) return;
    setTab("focus");
    setFocusLen(defaultFocusMinutes);
    setBreakLen(defaultBreakMinutes);
    setRemaining(defaultFocusMinutes * 60);
    baseRemainingRef.current = defaultFocusMinutes * 60;
    setRunning(false);
    startedAtRef.current = null;
    handledZeroRef.current = false;
    focusSessionStartedAtIso.current = null;
    setDistractions([]);
    setDistractionDraft("");
    setIntent("");
  }, [open, defaultFocusMinutes, defaultBreakMinutes]);

  useEffect(() => {
    if (!open) return;
    baseRemainingRef.current = plannedSeconds;
    setRemaining(plannedSeconds);
    setRunning(false);
    startedAtRef.current = null;
    handledZeroRef.current = false;
    if (tab === "focus") {
      focusSessionStartedAtIso.current = null;
      setDistractions([]);
    }
  }, [tab, plannedSeconds, open]);

  const intentRef = useRef(intent);
  const distrRef = useRef(distractions);
  const focusLenRef = useRef(focusLen);
  useEffect(() => {
    intentRef.current = intent;
  }, [intent]);
  useEffect(() => {
    distrRef.current = distractions;
  }, [distractions]);
  useEffect(() => {
    focusLenRef.current = focusLen;
  }, [focusLen]);

  const onSessionEndRef = useRef(onSessionEnd);
  useEffect(() => {
    onSessionEndRef.current = onSessionEnd;
  }, [onSessionEnd]);

  const finalizeFocusSession = (completedNaturally: boolean) => {
    const planned = focusLenRef.current;
    const elapsedSession = focusSessionStartedAtIso.current
      ? (Date.now() - new Date(focusSessionStartedAtIso.current).getTime()) / 1000
      : 0;
    const actualSeconds = completedNaturally ? planned * 60 : Math.min(planned * 60, Math.max(0, elapsedSession));
    const actualMinutes = completedNaturally ? planned : Math.max(0, Math.round(actualSeconds / 60));
    const intentStr = intentRef.current.trim();
    const dists = [...distrRef.current];
    if (actualMinutes <= 0 && dists.length === 0 && !intentStr) return;
    onSessionEndRef.current({
      plannedMinutes: planned,
      actualMinutes,
      intent: intentStr,
      distractions: dists,
      startedAt: focusSessionStartedAtIso.current,
      endedAt: new Date().toISOString(),
      completedNaturally,
    });
    focusSessionStartedAtIso.current = null;
    setDistractions([]);
  };

  useEffect(() => {
    if (!running) {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    tickRef.current = window.setInterval(() => {
      if (!startedAtRef.current) return;
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      const next = Math.max(0, baseRemainingRef.current - elapsed);
      setRemaining(next);
      if (next <= 0 && !handledZeroRef.current) {
        handledZeroRef.current = true;
        setRunning(false);
        void (async () => {
          const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const ctx = new Ctx();
          if (ctx.state === "suspended") await ctx.resume();
          playChime(ctx);
        })();
        if (tab === "focus") {
          finalizeFocusSession(true);
          setTab("break");
        } else {
          setTab("focus");
        }
      }
    }, 250);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [running, tab]);

  const toggleRun = async () => {
    if (remaining <= 0) {
      setRemaining(plannedSeconds);
      baseRemainingRef.current = plannedSeconds;
    }
    if (!running) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      if (ctx.state === "suspended") await ctx.resume();
      startedAtRef.current = Date.now();
      baseRemainingRef.current = remaining;
      if (tab === "focus" && !focusSessionStartedAtIso.current) {
        focusSessionStartedAtIso.current = new Date().toISOString();
      }
      setRunning(true);
    } else {
      const elapsed = startedAtRef.current ? (Date.now() - startedAtRef.current) / 1000 : 0;
      const left = Math.max(0, baseRemainingRef.current - elapsed);
      baseRemainingRef.current = left;
      setRemaining(left);
      startedAtRef.current = null;
      setRunning(false);
    }
  };

  const addDistraction = () => {
    const t = distractionDraft.trim();
    if (!t || tab !== "focus" || !running) return;
    setDistractions((d) => [...d, { note: t, at: new Date().toISOString() }]);
    setDistractionDraft("");
  };

  const saveAndResetFocus = () => {
    if (tab !== "focus") return;
    setRunning(false);
    startedAtRef.current = null;
    finalizeFocusSession(false);
    setRemaining(focusLen * 60);
    baseRemainingRef.current = focusLen * 60;
    handledZeroRef.current = false;
  };

  const fmt = useMemo(() => {
    const m = Math.floor(remaining / 60);
    const s = Math.floor(remaining % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [remaining]);

  if (!open) return null;

  return (
    <div className="focal-focus-overlay">
      <div className="focal-focus-scrim" onClick={onClose} />
      <div className="focal-focus-shell focal-panel">
        <div className="focal-focus-toprow">
          <div className="focal-focus-tabs">
            <button type="button" className={tab === "focus" ? "active" : ""} disabled={running} onClick={() => setTab("focus")}>
              FOCUS
            </button>
            <button type="button" className={tab === "break" ? "active" : ""} disabled={running} onClick={() => setTab("break")}>
              BREAK
            </button>
          </div>
          <div className="focal-focus-top-actions">
            {onOpenHistory ? (
              <button className="focal-glass-btn" type="button" onClick={onOpenHistory}>
                History
              </button>
            ) : null}
            <button className="focal-glass-btn" type="button" onClick={() => setSoundsOpen(true)} aria-label="Sounds">
              Sounds
            </button>
          </div>
        </div>

        {tab === "focus" ? (
          <div className="focal-duration-row">
            <span className="focal-duration-label">Length</span>
            <div className="focal-duration-chips">
              {DURATION_CHIPS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={focusLen === m ? "active" : ""}
                  disabled={running}
                  onClick={() => setFocusLen(m)}
                >
                  {m}m
                </button>
              ))}
            </div>
            <label className="focal-duration-custom">
              <span>Custom</span>
              <input
                type="number"
                min={1}
                max={180}
                value={focusLen}
                disabled={running}
                onChange={(e) => setFocusLen(Math.min(180, Math.max(1, Number(e.target.value) || 1)))}
              />
            </label>
          </div>
        ) : (
          <div className="focal-duration-row">
            <span className="focal-duration-label">Break</span>
            <div className="focal-duration-chips">
              {[3, 5, 10, 15].map((m) => (
                <button
                  key={m}
                  type="button"
                  className={breakLen === m ? "active" : ""}
                  disabled={running}
                  onClick={() => setBreakLen(m)}
                >
                  {m}m
                </button>
              ))}
            </div>
            <label className="focal-duration-custom">
              <span>Custom</span>
              <input
                type="number"
                min={1}
                max={60}
                value={breakLen}
                disabled={running}
                onChange={(e) => setBreakLen(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
              />
            </label>
          </div>
        )}

        <div className="focal-focus-ring-wrap">
          <svg className="focal-focus-svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle className="focal-focus-track" cx={size / 2} cy={size / 2} r={radius} />
            <circle
              className="focal-focus-progress"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeDasharray={`${circumference}`}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="focal-focus-center">
            <div className="focal-focus-time">{fmt}</div>
            <label className="focal-focus-intent">
              <span>I will focus on…</span>
              <input
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                placeholder="Writing, design, deep work…"
                disabled={running && tab === "focus"}
              />
            </label>
          </div>
        </div>

        {tab === "focus" ? (
          <div className="focal-distraction-block">
            <div className="focal-distraction-head">
              <span>Distraction log</span>
              <span className="focal-distraction-hint">{running ? "Tap log when something pulls you away" : "Start focus to log"}</span>
            </div>
            <div className="focal-distraction-input">
              <input
                value={distractionDraft}
                onChange={(e) => setDistractionDraft(e.target.value)}
                placeholder="What interrupted you?"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addDistraction();
                }}
                disabled={!running}
              />
              <button className="focal-glass-btn" type="button" disabled={!running} onClick={addDistraction}>
                Log
              </button>
            </div>
            {distractions.length ? (
              <ul className="focal-distraction-list">
                {distractions.map((d, i) => (
                  <li key={`${d.at}-${i}`}>
                    <span>{d.note}</span>
                    <button
                      type="button"
                      className="focal-distraction-remove"
                      aria-label="Remove"
                      onClick={() => setDistractions((x) => x.filter((_, idx) => idx !== i))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="focal-focus-footer">
          <button
            type="button"
            className={`focal-focus-play ${running ? "is-pause" : ""}`}
            onClick={() => void toggleRun()}
            aria-label={running ? "Pause" : "Play"}
          >
            {running ? "❚❚" : "▶"}
          </button>
          <div className="focal-focus-footer-secondary">
            {tab === "focus" ? (
              <button className="focal-glass-btn" type="button" onClick={saveAndResetFocus}>
                End &amp; save session
              </button>
            ) : null}
            <button className="focal-glass-btn subtle" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
      <SoundsPanel open={soundsOpen} onClose={() => setSoundsOpen(false)} engine={engineSingleton} />
    </div>
  );
}
