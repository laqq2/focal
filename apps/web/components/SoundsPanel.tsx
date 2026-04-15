"use client";

import { useEffect, useState } from "react";
import { FocalAudioEngine, SOUND_CATALOG, type SoundId } from "@/lib/sounds-engine";

type SoundTab = "recent" | "soundscapes" | "binaural";

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
    return JSON.parse(raw) as SoundId[];
  } catch {
    return [];
  }
}

function pushRecent(id: SoundId) {
  const cur = readRecent().filter((x) => x !== id);
  cur.unshift(id);
  localStorage.setItem(RECENT_KEY, JSON.stringify(cur.slice(0, 8)));
}

export function SoundsPanel({ open, onClose, engine }: Props) {
  const [tab, setTab] = useState<SoundTab>("soundscapes");
  const [recent, setRecent] = useState<SoundId[]>([]);
  const [, bump] = useState(0);

  useEffect(() => {
    if (open) setRecent(readRecent());
  }, [open]);

  if (!open) return null;

  const tiles =
    tab === "recent"
      ? SOUND_CATALOG.filter((s) => recent.includes(s.id)).sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id))
      : tab === "soundscapes"
        ? SOUND_CATALOG.filter((s) => s.tab === "ambient")
        : SOUND_CATALOG.filter((s) => s.tab === "binaural");

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

  return (
    <div className="focal-focus-overlay" style={{ zIndex: 80 }}>
      <div className="focal-panel-backdrop" onClick={onClose} />
      <div className="focal-panel" style={{ width: "min(720px, 94vw)", maxHeight: "78vh", overflow: "hidden" }}>
        <div className="focal-panel-header">
          <strong>Sounds</strong>
          <button className="focal-btn" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="focal-panel-body">
          <div className="focal-tabs" style={{ marginBottom: "0.75rem" }}>
            <button type="button" className={tab === "recent" ? "active" : ""} onClick={() => setTab("recent")}>
              Recent
            </button>
            <button type="button" className={tab === "soundscapes" ? "active" : ""} onClick={() => setTab("soundscapes")}>
              Soundscapes
            </button>
            <button type="button" className={tab === "binaural" ? "active" : ""} onClick={() => setTab("binaural")}>
              Binaural
            </button>
          </div>
          {tab === "recent" && tiles.length === 0 ? (
            <p style={{ color: "rgba(255,255,255,0.65)" }}>Play a sound to build your recent list.</p>
          ) : null}
          {tab === "binaural" ? (
            <p style={{ color: "rgba(255,255,255,0.65)", marginTop: 0 }}>
              Stereo headphones recommended. Layer with soundscapes if you like.
            </p>
          ) : null}
          <div className="focal-sound-grid">
            {tiles.map((s) => {
              const active = engine?.isPlaying(s.id) ?? false;
              return (
                <div key={s.id} className={`focal-sound-tile ${active ? "active" : ""}`} title={s.tooltip}>
                  <button
                    type="button"
                    onClick={() => void toggle(s.id)}
                    style={{
                      all: "unset",
                      cursor: "pointer",
                      width: "100%",
                      display: "block",
                    }}
                  >
                    <div style={{ fontSize: "1.4rem" }}>{s.emoji}</div>
                    <div style={{ fontSize: "0.92rem", marginTop: "0.25rem" }}>{s.label}</div>
                  </button>
                  <div className="vol">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round((engine?.getVolume(s.id) ?? 0.5) * 100)}
                      onChange={(e) => setVol(s.id, Number(e.target.value) / 100)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
