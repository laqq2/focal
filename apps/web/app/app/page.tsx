import DashboardClient from "@/components/DashboardClient";
import { OAuthPopupBridge } from "@/components/OAuthPopupBridge";

export default function AppPage() {
  return (
    <>
      <OAuthPopupBridge />
      <DashboardClient />
    </>
  );
}
