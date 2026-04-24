import type { Metadata } from "next";
import LegalShell from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Terms of Service — Focal",
  description: "Terms governing use of the Focal productivity dashboard.",
};

export default function TermsPage() {
  return (
    <LegalShell>
      <h1>Terms of Service</h1>
      <p className="focal-legal-updated">Last updated: April 2026</p>

      <h2>1. Acceptance</h2>
      <p>
        By using Focal, you agree to these Terms of Service. If you do not agree, do not use the app. These terms apply to
        the Focal web app, Chrome extension, and any related services.
      </p>

      <h2>2. What Focal is</h2>
      <p>
        Focal is a personal productivity dashboard. It is provided as-is, primarily for personal use. Features include a
        focus timer, ambient sounds, site blocker, Google Calendar integration, and cross-device sync.
      </p>

      <h2>3. Your account</h2>
      <p>
        You are responsible for maintaining the security of your account. You must not share your account credentials or use
        the service for anything unlawful. You must be at least 13 years old to use Focal.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Attempt to reverse-engineer, scrape, or abuse the service</li>
        <li>Use the service to violate any applicable law</li>
        <li>Attempt to access another user&apos;s data</li>
        <li>Use automated tools to create accounts or spam the service</li>
      </ul>

      <h2>5. Google services</h2>
      <p>
        Focal integrates with Google Calendar via OAuth. Your use of Google services through Focal is also subject to
        Google&apos;s Terms of Service. Focal only requests read-only calendar access and does not modify your Google data.
      </p>

      <h2>6. Availability</h2>
      <p>
        Focal is provided free of charge and on a best-effort basis. We do not guarantee uptime, availability, or that the
        service will be error-free. We may change, suspend, or discontinue any part of the service at any time without
        notice.
      </p>

      <h2>7. Your content</h2>
      <p>
        You own all data you enter into Focal (goals, focus logs, memento entries, etc.). You grant us a limited licence to
        store and display that data to you as part of operating the service. We will not use your content for any other
        purpose.
      </p>

      <h2>8. Disclaimer of warranties</h2>
      <p>
        Focal is provided &quot;as is&quot; without warranties of any kind, express or implied. We are not responsible for
        any loss of data, productivity, or other damages arising from use of the service.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Focal and its operators shall not be liable for any indirect, incidental,
        special, or consequential damages arising from your use of the service.
      </p>

      <h2>10. Termination</h2>
      <p>
        You may stop using Focal at any time and delete your account via Settings. We may suspend or terminate accounts that
        violate these terms.
      </p>

      <h2>11. Changes to these terms</h2>
      <p>We may update these terms as the product evolves. Continued use after changes constitutes acceptance of the new terms.</p>

      <h2>12. Contact</h2>
      <p>
        Questions about these terms? Email{" "}
        <a href="mailto:evankonggg@gmail.com">evankonggg@gmail.com</a>
      </p>
    </LegalShell>
  );
}
