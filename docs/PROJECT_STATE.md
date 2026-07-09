# FoxBridge — Project State

Last updated: July 2026 (Sprint 8)  
Repo: `https://github.com/Stevenco9/FoxBridge` (branch `main`)

Use this file to onboard a new ChatGPT conversation quickly. Do **not** commit secrets from `.env`.

---

## Current status

FoxBridge is a **desktop Electron app** (React + TypeScript + Vite) for RegFox event check-in. Core MVP flows are working in development:

- Live RegFox attendee download
- Attendee search + badge preview
- Electron badge printing with system print dialog
- Real QR codes on badges
- Meal validation with **persistent SQLite storage**

**Not yet built:** local attendee cache, QR scanner UI, silent/production Brother printing, mobile, multi-event support.

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
| Group registration names | Attendee name from `fieldData` (`name.first` / `name.last`), not purchaser billing name |

---

## Current Git commits / milestones

Recent milestones include meal validation persistence (Sprint 8), documentation (`PROJECT_STATE`, `PRODUCT_DECISIONS`, `CONFERENCE_CHECKLIST`), and the meal/QR/print feature set. Run `git log --oneline -10` for the latest SHAs.

---

## Architecture summary

```
FoxBridge/
├── electron/           # Main process, IPC, printing, database
│   ├── main.ts
│   ├── preload.ts
│   ├── regfoxHandlers.ts
│   ├── mealValidationHandlers.ts
│   ├── db/
│   │   ├── database.ts                 # SQLite init (foxbridge.db)
│   │   └── mealValidationRepository.ts
│   └── printing/       # Badge print + preferred printer store
├── src/
│   ├── features/
│   │   ├── attendees/  # Search screen (main UI shell)
│   │   ├── badge/      # Preview, fields, QR value helper
│   │   └── meals/      # Validation panel, plan config, helpers
│   ├── integrations/regfox/  # API service, mapping, meal classification
│   └── shared/models/        # Attendee, MealValidation types
├── scripts/
│   ├── test-regfox.ts        # CLI inspection of attendees + meals
│   └── test-printer.sh       # Separate macOS `lp` diagnostic (not used by app)
└── docs/                     # PRODUCT, ARCHITECTURE, PROJECT_STATE, etc.
```

**Stack:** Electron 36, React 19, Vite 6, TypeScript, **better-sqlite3**  
**RegFox API:** `https://api.webconnex.com/v2/public` with `apiKey` header  
**IPC:** `regfox:getAttendees`, `print:badgePreview`, `meals:getValidationsForAttendee`, `meals:validateMeal`  
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
9. **No `"type": "module"`** in root `package.json` — main process builds as CJS.
10. **Platform-independent printing layer** — macOS CUPS capture for remembered printer; Windows stub ready for extension.

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
| Validation | Per `attendee_id + meal_key`; duplicate blocked with **Already validated** |
| Persistence | **SQLite** — `meal_validations` table in `userData/foxbridge.db` |
| Full/half plan-only flow | Plans expand to individual meal buttons; no single "validate whole plan" button |
| Mobile | **Not built** |

### SQLite table: `meal_validations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `attendee_id` | TEXT NOT NULL | Stable attendee id |
| `meal_key` | TEXT NOT NULL | e.g. `mealPan.thursdayDinner` |
| `meal_label` | TEXT NOT NULL | Display name at validation time |
| `validated_at` | TEXT NOT NULL | ISO 8601 |
| `validated_by` | TEXT nullable | Volunteer id (unused in UI for now) |
| `source` | TEXT NOT NULL | Default `'desktop'` |
| UNIQUE | `(attendee_id, meal_key)` | Prevents duplicate meal use |

---

## Known issues

1. **`docs/PRODUCT.md` is partially stale** — lists QR scanning and meal tracking as out of scope, but QR generation and meal validation exist.
2. **Dual meal schemas** — legacy `meals.session*` and new `mealPan.*` coexist in the same event dataset.
3. **RegFox typo** — `mealPan.sabbathLuch` (not "Lunch") matches live form field key.
4. **No local attendee cache** — attendees re-fetched from RegFox on each app launch.
5. **`gh` CLI not logged in** on dev machine — `git push` works via git credentials; `gh` commands need `gh auth login`.
6. **`test:printer` (`lp`)** — unreliable for Brother QL labels; Electron print is the intended path.

---

## How to test meal validation persistence (Sprint 8)

1. Run `npm run dev`.
2. Select or look up an attendee with validatable meals (e.g. à la carte or full/half plan).
3. Click **Validate meal** for one meal — button should change to **Already validated**.
4. Quit and restart the app (`npm run dev` again).
5. Look up the same attendee — the meal should still show **Already validated**.
6. Try validating the same meal again — no duplicate row is created.

**Inspect the database (optional):**

```bash
sqlite3 ~/Library/Application\ Support/foxbridge/foxbridge.db \
  "SELECT attendee_id, meal_key, meal_label, validated_at FROM meal_validations;"
```

(Path may vary slightly by OS; database lives in Electron `userData`.)

---

## Immediate next task

**Add a local attendee cache synced from RegFox.**

Suggested scope:
1. SQLite `attendees` table (or JSON snapshot) populated on app start / refresh.
2. Reduce RegFox API calls during search and meal validation.
3. Optional: badge print history table (operational data in FoxBridge, not RegFox).

Alternative follow-ups: silent Brother printing, QR camera scanner input, update `PRODUCT.md` to match current scope.

---

## Short prompt to paste into a new ChatGPT chat

```
I'm continuing work on FoxBridge, a desktop Electron + React + TypeScript app for RegFox event check-in and Brother label badge printing.

Read docs/PROJECT_STATE.md, docs/ARCHITECTURE.md, and docs/PRODUCT_DECISIONS.md in the repo.

Current state:
- RegFox attendee download and search work
- Badge preview + Electron print (system dialog) work
- QR codes on badges encode stable attendee ids
- Meal validation persists in SQLite (meal_validations table)
- Branch main is on GitHub

Do not expose .env secrets. Do not hardcode printer names.

Next task: local attendee cache synced from RegFox.

Help me implement the next step with minimal scope, matching existing code conventions.
```
