# FoxBridge — Project State

Last updated: July 2026  
Repo: `https://github.com/Stevenco9/FoxBridge` (branch `main`, synced with `origin/main`)

Use this file to onboard a new ChatGPT conversation quickly. Do **not** commit secrets from `.env`.

---

## Current status

FoxBridge is a **desktop Electron app** (React + TypeScript + Vite) for RegFox event check-in. Core MVP flows are working in development:

- Live RegFox attendee download
- Attendee search + badge preview
- Electron badge printing with system print dialog
- Real QR codes on badges
- Meal validation MVP (in-memory)

**Not yet built:** local database/cache, QR scanner UI, silent/production Brother printing, mobile, persisted meal validation, multi-event support.

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
| Group registration names | Attendee name from `fieldData` (`name.first` / `name.last`), not purchaser billing name |

---

## Current Git commits / milestones

```
bb49dc0 Add meal validation, QR badges, and printer memory
79e87ec Layout Posish
132b784 Add badge preview printing
9461791 Implement attendee search and badge preview
bb01e50 Add RegFox attendee download
6c0131c Add RegFox connection test
fcd5717 Initialize FoxBridge project foundation
```

---

## Architecture summary

```
FoxBridge/
├── electron/           # Main process, IPC, printing
│   ├── main.ts
│   ├── preload.ts
│   ├── regfoxHandlers.ts
│   └── printing/       # Badge print + preferred printer store
├── src/
│   ├── features/
│   │   ├── attendees/  # Search screen (main UI shell)
│   │   ├── badge/      # Preview, fields, QR value helper
│   │   └── meals/      # Validation panel, plan config, helpers
│   ├── integrations/regfox/  # API service, mapping, meal classification
│   └── shared/models/        # Attendee, purchases, custom fields
├── scripts/
│   ├── test-regfox.ts        # CLI inspection of attendees + meals
│   └── test-printer.sh       # Separate macOS `lp` diagnostic (not used by app)
└── docs/                     # PRODUCT, ARCHITECTURE, DATA_MODEL, this file
```

**Stack:** Electron 36, React 19, Vite 6, TypeScript  
**RegFox API:** `https://api.webconnex.com/v2/public` with `apiKey` header  
**IPC:** `regfox:getAttendees`, `print:badgePreview`  
**Dev note:** Run with `env -u ELECTRON_RUN_AS_NODE` (Cursor sets this var and breaks Electron)

---

## Important project decisions

1. **Electron printing only** for badges — not `lp`, shell scripts, or PDF generation in the app flow.
2. **System print dialog** for now (`silent: false`); no silent printing yet.
3. **Attendee names** come from registrant `fieldData`, not billing/purchaser, for group registrations.
4. **QR payload** is a stable id only — no email, phone, meals, or API keys.
5. **Meal purchase categories:** `mealPlan`, `individualMeal`, `mealChoice` (legacy `meals.*` mapped to `mealPlan`).
6. **Meal plan expansions** live in one config file (`mealPlanConfig.ts`), derived from RegFox form descriptions.
7. **Validation state** is in-memory only (`attendeeId:mealPurchaseId` keys).
8. **No `"type": "module"`** in root `package.json` — main process builds as CJS.
9. **Platform-independent printing layer** — macOS CUPS capture for remembered printer; Windows stub ready for extension.

---

## Current RegFox test event status

- Credentials: `REGFOX_API_KEY` + `REGFOX_EVENT_ID` in local `.env` (see `.env.example`).
- Event uses **AdAgrA-style meal fields** (`mealPan.*`) plus legacy registrations still on `meals.session1/2/3`.
- ~10 test registrants in the current event (mix of individual, corporate, and group registrations).
- **Meal field structure (current form):**
  - Plans: `mealPan.fullMealPlan`, `mealPan.halfMealPlan`, `mealPan.imBringingMyOwn`
  - À la carte: `mealPan.thursdayDinner`, `fridayBreakfast`, `fridayLunch`, `fridayDinner`, `sabbathBreakfast`, `sabbathLuch`, `sabbathDinner`
  - Choices: `mealChoices.*` (e.g. beef, chicken, vegetarian, bacon)
  - Dietary: custom fields `doYouHaveAn`, `pleaseDescribe`
- Run `npm run test:regfox` to inspect live attendee/meal data (emails/phones redacted in script output).

---

## Badge printing status

| Item | Status |
|------|--------|
| Preview | Working — black & white, 3.9" × 2.4" horizontal |
| Print trigger | **Print Badge** → IPC → `printBadgePreview()` |
| Print dialog | macOS system dialog (`silent: false`) |
| Print CSS | Hides search, controls, buttons; prints badge only |
| Preferred printer | Saved after successful print; pre-selected next time if available |
| Brother QL-820NWB | Target printer; IPP/USB and Bluetooth queues exist on dev Mac |
| Silent / auto-select | **Not implemented** |
| `test:printer` script | Separate `lp` diagnostic; not integrated into app |

---

## QR code status

| Item | Status |
|------|--------|
| Generation | `react-qr-code` on badge preview |
| Value | Stable attendee id via `getAttendeeQrValue()` (prefers `id` when stable, else `confirmationCode`, else `registrationId`) |
| Scanner | **Not built** — meal validation uses manual QR value paste |
| PII in QR | None by design |

---

## Meal validation status

| Item | Status |
|------|--------|
| UI | Middle panel: QR lookup + attendee list selection |
| Displays | Meal plans, validatable meals (with per-meal buttons), meal choice, dietary restriction |
| Plan expansion | `getValidatableMeals(attendee)` merges à la carte + plan-expanded meals; deduped |
| Validation | Per `attendeeId + mealPurchaseId`; duplicate blocked with "Already validated" |
| Persistence | **In-memory only** — lost on app restart |
| Full/half plan-only flow | Plans expand to individual meal buttons; no single "validate whole plan" button |
| Mobile | **Not built** |

---

## Known issues

1. **`docs/PRODUCT.md` is partially stale** — lists QR scanning and meal tracking as out of scope, but QR generation and meal validation MVP exist.
2. **Dual meal schemas** — legacy `meals.session*` and new `mealPan.*` coexist in the same event dataset.
3. **RegFox typo** — `mealPan.sabbathLuch` (not "Lunch") matches live form field key.
4. **No local cache** — attendees re-fetched from RegFox on each app launch.
5. **Meal validation not persisted** — no database or file store yet.
6. **`gh` CLI not logged in** on dev machine — `git push` works via git credentials; `gh` commands need `gh auth login`.
7. **`test:printer` (`lp`)** — unreliable for Brother QL labels; Electron print is the intended path.
8. **Cursor git UI** — can show a spinning sync indicator even after successful terminal commit/push; reload window if stuck.

---

## Immediate next task

**Persist meal validation state and add a local attendee cache.**

Suggested scope:
1. SQLite or JSON file store for attendees synced from RegFox.
2. Persist validated meals (`attendeeId`, `mealPurchaseId`, timestamp).
3. Refresh cache on app start with RegFox pull (or TTL-based sync).
4. Keep meal validation UI; wire it to stored state instead of in-memory `Set`.

Alternative follow-ups: silent Brother printing, QR scanner input, update `PRODUCT.md` to match current scope.

---

## Short prompt to paste into a new ChatGPT chat

```
I'm continuing work on FoxBridge, a desktop Electron + React + TypeScript app for RegFox event check-in and Brother label badge printing.

Read docs/PROJECT_STATE.md, docs/ARCHITECTURE.md, and docs/PRODUCT.md in the repo.

Current state:
- RegFox attendee download and search work
- Badge preview + Electron print (system dialog) work
- QR codes on badges encode stable attendee ids
- Meal validation MVP works in-memory with meal plan expansion (mealPan.* + legacy meals.*)
- Branch main is pushed to GitHub

Do not expose .env secrets. Do not hardcode printer names.

Next task: persist meal validation state and add local attendee cache.

Help me implement the next step with minimal scope, matching existing code conventions.
```
