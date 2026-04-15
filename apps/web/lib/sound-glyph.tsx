import type { SoundId } from "@/lib/sounds-engine";

const svgProps = {
  width: 28,
  height: 28,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.65,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Minimal line icons for sound cards (inspired by focus-app sound pickers). */
export function SoundGlyph({ id, className }: { id: SoundId; className?: string }) {
  switch (id) {
    case "gamma40":
    case "alpha10":
      return (
        <svg {...svgProps} className={className} aria-hidden>
          <path d="M3 12c2.5-5 5.5-5 8 0s5.5 5 8 0" />
          <path d="M3 16c2.5-5 5.5-5 8 0s5.5 5 8 0" opacity={0.55} />
        </svg>
      );
    case "rain":
      return (
        <svg {...svgProps} className={className} aria-hidden>
          <path d="M8 4a4 4 0 0 1 8 0v2" />
          <path d="M7 14v4M10 12v6M13 14v4M16 12v6" />
        </svg>
      );
    case "ocean":
    case "beach":
      return (
        <svg {...svgProps} className={className} aria-hidden>
          <path d="M3 14c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2 2 2 2 2" />
          <path d="M3 18c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2 2 2 2 2" opacity={0.55} />
        </svg>
      );
    case "thunder":
      return (
        <svg {...svgProps} className={className} aria-hidden>
          <path d="M4 14h6l-2 4h4l-6 6" />
          <path d="M18 6a3 3 0 0 0-5.2-2" opacity={0.55} />
        </svg>
      );
    case "wind":
      return (
        <svg {...svgProps} className={className} aria-hidden>
          <path d="M4 9h12a3 3 0 1 0-3-3" />
          <path d="M6 14h14a2.5 2.5 0 1 1-2.5 2.5" opacity={0.75} />
          <path d="M8 19h8" opacity={0.5} />
        </svg>
      );
    case "forest":
    case "garden":
      return (
        <svg {...svgProps} className={className} aria-hidden>
          <path d="M12 3v18M9 8l3-4 3 4M7 13l5-5 5 5" />
        </svg>
      );
    case "creek":
      return (
        <svg {...svgProps} className={className} aria-hidden>
          <path d="M4 16c3-3 5 1 8-2s5 1 8-2" />
          <path d="M6 12c2-1 3 1 5-1" opacity={0.55} />
        </svg>
      );
    case "campfire":
      return (
        <svg {...svgProps} className={className} aria-hidden>
          <path d="M12 20c-3-4 1-7 0-10-2 2-4 5-3 8 1 2 2 2 3 2z" />
          <path d="M9 20h6" />
        </svg>
      );
    case "cafe":
      return (
        <svg {...svgProps} className={className} aria-hidden>
          <path d="M6 9h8v5a3 3 0 0 1-3 3H6" />
          <path d="M14 11h1a2 2 0 0 1 0 4h-1" />
          <path d="M7 20h8" opacity={0.55} />
        </svg>
      );
    case "office":
      return (
        <svg {...svgProps} className={className} aria-hidden>
          <rect x="5" y="4" width="14" height="16" rx="1" />
          <path d="M9 8h6M9 12h6M9 16h4" opacity={0.55} />
        </svg>
      );
    case "train":
      return (
        <svg {...svgProps} className={className} aria-hidden>
          <rect x="5" y="7" width="14" height="9" rx="1" />
          <path d="M8 20v-2M16 20v-2M6 11h12" />
          <circle cx="9" cy="20" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="20" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "night":
      return (
        <svg {...svgProps} className={className} aria-hidden>
          <path d="M18 5a6 6 0 0 1-8 8 7 7 0 0 0 8-8z" />
          <path d="M5 19l2-2M8 21l1-1" opacity={0.45} />
        </svg>
      );
    case "white":
    case "static":
      return (
        <svg {...svgProps} className={className} aria-hidden>
          <rect x="5" y="7" width="14" height="10" rx="1" />
          <path d="M8 10h.5M11 10h.5M14 10h.5M8 13h.5M11 13h.5M14 13h.5" strokeWidth={1.2} />
        </svg>
      );
    case "brown":
    case "pink":
      return (
        <svg {...svgProps} className={className} aria-hidden>
          <path d="M4 12h16M4 8h10M4 16h10" opacity={0.85} />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    case "fan":
      return (
        <svg {...svgProps} className={className} aria-hidden>
          <circle cx="12" cy="12" r="7" />
          <path d="M12 5v3M12 16v3M5 12h3M16 12h3" />
        </svg>
      );
    default:
      return (
        <svg {...svgProps} className={className} aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 5v2M12 17v2M5 12h2M17 12h2" opacity={0.5} />
        </svg>
      );
  }
}
