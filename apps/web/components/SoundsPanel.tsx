"use client";

import { useEffect, useMemo, useState } from "react";
import { SoundGlyph } from "@/lib/sound-glyph";
import { FocalAudioEngine, SOUND_CATALOG, isValidSoundId, type SoundId } from "@/lib/sounds-engine";

type UiTab = "recent" | "soundscapes" | "binaural" | "spotify" | "youtube" | "custom";

interface Props {
  open: boolean;
  onClose: () => void;
  engine: FocalAudioEngine | null;
}

const RECENT_KEY = "focal_sound_recent";

function readRecent(): SoundId[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return parsed.filter((x): x is SoundId => isValidSoundId(x));
  } catch {
    return [];
  }
}

function pushRecent(id: SoundId) {
  const cur = readRecent().filter((x) => x !== id);
  cur.unshift(id);
  localStorage.setItem(RECENT_KEY, JSON.stringify(cur.slice(0, 12)));
}

function labelFor(id: SoundId): string {
  return SOUND_CATALOG.find((s) => s.id === id)?.label ?? id;
}

export function SoundsPanel({ open, onClose, engine }: Props) {
  const [tab, setTab] = useState<UiTab>("soundscapes");
  const [recent, setRecent] = useState<SoundId[]>([]);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [, bump] = useState(0);

  useEffect(() => {
    if (open) setRecent(readRecent());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => bump((x) => x + 1), 500);
    return () => window.clearInterval(id);
  }, [open]);

  const activeIds = engine ? engine.getActiveSoundIds() : [];

  const tiles = useMemo(() => {
    if (tab === "recent") {
      return SOUND_CATALOG.filter((s) => recent.includes(s.id)).sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id));
    }
    if (tab === "soundscapes") return SOUND_CATALOG.filter((s) => s.family === "soundscape");
    if (tab === "binaural") return SOUND_CATALOG.filter((s) => s.family === "binaural");
    return [];
  }, [tab, recent]);

  if (!open) return null;

  const toggle = async (id: SoundId) => {
    if (!engine) return;
    await engine.toggle(id);
    pushRecent(id);
    setRecent(readRecent());
    bump((x) => x + 1);
  };

  const setVol = (id: SoundId, v: number) => {
    engine?.setVolume(id, v);
    bump((x) => x + 1);
  };

  const tabBtn = (id: UiTab, label: string) => (
    <button key={id} type="button" className={`focal-sounds-tab ${tab === id ? "is-active" : ""}`} onClick={() => setTab(id)}>
      {label}
    </button>
  );

  return (
    <div className="focal-focus-overlay focal-sounds-overlay" style={{ zIndex: 80 }}>
      <div className="focal-panel-backdrop" onClick={onClose} />
      <div className="focal-sounds-shell">
        <header className="focal-sounds-header">
          <div className="focal-sounds-header-title">
            <span className="focal-sounds-header-icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </span>
            <h2 className="focal-sounds-heading">Sounds</h2>
          </div>
          <div className="focal-sounds-header-actions">
            <button type="button" className="focal-sounds-icon-btn" aria-label="Add (coming soon)" title="Coming soon" disabled>
              +
            </button>
            <button type="button" className="focal-sounds-close" aria-label="Close sounds" onClick={onClose}>
              ×
            </button>
          </div>
        </header>

        <div className="focal-sounds-toolbar">
          <div className="focal-sounds-tabs" role="tablist" aria-label="Sound categories">
            {tabBtn("recent", "Recent")}
            {tabBtn("soundscapes", "Soundscapes")}
            {tabBtn("binaural", "Binaural")}
            {tabBtn("spotify", "Spotify")}
            {tabBtn("youtube", "YouTube")}
            {tabBtn("custom", "Custom")}
          </div>
          <button
            type="button"
            className={`focal-sounds-now-btn ${activeIds.length ? "has-active" : ""}`}
            onClick={() => setNowPlayingOpen((o) => !o)}
            aria-expanded={nowPlayingOpen}
          >
            Now playing
            <span aria-hidden>→</span>
          </button>
        </div>

        {nowPlayingOpen && activeIds.length > 0 ? (
          <div className="focal-sounds-now-panel" role="region" aria-label="Now playing">
            {activeIds.map((id) => (
              <div key={id} className="focal-sounds-now-row">
                <span className="focal-sounds-now-name">{labelFor(id)}</span>
                <input
                  type="range"
                  className="focal-sounds-now-slider"
                  min={0}
                  max={100}
                  value={Math.round((engine?.getVolume(id) ?? 0.5) * 100)}
                  onChange={(e) => setVol(id, Number(e.target.value) / 100)}
                  aria-label={`Volume for ${labelFor(id)}`}
                />
                <button type="button" className="focal-sounds-now-stop" onClick={() => void engine?.toggle(id)}>
                  Stop
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="focal-sounds-body">
          {tab === "recent" && tiles.length === 0 ? (
            <p className="focal-sounds-empty">Play a sound to build your recent list.</p>
          ) : null}
          {tab === "binaural" ? (
            <p className="focal-sounds-hint">Use stereo headphones for binaural beats. You can layer a soundscape underneath.</p>
          ) : null}
          {tab === "spotify" ? (
            <div className="focal-sounds-placeholder">
              <p>
                <strong>Spotify</strong> is not embedded here — open Spotify in another tab and play your focus playlist while Focal runs.
              </p>
              <p className="focal-sounds-placeholder-sub">Native mixing inside Focal may arrive in a future update.</p>
            </div>
          ) : null}
          {tab === "youtube" ? (
            <div className="focal-sounds-placeholder">
              <p>
                <strong>YouTube</strong> focus mixes work best in a separate tab so the timer and blocker stay uninterrupted.
              </p>
            </div>
          ) : null}
          {tab === "custom" ? (
            <div className="focal-sounds-placeholder">
              <p>
                <strong>Custom</strong> uploads are not available yet. Every texture here is generated in high quality in your browser — no
                compressed loops.
              </p>
            </div>
          ) : null}

          {tab === "recent" || tab === "soundscapes" || tab === "binaural" ? (
            <div className="focal-sounds-grid">
              {tiles.map((s) => {
                const active = engine?.isPlaying(s.id) ?? false;
                return (
                  <div
                    key={s.id}
                    className={`focal-sound-card ${active ? "is-active" : ""}`}
                    style={{ backgroundImage: s.gradient }}
                    title={s.tooltip}
                  >
                    <div className="focal-sound-card-shade" aria-hidden />
                    <button type="button" className="focal-sound-card-hit" onClick={() => void toggle(s.id)} aria-pressed={active}>
                      <span className="focal-sound-card-icon">
                        <SoundGlyph id={s.id} />
                      </span>
                      <span className="focal-sound-card-label">{s.label}</span>
                    </button>
                    <div className={`focal-sound-card-vol ${active ? "is-visible" : ""}`}>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round((engine?.getVolume(s.id) ?? 0.5) * 100)}
                        onChange={(e) => setVol(s.id, Number(e.target.value) / 100)}
                        aria-label={`Volume for ${s.label}`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
