# FoxBridge Mobile PWA

Volunteer-facing meal scanner (foundation). See [`docs/MOBILE_PRODUCT.md`](../../docs/MOBILE_PRODUCT.md).

## Setup

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

Or from this directory:

```bash
npm run dev
```

Opens at `http://localhost:5174`.

## PWA install

1. Run the dev server or preview build over HTTPS or localhost.
2. In Chrome (Android) or Safari (iOS), use **Add to Home Screen** / **Install app**.
3. Launch from the home screen icon.

Production builds require `npm run build` then `npm run preview` or static hosting with HTTPS.

## Sign-in flows

**Production (AdAgrA):** Volunteer name + scanner code validated via Supabase `validate_scanner_code` RPC.

**Development:** Set `VITE_MOBILE_ACCESS_CODE` in `.env`, sign in with that code, then pick a conference.

Requires `supabase/migrations/002_mobile_scanner_foundation.sql` for scanner codes and conference list reads.

## Screens

| Route | Screen |
|-------|--------|
| `/` | Splash |
| `/sign-in` | Sign In |
| `/conference` | Conference Selection |
| `/ready` | Ready to Scan (placeholder) |

QR scanning and meal validation are not implemented yet.
