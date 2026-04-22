"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export function LearnAuthShell({
  children,
}: {
  children: (ctx: { supabase: ReturnType<typeof createSupabaseBrowser>; userId: string; accessToken: string }) => ReactNode;
}) {
  const supabase = createSupabaseBrowser();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  if (session === undefined) {
    return (
      <div className="focal-learn-page">
        <p className="focal-learn-muted">Loading…</p>
      </div>
    );
  }
  if (!session?.user) {
    return (
      <div className="focal-learn-page">
        <p className="focal-learn-muted">Sign in to continue.</p>
        <Link className="focal-btn primary" href="/login" style={{ marginTop: "0.75rem", display: "inline-block" }}>
          Go to login
        </Link>
      </div>
    );
  }

  return <>{children({ supabase, userId: session.user.id, accessToken: session.access_token })}</>;
}
