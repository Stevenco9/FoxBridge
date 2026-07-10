# FoxBridge Mobile PWA

Volunteer-facing meal scanner. See [`docs/MOBILE_PRODUCT.md`](../../docs/MOBILE_PRODUCT.md).

## Production workflow (AdAgrA)

1. Organizer opens FoxBridge desktop and loads attendees.
2. Organizer taps **Connect a phone** — desktop shows one HTTPS pairing QR.
3. Volunteer scans the QR with the phone’s **Camera app** (not a special scanner app).
4. Hosted PWA opens at `/pair?token=...`, exchanges the token, and navigates to **Ready to scan**.
5. Volunteer scans attendee badges and validates meals.

**No volunteer account, scanner code, conference selection, or technical setup is required.**

## Setup (developers)

```bash
cd apps/mobile
cp .env.example .env
# Edit .env with Supabase URL + anon key
npm install
```

## Development

From repo root:

```bash
npm run dev:mobile
```

The dev server binds to `0.0.0.0:5174` so phones on the same Wi-Fi can reach it.

| Where you open it | URL |
|-------------------|-----|
| On this computer | `http://localhost:5174` |
| On a phone (same Wi-Fi) | `http://<your-mac-lan-ip>:5174` |

**Production pairing requires HTTPS.** Set **Scanner web address** in desktop Settings → Advanced (or `MOBILE_APP_URL` / `FOXBRIDGE_SCANNER_URL` in the root `.env` for packaged defaults).

### Manual sign-in (development only)

In `import.meta.env.DEV`, the splash screen routes to `/sign-in` for manual scanner-code testing. This path is **not** part of the production volunteer experience.

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Splash — resumes session or waits for pairing |
| `/pair?token=...` | One-scan pairing (production) |
| `/ready` | Scan badges + validate meals |
| `/sign-in` | Dev fallback — manual scanner code |
| `/conference` | Dev fallback — conference picker |

## Pairing service

`pairingService.ts` calls Supabase RPC `exchange_scanner_pairing_token`. Migration: `supabase/migrations/005_scanner_pairing_tokens.sql`.

## Meal validation

Uses `validate_meal` RPC (migration `004_mobile_meal_validation.sql`). Online only — no offline queue yet.

## Deploy to Vercel

Deploy the **`apps/mobile`** directory as a standalone Vite project.

### Vercel project settings

| Setting | Value |
|---------|--------|
| **Root Directory** | `apps/mobile` |
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` (default) |

`vercel.json` in this directory configures SPA fallback so direct links to `/pair`, `/ready`, and other client routes load correctly.

### Environment variables

Add these **public** Vite variables in the Vercel project (**Settings → Environment Variables**). Do not commit real values to the repository.

| Name | Description |
|------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key |

The app reads them via `import.meta.env` in `src/lib/supabaseClient.ts`.

After adding or changing environment variables, **redeploy** the project so the build picks up the new values.

### First deploy

1. Import the FoxBridge repository in Vercel.
2. Set **Root Directory** to `apps/mobile`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy, then use the production URL as the desktop **Scanner web address**.
