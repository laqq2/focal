import type { SupabaseClient } from "@supabase/supabase-js";
import { isEmbeddedExtension } from "@/lib/extension-bridge";
import { authRedirectToApp } from "@/lib/auth-origin";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

/**
 * Google OAuth via Supabase. When embedded in the extension iframe, opens the
 * provider flow in a new window (Google blocks sign-in inside embedded frames → 403).
 */
export async function signInWithGoogleOAuth(client: SupabaseClient): Promise<{ error: Error | null }> {
  const redirectTo = authRedirectToApp();
  const baseOptions = {
    redirectTo,
    scopes: CALENDAR_SCOPE,
    queryParams: { access_type: "offline" as const, prompt: "consent" as const },
  };

  if (isEmbeddedExtension()) {
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { ...baseOptions, skipBrowserRedirect: true },
    });
    if (error) return { error: new Error(error.message) };
    if (!data?.url) return { error: new Error("Missing OAuth URL from Supabase.") };
    const popup = window.open(data.url, "_blank", "noopener,noreferrer,width=520,height=720");
    if (!popup) {
      return {
        error: new Error("Popup was blocked. Allow popups for this site, or sign in from a normal browser tab."),
      };
    }
    return { error: null };
  }

  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: baseOptions,
  });
  return { error: error ? new Error(error.message) : null };
}
