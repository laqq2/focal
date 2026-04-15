/**
 * Canonical HTTPS origin for Supabase OAuth and email redirects.
 * Set NEXT_PUBLIC_APP_ORIGIN on Vercel to your deployed URL (no trailing slash).
 * Required for the Chrome extension: the iframe must not rely on a missing env
 * (Google/Supabase will reject non-https redirect URIs).
 */
export function getAuthAppOrigin(): string {
  const raw = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_APP_ORIGIN?.trim() : "";
  if (raw) return raw.replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    const { protocol, origin } = window.location;
    if (protocol === "https:" || protocol === "http:") return origin.replace(/\/+$/, "");
  }
  return "http://localhost:3000";
}

/** Supabase `redirectTo` target after OAuth (must be listed in Supabase Auth → Redirect URLs). */
export function authRedirectToApp(): string {
  return `${getAuthAppOrigin()}/app`;
}

/** Full URL for the standalone login page (used by the extension shell via `chrome.tabs.create`). */
export function authLoginPageUrl(): string {
  return `${getAuthAppOrigin()}/login`;
}
