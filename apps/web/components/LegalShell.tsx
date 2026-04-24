import Link from "next/link";

export default function LegalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="focal-root">
      <div className="focal-bg solid-theme" />
      <div className="focal-content focal-legal-wrap">
        <nav className="focal-legal-nav">
          <Link href="/login" className="focal-btn" style={{ display: "inline-flex" }}>
            ← Focal
          </Link>
          <span className="focal-legal-nav-sep" aria-hidden>
            |
          </span>
          <Link href="/privacy" className="focal-legal-nav-link">
            Privacy
          </Link>
          <span className="focal-legal-nav-dot" aria-hidden>
            ·
          </span>
          <Link href="/terms" className="focal-legal-nav-link">
            Terms
          </Link>
        </nav>
        <article className="focal-legal-doc">{children}</article>
      </div>
    </div>
  );
}
