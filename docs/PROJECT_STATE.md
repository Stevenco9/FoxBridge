# FoxBridge — Project State

Last updated: July 2026 (Sprint 8+)  
Repo: `https://github.com/Stevenco9/FoxBridge` (branch `main`)

Use this file to onboard a new ChatGPT conversation quickly. Do **not** commit secrets from `.env`.

**Planning:** [`SUPABASE_ARCHITECTURE.md`](./SUPABASE_ARCHITECTURE.md) — future mobile scanner cloud design (not implemented).  
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
- **Supabase mobile scanner architecture** documented (design only — see `docs/SUPABASE_ARCHITECTURE.md`)

**Not yet built:** durable local attendee cache, Supabase integration code, mobile scanner UI, mobile meal validation API, silent/production Brother printing, multi-event support.

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
| **Supabase architecture (planning)** | `docs/SUPABASE_ARCHITECTURE.md` — tables, data flow, offline strategy, security; no code yet |
| Group registration names | Attendee name from `fieldData` (`name.first` / `name.last`), not purchaser billing name |

---

## Current Git commits / milestones

Recent milestones include Supabase architecture planning, scanner server foundation, meal validation persistence (Sprint 8), documentation, and the meal/QR/print feature set. Run `git log --oneline -10` for the latest SHAs.

---

## Architecture summary

```
FoxBridge/
├── electron/           # Main process, IPC, printing, database, scanner server
│   ├── main.ts
│   ├── preload.ts
│   ├── regfoxHandlers.ts
│   ├── mealValidationHandlers.ts
│   ├── scannerServerHandlers.ts
│   ├── scannerServer/
│   │   ├── scannerServer.ts          # Node http server + routes
│   │   ├── attendeeCache.ts          # In-memory cache from RegFox sync
│   │   ├── buildAttendeeResponse.ts   # Reuses meal classification helpers
│   │   └── config.ts                 # Port, auto-start flag
│   ├── db/
│   │   ├── database.ts                 # SQLite init (foxbridge.db)
│   │   └── mealValidationRepository.ts
│   └── printing/       # Badge print + preferred printer store
├── src/
│   ├── features/
│   │   ├── attendees/  # Search screen (main UI shell)
│   │   ├── badge/      # Preview, fields, QR value helper
│   │   ├── meals/      # Validation panel, plan config, helpers
│   │   └── scanner/    # Desktop start/stop controls (not mobile UI)
│   ├── integrations/regfox/  # API service, mapping, meal classification
│   └── shared/models/        # Attendee, MealValidation, ScannerServer types
├── scripts/
│   ├── test-regfox.ts        # CLI inspection of attendees + meals
│   └── test-printer.sh       # Separate macOS `lp` diagnostic (not used by app)
└── docs/                     # VISION, PRODUCT, ARCHITECTURE, PROJECT_STATE, SUPABASE_ARCHITECTURE, etc.
```

**Stack:** Electron 36, React 19, Vite 6, TypeScript, **better-sqlite3**  
**RegFox API:** `https://api.webconnex.com/v2/public` with `apiKey` header (main process only — never exposed via scanner server)  
**IPC:** `regfox:getAttendees`, `print:badgePreview`, `meals:getValidationsForAttendee`, `meals:validateMeal`, `scannerServer:getStatus`, `scannerServer:start`, `scannerServer:stop`  
**Dev note:** Run with `env -u ELECTRON_RUN_AS_NODE` (Cursor sets this var and breaks Electron)

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
11. **No `"type": "module"`** in root `package.json` — main process builds as CJS.
12. **Platform-independent printing layer** — macOS CUPS capture for remembered printer; Windows stub ready for extension.

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
| Mobile browser scanner | **Not built** — scanner server is the backend foundation |
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

**Implement local attendee cache on desktop** (SQLite), then begin Supabase integration per [`SUPABASE_ARCHITECTURE.md`](./SUPABASE_ARCHITECTURE.md).

Suggested order:
1. SQLite attendee cache synced from RegFox on app start (desktop still primary).
2. Supabase project + table migrations (`conferences`, `attendees`, `meal_entitlements`, `meal_validations`, `scanner_sessions`).
3. Desktop “Publish to cloud” using sanitized attendee/entitlement upload (service role key in main process only).
4. RLS + scanner codes before any public mobile URL.
5. Mobile web PWA (online-first): scan QR → read Supabase → validate meal.
6. Optional: desktop pull of mobile validations into SQLite; mobile offline queue.

Interim option: LAN pairing on local scanner server if cloud is not ready for AdAgrA.

---

## Short prompt to paste into a new ChatGPT chat

```
I'm continuing work on FoxBridge, a desktop Electron + React + TypeScript app for RegFox event check-in and Brother label badge printing.

Read docs/PROJECT_STATE.md, docs/SUPABASE_ARCHITECTURE.md, docs/ARCHITECTURE.md, and docs/PRODUCT_DECISIONS.md in the repo.

Current state:
- RegFox attendee download and search work
- Badge preview + Electron print (system dialog) work
- QR codes on badges encode stable attendee ids
- Meal validation persists in SQLite (meal_validations table)
- Local scanner HTTP server foundation on localhost (health + attendee lookup)
- Supabase mobile architecture is planned in docs/SUPABASE_ARCHITECTURE.md (not implemented)
- Branch main is on GitHub

Do not expose .env secrets. Do not hardcode printer names.

Next task: local attendee cache and/or first Supabase integration step.

Help me implement the next step with minimal scope, matching existing code conventions.
```
