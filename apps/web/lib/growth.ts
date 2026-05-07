export type PlanState = "free" | "trial" | "pro";

const PLAN_KEY = "focal_plan_state";
const PAYWALL_DISMISS_KEY = "focal_paywall_dismissed";

export function readPlanState(): PlanState {
  if (typeof window === "undefined") return "free";
  const raw = localStorage.getItem(PLAN_KEY);
  if (raw === "trial" || raw === "pro" || raw === "free") return raw;
  return "free";
}

export function writePlanState(plan: PlanState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PLAN_KEY, plan);
  window.dispatchEvent(new CustomEvent("focal_plan_changed", { detail: plan }));
}

export function readPaywallDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PAYWALL_DISMISS_KEY) === "1";
}

export function writePaywallDismissed(dismissed: boolean) {
  if (typeof window === "undefined") return;
  if (dismissed) localStorage.setItem(PAYWALL_DISMISS_KEY, "1");
  else localStorage.removeItem(PAYWALL_DISMISS_KEY);
}
