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

export function SoundGlyph({ id, className }: { id: SoundId; className?: string }) {
  switch (id) {
    case "gamma40":
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
      return (
        <svg {...svgProps} className={className} aria-hidden>
          <path d="M3 14c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2 2 2 2 2" />
          <path d="M3 18c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2 2 2 2 2" opacity={0.55} />
        </svg>
      );
    case "forest":
      return (
        <svg {...svgProps} className={className} aria-hidden>
          <path d="M12 3v18M9 8l3-4 3 4M7 13l5-5 5 5" />
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
    case "white":
      return (
        <svg {...svgProps} className={className} aria-hidden>
          <path d="M4 12h16M4 8h10M4 16h10" opacity={0.85} />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    default:
      return (
        <svg {...svgProps} className={className} aria-hidden>
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
  }
}
