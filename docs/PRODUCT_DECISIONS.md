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

**RegFox is the source of truth for attendee data.**  
Registration answers, purchases, custom fields, and official payment status come from RegFox. FoxBridge reads and presents that data; it does not invent attendee records.

**FoxBridge owns operational data.**  
Meal redemption, badge printing history, check-in actions, and other on-site activity live in FoxBridge. That separation keeps registration data authoritative in RegFox while giving staff a clear record of what happened at the event.

**Payment display is read-only (Sprint 16A).**  
FoxBridge shows normalized RegFox payment status and amounts for door staff. It does not currently update RegFox payment records. On-site payment recording, if added later, will be an explicit FoxBridge operational record—not a silent rewrite of RegFox finances. The payment model supports partial balances for future events even when the current event is primarily paid versus unpaid.

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
- **Pairing tokens are short-lived and single-use** — desktop creates token via service role; mobile exchanges via `exchange_scanner_pairing_token`; hash stored in `scanner_pairing_tokens`.
- **HTTPS scanner web address required for production QR** — packaged default or Settings → Advanced override (“Scanner web address”).
- **Desktop meal validation hidden by default** — mobile is the primary meal-line tool; desktop column available via Advanced toggle.

### Sprint 13A — Guided setup decisions

- **In-app settings over `.env` for organizers** — RegFox and phone scanning service credentials are saved in Electron `userData` with encrypted secrets. `.env` remains a developer fallback.
- **Wizard vs operations home** — First-time and reset flows use a step-by-step wizard. Day-of operations use a simplified home screen focused on conference status and Connect a phone.
- **Advanced holds legacy tools** — Cloud status, manual publish, localhost scanner server, and desktop meal validation stay available but outside the default AdAgrA workflow.

When a decision feels ambiguous, return to the principles above: fewer clicks, hidden complexity, RegFox as source of truth, FoxBridge as owner of on-site operations, and defaults that work without a manual.
