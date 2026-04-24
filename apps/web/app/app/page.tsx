import DashboardClient from "@/components/DashboardClient";

/**
 * Authenticated dashboard. Unauthenticated visitors in a normal browser are
 * redirected to `/` (see `DashboardClient`); the Chrome extension iframe
 * still shows inline sign-in when no session is present.
 */
export default function AppPage() {
  return <DashboardClient />;
}
