# FoxBridge Mobile PWA

Volunteer-facing meal scanner. See [`docs/MOBILE_PRODUCT.md`](../../docs/MOBILE_PRODUCT.md).

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

Opens at `http://localhost:5174`.

**Camera scanning:** Use HTTPS or `localhost`. On a phone, use your machine's LAN IP only if the browser allows camera access on that origin.

## Supabase migrations

Run in order in the Supabase SQL editor:

1. `supabase/migrations/001_cloud_foundation.sql`
2. `supabase/migrations/002_mobile_scanner_foundation.sql`
3. `supabase/migrations/003_mobile_attendee_lookup.sql`

Desktop must **Publish attendees** (Sprint 10) so `attendees` and `meal_entitlements` rows exist for lookup.

## Sign-in flows

**Production (AdAgrA):** Volunteer name + scanner code via `validate_scanner_code` RPC → conference auto-selected.

**Development:** Set `VITE_MOBILE_ACCESS_CODE=dev-scanner` in `.env`, sign in with that code, then pick a conference.

## Screens

| Route | Screen |
|-------|--------|
| `/` | Splash |
| `/sign-in` | Sign In |
| `/conference` | Conference Selection |
| `/ready` | Scanner — scan badge, manual entry, attendee lookup result |

## End-to-end scan test (Sprint 12)

1. **Desktop:** Ensure RegFox attendees load and click **Publish attendees** in Cloud status.
2. **Supabase:** Confirm `attendees` rows include `qr_identifier` matching badge QR values.
3. **Mobile:** `npm run dev:mobile` → sign in → reach **Ready to scan**.
4. **Scan:** Tap **Scan badge**, allow camera, scan a printed badge QR.
5. **Or manual:** Tap **Enter code manually**, paste the QR value (same as desktop `getAttendeeQrValue`).
6. **Expect:** Attendee name, registration ID, and validatable meals list. No validate buttons yet.

### Troubleshooting

| Issue | Check |
|-------|--------|
| Camera denied | Browser permissions; use manual entry |
| Attendee not found | Desktop publish completed; same conference selected; `qr_identifier` matches badge |
| Network unavailable | Supabase URL/key in `.env`; migration 003 applied |
| Empty meals | Desktop publish included meal entitlements for that attendee |

## PWA install

1. Run dev server or `npm run build && npm run preview`.
2. Chrome → Install app, or iOS Safari → Add to Home Screen.

## Not implemented yet

- Meal validation (write to Supabase)
- Offline cache / sync queue
- Admin, settings, or reporting screens
