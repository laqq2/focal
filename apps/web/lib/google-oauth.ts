import type { SupabaseClient } from "@supabase/supabase-js";
import { authRedirectToApp } from "@/lib/auth-origin";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

/**
 * Google OAuth via Supabase (full-page redirect). Use only when not in the extension iframe;
 * embedded new tab flows should use `openExtensionLoginTab(authLoginPageUrl())` instead.
 */
export async function signInWithGoogleOAuth(client: SupabaseClient): Promise<{ error: Error | null }> {
  const redirectTo = authRedirectToApp();
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: CALENDAR_SCOPE,
      queryParams: { access_type: "offline" as const, prompt: "consent" as const },
    },
  });
  return { error: error ? new Error(error.message) : null };
}
