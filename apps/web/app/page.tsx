import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Focal — A calm new tab for deep focus",
  description: "A calm new tab for deep focus. Timer, sounds, blocklist, calendar, and sync across devices.",
};

const FEATURES = [
  "Focus Timer",
  "Ambient Sounds",
  "Site Blocker",
  "Google Calendar",
  "Memento Mori",
  "Cross-device Sync",
] as const;

export default function HomePage() {
  return (
    <div className="focal-root">
      <div className="focal-bg solid-theme" />
      <div className="focal-content focal-landing">
        <header className="focal-landing-header">
          <Link href="/" className="focal-landing-brand" aria-label="Focal home">
            Focal
          </Link>
          <Link href="/login" className="focal-btn">
            Sign in
          </Link>
        </header>

        <main className="focal-landing-main">
          <section className="focal-landing-hero" aria-labelledby="focal-landing-title">
            <h1 id="focal-landing-title" className="focal-landing-title">
              Focal
            </h1>
            <p className="focal-landing-tagline">A calm new tab for deep focus.</p>
            <Link href="/login" className="focal-btn primary focal-landing-cta">
              Get started free
            </Link>
          </section>

          <section className="focal-landing-features" aria-labelledby="focal-landing-features-h">
            <h2 id="focal-landing-features-h" className="focal-landing-features-heading">
              Everything in one place
            </h2>
            <ul className="focal-landing-feature-list">
              {FEATURES.map((label) => (
                <li key={label} className="focal-landing-feature-item">
                  {label}
                </li>
              ))}
            </ul>
          </section>
        </main>

        <footer className="focal-landing-footer">
          <Link href="/privacy" className="focal-landing-footer-link">
            Privacy
          </Link>
          <span className="focal-landing-footer-sep" aria-hidden>
            ·
          </span>
          <Link href="/terms" className="focal-landing-footer-link">
            Terms
          </Link>
        </footer>
      </div>
    </div>
  );
}
