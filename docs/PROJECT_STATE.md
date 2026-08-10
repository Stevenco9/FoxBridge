# FoxBridge — Project State

Last updated: August 2026 (Sprint 20.5 — UX polish and validation)  
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
- **Mobile PWA** — sign-in, QR scan, **Supabase meal validation** (online only)
- **Guided conference setup** — wizard for RegFox, printer, and optional phone scanning (Sprint 13A–13B)
- **Operations home** — conference status, Connect a phone, refresh registrations (Sprint 13B)
- **One-scan phone pairing** — organizer shows one QR; volunteer scans with Camera app; PWA auto-joins conference (Sprint 13B)
- **Meal Dashboard (Sprint 18A–18B)** — read-only meal validation reporting; open a meal for the entitled / served detail report
- **Badge print history (Sprint 19.1–19.5)** — local SQLite logs; status under Badge Preview; click opens print history dialog
- **Available attendee fields catalog (Sprint 20.1)** — pure shared discovery service for future configurable highlight fields (no UI/IPC yet)
- **Event settings persistence (Sprint 20.2)** — `event-settings.json` + generic get/patch IPC for per-event prefs (`attendeeDisplay`); no UI yet
- **Event Settings UI (Sprint 20.3)** — Operations Home → Event Settings; Attendee Display ordered field list (add/remove/change, autosave); attendee details screen unchanged
- **Attendee Quick Info (Sprint 20.4)** — details panel renders configured `attendeeDisplay` fields; hardcoded AdAgrA book UI removed
- **Sprint 20.5 polish** — Event Settings / Quick Info spacing, long-label handling, scroll for long lists, clearer stale keys

**Not yet built:** reorder controls for display items, IPC for available-field catalog discovery, mobile offline queue, desktop pull of cloud validations into local SQLite, durable local attendee cache on desktop, silent/production Brother printing, multi-event support.

---

## Sprint 15A / packaging — Desktop installers

| Item | Status |
|------|--------|
| **electron-builder** | Configured in `package.json` (`appId`: `com.foxbridge.desktop`, output: `release/`) |
| **macOS universal DMG** | `npm run dist:mac` → `release/FoxBridge-<version>-mac-universal.dmg` |
| **Windows NSIS x64** | `npm run dist:win` → `release/FoxBridge-<version>-win-x64.exe` (build on Windows or via Actions) |
| **Windows CI** | `.github/workflows/build-windows.yml` — tests + NSIS artifact upload (no auto Release) |
| **better-sqlite3** | Rebuilt via `postinstall`; unpacked from ASAR (`asarUnpack`) in packaged app |
| **User data** | Electron `userData` (macOS `~/Library/Application Support/foxbridge`; Windows `%APPDATA%\foxbridge`) |
| **Icons** | `build/icon.icns`, `build/icon.ico`, `build/icon.png` from `apps/mobile/public/icon.svg` |
| **Release docs** | [`RELEASING.md`](./RELEASING.md) — Mac + Windows build and install |

**Current limitations:** Mac and Windows builds are **unsigned** (Gatekeeper / SmartScreen warnings on first launch). **Brother badge printing is verified on macOS; not yet verified on Windows.** No auto-update or automatic GitHub Releases publishing yet.

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
| Event settings | Per-event prefs in `userData/event-settings.json` via `getEventSettings` / `patchEventSettings` (`attendeeDisplay.fieldKeys` today) |
| QR on badge | Encodes stable attendee id (`registrationId` / id); no PII in QR |
| Meal validation panel | QR paste or list selection; shows plans, validatable meals, meal choice, dietary info |
| Meal plan expansion | Full/half/bring-your-own plans expand to individual meals via `mealPlanConfig.ts` |
| **Persistent meal validation** | SQLite `meal_validations` table; survives app restart; UNIQUE per attendee + meal |
| **Scanner server (foundation)** | Local HTTP server in main process; health + attendee lookup endpoints; off by default |
| **Supabase cloud publish (Sprint 10)** | Main-process client; `cloud:publishAttendees`; optional `.env` config |
| **Guided setup + operations home (Sprint 13A–13B)** | Setup wizard, persisted settings, simplified operations home, one-scan Connect a phone |
| **One-scan phone pairing (Sprint 13B)** | `scanner_pairing_tokens` + `exchange_scanner_pairing_token` RPC; desktop creates HTTPS pairing QR; mobile `/pair?token=` |
| **Auto-publish to phone scanners (Sprint 13B)** | RegFox load/refresh publishes attendees when phone service is configured; non-technical warning on failure |
| **Desktop meal validation toggle (Sprint 13B)** | Hidden by default in Conference Mode; optional under Settings → Advanced |
| **Mobile PWA (Sprint 11–13)** | QR scan, attendee lookup, online **meal validation** via Supabase `validate_meal` RPC |
| Group registration names | Attendee name from `fieldData` (`name.first` / `name.last`), not purchaser billing name |

---

## Current Git commits / milestones

Recent milestones include one-scan phone pairing + operations home cleanup (Sprint 13B), guided conference setup (Sprint 13A), mobile Supabase meal validation (Sprint 13), QR scan lookup (Sprint 12), mobile PWA foundation (Sprint 11), and Supabase cloud publish. Run `git log --oneline -10` for the latest SHAs.

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
│   ├── settingsHandlers.ts
│   ├── eventSettingsHandlers.ts
│   ├── settings/
│   │   ├── settingsService.ts
│   │   ├── settingsStore.ts
│   │   ├── eventSettingsStore.ts
│   │   └── secretStore.ts
│   ├── cloud/
│   │   ├── supabaseConfig.ts
│   │   ├── supabaseClient.ts
│   │   ├── buildPublishPayload.ts
│   │   ├── publishAttendeesRepository.ts
│   │   ├── mobileScannerInfoRepository.ts
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
│   │   ├── eventSettings/
│   │   ├── meals/
│   │   ├── scanner/
│   │   └── cloud/          # Cloud Status panel
│   ├── integrations/regfox/  # API service, mapping, meal classification
│   └── shared/models/        # Attendee, MealValidation, ScannerServer types
├── build/                  # Desktop icon assets (icns, ico, png) for electron-builder
├── scripts/
│   ├── test-regfox.ts        # CLI inspection of attendees + meals
│   └── test-printer.sh       # Separate macOS `lp` diagnostic (not used by app)
└── docs/                     # VISION, PRODUCT, ARCHITECTURE, PROJECT_STATE, RELEASING, SUPABASE_ARCHITECTURE, etc.
```

**Stack:** Electron 36, React 19, Vite 6, TypeScript, **better-sqlite3**, **@supabase/supabase-js**  
**RegFox API:** `https://api.webconnex.com/v2/public` with `apiKey` header (main process only)  
**IPC:** `settings:*`, `regfox:getAttendees|connect|updateRegistrations`, `print:*`, `meals:*`, `scannerServer:*`, `cloud:*`  
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
| Mobile scanner IPC | `cloud:getMobileScannerInfo`, `cloud:setupMobileScanner`, `cloud:testMobileService` |
| Organizer UI | **Setup wizard** + **Operations home** — no Supabase jargon in normal flow |
| Advanced UI | **Settings → Advanced** — Cloud status, scanner server, diagnostics |
| Settings persistence | `userData/settings/app-settings.json` + encrypted secrets via `safeStorage` |
| `.env` fallback | Still supported for development; migrated on first launch when settings empty |
| SQLite / desktop meals | **Unchanged** — cloud is additive; desktop works without Supabase |
| Schema migration | `supabase/migrations/001_cloud_foundation.sql` (run manually in Supabase) |
| Mobile scanner | **Built** — `apps/mobile` PWA with Supabase auth + meal validation |
| Validation upload to cloud | **Built (mobile)** — `validate_meal` RPC writes `meal_validations` |
| Pull validations to desktop | **Not built** |
| RLS / scanner codes | **Partial** — `scanner_sessions` + `validate_scanner_code` RPC; auto-created in setup |

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
6. Finish setup wizard step **Mobile scanner** — attendees are sent automatically.
7. Verify in Supabase Table Editor: `attendees` and `meal_entitlements` rows for your conference.
8. Unset Supabase env vars and restart — desktop search, badges, and meal validation should still work.

Publish state is stored locally in `userData/cloud-publish-state.json`.

---

## Guided setup and operations home (Sprint 13A)

### Setup wizard (first launch or Settings → Reopen setup)

| Step | Action |
|------|--------|
| Welcome | Start setup |
| Language | English or Spanish (wizard + home screen only) |
| Connect registration | RegFox API key + page ID → test + auto-download attendees |
| Printer | Select Brother printer, print test badge, or skip |
| Mobile scanner | Test mobile service, auto-publish attendees, create scanner code |
| Ready | Review summary → **Finish setup** |

Settings persist in `userData/settings/`. Secrets use Electron `safeStorage` when available.

**Organizer** runs setup on the registration laptop. **Volunteers** use desktop search/print/meals or the mobile PWA.

### Operations home (after setup)

| Action | Behavior |
|--------|----------|
| Find attendee | Scrolls to search |
| Print badge | Scrolls to badge preview |
| Validate meal | Scrolls to meal panel |
| Connect a phone | QR (app URL only) + scanner code + copy buttons; LAN URL in dev |
| Update registrations | RegFox download + auto-republish to mobile when configured |

**Settings → Advanced:** Cloud status, manual publish, scanner server, diagnostics. Legacy localhost scanner server is **not** in the default workflow.

### How to test guided setup

1. Delete or rename `userData/settings/` to simulate first launch (optional).
2. Run `npm run dev` — wizard should appear.
3. Complete RegFox step — attendees load without a separate “load” button.
4. Skip or configure printer — test print uses a hidden window (does not replace main UI).
5. Enter mobile service fields (or rely on migrated `.env`) — attendees publish automatically.
6. Finish setup — operations home appears with five action buttons.
7. **Connect a phone** — large QR encodes the phone-accessible app URL only; volunteers enter scanner code manually at sign-in.
8. **Update registrations** — one button refreshes RegFox and republishes to mobile.
9. **LAN testing** — with `npm run dev:mobile`, desktop shows `http://<lan-ip>:5174` when the test server is running (same Wi-Fi required).
9. **Settings → Reopen setup wizard** — returns to wizard without deleting SQLite data.

### Remaining limitations

- QR contains **only the mobile app URL** — no scanner code or secrets in the QR payload.
- `localhost` is never shown as a phone-accessible address; use hosted URL or LAN testing URL.
- Incomplete mobile setup shows **Set up mobile scanner** instead of a dead-end error.
- Full auto-pairing / auto-sign-in from QR is **not** implemented — manual scanner code required.

---

## Mobile PWA status (Sprint 11–13)

| Item | Status |
|------|--------|
| Location | `apps/mobile` — standalone React + Vite + TypeScript app |
| PWA | `vite-plugin-pwa` — installable; manifest + service worker on build |
| Supabase | Anon key via `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` |
| Auth | Volunteer name + scanner code (`validate_scanner_code` RPC) or dev access code |
| Screens | Splash → Sign In → Conference Selection → **Scanner** |
| QR scanning | **`@zxing/browser`** — camera scan + manual code entry |
| Attendee lookup | By `qr_identifier` for current conference |
| **Meal validation** | **`validate_meal` RPC** — online only; `source = mobile`; duplicate → Already validated |
| Offline | **Not implemented** |
| Schema | Migrations `001`–`004` (includes `meal_validations` + RPC) |

### Setup

```bash
cd apps/mobile
cp .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
```

From repo root: `npm run dev:mobile` (port **5174**).

Run Supabase migrations **001 → 002 → 003 → 004**. Desktop **Send attendees to mobile scanner** must run before mobile lookup works.

### How to test meal validation (Sprint 13)

1. **Desktop:** `npm run dev` → load RegFox attendees → **Send attendees to mobile scanner** (Conference Mode step 2).
2. **Supabase:** Run `004_mobile_meal_validation.sql`; confirm `meal_validations` table and `validate_meal` RPC exist.
3. **Mobile:** `npm run dev:mobile` → sign in with scanner code → scan or enter badge QR.
4. Tap **Validate meal** on an available meal → UI shows **Validated**.
5. **Supabase:** Confirm row in `meal_validations` (`conference_id`, `attendee_id`, `meal_key`, `meal_label`, `validated_at`, `scanner_session_id`, `source = mobile`).
6. Validate the same meal again → UI shows **Already validated** (no crash, no duplicate row).
7. Re-scan attendee → prior validations show **Already validated**.
8. **Desktop:** `npm run build` and `npm run dev` — SQLite meal validation unchanged.

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
| Mobile browser scanner | QR scan + **online meal validation** via Supabase |
| PII in QR | None by design |

---

## Meal validation status

| Item | Status |
|------|--------|
| UI | Middle panel: QR lookup + attendee list selection |
| Validation | Per `attendee_id + meal_key`; duplicate blocked with **Already validated** |
| Persistence | SQLite `meal_validations` table in `userData/foxbridge.db` |
| Mobile validation API | **Supabase `validate_meal` RPC** (online only) |

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

**Pull mobile validations into desktop SQLite** and/or **mobile offline queue**, per [`SUPABASE_ARCHITECTURE.md`](./SUPABASE_ARCHITECTURE.md).

Suggested order:
1. Desktop sync job: pull Supabase `meal_validations` into local SQLite.
2. Mobile offline cache + validation outbox.
3. RLS hardening / scanner session scoping beyond anon read policies.

---

## Sprint 18A / 18B — Meal Dashboard + Meal Detail

Read-only desktop reporting over Supabase meal validations for the active conference. Does **not** change mobile scanning, validation writes, schema, RegFox sync, entitlement generation, or canonical meal order.

### Sprint 18A — summary dashboard

- Entry: Operations Home → **Meal Dashboard**
- IPC: `cloud:getMealDashboard` → `loadMealDashboard()` (main-process service-role client)
- Summary cards, per-meal table, recent 25 scans
- **Entitled counts** prefer live RegFox attendee cache via `getValidatableMeals` / `buildLiveMealEntitlements`; fall back to Supabase `meal_entitlements` when the cache is empty
- Canonical meal display names from existing meal-order helpers

### Sprint 18B — meal detail report

- Selecting a meal opens a nested detail view in the same panel (Back restores the summary **without** refetching dashboard aggregates)
- Detail Refresh reloads only that meal (`cloud:getMealDashboardDetail`)
- Header: meal name, entitled, served, not served, % served, most recent validation
- One row per entitled attendee: name, Served / Not Served, validation time, scanner label
- Filters: All / Served / Not Served; attendee-name search; sort A–Z, Z–A, served newest, served oldest (unserved after served for time sorts)
- No email, phone, confirmation code, payment, or registration answers

### Data joining rules

| Store | Identity column | Join to name |
|-------|-----------------|--------------|
| `meal_entitlements.attendee_id` | QR identifier | `attendees.qr_identifier` (also try `attendees.attendee_id`) |
| `meal_validations.attendee_id` | QR identifier | same |
| `scanner_sessions` | `meal_validations.scanner_session_id` → `scanner_sessions.id` | `label` |

Queries are scoped to `conference_id` and the selected meal’s canonical key plus known child-path aliases (`mealKeysMatchingCanonical`).

### Duplicate validation rule

- One list row per entitled attendee
- Any validation for that attendee + meal ⇒ **Served**
- Displayed “served at” time = **earliest** `validated_at` among duplicates; scanner label comes from that earliest row
- Header “most recent” uses the **latest** validation among entitled served attendees
- Raw duplicate count is kept only in memory for diagnostics (`rawValidationCount`); not shown as separate people

### Tests

- `npm run test:meal-dashboard`
- `npm run test:meal-detail`
- `npm run test:meal-order`

### Remaining live-test requirements

- Confirm meal detail against a live conference with real phone validations
- Confirm RegFox-cache entitled list matches on-floor expectations when registrations have just refreshed
- Confirm child-path vs canonical `meal_key` rows both appear under one meal detail
- Confirm scanner labels resolve when `scanner_session_id` is present
- Confirm Back keeps summary data without an unnecessary full dashboard refetch

### Attendee meal status (person-first)

Lives only in **Meal Dashboard → By attendee** (not on the main registration/check-in screen):

- Name search over loaded RegFox attendees
- Open a person → purchased meals with **Validated** / **Not validated**, time, and scanner label
- Summary: `X of Y validated`
- Validations: Supabase phone history (by QR identifier) merged with local desktop SQLite
- **By meal** tab keeps the existing meal summary + meal detail drill-down
- Does not change mobile scanning or meal validation writes

---

## Sprint 19.1 — Badge print history infrastructure

Local desktop SQLite foundation for recording badge reprints.

| Item | Detail |
|------|--------|
| **Model** | `src/shared/models/BadgePrintLog.ts` — `BadgePrintLog`, `RecordBadgePrintInput`, `BadgePrintStatus` |
| **Table** | `badge_print_logs` created in `electron/db/database.ts` `initSchema()` via `CREATE TABLE IF NOT EXISTS` (same pattern as `meal_validations` / `attendee_check_ins`) |
| **Indexes** | `attendee_id`; `(attendee_id, printed_at)` |
| **Repository** | `electron/db/badgePrintLogRepository.ts` |
| **API** | `recordBadgePrint`, `getBadgePrintHistory`, `getBadgePrintCount`, `getLastBadgePrint`, `getBadgePrintStatus` |
| **Columns** | `id`, `attendee_id`, `printed_at`, `printer_name`, `workstation`, `operator`, `notes` (last four nullable) |

Schema is applied automatically the next time the main process opens `foxbridge.db` (`getDatabase()` → `initSchema()`). Existing databases pick up the new table without a separate migration script.

### Sprint 19.2 — Record successful badge prints

After `webContents.print` reports success in `electron/printing/printBadgePreview.ts`, the main process calls `recordBadgePrint` with:

- `attendeeId` passed from `BadgePreview` via `print:badgePreview` IPC
- `printedAt` assigned by the repository (current ISO timestamp)
- `printerName` from existing `captureSelectedPrinterName` (nullable)
- `workstation` / `operator` left null (not available in the current print path)

Failed prints (dialog cancel / print error) reject before logging. Test badge printing is unchanged and does not write history. Logging errors are swallowed so they cannot fail a successful print.

### Sprint 19.3 — Expose badge print status via IPC

Read-only single IPC for the renderer (no UI):

- Channel: `print:getBadgePrintStatus`
- Preload: `window.electronAPI.getBadgePrintStatus(attendeeId)`
- Handler: `electron/badgePrintHandlers.ts` → `getBadgePrintStatus()`
- Returns `{ count, lastPrintedAt, history }` (`history` newest-first; empty attendee id → empty status)

### Sprint 19.4 — Badge print status indicator

Compact status under the **Badge Preview** title (not full history, no modal):

- Loads via `getBadgePrintStatus(attendeeId)` when the selected attendee changes
- Refresh token bumps after a successful `printBadgePreview` so the indicator updates without leaving the person
- Copy: `Never Printed` / `Printed 1 time` / `Printed X times`, plus `Last: …` when printed
- Sprint 19.4.1: indicator is a button with hover/focus styling and required `onClick` (parent-supplied; history dialog not implemented yet)
- Sprint 19.5: click opens `BadgePrintHistoryDialog` — summary + date/time list via `getBadgePrintStatus`; Close or backdrop dismisses; no edit/delete/export

---

## Sprint 20.1 — Discover available registration fields

Pure shared service that builds a catalog of every meaningful `Attendee` attribute organizers may later choose to display in the attendee details panel. **No UI, no IPC, no import changes.**

| Item | Detail |
|------|--------|
| **Service** | `src/shared/attendees/discoverAvailableAttendeeFields.ts` |
| **API** | `discoverAvailableAttendeeFields({ attendees })` → `AvailableAttendeeField[]` |
| **Shape** | `{ key, label, dataType, source, category? }` — JSON-serializable for a future IPC wrapper |
| **Static fields** | Built-in Attendee props, derived (`fullName`, `cityState`, `registrationType`), payment snapshot |
| **Event-specific** | Union of `customFields` (`custom:<path>`) and `purchases` (`purchase:<id>`) across imported attendees |
| **Test** | `npm run test:available-attendee-fields` |

Keys for custom/purchase entries align with badge field ID prefixes (`custom:`, `purchase:`) so later resolution can share conventions with `badgeFields.ts`.

---

## Sprint 20.2 — Event settings persistence

Per-event organizer preferences in Electron `userData`, separate from global `AppSettingsPublic` and SQLite ops data. **No UI.**

| Item | Detail |
|------|--------|
| **File** | `{userData}/event-settings.json` |
| **Shape** | `{ version: 1, events: { [regfoxEventId]: EventSettingsEntry } }` |
| **Model** | `src/shared/models/EventSettings.ts` |
| **Normalize** | `src/shared/settings/normalizeEventSettings.ts` (pure) |
| **Store** | `electron/settings/eventSettingsStore.ts` |
| **IPC** | `eventSettings:get` / `eventSettings:patch` (generic entry get/merge) |
| **Preload** | `getEventSettings(eventId)`, `patchEventSettings(eventId, patch)` |
| **Current section** | `attendeeDisplay.fieldKeys` — stable Sprint 20.1 catalog keys |
| **Extensibility** | Add sections on `EventSettingsEntry` / `EventSettingsPatch` (e.g. badgeLayout, meals) without new channels |
| **Test** | `npm run test:event-settings` |

Example on-disk fragment:

```json
{
  "version": 1,
  "events": {
    "12345": {
      "attendeeDisplay": {
        "fieldKeys": ["fullName", "custom:address.city", "purchase:mealPan.fullMealPlan"]
      }
    }
  }
}
```

---

## Sprint 20.3 — Event Settings UI (Attendee Display)

Organizer UI to configure which fields will appear on the attendee details screen. **Does not yet render those fields on the details panel.**

| Item | Detail |
|------|--------|
| **Entry** | Operations Home → **Event Settings** (secondary action beside Meal Dashboard) |
| **Shell** | `src/features/eventSettings/EventSettingsPanel.tsx` — modal overlay; sections container for future badge/meal prefs |
| **Section** | `AttendeeDisplaySettingsSection.tsx` — dynamic ordered list of selectors |
| **Catalog** | Renderer calls `discoverAvailableAttendeeFields({ attendees })` (Sprint 20.1); grouped Built-in / Derived / Payment / Purchases / Custom Registration |
| **Persist** | Autosave via `getEventSettings` / `patchEventSettings` → `attendeeDisplay.fieldKeys` |
| **Actions** | Add, remove, change item; reorder deferred |
| **Duplicates** | Options already used in other rows are disabled in each `<select>` |
| **Test** | `npm run test:attendee-display-catalog` |

---

## Sprint 20.4 — Render Attendee Quick Info

Configured Event Settings fields now appear on the selected attendee details panel.

| Item | Detail |
|------|--------|
| **Panel** | `AttendeeQuickInfoPanel` — after Payment, before Check-in / Badge |
| **Load** | `getPublicSettings` → `regfoxEventId` → `getEventSettings` → `attendeeDisplay.fieldKeys` |
| **Resolve** | `resolveAttendeeDisplayItems` / `resolveAttendeeDisplayValue` (shared pure) |
| **Labels** | From `discoverAvailableAttendeeFields` catalog |
| **Hide empty** | null / empty string / empty array / false / purchase qty ≤ 0 |
| **Format** | true → `✓ Yes`; qty 1 → `Purchased`; qty >1 → `N Purchased`; arrays multiline |
| **Removed** | Hardcoded AdAgrA book detail panel + list emoji (`AttendeeBookIndicator`) |
| **Test** | `npm run test:resolve-attendee-display` |

Organizers who want book status on details configure the matching purchase field under Event Settings → Attendee Display.

---

## Sprint 20.5 — UX polish and validation

No new features. Polish + validation of Sprint 20 Event Settings / Quick Info:

- Fixed Event Settings header; body scrolls for long Attendee Display lists
- Attendee Display section card styling; select ellipsis + stale-key highlight
- Quick Info max-height scroll; wrapping for long labels/values
- Clearer unavailable labels; Saved status auto-clears
- Validated duplicates-after-edit, stale labels, large lists, disk persistence path (`userData/event-settings.json`)

---

## Short prompt to paste into a new ChatGPT chat

```
I'm continuing work on FoxBridge, a desktop Electron + React + TypeScript app for RegFox event check-in and Brother label badge printing.

Read docs/PROJECT_STATE.md, docs/MOBILE_PRODUCT.md, docs/SUPABASE_ARCHITECTURE.md, and docs/PRODUCT_DECISIONS.md in the repo.

Current state:
- Desktop: guided setup wizard, operations home, RegFox sync, badges, print, SQLite meal validation, optional mobile cloud publish
- Mobile PWA: sign-in, QR scan, online meal validation via Supabase validate_meal RPC
- Branch main is on GitHub

Do not expose .env secrets. Do not hardcode printer names.

Next task: desktop pull of cloud validations and/or mobile offline mode.

Help me implement the next step with minimal scope, matching existing code conventions.
```
