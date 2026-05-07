"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import FocalLogo from "@/components/FocalLogo";

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "Do I need to create an account?",
    a: "Yes — signing in with Google lets Focal sync your focus history, goals, and blocklist across your devices. We use Supabase for storage. Your Google account is only used for authentication and, optionally, calendar read access.",
  },
  {
    q: "What does Focal do with my calendar data?",
    a: "Calendar access is read-only and optional. We fetch upcoming events to display in the sidebar — nothing is stored on our servers beyond a short session cache. You can revoke access at any time from your Google account settings.",
  },
  {
    q: "Is Focal free?",
    a: "Yes, fully free during early access. All features — timer, sounds, goals, calendar, site blocker, memento — are available now. Pricing for a future pro tier hasn't been set; early users will get advance notice and generous grandfather terms.",
  },
  {
    q: "Do I need the Chrome extension?",
    a: "No. The web app works without it. The extension adds two things: it replaces your new tab page with Focal, and it enforces site blocking. You can sign in and use the full dashboard from the web app without touching Chrome's extension settings.",
  },
  {
    q: "How does the site blocker work?",
    a: "When the blocker is active and you try to visit a blocked domain, the extension intercepts the navigation and shows a calm redirect page. Blocking only runs during the window you enable it — there's no \"always on\" mode unless you choose that. You manage your blocklist in Focal; the extension reads it in real time.",
  },
  {
    q: "What browsers does Focal support?",
    a: "The web app works in any modern browser. The Chrome extension requires Chrome (or a Chromium-based browser like Brave or Edge). Safari and Firefox extension support isn't planned yet, but the web dashboard works fine on both.",
  },
  {
    q: "What is memento mori and can I turn it off?",
    a: "Memento mori is a small widget that surfaces your age, approximate time remaining, and a reflective quote — the aim is gentle perspective, not dread. It's completely optional; you can disable it in settings. Many users who try it end up keeping it on; the reminder that time is finite tends to feel grounding rather than morbid.",
  },
];

function formatPreviewClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export default function FocalLandingPage() {
  const navRef = useRef<HTMLElement>(null);
  const [previewClock, setPreviewClock] = useState(formatPreviewClock);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    void trackEvent("landing_viewed", { source_surface: "landing" });
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const reveals = document.querySelectorAll<HTMLElement>(".focal-lp .reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );
    reveals.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    setPreviewClock(formatPreviewClock());
    const id = window.setInterval(() => setPreviewClock(formatPreviewClock()), 10_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="focal-lp">
      <nav ref={navRef} className="nav" id="main-nav" role="navigation" aria-label="Main">
        <div className="nav-inner">
          <Link href="/" className="nav-brand" aria-label="Focal home">
            <FocalLogo size={36} alt="" priority />
            <span className="nav-brand-text">Focal</span>
          </Link>
          <div className="nav-links" role="list">
            <Link href="#how" role="listitem">
              How it works
            </Link>
            <Link href="#features" role="listitem">
              Features
            </Link>
            <Link href="#faq" role="listitem">
              FAQ
            </Link>
          </div>
          <div className="nav-cta">
            <Link href="/login" className="btn-primary" style={{ padding: "0.6rem 1.25rem", fontSize: "0.88rem" }}>
              Start free
            </Link>
          </div>
        </div>
      </nav>

      <section className="hero" id="hero" aria-labelledby="hero-title" data-screen-label="01 Hero">
        <div className="hero-bg" role="img" aria-label="Background landscape at dusk" />
        <div className="hero-inner">
          <div className="hero-label reveal">
            <div className="hero-label-dot" aria-hidden />
            <span className="t-label">One tab for intention</span>
          </div>

          <h1 className="t-display hero-title reveal reveal-delay-1" id="hero-title">
            The browser that
            <br />
            <em>stops the scatter.</em>
          </h1>

          <p className="hero-sub reveal reveal-delay-2">
            Focal turns your new tab into a calm workspace — focus timer, ambient sounds, daily goals, and gentle memento mori. No guilt. No noise. Just your next session.
          </p>

          <div className="btn-group reveal reveal-delay-3">
            <Link href="/login" className="btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4l3 3" />
              </svg>
              Sign in with Google — it&apos;s free
            </Link>
            <Link href="#how" className="btn-ghost">
              See how it works
            </Link>
          </div>

          <div className="hero-trust reveal reveal-delay-4">
            <span className="hero-trust-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Privacy-forward
            </span>
            <span className="hero-trust-sep" aria-hidden>
              ·
            </span>
            <span className="hero-trust-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
              Works in Chrome
            </span>
            <span className="hero-trust-sep" aria-hidden>
              ·
            </span>
            <span className="hero-trust-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              Syncs across devices
            </span>
            <span className="hero-trust-sep" aria-hidden>
              ·
            </span>
            <span className="hero-trust-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Free to start
            </span>
          </div>
        </div>

        <div className="hero-preview reveal reveal-delay-5">
          <div className="preview-shell" role="img" aria-label="Focal dashboard preview">
            <div className="preview-bar">
              <div className="preview-dot" style={{ background: "#ff5f57" }} />
              <div className="preview-dot" style={{ background: "#febc2e" }} />
              <div className="preview-dot" style={{ background: "#28c840" }} />
            </div>
            <div className="preview-content">
              <div className="preview-sidebar">
                <div className="preview-sidebar-brand">
                  <FocalLogo size={22} alt="" />
                  <span>Focal</span>
                </div>
                <div>
                  <div className="preview-sidebar-label" style={{ marginBottom: "0.65rem" }}>
                    Next up
                  </div>
                  <div className="preview-event">
                    <div className="preview-event-title">Deep work block</div>
                    <div className="preview-event-time">2:00 PM – 4:00 PM</div>
                  </div>
                  <div className="preview-event">
                    <div className="preview-event-title">Team standup</div>
                    <div className="preview-event-time">4:30 PM</div>
                  </div>
                  <div className="preview-event" style={{ borderBottom: "none" }}>
                    <div className="preview-event-title">Research review</div>
                    <div className="preview-event-time">Tomorrow 9:00 AM</div>
                  </div>
                </div>
                <div style={{ marginTop: "auto" }}>
                  <div className="preview-sidebar-label" style={{ marginBottom: "0.5rem" }}>
                    Memento
                  </div>
                  <div
                    style={{
                      fontSize: "0.62rem",
                      color: "rgba(245,244,240,0.42)",
                      lineHeight: 1.5,
                      fontStyle: "italic",
                    }}
                  >
                    &quot;You have roughly 1,820 Sundays left. Make today deliberate.&quot;
                  </div>
                </div>
              </div>
              <div className="preview-main">
                <div className="preview-clock" id="preview-clock">
                  {previewClock}
                </div>
                <div className="preview-greeting">Good afternoon, Alex.</div>
                <div style={{ position: "relative", width: "90px", height: "90px", margin: "0.25rem 0" }}>
                  <svg width="90" height="90" viewBox="0 0 90 90" aria-hidden>
                    <circle cx="45" cy="45" r="38" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
                    <circle
                      cx="45"
                      cy="45"
                      r="38"
                      fill="none"
                      stroke="#d4af37"
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray="238.76"
                      strokeDashoffset="80"
                      transform="rotate(-90 45 45)"
                      className="ring-track"
                    />
                  </svg>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.1rem",
                    }}
                  >
                    <div style={{ fontFamily: "var(--serif)", fontSize: "1.3rem", color: "#fff" }}>18:42</div>
                    <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      remaining
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <div className="preview-pill">Rain on leaves</div>
                  <div className="preview-pill">25 min focused</div>
                </div>
                <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.3)", marginTop: "0.25rem", fontStyle: "italic" }}>
                  Today&apos;s intention: finish literature review
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="problem" id="problem" aria-labelledby="problem-title" data-screen-label="02 Problem">
        <div className="container">
          <div className="problem-inner">
            <div className="problem-left">
              <span className="t-label reveal">The real problem</span>
              <h2 className="t-h2 reveal reveal-delay-1" id="problem-title">
                Your browser was built to distract you.
              </h2>
              <div className="problem-bullets">
                <div className="problem-bullet reveal reveal-delay-2">
                  <div className="problem-bullet-mark" aria-hidden>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(220,150,140,0.9)" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </div>
                  <div className="problem-bullet-text">
                    <strong>The phantom-tab spiral</strong>
                    <span>You open &quot;just one more&quot; tab to check something. Forty minutes later, the original task is still waiting.</span>
                  </div>
                </div>
                <div className="problem-bullet reveal reveal-delay-3">
                  <div className="problem-bullet-mark" aria-hidden>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(220,150,140,0.9)" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </div>
                  <div className="problem-bullet-text">
                    <strong>Sessions that never close</strong>
                    <span>Work bleeds into evening because there was no clear moment of beginning — or end.</span>
                  </div>
                </div>
                <div className="problem-bullet reveal reveal-delay-4">
                  <div className="problem-bullet-mark" aria-hidden>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(220,150,140,0.9)" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </div>
                  <div className="problem-bullet-text">
                    <strong>Ambient urgency everywhere</strong>
                    <span>Productivity tools that gamify, streak, and guilt — adding noise instead of removing it.</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="problem-right reveal reveal-delay-2">
              <div className="problem-quote">&quot;Focus is not about doing more — it&apos;s about being fully present for fewer things.&quot;</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <div style={{ fontSize: "0.88rem", fontWeight: 500 }}>— The premise behind Focal</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Built for knowledge workers, students, and anyone who wants calm progress over anxious productivity.
                </div>
              </div>
              <div className="hair" />
              <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  <div style={{ fontFamily: "var(--serif)", fontSize: "1.6rem", color: "var(--accent)" }}>25 min</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Default session length, research-backed</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  <div style={{ fontFamily: "var(--serif)", fontSize: "1.6rem", color: "var(--accent)" }}>1 tab</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>For intention, not distraction</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="how" id="how" aria-labelledby="how-title" data-screen-label="03 How It Works">
        <div className="container">
          <div className="how-head">
            <span className="t-label reveal">How it works</span>
            <h2 className="t-h2 reveal reveal-delay-1" id="how-title">
              Three moments. One session.
            </h2>
            <p className="t-body reveal reveal-delay-2" style={{ maxWidth: "480px", textAlign: "center" }}>
              Focal structures each working session so you know what you&apos;re doing, while you&apos;re doing it, and when you&apos;re done.
            </p>
          </div>
          <div className="how-steps reveal reveal-delay-2">
            <div className="how-step">
              <div className="how-step-num" aria-hidden>
                01
              </div>
              <h3 className="how-step-title">Set your intention</h3>
              <p className="how-step-body">
                Name the one thing this session is for. Focal shows it back to you the whole time — a quiet anchor when the urge to switch tabs arrives.
              </p>
            </div>
            <div className="how-step">
              <div className="how-step-num" aria-hidden>
                02
              </div>
              <h3 className="how-step-title">Work inside the container</h3>
              <p className="how-step-body">
                The timer runs. Ambient sounds fill the silence. The site blocker holds the perimeter. You just work — no scoreboard, no streak pressure.
              </p>
            </div>
            <div className="how-step">
              <div className="how-step-num" aria-hidden>
                03
              </div>
              <h3 className="how-step-title">Close the loop</h3>
              <p className="how-step-body">
                When the session ends, log what happened. Over days, your focus history tells a clearer story — not guilt, just pattern.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="features" id="features" aria-labelledby="features-title" data-screen-label="04 Features">
        <div className="container">
          <div className="features-head">
            <span className="t-label reveal">Everything you need</span>
            <h2 className="t-h2 reveal reveal-delay-1" id="features-title">
              Built for depth, not breadth.
            </h2>
            <p className="t-body reveal reveal-delay-2" style={{ maxWidth: "480px", textAlign: "center" }}>
              Six tools that belong together. Nothing that doesn&apos;t.
            </p>
          </div>
          <div className="features-grid">
            <div className="feature-card reveal">
              <div className="feature-icon" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <div className="feature-title">Focus Timer</div>
              <div className="feature-body">
                Pomodoro-style sessions with configurable lengths. A single ring shows elapsed time without demanding your attention.
              </div>
            </div>
            <div className="feature-card reveal reveal-delay-1">
              <div className="feature-icon" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <div className="feature-title">Procedural Ambient Sounds</div>
              <div className="feature-body">Rain, café, forest, fire — blend multiple layers at your own volumes. No playlists, no decisions, just atmosphere.</div>
            </div>
            <div className="feature-card reveal reveal-delay-2">
              <div className="feature-icon" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              </div>
              <div className="feature-title">Daily Goals</div>
              <div className="feature-body">
                Set one or two priorities at the start of the day. An evening check-in closes the loop without turning it into a performance review.
              </div>
            </div>
            <div className="feature-card reveal reveal-delay-1">
              <div className="feature-icon" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </div>
              <div className="feature-title">Google Calendar</div>
              <div className="feature-body">Your next few events surface in the sidebar — read-only, no editing. What&apos;s ahead, without leaving the tab.</div>
            </div>
            <div className="feature-card reveal reveal-delay-2">
              <div className="feature-icon" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div className="feature-title">Site Blocker</div>
              <div className="feature-body">
                The Chrome extension intercepts distracting domains during a session. One toggle. Presets for social, news, video. You decide what&apos;s blocked, and when.
              </div>
            </div>
            <div className="feature-card reveal reveal-delay-3">
              <div className="feature-icon" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4" />
                  <path d="M12 16h.01" />
                </svg>
              </div>
              <div className="feature-title">Memento Mori</div>
              <div className="feature-body">
                A gentle reminder of finite time — your age, weeks remaining, a quiet prompt to make today deliberate. Not morbid. Just honest.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="social" id="social" aria-labelledby="social-title" data-screen-label="05 Social Proof">
        <div className="container">
          <div className="social-head">
            <span className="t-label reveal">Built for people who…</span>
            <h2 className="t-h2 reveal reveal-delay-1" id="social-title">
              Know what good work feels like,
              <br />
              and want more of it.
            </h2>
          </div>
          <div className="quotes-grid">
            <div className="quote-card reveal">
              <div className="quote-mark" aria-hidden>
                &quot;
              </div>
              <p className="quote-text">
                I&apos;ve tried every productivity app. Most of them made me feel worse. Focal is the first one that just… gets out of the way and lets me work.
              </p>
              <div className="quote-author">
                <span className="quote-name">A PhD researcher</span>
                <span className="quote-role">Using Focal for dissertation sprints</span>
              </div>
            </div>
            <div className="quote-card reveal reveal-delay-1">
              <div className="quote-mark" aria-hidden>
                &quot;
              </div>
              <p className="quote-text">
                The memento mori widget sounds dark but it&apos;s the opposite — I actually feel calmer knowing I&apos;m being intentional about my time. It&apos;s a grounding thing.
              </p>
              <div className="quote-author">
                <span className="quote-name">A product designer</span>
                <span className="quote-role">Remote, working across time zones</span>
              </div>
            </div>
            <div className="quote-card reveal reveal-delay-2">
              <div className="quote-mark" aria-hidden>
                &quot;
              </div>
              <p className="quote-text">
                ADHD means I need structure and calm at the same time. Most tools give me one or the other. Focal manages both without punishing me for being human.
              </p>
              <div className="quote-author">
                <span className="quote-name">A freelance writer</span>
                <span className="quote-role">ADHD-diagnosed, big on systems that don&apos;t shame</span>
              </div>
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: "2.5rem" }} className="reveal">
            <p className="t-small" style={{ fontStyle: "italic" }}>
              These are representative perspectives based on the people Focal was built for. Focal is in early access — real testimonials coming as the community grows.
            </p>
          </div>
        </div>
      </section>

      <section className="faq" id="faq" aria-labelledby="faq-title" data-screen-label="06 FAQ">
        <div className="container">
          <div className="faq-head">
            <span className="t-label reveal">Questions</span>
            <h2 className="t-h2 reveal reveal-delay-1" id="faq-title">
              The ones people actually ask.
            </h2>
          </div>
          <div className="faq-list" role="list">
            {FAQ_ITEMS.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={item.q} className={`faq-item${open ? " open" : ""}`} role="listitem">
                  <button className="faq-q" type="button" aria-expanded={open} onClick={() => setOpenFaq(open ? null : i)}>
                    {item.q}
                    <svg className="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  <div className="faq-a" role="region">
                    <div className="faq-a-inner">{item.a}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="final-cta" id="start" data-screen-label="07 Final CTA">
        <div className="final-cta-bg" aria-hidden />
        <div className="container">
          <div className="final-cta-inner">
            <span className="t-label reveal">Ready when you are</span>
            <h2 className="t-h2 reveal reveal-delay-1" style={{ maxWidth: "560px", margin: "0 auto" }}>
              Your next session starts with one tab.
            </h2>
            <p className="t-body reveal reveal-delay-2" style={{ maxWidth: "400px", margin: "0 auto", textAlign: "center" }}>
              No credit card. No onboarding quiz. Sign in with Google and your first session is waiting.
            </p>
            <div className="btn-group reveal reveal-delay-3" style={{ justifyContent: "center" }}>
              <Link href="/login" className="btn-primary" style={{ fontSize: "1rem", padding: "0.95rem 2rem" }}>
                Sign in with Google — it&apos;s free
              </Link>
            </div>
            <p className="final-cta-reassurance reveal reveal-delay-4">Works in Chrome · Free during early access · Cancel anytime</p>
          </div>
        </div>
      </section>

      <footer className="footer" role="contentinfo" data-screen-label="08 Footer">
        <div className="footer-inner">
          <span className="footer-brand">
            <FocalLogo size={26} alt="" />
            <span>Focal</span>
          </span>
          <div className="footer-links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href="mailto:evankonggg@gmail.com">Contact</a>
          </div>
          <span className="footer-copy">© 2026 Focal</span>
        </div>
      </footer>

      <div className="sticky-cta" role="complementary" aria-label="Quick sign-in">
        <span className="sticky-cta-text">One tab. Calm focus.</span>
        <Link href="/login" className="btn-primary">
          Start free
        </Link>
      </div>
    </div>
  );
}
