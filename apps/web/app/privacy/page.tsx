import type { Metadata } from "next";
import LegalShell from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Privacy Policy — Focal",
  description: "How Focal collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalShell>
      <h1>Privacy Policy</h1>
      <p className="focal-legal-updated">Last updated: April 2026</p>

      <h2>1. Who we are</h2>
      <p>
        Focal is a personal productivity dashboard built and operated as an independent project. Contact:{" "}
        <a href="mailto:hello@focal-web-alpha.vercel.app">hello@focal-web-alpha.vercel.app</a>
      </p>

      <h2>2. What data we collect</h2>
      <p>When you use Focal, we store the following data in your personal Supabase account:</p>
      <ul>
        <li>Your name and email address (from Google sign-in)</li>
        <li>Your daily goals</li>
        <li>Focus session records (duration, intent, distractions)</li>
        <li>Your site blocklist</li>
        <li>Memento Mori entries (names and birth years you enter)</li>
        <li>App preferences (clock format, timer durations, quote style)</li>
      </ul>

      <h2>3. Google Calendar access</h2>
      <p>
        If you connect Google Calendar, Focal requests read-only access (<code>calendar.readonly</code> scope) to display
        your events for today. We do not store your calendar data — it is fetched on demand and displayed only to you. We
        do not share, sell, or use your calendar data for any purpose other than displaying it within your Focal dashboard.
      </p>
      <p>
        Focal&apos;s use of Google Calendar data complies with the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener noreferrer" target="_blank">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2>4. How we use your data</h2>
      <ul>
        <li>To sync your dashboard across devices</li>
        <li>To display your focus history and statistics</li>
        <li>To personalise your experience (name, preferences)</li>
      </ul>
      <p>
        We do not sell your data. We do not use your data for advertising. We do not share your data with third parties
        except as required to operate the service (Supabase for database hosting, Vercel for web hosting).
      </p>

      <h2>5. Data storage and security</h2>
      <p>
        Your data is stored in Supabase (PostgreSQL) with Row Level Security enabled — meaning only you can read or write
        your own data. Supabase infrastructure is hosted on AWS. Data is encrypted at rest and in transit.
      </p>

      <h2>6. Your rights</h2>
      <p>You can at any time:</p>
      <ul>
        <li>Delete your account and all associated data via Settings</li>
        <li>Revoke Google Calendar access via your Google Account permissions</li>
        <li>Request a copy of your data by contacting us</li>
      </ul>

      <h2>7. Cookies</h2>
      <p>
        Focal uses only functional cookies required for authentication (Supabase session tokens). We do not use tracking or
        advertising cookies.
      </p>

      <h2>8. Changes to this policy</h2>
      <p>
        We may update this policy as the product evolves. Significant changes will be communicated via the app. Continued use
        after changes constitutes acceptance.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about this policy? Email{" "}
        <a href="mailto:evankonggg@gmail.com">evankonggg@gmail.com</a>
      </p>
    </LegalShell>
  );
}
