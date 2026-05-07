import type { Session } from "@supabase/supabase-js";
import type { createSupabaseBrowser } from "@/lib/supabase-browser";

type Supabase = ReturnType<typeof createSupabaseBrowser>;

export type AnalyticsEventName =
  | "landing_viewed"
  | "onboarding_started"
  | "onboarding_completed"
  | "focus_session_started"
  | "focus_session_completed"
  | "blocker_enabled"
  | "paywall_viewed"
  | "trial_started";

type AnalyticsPayload = Record<string, unknown>;

const SESSION_KEY = "focal_analytics_session_id";
const ONCE_PREFIX = "focal_analytics_once:";

function getSessionId() {
  if (typeof window === "undefined") return "server";
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, next);
  return next;
}

export function trackOncePerUser(event: AnalyticsEventName, userId: string, payload?: AnalyticsPayload) {
  if (typeof window === "undefined") return;
  const key = `${ONCE_PREFIX}${userId}:${event}`;
  if (localStorage.getItem(key) === "1") return;
  localStorage.setItem(key, "1");
  void trackEvent(event, payload);
}

export async function trackEvent(
  event: AnalyticsEventName,
  payload?: AnalyticsPayload,
  options?: {
    supabase?: Supabase;
    session?: Session | null;
  }
) {
  const body = {
    event_name: event,
    event_version: 1,
    timestamp_utc: new Date().toISOString(),
    session_id: getSessionId(),
    user_id: options?.session?.user?.id ?? null,
    plan: typeof window !== "undefined" ? localStorage.getItem("focal_plan_state") ?? "free" : "free",
    payload: payload ?? {},
  };

  if (process.env.NODE_ENV !== "production") {
    // Keep a visible trail during local development.
    // eslint-disable-next-line no-console
    console.info("[focal analytics]", body);
  }

  if (!options?.supabase) return;

  try {
    await options.supabase.from("analytics_events").insert(body);
  } catch {
    // Swallow errors: analytics must never block product usage.
  }
}
