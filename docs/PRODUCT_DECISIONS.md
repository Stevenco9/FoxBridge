# FoxBridge — Product Decisions

This document explains **why** FoxBridge was designed the way it was. It captures product intent and guiding principles, not implementation details.

---

## Vision

FoxBridge is a desktop companion for RegFox designed to make conference registration **fast, reliable, and volunteer-friendly**.

Event staff should be able to find an attendee, confirm their details, print a badge, and validate meals without exports, spreadsheets, or fragile workarounds. The product exists to reduce friction at the door—not to replace RegFox, but to make live operations smooth.

---

## Product Principles

**Registration volunteers should need as few clicks as possible.**  
Every extra step at check-in costs time and creates lines. Flows should be short, obvious, and repeatable.

**The UI should remember preferences automatically.**  
Printers, layout choices, and other operational preferences should persist without asking volunteers to reconfigure the app at every session.

**Badge printing should be one-click after initial setup.**  
The first print may require choosing a printer; after that, printing a badge should feel immediate.

**QR codes contain only stable attendee identifiers.**  
Badges encode a lookup key, not personal or sensitive data. Meal details, contact information, and credentials never belong in a QR payload.

**FoxBridge is an operational layer, not a registration platform.**  
FoxBridge synchronizes with registration systems; it does not replace them. Organizers keep registrations, payments, and form answers upstream. FoxBridge owns live-event operations (check-in, badges, meals, and related on-site history). See [`ARCHITECTURE.md`](./ARCHITECTURE.md).

**RegFox is the source of truth for attendee data.**  
Registration answers, purchases, custom fields, and official payment status come from RegFox. FoxBridge reads and presents that data; it does not invent attendee records.

**FoxBridge Event identity is platform-independent (Sprint 21.3).**  
A FoxBridge Event is distinct from a RegFox page id. Associations (Local Event Store, Event Settings, sync state) prefer the FoxBridge Event id. `regfoxEventId` remains for existing RegFox integration until a later migration — this is not a full source-of-truth cutover.

**Device trust hierarchy (Sprint 22 — live-validated).**
Principal Desktop proves registration-platform control of an event (RegFox: ephemeral server-side verify of API key against `GET /forms/{id}` — key not stored in Cloud). Linked Desktops join with Principal-issued codes (~15 min, single-use) and receive 48‑hour revocable credentials. Principal claim/transfer requires fresh independent RegFox ownership proof — Linked/revoked history, cached event IDs, and transfer confirmation alone never authorize Principal. Operator enrollment codes remain Advanced/support only (`legacy` desks). See [`DEVICE_TRUST_ARCHITECTURE.md`](./DEVICE_TRUST_ARCHITECTURE.md).

**Organizers should not need Cloud credentials for first Sync setup (Sprint 22.2).**  
After a successful RegFox connection, normal organizers choose **Join an existing FoxBridge Event** (connection code) or **Set up my event** (RegFox API key + event ID → Cloud ownership verify). They should not paste Supabase URLs, publishable keys, service-role keys, desk tokens, or operator enrollment codes unless using Advanced / support paths.

**Extra desks join with a Principal connection code (Sprint 22.3).**  
A second computer joins with a short code from the Principal Desktop — no RegFox API key and no Cloud console access required. Codes accept dashed or undashed entry. After revoke/expiry, the same FoxBridge installation rejoins as one logical Linked Desktop when it presents its opaque installation ID with a fresh code (Sprint 22.5).

**Linked Desktop = full operational workstation (Sprint 23.4a / 23.5).**  
Principal is the administrative owner (ownership, transfer, Connected Desktops) and registration-platform authority for upstream write-back. Linked Desktops reconstruct the approved operational Attendee model from a Principal-published Cloud snapshot and share the same FoxBridge Cloud check-in write path. Upstream reconciliation (e.g. RegFox) is Principal-only via a platform adapter — Linked never receives upstream API keys. Operational check-in is real-time authoritative; upstream sync is observable via lightweight Principal diagnostics. See [`CHECK_IN_ARCHITECTURE.md`](./CHECK_IN_ARCHITECTURE.md).

**Event data persists; event access does not survive quit (Sprint 23.2).**  
A new Electron process starts **locked** until the organizer unlocks via **Set up my event** (explicit RegFox API key + Event ID → Principal claim) or **Join an existing FoxBridge Event** (connection code). Sleep and same-process window close stay unlocked. Reopen Setup Wizard warns, then locks the process session without deleting local history. Same-install Principal relaunch reactivates the existing Principal desk after RegFox proof (no false transfer). Canonical design: [`EVENT_SESSION_ARCHITECTURE.md`](./EVENT_SESSION_ARCHITECTURE.md).

**FoxBridge owns operational data.**  
Meal redemption, badge printing history, check-in actions, and other on-site activity live in FoxBridge. That separation keeps registration data authoritative in RegFox while giving staff a clear record of what happened at the event.

**Payment display is read-only (Sprint 16A).**  
FoxBridge shows normalized RegFox payment status and amounts for door staff. It does not currently update RegFox payment records. On-site payment recording, if added later, will be an explicit FoxBridge operational record—not a silent rewrite of RegFox finances. The payment model supports partial balances for future events even when the current event is primarily paid versus unpaid.

**Quantity add-ons map as purchases (Sprint 17B).**  
RegFox checkbox options arrive as `true`; quantity add-ons (e.g. *Libro de "Consejos sobre Agricultura" de Ellen White*) arrive as numeric strings like `"1"`. Both become `Attendee.purchases` so door staff can see book and merchandise selections without reading raw field paths. Contact and address numbers are excluded. Hardcoded AdAgrA book UI was removed in Sprint 20.4 in favor of configurable Attendee Display (Event Settings).

**Attendee-detail field catalogs are comprehensive (Sprint 20.1).**  
When discovering fields organizers may later pin as highlights on the attendee details panel, FoxBridge includes the full meaningful `Attendee` surface: built-in properties, derived composites, payment snapshot fields, custom registration answers, and purchase/selection line items (tickets, meal plans, packages, books, merchandise, and other registration options). The catalog is not pre-filtered to a short “important” list—organizers choose what to display in a later configuration sprint.

**Event-specific preferences use a dedicated settings file (Sprint 20.2).**  
UI prefs that belong to one RegFox event (attendee display field keys today; badge layout / meal prefs later) persist in `{userData}/event-settings.json`, keyed by event id. They are not mixed into global `AppSettingsPublic` or SQLite operational tables. Selection stores stable field catalog keys, not labels.

**Good defaults are better than complicated configuration.**  
Most events should work out of the box. Advanced options can exist, but volunteers should rarely need them.

**Organizers configure once; volunteers operate all day.**  
Registration leads run the guided setup wizard (RegFox, printer). Volunteers pair phones by scanning one QR code from the home screen — they should never edit `.env`, enter scanner codes, pick conferences, or understand cloud infrastructure.

**One-scan phone pairing.**  
A volunteer pairs a phone by scanning one temporary QR code with the phone’s normal camera. No volunteer account, scanner code, conference selection, or technical setup is required.

**Automate steps FoxBridge can perform itself.**  
Connecting to RegFox should download attendees. Updating registrations should republish to mobile scanners. Setup should not expose separate “load” and “publish” actions to organizers.

---

## UX Principles

**One step at a time.**  
Show only what matters for the current task—search, preview, print, or validate—instead of overwhelming staff with every option at once.

**Hide complexity.**  
Integrations, sync behavior, and data mapping stay behind the scenes. Volunteers see names, badges, and clear actions—not API concepts or field paths.

**Never make volunteers think about technical details.**  
They should not need to know how RegFox stores a field, which printer driver is in use, or how meal plans expand internally. The app should just work.

**Optimize for speed during live registration.**  
Layouts, typography, and interaction patterns favor clarity under pressure: large type on badges, fast search, minimal confirmation dialogs, and quick recovery from mistakes.

---

## Technical Philosophy

**Keep integrations isolated.**  
RegFox, printers, and future platforms connect through dedicated integration layers. The rest of the app speaks in FoxBridge terms—attendees, badges, meals—not vendor-specific shapes.

**Never tie the application directly to RegFox data structures.**  
External responses are mapped into internal models at the boundary. When RegFox changes field names or form layouts, updates stay localized rather than spreading through the UI.

**Desktop and mobile share the same core logic.**  
The desktop app leads today, but business rules (search, meal validation, badge content, QR semantics) should be reusable so a future mobile companion does not duplicate logic.

**Prefer simple, maintainable solutions over clever ones.**  
Explicit configuration, readable flows, and small modules beat fragile automation. The goal is software volunteers can depend on for years of events, not novelty for its own sake.

---

## Future Vision

These capabilities are planned or anticipated beyond the current desktop MVP. They extend the same vision—fast, reliable, volunteer-friendly registration—without changing who owns which data.

**Meal validation**  
Staff scan or enter an attendee identifier and confirm which meals they are entitled to—whether bundled in a plan or selected à la carte. Validation is recorded in FoxBridge as operational history, separate from RegFox registration data.

**Mobile scanner**  
A phone or tablet companion for roaming check-in and meal lines. Same attendee lookup and validation rules as desktop, optimized for camera-based QR scanning and quick taps.

**Multi-event support**  
Switch between events without reconfiguring from scratch. Each event keeps its own badge defaults, meal rules, and operational history while sharing the same app shell.

**Localization**  
Interface and badge content adaptable to other languages and regional formats, so international conferences can use the same workflow with localized labels and date conventions.

**Offline capability**  
Continue basic search, badge reprint, and meal validation when connectivity is poor, syncing operational changes when the network returns. RegFox remains authoritative; local cache bridges gaps during live operations.

**Reports**  
Summaries for organizers: badges printed, meals validated, check-in counts, and exceptions. Operational insight from FoxBridge data without duplicating RegFox’s registration reporting.

---

## How this document relates to other docs

| Document | Purpose |
|----------|---------|
| `PRODUCT.md` | Requirements and MVP scope |
| `ARCHITECTURE.md` | System structure and layers |
| `PROJECT_STATE.md` | Current build status and next tasks |
| **This file** | Rationale and principles behind design choices |
| `MOBILE_PRODUCT.md` | Mobile volunteer scope, workflows, and anti-scope-creep guardrails |
| `CONFERENCE_CHECKLIST.md` | Organizer + volunteer operational checklist |

### Sprint 13B — One-scan phone pairing

- **Volunteer pairs by scanning one temporary QR code** with the phone’s normal Camera app. No volunteer account, scanner code, conference selection, or technical setup is required.
- **Organizer-facing UI is non-technical** — no `.env`, Supabase, RPC, anon key, service role, localhost, or scanner codes in Conference Mode. Technical configuration lives under Settings → Advanced only.
- **FoxBridge Cloud public defaults are packaging-time (Sprint 21.5)** — Cloud endpoint URL + publishable client key may be injected via `FOXBRIDGE_CLOUD_*` at build/CI. Privileged desktop keys are never shipped in installers.
- **Production desks enroll with a one-time event code (Sprint 21.6–21.9)** — Desktop exchanges the code for a revocable event-scoped desk credential; privileged Cloud writes run in FoxBridge Cloud Edge Functions. Legacy local service-role remains development/migration only. Organizers enroll from Setup Wizard (after RegFox) or Operations Home; Advanced remains a fallback. No Supabase/URLs/keys/desk-token jargon in those surfaces. Operator deploy/validation: [`FOXBRIDGE_SYNC_DEPLOYMENT.md`](./FOXBRIDGE_SYNC_DEPLOYMENT.md) (requires migrations through **010**).
- **Pairing tokens are short-lived and single-use** — desktop creates token via desk Edge Function (or legacy service role); mobile exchanges via `exchange_scanner_pairing_token`; hash stored in `scanner_pairing_tokens`. QR is HTTPS `/pair?token=…` only (Sprint 21.7).
- **HTTPS scanner web address required for production QR** — packaged default or Settings → Advanced override (“Scanner web address”).
- **Desktop meal validation hidden by default** — mobile is the primary meal-line tool; desktop column available via Advanced toggle.

### Sprint 24.1 — Signed Mac releases

- **Production Mac installers are signed and notarized** — Developer ID Application, Hardened Runtime, Apple notarytool. Local `npm run dist:mac` stays unsigned so ordinary development does not need Apple credentials.
- **One universal Mac channel** — GitHub Releases host `FoxBridge-<version>-mac-universal.dmg` (humans) plus ZIP + `latest-mac.yml` (future electron-updater). Never publish host-arch `pack:mac` artifacts to that channel.
- **Public GitHub Releases as the update provider** — metadata is readable without embedding a GitHub token in the Desktop app. Signing/notarization secrets stay in GitHub Actions (names: `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`).
- **Updates must not interrupt an event** — in-app download/install is a later sprint; when added, install remains operator-initiated. Replacing the `.app` does not move `~/Library/Application Support/foxbridge`.

### Sprint 13A — Guided setup decisions

- **In-app settings over `.env` for organizers** — RegFox and phone scanning service credentials are saved in Electron `userData` with encrypted secrets. `.env` remains a developer fallback.
- **Wizard vs operations home** — First-time and reset flows use a step-by-step wizard (including FoxBridge Sync). Day-of operations use a simplified home screen with Sync status/recovery plus Connect a phone.
- **Advanced holds legacy tools** — Cloud status, manual publish, localhost scanner server, and desktop meal validation stay available but outside the default AdAgrA workflow.

When a decision feels ambiguous, return to the principles above: fewer clicks, hidden complexity, FoxBridge as an operational layer that syncs with registration platforms (not a replacement), RegFox as source of truth for attendee data, FoxBridge as owner of on-site operations, and defaults that work without a manual.
