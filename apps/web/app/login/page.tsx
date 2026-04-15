"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/app");
    });
  }, [router]);

  const signGoogle = async () => {
    setBusy(true);
    setStatus(null);
    const supabase = createSupabaseBrowser();
    const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/app`,
        scopes: "https://www.googleapis.com/auth/calendar.readonly",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) setStatus(error.message);
    setBusy(false);
  };

  const signMagic = async () => {
    setBusy(true);
    setStatus(null);
    const supabase = createSupabaseBrowser();
    const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/app` },
    });
    if (error) setStatus(error.message);
    else setStatus("Check your email for the magic link.");
    setBusy(false);
  };

  return (
    <div className="focal-root">
      <div className="focal-bg solid-theme" />
      <div className="focal-content" style={{ justifyContent: "center" }}>
        <div className="focal-panel focal-login-card">
          <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.6rem" }}>Welcome to Focal</h1>
          <p style={{ margin: "0 0 1rem", color: "rgba(255,255,255,0.7)" }}>
            Sign in to sync your focus, goals, and lists across devices.
          </p>
          <button className="focal-btn primary" type="button" onClick={signGoogle} disabled={busy} style={{ width: "100%" }}>
            Continue with Google
          </button>
          <div style={{ margin: "1rem 0", color: "rgba(255,255,255,0.45)", fontSize: "0.85rem" }}>or</div>
          <label style={{ textAlign: "left", display: "block", color: "rgba(255,255,255,0.7)", fontSize: "0.9rem" }}>
            Email magic link
            <input className="focal-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <button className="focal-btn" type="button" onClick={signMagic} disabled={busy || !email} style={{ width: "100%", marginTop: "0.65rem" }}>
            Send link
          </button>
          {status ? <p style={{ marginTop: "0.75rem", color: "rgba(255,255,255,0.75)" }}>{status}</p> : null}
        </div>
      </div>
    </div>
  );
}
