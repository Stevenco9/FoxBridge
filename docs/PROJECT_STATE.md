# FoxBridge — Project State

Last updated: July 2026 (Sprint 12)  
Repo: `https://github.com/Stevenco9/FoxBridge` (branch `main`)

Use this file to onboard a new ChatGPT conversation quickly. Do **not** commit secrets from `.env`.

**Planning:** [`SUPABASE_ARCHITECTURE.md`](./SUPABASE_ARCHITECTURE.md) — mobile scanner cloud design.  
**Mobile product:** [`MOBILE_PRODUCT.md`](./MOBILE_PRODUCT.md) — volunteer-focused mobile scope and guardrails (`apps/mobile`).  
**Vision:** [`VISION.md`](./VISION.md) — long-term product and architecture principles.

---

## Current status

FoxBridge is a **desktop Electron app** (React + TypeScript + Vite) for RegFox event check-in. Core MVP flows are working in development:

- Live RegFox attendee download
- Attendee search + badge preview
- Electron badge printing with system print dialog
- Real QR codes on badges
- Meal validation with **persistent SQLite storage**
- **Local scanner HTTP server foundation** (disabled by default; localhost only)
- **Supabase cloud publish foundation** (optional; desktop unchanged if unset or unavailable)
- **Mobile PWA foundation** (`apps/mobile`) — sign-in, conference selection, **QR scan + attendee lookup**

**Not yet built:** mobile meal validation, validation pull-down from Supabase, offline mobile cache, durable local attendee cache on desktop, silent/production Brother printing, multi-event support.

---

## Current working features

| Area | Status |
|------|--------|
| RegFox connection test | `npm run test:regfox` — connects and lists attendees with meal breakdown |
| Attendee download | Paginated fetch from Webconnex v2 `/search/registrants` |
| Attendee search | Filter by name, email, org, purchases, custom fields |
| Badge preview | 3.9" × 2.4" horizontal label; Inter font; top/middle/bottom configurable zones (up to 3 fields each) |
| Badge printing | **Print Badge** button → Electron `webContents.print({ silent: false })`; print CSS hides non-badge UI |
| Preferred printer memory | Remembers last successful printer in `userData/preferred-printer.json`; pre-selects if still available |
| QR on badge | Encodes stable attendee id (`registrationId` / id); no PII in QR |
| Meal validation panel | QR paste or list selection; shows plans, validatable meals, meal choice, dietary info |
| Meal plan expansion | Full/half/bring-your-own plans expand to individual meals via `mealPlanConfig.ts` |
| **Persistent meal validation** | SQLite `meal_validations` table; survives app restart; UNIQUE per attendee + meal |
| **Scanner server (foundation)** | Local HTTP server in main process; health + attendee lookup endpoints; off by default |
| **Supabase cloud publish (Sprint 10)** | Main-process client; `cloud:publishAttendees`; Cloud Status panel; optional `.env` config |
| **Mobile PWA (Sprint 11–12)** | `apps/mobile` — PWA, Supabase lookup, `@zxing/browser` QR scan, read-only attendee + meals |
| Group registration names | Attendee name from `fieldData` (`name.first` / `name.last`), not purchaser billing name |

---

## Current Git commits / milestones

Recent milestones include mobile QR scan + attendee lookup (Sprint 12), mobile PWA foundation (Sprint 11), Supabase cloud publish, and meal validation persistence. Run `git log --oneline -10` for the latest SHAs.

---

## Architecture summary

```
FoxBridge/
├── apps/
│   └── mobile/         # Volunteer PWA (React + Vite + vite-plugin-pwa)
├── electron/           # Main process, IPC, printing, database, scanner server, cloud
│   ├── main.ts
│   ├── preload.ts
│   ├── regfoxHandlers.ts
│   ├── mealValidationHandlers.ts
│   ├── scannerServerHandlers.ts
│   ├── cloudHandlers.ts
│   ├── cloud/
│   │   ├── supabaseConfig.ts
│   │   ├── supabaseClient.ts
│   │   ├── buildPublishPayload.ts
│   │   ├── publishAttendeesRepository.ts
│   │   └── cloudPublishStore.ts
│   ├── scannerServer/
│   ├── db/
│   └── printing/
├── supabase/
│   └── migrations/     # 001 cloud, 002 scanner auth, 003 mobile attendee read
├── src/
│   ├── features/
│   │   ├── attendees/
│   │   ├── badge/
│   │   ├── meals/
│   │   ├── scanner/
│   │   └── cloud/          # Cloud Status panel
│   ├── integrations/regfox/  # API service, mapping, meal classification
│   └── shared/models/        # Attendee, MealValidation, ScannerServer types
├── scripts/
│   ├── test-regfox.ts        # CLI inspection of attendees + meals
│   └── test-printer.sh       # Separate macOS `lp` diagnostic (not used by app)
└── docs/                     # VISION, PRODUCT, ARCHITECTURE, PROJECT_STATE, SUPABASE_ARCHITECTURE, etc.
```

**Stack:** Electron 36, React 19, Vite 6, TypeScript, **better-sqlite3**, **@supabase/supabase-js**  
**RegFox API:** `https://api.webconnex.com/v2/public` with `apiKey` header (main process only)  
**IPC:** `regfox:getAttendees`, `print:badgePreview`, `meals:getValidationsForAttendee`, `meals:validateMeal`, `scannerServer:*`, `cloud:getStatus`, `cloud:publishAttendees`  
**Dev note:** Run with `env -u ELECTRON_RUN_AS_NODE` (Cursor sets this var and breaks Electron).  
**Native modules:** `better-sqlite3` must be rebuilt for Electron after a fresh `npm install`. This runs automatically via `postinstall`; if desktop fails with `NODE_MODULE_VERSION` errors, run `npm run rebuild:native`.

---

## Important project decisions

1. **Electron printing only** for badges — not `lp`, shell scripts, or PDF generation in the app flow.
2. **System print dialog** for now (`silent: false`); no silent printing yet.
3. **Attendee names** come from registrant `fieldData`, not billing/purchaser, for group registrations.
4. **QR payload** is a stable id only — no email, phone, meals, or API keys.
5. **Meal purchase categories:** `mealPlan`, `individualMeal`, `mealChoice` (legacy `meals.*` mapped to `mealPlan`).
6. **Meal plan expansions** live in one config file (`mealPlanConfig.ts`), derived from RegFox form descriptions.
7. **Validation state** persisted in SQLite (`meal_validations`); UNIQUE on `attendee_id + meal_key`.
8. **Database access in main process only** — renderer uses IPC; no direct SQLite from React.
9. **Scanner server binds to localhost (`127.0.0.1`) only** — no auth yet; LAN binding requires pairing/security next.
10. **Scanner server is disabled by default** — start via desktop **Start server** button or `SCANNER_SERVER_ENABLED=true`.
11. **Supabase is optional** — desktop SQLite and RegFox flows work without cloud config; publish failures do not block desktop.
12. **No `"type": "module"`** in root `package.json` — main process builds as CJS.
13. **Platform-independent printing layer** — macOS CUPS capture for remembered printer; Windows stub ready for extension.

---

## Scanner server status

| Item | Status |
|------|--------|
| HTTP server | Node `http` module in Electron main process |
| Default state | **Stopped** |
| Start triggers | Desktop **Start server** button, or `SCANNER_SERVER_ENABLED=true` in `.env` |
| Bind address | `127.0.0.1` (localhost only) |
| Default port | `3847` (override with `SCANNER_SERVER_PORT`) |
| Attendee data source | In-memory cache populated when `regfox:getAttendees` runs |
| RegFox API key | **Never exposed** to HTTP clients |
| Mobile meal validation | **Not implemented** — lookup only |
| Mobile scanner UI | **Not built** |
| LAN / auth | **Not implemented** — required before binding beyond localhost |

### Endpoints

#### `GET /health`

Returns:

```json
{
  "ok": true,
  "app": "FoxBridge",
  "mode": "scanner-server",
  "timestamp": "2026-07-09T23:00:00.000Z"
}
```

#### `GET /api/attendees/:attendeeId`

Looks up an attendee by stable QR identifier (`id` or `registrationId`). Returns name, registration id, and validatable meals using the same logic as the desktop meal panel.

Example success (`200`):

```json
{
  "attendeeId": "88609458",
  "name": "Mark Zuckerberg",
  "registrationId": "88609458",
  "validatableMeals": [
    {
      "id": "mealPan.thursdayDinner",
      "name": "Thursday Dinner",
      "source": "individual"
    }
  ]
}
```

Error responses:

| Status | When |
|--------|------|
| `400` | Missing attendee id |
| `404` | Attendee not found in cache |
| `503` | Attendee cache empty (RegFox sync not completed) |

**Not returned:** email, phone, RegFox API key, meal validation write endpoints.

---

## How to test the scanner server

1. Run `npm run dev` and wait for attendees to load from RegFox.
2. Click **Start server** in the header (or set `SCANNER_SERVER_ENABLED=true` in `.env` and restart).
3. Confirm status shows `http://127.0.0.1:3847` (or your configured port).

```bash
curl -s http://127.0.0.1:3847/health | jq .

# Replace ATTENDEE_ID with a stable id from badge QR or test:regfox output
curl -s http://127.0.0.1:3847/api/attendees/ATTENDEE_ID | jq .
```

4. Stop the server with **Stop server** or quit the app.
5. Before attendees load, `GET /api/attendees/:id` should return `503`.

**Security note:** Localhost binding is sufficient for same-machine testing. Before exposing the server on the LAN for a phone browser, add pairing or authentication — do not bind to `0.0.0.0` without that step.

---

## Supabase cloud status (Sprint 10)

| Item | Status |
|------|--------|
| Supabase client | `@supabase/supabase-js` in Electron **main process only** |
| Configuration | Optional `.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_CONFERENCE_ID` |
| Publish IPC | `cloud:publishAttendees` — upserts attendees + meal entitlements from RegFox cache |
| Status IPC | `cloud:getStatus` — configured, connected, conference, last publish |
| UI | **Cloud status** panel in header with **Publish attendees** button |
| SQLite / desktop meals | **Unchanged** — cloud is additive; desktop works without Supabase |
| Schema migration | `supabase/migrations/001_cloud_foundation.sql` (run manually in Supabase) |
| Mobile scanner | **Not built** |
| Validation upload to cloud | **Not built** |
| Pull validations to desktop | **Not built** |
| RLS / scanner codes | **Not built** |

### Published fields

Per attendee (sanitized upload):

- `attendee_id`, `registration_id`, `display_name`, `email`, `qr_identifier`
- `meal_entitlements` rows: `meal_key`, `meal_label`, `source`, `source_plan_id`

RegFox API key is never sent to Supabase or the renderer.

### How to test Supabase publish

1. Create a Supabase project and run `supabase/migrations/001_cloud_foundation.sql`.
2. Insert a `conferences` row and copy its `id` to `SUPABASE_CONFERENCE_ID` in `.env`.
3. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY`.
4. Run `npm run dev` and wait for RegFox attendees to load.
5. Confirm **Cloud status** shows **Connected** (or **Unavailable** if the conference row is missing — publish may still work for attendees).
6. Click **Publish attendees** — panel should show last publish time and attendee count.
7. Verify in Supabase Table Editor: `attendees` and `meal_entitlements` rows for your conference.
8. Unset Supabase env vars and restart — desktop search, badges, and meal validation should still work.

Publish state is stored locally in `userData/cloud-publish-state.json`.

---

## Mobile PWA status (Sprint 11–12)

| Item | Status |
|------|--------|
| Location | `apps/mobile` — standalone React + Vite + TypeScript app |
| PWA | `vite-plugin-pwa` — installable; manifest + service worker on build |
| Supabase | Anon key via `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` |
| Auth | Volunteer name + scanner code (`validate_scanner_code` RPC) or dev access code |
| Screens | Splash → Sign In → Conference Selection → **Scanner (Ready to scan)** |
| QR scanning | **`@zxing/browser`** — camera scan + manual code entry |
| Attendee lookup | Read-only by `qr_identifier` for current conference |
| Meal validation | **Not implemented** |
| Offline | **Not implemented** |
| Schema | Migrations `001`, `002`, **`003_mobile_attendee_lookup.sql`** |

### Setup

```bash
cd apps/mobile
cp .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
```

From repo root: `npm run dev:mobile` (port **5174**).

Run Supabase migrations **001 → 002 → 003**. Desktop **Publish attendees** must run before mobile lookup works.

### How to test end-to-end scan (Sprint 12)

1. **Desktop:** `npm run dev` → load RegFox attendees → **Publish attendees** (Cloud status panel).
2. **Supabase:** Verify `attendees.qr_identifier` and `meal_entitlements` rows for your conference.
3. **Mobile:** `npm run dev:mobile` → sign in (scanner code or dev access code) → **Ready to scan**.
4. Tap **Scan badge** → allow camera → scan printed badge QR **or** **Enter code manually** with the QR value.
5. **Expect:** Attendee name, registration ID, validatable meals list. **No validate buttons.**
6. Test errors: deny camera (plain message + manual fallback), wrong code (not found), airplane mode (network unavailable).

See [`apps/mobile/README.md`](../apps/mobile/README.md) and [`MOBILE_PRODUCT.md`](./MOBILE_PRODUCT.md).

---

## Current RegFox test event status

- Credentials: `REGFOX_API_KEY` + `REGFOX_EVENT_ID` in local `.env` (see `.env.example`).
- Event uses **AdAgrA-style meal fields** (`mealPan.*`) plus legacy registrations still on `meals.session1/2/3`.
- ~10 test registrants in the current event (mix of individual, corporate, and group registrations).
- Run `npm run test:regfox` to inspect live attendee/meal data (emails/phones redacted in script output).

---

## Badge printing status

| Item | Status |
|------|--------|
| Preview | Working — black & white, 3.9" × 2.4" horizontal |
| Print trigger | **Print Badge** → IPC → `printBadgePreview()` |
| Print dialog | macOS system dialog (`silent: false`) |
| Preferred printer | Saved after successful print; pre-selected next time if available |
| Silent / auto-select | **Not implemented** |

---

## QR code status

| Item | Status |
|------|--------|
| Generation | `react-qr-code` on badge preview |
| Value | Stable attendee id via `getAttendeeQrValue()` |
| Desktop scanner input | Manual QR value paste in meal validation panel |
| Mobile browser scanner | **Read-only lookup** — QR scan + entitlements display; validation not built |
| PII in QR | None by design |

---

## Meal validation status

| Item | Status |
|------|--------|
| UI | Middle panel: QR lookup + attendee list selection |
| Validation | Per `attendee_id + meal_key`; duplicate blocked with **Already validated** |
| Persistence | SQLite `meal_validations` table in `userData/foxbridge.db` |
| Mobile validation API | **Not implemented** |

---

## Known issues

1. **`docs/PRODUCT.md` is partially stale** — lists QR scanning and meal tracking as out of scope, but QR generation and meal validation exist.
2. **Dual meal schemas** — legacy `meals.session*` and new `mealPan.*` coexist in the same event dataset.
3. **In-memory attendee cache only** — scanner server and desktop share cache from latest RegFox fetch; not persisted across restarts.
4. **Scanner server is localhost-only** — phones on Wi‑Fi cannot reach it until LAN bind + pairing is added.

---

## How to test meal validation persistence

1. Run `npm run dev`.
2. Validate a meal for an attendee — button shows **Already validated**.
3. Restart the app — validation state persists.
4. Inspect SQLite (optional):

```bash
sqlite3 ~/Library/Application\ Support/foxbridge/foxbridge.db \
  "SELECT attendee_id, meal_key, meal_label, validated_at FROM meal_validations;"
```

---

## Immediate next task

**Mobile meal validation** — write to Supabase `meal_validations` with duplicate handling, per [`MOBILE_PRODUCT.md`](./MOBILE_PRODUCT.md).

Suggested order:
1. Validate meal button on attendee result screen (Supabase insert).
2. Show already-validated state from existing `meal_validations` rows.
3. Desktop pull of cloud validations into local SQLite.
4. Offline cache + validation outbox.

---

## Short prompt to paste into a new ChatGPT chat

```
I'm continuing work on FoxBridge, a desktop Electron + React + TypeScript app for RegFox event check-in and Brother label badge printing.

Read docs/PROJECT_STATE.md, docs/MOBILE_PRODUCT.md, docs/SUPABASE_ARCHITECTURE.md, and docs/PRODUCT_DECISIONS.md in the repo.

Current state:
- Desktop: RegFox sync, badges, print, SQLite meal validation, optional Supabase publish
- Mobile PWA (apps/mobile): sign-in, QR scan, read-only attendee + meal entitlement lookup from Supabase
- Branch main is on GitHub

Do not expose .env secrets. Do not hardcode printer names.

Next task: mobile meal validation writes to Supabase.

Help me implement the next step with minimal scope, matching existing code conventions.
```
