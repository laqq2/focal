"use client";

import { useEffect, useMemo } from "react";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { getAuthAppOrigin } from "@/lib/auth-origin";

export const OAUTH_SESSION_MSG = "FOCAL_SET_SUPABASE_SESSION";

/**
 * When Google OAuth completes in a popup, the popup may use a different storage
 * partition than the extension iframe. After Supabase establishes a session,
 * forward tokens to `window.opener` so the iframe can `setSession`.
 */
export function OAuthPopupBridge() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.opener) return;
    const targetOrigin = getAuthAppOrigin();
    let closed = false;
    const finish = (s: Session) => {
      if (closed) return;
      closed = true;
      try {
        window.opener.postMessage(
          {
            type: OAUTH_SESSION_MSG,
            payload: {
              access_token: s.access_token,
              refresh_token: s.refresh_token,
              expires_at: s.expires_at,
            },
          },
          targetOrigin
        );
      } catch {
        /* ignore */
      }
      window.close();
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) finish(session);
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish(data.session);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  return null;
}

export function isOAuthSessionMessage(data: unknown): data is {
  type: typeof OAUTH_SESSION_MSG;
  payload: { access_token: string; refresh_token: string; expires_at?: number };
} {
  if (!data || typeof data !== "object") return false;
  const o = data as { type?: string; payload?: unknown };
  if (o.type !== OAUTH_SESSION_MSG) return false;
  const p = o.payload as { access_token?: string; refresh_token?: string } | undefined;
  return Boolean(p?.access_token && p?.refresh_token);
}
