# Focal

Focal is a calm “new tab” dashboard with focus timers, procedural soundscapes, optional site blocking (via the browser extension), Google Calendar (via Supabase Google OAuth), and gentle Memento Mori reminders. The product is split into:

- **`apps/web`**: Next.js app deployed to Vercel (PWA-friendly). Routes: `/` → `/app`, `/app` dashboard, `/login` standalone auth.
- **`apps/extension`**: Thin Chrome extension shell that iframes the web app and mirrors Supabase session + blocker state into `chrome.storage.local`, while the service worker applies `declarativeNetRequest` rules.
- **`packages/shared`**: Shared types, quotes, memento math, and blocker presets.

## Prerequisites

- Node.js 18.18+ and npm
- A Supabase project
- (Optional) Google Cloud OAuth client for legacy manifest fields / Safari packaging notes below

## Supabase setup

1. Create a project and copy **Project URL** + **anon key** into `apps/web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
NEXT_PUBLIC_APP_ORIGIN=http://localhost:3000
```

2. Run `supabase/schema.sql` in the Supabase SQL editor. If you already created tables earlier, run only the new `focus_logs` block from that file (or `supabase/migration-focus_logs.sql`) so session history can sync.

3. Enable **Auth → Providers → Google** and add the Calendar readonly scope:

   - Additional scope: `https://www.googleapis.com/auth/calendar.readonly`

4. Under **Database → Replication**, enable **Realtime** for `daily_goals` and `focus_sessions`.

5. Set **Auth → URL Configuration** redirect URLs to include your Vercel domain and `http://localhost:3000/app`.

## Local development

```bash
cd focal
npm install
npm run dev
```

Visit `http://localhost:3000/app`.

Add your background image as `apps/web/public/background.jpg` (see `public/BACKGROUND.txt`).

## Deploy the web app (Vercel)

1. Connect the `focal` repo and set the **Root Directory** to `apps/web` (or deploy the monorepo with the same workspace install command: `npm install` at repo root, **Build** `npm run build --workspace=@focal/web`, **Output** `.next` from `apps/web`).

2. Configure the same `NEXT_PUBLIC_*` variables in Vercel. Set `NEXT_PUBLIC_APP_ORIGIN` to your production origin (for example `https://focal.example.com`).

## Chrome extension

1. Edit `apps/extension/config.json` and set `appUrl` to your deployed `/app` URL (or keep `http://localhost:3000/app` for local dev).

2. Open `chrome://extensions`, enable **Developer mode**, **Load unpacked**, choose `focal/apps/extension`.

3. Replace `oauth2.client_id` in `manifest.json` if you still use Chrome identity APIs (the web app itself uses Supabase for Google OAuth).

4. For **site blocking**, open the dashboard inside the extension new tab, toggle **Blocker Active**, and add domains. The extension redirects blocked top-level navigations to `blocked.html`, which reads the blocked hostname from `document.referrer`.

## Safari Web Extension (Xcode)

Apple ships a converter that wraps a Chrome MV3 extension:

```bash
xcrun safari-web-extension-converter /path/to/focal/apps/extension \
  --project-location /path/to/output \
  --app-name Focal
```

Open the generated Xcode project, set your team signing, build, and run the macOS wrapper app to sideload the extension for personal use. Point `config.json` at your production `/app` URL so the embedded web experience matches Chrome.

**Note:** Safari’s extension runtime differs slightly from Chrome; test blocking + storage flows after conversion. For cross-browser APIs in future iterations, consider vendoring `webextension-polyfill` into the extension bundle.

## Architecture notes

- **Auth & data** live in Supabase (`profiles`, `daily_goals`, `focus_sessions`, `focus_logs`, `blocked_sites`, `memento_entries`). Each completed or “ended early” focus session appends a `focus_logs` row (intent, distractions JSON, planned vs actual minutes) while `focus_sessions` continues to hold **per-day** total minutes.
- **UI polish** for glass panels and the focus overlay drew loose inspiration from [Magic MCP](https://21st.dev) “glass / timer” search results (`bg-black/20`, `backdrop-blur-xl`-style treatment translated to plain CSS).
- **Offline mode** caches the last bundle in `localStorage` and queues failed writes in `focal_pending_writes` (see `apps/web/lib/sync.ts`).
- **Extension bridge** messages (`FOCAL_*` in `packages/shared`) sync the Supabase session into `chrome.storage.local` so the iframe can rehydrate on cold start.
- **Sounds** are generated with the Web Audio API (`apps/web/lib/sounds-engine.ts`); binaural presets route left/right carriers into a stereo graph (headphones recommended).

## Repository layout

```
focal/
├── apps/
│   ├── web/                # Next.js dashboard + PWA manifest
│   └── extension/          # Chrome/Safari shell + blocker service worker
├── packages/
│   └── shared/             # Shared TS modules
├── supabase/
│   └── schema.sql
└── README.md
```
