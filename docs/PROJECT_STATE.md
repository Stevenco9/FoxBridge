# FoxBridge — Project State

Last updated: August 2026 (**Sprint 24.4A — packaged public Cloud configuration**)  
Repo: `https://github.com/Stevenco9/FoxBridge` (branch `main`, **public**)

Use this file to onboard a new ChatGPT conversation quickly. Do **not** commit secrets from `.env`.

**Sync design:** [`SYNC_ARCHITECTURE.md`](./SYNC_ARCHITECTURE.md) — canonical FoxBridge Sync architecture.  
**Device trust / self-service provisioning:** [`DEVICE_TRUST_ARCHITECTURE.md`](./DEVICE_TRUST_ARCHITECTURE.md) — Sprint 22 **complete / live-validated**.  
**Event access session / multi-desktop ops:** [`EVENT_SESSION_ARCHITECTURE.md`](./EVENT_SESSION_ARCHITECTURE.md) — Sprint **23 complete / live-validated**.  
**Operational check-in:** [`CHECK_IN_ARCHITECTURE.md`](./CHECK_IN_ARCHITECTURE.md) — Cloud-first multi-desk check-in + Principal upstream reconciliation.  
**Sync deploy/validation:** [`FOXBRIDGE_SYNC_DEPLOYMENT.md`](./FOXBRIDGE_SYNC_DEPLOYMENT.md) — operator checklist through migration **019**.  
**Cloud backend:** [`SUPABASE_ARCHITECTURE.md`](./SUPABASE_ARCHITECTURE.md) — current Supabase implementation of FoxBridge Cloud.  
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
- **Sprint 21.0–21.10 Sync** — architecture through live clean-install validation (desk enroll, pair, meal validate, Cloud→SQLite)
- **Sprint 22 FINAL — live-validated** — Principal self-service, Connected Desktops, Linked join/revoke/rejoin, secure Principal claim. See [`DEVICE_TRUST_ARCHITECTURE.md`](./DEVICE_TRUST_ARCHITECTURE.md).
- **Sprint 23 FINAL — live-validated** — EventAccessSession lock/unlock; Principal/Linked operational parity; event isolation (A→B→A); operational attendee snapshot; Cloud-first multi-desk check-in; Principal upstream reconciliation (RegFox adapter #1); durable retry; audit + Principal health. See [`EVENT_SESSION_ARCHITECTURE.md`](./EVENT_SESSION_ARCHITECTURE.md) + [`CHECK_IN_ARCHITECTURE.md`](./CHECK_IN_ARCHITECTURE.md).

**Follow-up (non-blocking / backlog — not Sprint 23 blockers):** additional registration-platform adapters; offline Cloud check-in queue; check-out / undo check-in; mobile registration check-in; tighter historical anon RLS; richer admin diagnostics; multi-event UI; Brother silent printing; join-code rate limits; Pre-22.5 Linked rows without `installation_id` may duplicate once on first upgrade rejoin.

**Not yet built:** Sprint 24.4 live auto-update validation on two Macs. Signed 0.1.2 and published v0.1.3 omitted packaged Cloud defaults. **Do not modify v0.1.3.** The next corrected release is a new version after GitHub Actions Cloud Variables exist.

---

## Sprint 15A / packaging — Desktop installers

| Item | Status |
|------|--------|
| **electron-builder** | Configured in `package.json` (`appId`: `com.foxbridge.desktop`, output: `release/`) |
| **macOS universal DMG + ZIP** | Production: GitHub Actions `release-mac.yml`. Local unsigned smoke: `npm run dist:mac` |
| **macOS pack (host arch only)** | `npm run pack:mac` → ARM64-only on Apple Silicon — **do not** use for multi-Mac live validation or the update channel |
| **Mac signing / notarization** | CI: Developer ID Application + Hardened Runtime + notarytool. Local `dist:mac`: unsigned by design |
| **GitHub Releases (Mac)** | Tag `v*` matching `package.json` version publishes DMG, ZIP, `latest-mac.yml`. `workflow_dispatch` does **not** publish |
| **Windows NSIS x64** | `npm run dist:win` → `release/FoxBridge-<version>-win-x64.exe` (`--publish never`) |
| **Windows CI** | `.github/workflows/build-windows.yml` — tests + NSIS artifact upload (no GitHub Release) |
| **better-sqlite3** | Rebuilt via `postinstall`; unpacked from ASAR (`asarUnpack`) in packaged app |
| **User data** | Electron `userData` (macOS `~/Library/Application Support/foxbridge`; Windows `%APPDATA%\foxbridge`) — unchanged by signing |
| **Icons** | `build/icon.icns`, `build/icon.ico`, `build/icon.png` from `apps/mobile/public/icon.svg` |
| **Release docs** | [`RELEASING.md`](./RELEASING.md) — Mac + Windows build and install |

**Current limitations:** **Windows** installers remain **unsigned** (SmartScreen on first launch). **Brother badge printing is verified on macOS; not yet verified on Windows.** In-app auto-update engine + Settings Software Update UI are wired (Sprint 24.2–24.3); live auto-update validation remains pending (24.4) until a Cloud-complete version newer than 0.1.3. Local `npm run dist:mac` is still unsigned.

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
│   ├── sync/                   # Desktop Sync Cloud→SQLite (sync())
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
**IPC:** `settings:*`, `regfox:getAttendees|connect|updateRegistrations`, `print:*`, `meals:*`, `scannerServer:*`, `cloud:*`, `update:getStatus|checkForUpdates|downloadUpdate|restartAndInstallUpdate`  
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
3. **Local Event Store + Event identity (Sprint 21.2–21.3)** — attendees persist under FoxBridge `events.id` when known; `regfoxEventId` remains for RegFox APIs until a later cutover.
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

**Sprint 22.5 (Linked UX polish):** Join-code entry accepts dashed/undashed variants; Connected Desktops shows a live countdown; Linked rejoin reuses installation identity after revoke (fresh join code + new token still required). Migrations **014–015** fix live redeem (audit + ambiguous `conference_id`).

**Sprint 22.4 (security closeout):** Principal claim requires independent RegFox ownership proof; Linked history cannot elevate; Sync UX is Join vs Set up my event; operator enrollment Advanced-only.

**Sprint 22 FINAL:** Live-validated on multi-Mac universal builds. Do not start Sprint 23 until explicitly scoped.

Also still backlog:

1. Tighten anon RLS (conference-scoped SELECT policies).
2. Mobile offline cache + validation outbox.
3. Optional Desktop→Cloud meal upload when desktop meals are used.
4. Multi-event UI switching.
5. (Done in Sprint 24.4A) Wire `FOXBRIDGE_CLOUD_*` into GitHub Actions Mac and Windows packaging.

---

## Sprint 22.3 — Linked Desktop join codes & Connected Desktops

| Item | Detail |
|------|--------|
| **Schema** | Migration `012_linked_desk_join_codes.sql` — `desk_join_codes`, issue/redeem/revoke RPCs, audit actions |
| **Edge** | `desktop-issue-join-code`, `desktop-redeem-join`, `desktop-list-desks`, `desktop-revoke-desk` |
| **TTL** | Join code ~15 min (5–30); Linked credential 48 h |
| **UI** | Join existing event (Sync panel); Principal Connected Desktops (generate/revoke) |
| **Auth** | `assertPrincipalRole` on issue/list/revoke; Linked/legacy get 403 |
| **Test** | `npm run test:linked-desk-join` |

---

## Sprint 22.2 — Principal Desktop self-service Setup UX

Organizer UX only (no Linked join codes / Connected Desktops management).

| Item | Detail |
|------|--------|
| **Wizard** | After RegFox: “Set up FoxBridge Sync” → main-process Principal claim; Connected + Next when already Principal/legacy |
| **Transfer** | If another Principal exists → explicit confirmation before `confirmTransfer: true` |
| **Fallback** | “I have an enrollment code” + Advanced Settings still use Sprint 21 operator enroll |
| **Setup later** | Optional; local registration/badges/meals remain usable |
| **Operations Home** | Connected — Principal / Connected — legacy / not connected / reconnect |
| **Secrets** | RegFox API key stays in main/`safeStorage`; never in renderer claim payload |
| **Test** | `npm run test:principal-setup-ux` (+ existing sync-status / principal-claim) |

---

## Sprint 22.1 — Principal Desktop provisioning backend

Backend/trust infrastructure only. No Wizard redesign, Linked join codes, or Connected Desktops UI.

| Item | Detail |
|------|--------|
| **Schema** | `011_principal_desk_provisioning.sql` — external identity uniqueness, `desk_devices.role`, one-active-Principal index, audit table, `provision_principal_desk_device` |
| **Legacy policy** | Existing + operator-enrolled desks → `role=legacy` (standard desk ops preserved) |
| **Edge** | `desktop-claim-principal` — ephemeral RegFox `GET /forms/{id}` verify; find-or-create Event; Principal mint/transfer |
| **Desktop** | `claimFoxBridgeCloudPrincipal` IPC — uses main-process RegFox secrets only |
| **Fallback** | Sprint 21 `desktop-enroll` unchanged product-wise (`legacy` role) |
| **Test** | `npm run test:principal-claim` |

---

## Sprint 22.0 — Self-service provisioning & device trust (architecture only)

Design for organizer self-service Event claim and Principal/Linked Desktop trust. **No schema, Edge Functions, or Setup Wizard changes in 22.0.**

| Item | Detail |
|------|--------|
| **Doc** | [`DEVICE_TRUST_ARCHITECTURE.md`](./DEVICE_TRUST_ARCHITECTURE.md) |
| **Principal** | Cloud verifies RegFox `GET /forms/{id}` ephemerally; mints Principal desk credential |
| **Linked** | Principal issues 10–15 min single-use join code → 48 h Linked desk credential |
| **Scanner** | Unchanged Sprint 21 pairing plane |
| **Reuse** | Extend `desk_devices` / enrollment patterns; do not replace Sync |
| **Next** | Sprint 22.1 implementation slice |

---

## Sprint 21.10 — Live clean-install Sync validation

Production-style validation against Cloud project `upsjnvlllkeucjarbnnx` / conference `d00f67ca-2d5b-4e3e-b7bb-659bc0031363` (RegFox `1012457`). Packaged Desktop: `release/mac-arm64/FoxBridge.app` with public Cloud config only.

| Gate | Result |
|------|--------|
| Migrations 001–010 (incl. 010) | PASS |
| Edge Functions `desktop-*` (6) | PASS deployed |
| Scanner PWA `https://fox-bridge.vercel.app` | PASS (live `VITE_SUPABASE_*` matched project) |
| Packaged Desktop public config / no service-role | PASS |
| **A** Clean install | PASS |
| **B** Connect RegFox | PASS |
| **C** Load/select event | PASS |
| **D** Reach FoxBridge Sync | PASS |
| **E** Enrollment code | PASS |
| **F** Sync Connected | PASS |
| **G** Publish attendees | PASS |
| **H–K** Connect phone / QR / Camera / Ready to Scan | PASS |
| **L** Validate test meal on phone | PASS |
| **M** Cloud `meal_validations` row | PASS |
| **N** Desktop Sync → SQLite | PASS |
| **O** Restart — event, Sync Connected, Meal Dashboard still show validation | PASS |

**Sprint 21 Sync feature/enablement track: CLOSED.**

Runbook: [`FOXBRIDGE_SYNC_DEPLOYMENT.md`](./FOXBRIDGE_SYNC_DEPLOYMENT.md).

---

## Sprint 21.9 — End-to-end Sync deployment & validation

Primarily validation, deployment readiness, and documentation. Architecture unchanged except migration **010** (hosted-safe enrollment code issuance).

| Item | Detail |
|------|--------|
| **Runbook** | [`FOXBRIDGE_SYNC_DEPLOYMENT.md`](./FOXBRIDGE_SYNC_DEPLOYMENT.md) |
| **Fix** | `010_fix_issue_desk_enrollment_digest.sql` — `issue_desk_enrollment_code` uses `search_path = public, extensions` |
| **Requires deploy** | Migrations 001–**010**; all six `desktop-*` Edge Functions; conference bootstrap + enrollment code |
| **Desktop package vars** | `FOXBRIDGE_CLOUD_URL`, `FOXBRIDGE_CLOUD_PUBLISHABLE_KEY` (or `ANON_KEY`), `FOXBRIDGE_SCANNER_URL` |
| **Mobile package vars** | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| **No local service-role** | Production Desktop + Mobile operate with public config + desk enrollment |
| **Automated** | `npm run test:sync-deployment-readiness` |
| **Live validation** | Completed in Sprint 21.10 (clean-install A–O PASS) |

---

## Sprint 21.8 — Organizer FoxBridge Sync enrollment UX

First-time enrollment in Setup Wizard; ongoing status and recovery on Operations Home. Shared enrollment/status logic — not two separate workflows.

| Item | Detail |
|------|--------|
| **Wizard** | Always shows FoxBridge Sync after RegFox; ✓ Connected + Next when desk credential is valid; otherwise code entry + Set up later |
| **Operations Home** | Compact Sync status row + FoxBridge Sync action; opens shared connect/reconnect panel |
| **Shared UI** | `FoxBridgeSyncEnrollment` + `foxbridgeSyncStatus` helpers (phase classification, organizer-safe errors) |
| **Status fields** | `CloudStatus.connectionError` / `deskCredentialConfigured`; `SetupStatus.foxbridgeSync*` |
| **Copy** | “FoxBridge Sync” / enrollment code only — no Supabase, URLs, keys, or desk-token jargon |
| **Advanced** | Fallback enroll still available; primary path is Wizard + Operations Home |
| **Unchanged** | Phone pairing, registration, badge, meal, Quick Info |
| **Test** | `npm run test:foxbridge-sync-status` |

---

## Sprint 21.7 — Simplified phone pairing

One-scan pairing for desk-enrolled Desktops. QR is an HTTPS FoxBridge Scanner URL with a short-lived token only.

| Item | Detail |
|------|--------|
| **QR payload** | `https://<scanner-origin>/pair?token=<raw>` — no Cloud URL/keys, conference id, or desk secrets |
| **Desktop states** | generating → waiting → connected; expired auto-renews; failed with plain-language errors |
| **Publish** | Best-effort; soft warning if phones may be behind; hard-fail only when no attendees |
| **Mobile** | Existing `/pair` + `exchange_scanner_pairing_token` → Ready to Scan (packaged VITE Cloud config) |
| **Reuse** | `desktop-create-pairing`, `desktop-pairing-status`, Sprint 21.6 desk boundary |
| **Test** | `npm run test:pairing` |

---

## Sprint 21.6 — Trusted Cloud operations boundary

Backend/infrastructure. No registration/badge/meal-validation behavior redesign; pairing flow unchanged product-wise.

| Item | Detail |
|------|--------|
| **Credential** | One-time enrollment code → revocable desk device token bound to one conference |
| **Server** | Supabase Edge Functions (`desktop-enroll`, `desktop-publish`, `desktop-resolve-conference`, `desktop-create-pairing`, `desktop-pairing-status`, `desktop-ensure-scanner-session`) |
| **Schema** | `desk_devices`, `desk_enrollment_codes` + `issue_desk_enrollment_code()` (`009`; hosted fix `010`) |
| **Desktop** | `desktopCloudApi.ts`; transport prefers desk credential over legacy service-role |
| **Production** | No local service-role required when public Cloud config + enrollment succeed |
| **Legacy** | Advanced privileged key still works for dev/migration |
| **Test** | `npm run test:desk-credential` |

---

## Sprint 21.5 — Seamless Cloud configuration foundation

Infrastructure / configuration layer. No registration, meal-validation, or pairing redesign.

| Item | Detail |
|------|--------|
| **Product config** | `cloudConfig.ts` — FoxBridge Cloud public + privileged resolution |
| **Shared model** | `src/shared/models/CloudConfig.ts` |
| **Packaged public defaults** | GitHub Actions repository Variables `FOXBRIDGE_CLOUD_URL` + `FOXBRIDGE_CLOUD_PUBLISHABLE_KEY` + `FOXBRIDGE_SCANNER_URL` (Sprint 24.4A fail-closed CI). Repo source stays empty. Signed 0.1.2 / v0.1.3 omitted these Variables. |
| **Never packaged** | Service-role / privileged desktop key |
| **Migration** | Existing Settings/secrets and local `.env` still win / remain supported |
| **Advanced UI** | Labeled as development / migration override |
| **IPC** | `cloud:getConfigInfo` → `getFoxBridgeCloudConfigInfo` |
| **Test** | `npm run test:cloud-config` |

---

## Sprint 21.4 — Sync scheduling & lifecycle

Infrastructure only. No UI, phone, pairing, Cloud onboarding, or registration-workflow changes.

| Item | Detail |
|------|--------|
| **Manager** | `electron/sync/syncManager.ts` |
| **Interval** | `DESKTOP_SYNC_INTERVAL_MS` = 5 minutes |
| **Start** | `main.ts` after boot identity hydrate — non-blocking |
| **Stop** | `will-quit` before DB close |
| **Entry** | Still `sync()` / `syncBestEffort()` for entity work |
| **Preconditions** | `activeEventId` + Cloud configured |
| **Overlap** | Single in-progress run; extra ticks/hooks skip |
| **Hooks** | Publish + connection-test call `requestDesktopSyncBestEffort` (void) |
| **Test** | `npm run test:sync-manager` |

---

## Sprint 21.3 — Event identity foundation

Infrastructure only. No UI, phone, pairing, or registration-workflow UX changes.

| Item | Detail |
|------|--------|
| **Model** | `src/shared/models/Event.ts` — platform-independent FoxBridge Event |
| **Table** | SQLite `events` (`UNIQUE(registration_platform, platform_event_id)`) |
| **Settings** | `activeEventId` + keep `regfoxEventId` for RegFox integration |
| **Service** | `electron/settings/eventIdentityService.ts` — `activateRegFoxEvent` / boot ensure |
| **Associations** | Local Event Store, Event Settings (dual-key), sync cursors scoped by FoxBridge Event when known |
| **Policy** | New code prefers FoxBridge Event id; RegFox-specific paths may still use `regfoxEventId` |
| **Test** | `npm run test:event-identity` |

---

## Sprint 21.2 — Local Event Store foundation

SQLite `event_attendees` is the canonical Desktop working dataset for registrations after import. No UI / phone / pairing / meal-validation semantic changes.

| Item | Detail |
|------|--------|
| **Table** | `event_attendees` (`id`, `event_id`, `registration_id`, `source_platform`, `payload`, `synced_at`, `updated_at`) |
| **Write** | RegFox connect / load / update → `replaceAttendeeCacheFromRegistrationSync` |
| **Boot** | Hydrate in-memory cache from Local Event Store |
| **Read** | `regfox:getAttendees` returns local when non-empty; otherwise downloads via RegFox |
| **Refresh** | Operations “Refresh registrations” still calls `updateRegistrations` → RegFox → replace store |
| **Config** | Event Settings remain in `event-settings.json` |
| **Test** | `npm run test:local-event-store` |

---

## Sprint 21.1 — Desktop Sync foundation

Infrastructure only. No UI, phone, pairing, or registration-import changes.

| Item | Detail |
|------|--------|
| **Service** | `electron/sync/syncService.ts` — `sync()` / `syncBestEffort()` |
| **Entity** | Meal validations pull Cloud → SQLite |
| **Triggers** | Sync Manager (initial + every 5 min); also after successful `publishAttendees` / `testMobileService` via manager |
| **Cursor** | `userData/desktop-sync-cursors.json` |
| **Policy** | First write wins; preserve Cloud `validated_at` |
| **Test** | `npm run test:desktop-sync` |
| **Design** | [`SYNC_ARCHITECTURE.md`](./SYNC_ARCHITECTURE.md) §13 |

---

## Sprint 21.0 — FoxBridge Sync Architecture (design only)

Documentation sprint. No application behavior changes.

| Item | Detail |
|------|--------|
| **Canonical design** | [`SYNC_ARCHITECTURE.md`](./SYNC_ARCHITECTURE.md) |
| **Supabase doc** | Reframed as **current Cloud implementation**, not the Sync architecture |
| **Principles** | Offline-first Desktop; Cloud for pairing/coordination; RegFox authoritative for registrations; phones only talk to Cloud; scoped write-back allowed |
| **Next build sprint** | 21.1 — durable local attendees + meal validation pull |

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
| **Shape** | `{ version: 1, events: { [foxbridgeEventId \| legacyRegFoxPageId]: EventSettingsEntry } }` |
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

## Sprint 24.2 — electron-updater main-process infrastructure

**Status:** Implemented in repo. Settings UI added in Sprint 24.3. **No production update release yet.**

| Item | Detail |
|------|--------|
| **Dependency** | `electron-updater` ^6.8.9 (uses packaged `app-update.yml` from electron-builder GitHub provider) |
| **UpdateManager** | Main-process only (`electron/update/updateManager.ts`); renderer never imports electron-updater |
| **Policy** | `autoDownload = false`, `autoInstallOnAppQuit = false` — download/install only on explicit user action |
| **Packaged only** | Real checks run when `app.isPackaged`; `npm run dev` exposes `updaterEnabled: false` and performs no network calls |
| **Startup check** | Quiet check ~45s after app ready (does not block startup) |
| **Periodic check** | Every ~5 hours while app remains open |
| **IPC** | `update:getStatus`, `update:checkForUpdates`, `update:downloadUpdate`, `update:restartAndInstallUpdate` — no feed URL or token parameters |
| **Push events** | `update:statusChanged` broadcast via preload `onUpdateStatusChanged` (listener cleanup supported) |
| **Safe status** | `state`, `updaterEnabled`, `currentVersion`, `availableVersion`, `downloadPercent`, `errorSafeMessage`, `lastCheckedAt` |
| **userData** | Binary replacement only — `~/Library/Application Support/foxbridge` paths unchanged |
| **Principal/Linked** | Identical application-level behavior; no EventAccessSession coupling |
| **Tests** | `npm run test:update-manager` |

---

## Sprint 24.3 — Settings Software Update UI

**Status:** Implemented in repo. **Live auto-update validation still pending (Sprint 24.4).**

| Item | Detail |
|------|--------|
| **Settings badge** | Green dot on Operations Home ⚙ when `state` is `available` or `downloaded` (not shown for `error`) |
| **Software Update section** | `SettingsModal` → `SoftwareUpdateSection` with manual check/download/restart |
| **Subscription** | `useUpdateStatus` hook in `AttendeeSearchScreen` — single app-level subscription for badge + Settings |
| **Restart confirm** | Inline alertdialog before `restartAndInstallUpdate()`; never auto-restart |
| **Dev mode** | Quiet message when `updaterEnabled: false` — no confusing updater errors |
| **i18n** | `settings.update.*` keys in English + Mexican Spanish |
| **Tests** | `npm run test:software-update-ui` |

**Pending:** Live two-Mac auto-update validation after a Cloud-complete version newer than 0.1.3. Do not modify v0.1.3.

---

## Sprint 24.4A — Packaged public Cloud configuration

**Status:** Implemented in repo. **No new version / tag / Release.** Live auto-update validation is **not** passed.

| Item | Detail |
|------|--------|
| **Variables** | GitHub Actions repository Variables `FOXBRIDGE_CLOUD_URL`, `FOXBRIDGE_CLOUD_PUBLISHABLE_KEY`, `FOXBRIDGE_SCANNER_URL` |
| **Build inject** | `release-mac.yml` and `build-windows.yml` pass `vars.*` into `npm run build` (Windows also into `dist:win` rebuild) |
| **Pre-build** | `npm run validate:packaged-cloud-env` — HTTPS, no placeholders, reject `sb_secret_` / service-role; does not print the key |
| **Post-build** | `npm run verify:packaged-cloud-bundle` — compiled `dist-electron` must contain the three values before signing/packaging |
| **Never packaged** | `SUPABASE_SERVICE_ROLE_KEY`, Apple credentials, `GITHUB_TOKEN`, RegFox API keys |
| **0.1.2 / 0.1.3** | Signed CI 0.1.2 and published v0.1.3 omitted these Variables. **v0.1.3 remains untouched.** |
| **Tests** | `npm run test:packaged-cloud-config` plus extended `test:mac-release-config` / `test:sync-deployment-readiness` |

**Next:** Create the three repository Variables, then `workflow_dispatch` smoke (no tag). After that smoke is good, bump to a **new version** for the corrected production/updater sequence.

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

Read docs/PROJECT_STATE.md, docs/EVENT_SESSION_ARCHITECTURE.md, docs/CHECK_IN_ARCHITECTURE.md, docs/SYNC_ARCHITECTURE.md, docs/FOXBRIDGE_SYNC_DEPLOYMENT.md, docs/DEVICE_TRUST_ARCHITECTURE.md, docs/MOBILE_PRODUCT.md, docs/SUPABASE_ARCHITECTURE.md, and docs/PRODUCT_DECISIONS.md in the repo.

Current state:
- Desktop: EventAccessSession lock/unlock; Principal + Linked operational parity; Cloud-first multi-desk check-in; Principal RegFox upstream reconciliation
- Mobile PWA: sign-in, QR scan, online meal validation via Supabase validate_meal RPC
- Sprint 22 + Sprint 23 CLOSED / live-validated
- Branch main is on GitHub

Do not expose .env secrets. Do not hardcode printer names.

Next task: After GitHub Actions Cloud Variables exist, run a signed `workflow_dispatch` smoke. Do not bump/tag until that smoke is confirmed. Do not modify v0.1.3. Live auto-update validation is not passed.

Help me implement the next step with minimal scope, matching existing code conventions.
```
