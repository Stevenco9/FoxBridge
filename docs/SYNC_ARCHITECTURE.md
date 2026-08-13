# FoxBridge Sync Architecture

**Status:** Design (Sprint 21.0) — documentation only; not yet implemented as a named Sync platform  
**Last updated:** August 2026  
**Canonical for:** Synchronization roles, lifecycles, data policies, and reuse plan  

**Related docs (do not duplicate this design):**

| Doc | Role |
|-----|------|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Product/system principles (operational layer, source of truth) |
| [`SUPABASE_ARCHITECTURE.md`](./SUPABASE_ARCHITECTURE.md) | **Current** cloud implementation details (schema, RPCs, RLS notes) |
| [`MOBILE_PRODUCT.md`](./MOBILE_PRODUCT.md) | Volunteer mobile product scope |
| [`PRODUCT_DECISIONS.md`](./PRODUCT_DECISIONS.md) | Why product choices were made |
| [`PROJECT_STATE.md`](./PROJECT_STATE.md) | What is built today |

---

## 1. Purpose

FoxBridge is evolving from a desktop RegFox helper into an **event operations platform**.

It is **not** a replacement for registration platforms (RegFox today). It is an **operational layer that synchronizes with them** while providing event-day capabilities those platforms do not: badge printing, meal validation, phone scanners, dashboards, and on-site history.

**FoxBridge Sync** is the name for the synchronization platform that will:

- Replace manual Supabase/project wiring with seamless event coordination
- Preserve **offline-first desktop** behavior
- Route **phones through FoxBridge Cloud**, never through registration APIs
- Support carefully scoped **read and write-back** to registration platforms where product allows

This document defines architecture and sync **policies**. Implementation lands in later sprints.

---

## 2. Design principles

1. **Desktop remains fully usable offline.** Registration desk workflows must not depend on FoxBridge Cloud or phones.
2. **FoxBridge Cloud coordinates devices and sync.** Pairing, device sessions, shared operational state, and cross-device coordination live in Cloud.
3. **Registration platforms remain authoritative for registration data.** Attendees, purchases, form answers, and official payment status originate upstream.
4. **FoxBridge may READ from and WRITE back to supported registration platforms** when the write is an explicit operational action (for example check-in). Writes are never silent rewrites of registration finance or form content.
5. **Phones synchronize only with FoxBridge Cloud.** Mobile never holds RegFox API keys and never talks to registration platforms directly.
6. **Prefer sync policies over generic conflict UIs.** Each data type declares source, direction, and a simple deterministic policy organizers can trust.

---

## 3. Overall system architecture

```
                    ┌──────────────────────────────┐
                    │   Registration platform      │
                    │   (RegFox today)             │
                    │   Authoritative registrations│
                    └──────────────┬───────────────┘
                                   │
                    sync adapter   │  read (+ scoped write-back)
                    (desktop)      │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                     FoxBridge Desktop                             │
│  Offline-first operations hub                                     │
│  • Local durable store (SQLite + event settings)                  │
│  • RegFox sync agent                                              │
│  • Badges, check-in, local meals, Event Settings                  │
│  • Publishes / pulls via Sync client                              │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             │  Sync protocol (today: Supabase)
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                     FoxBridge Cloud                               │
│  Synchronization + pairing + sessions + event coordination         │
│  Current implementation: Supabase (Postgres + Auth + RPC)         │
│  See SUPABASE_ARCHITECTURE.md for schema/RPC details              │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             │  anon / session-scoped access
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Phones (mobile PWA)                           │
│  Meal-line / roaming scanners                                     │
│  Sync only with FoxBridge Cloud                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Today (as built):** Desktop holds attendees mostly **in memory**, publishes a sanitised subset to Supabase, and phones validate meals in Cloud. Desktop SQLite stores meals, check-ins, and badge print logs. Cloud meal validations are read live for dashboards but are **not** yet pulled into SQLite. Pairing already uses Cloud tokens/sessions.

**Target:** Desktop durable cache + bidirectional ops sync through Cloud; phones optionally offline with outbox; seamless Cloud onboarding instead of manual project keys.

---

## 4. Component responsibilities

### 4.1 Desktop

| Responsibility | Notes |
|----------------|-------|
| Offline operations hub | Search, badges, print, local meal validation, check-in UI |
| Registration sync agent | Only process that calls RegFox (or future platforms) |
| Durable local store | Target: attendees + ops history survive restart without Cloud |
| Sync client | Push registration snapshots & local ops; pull phone ops |
| Event Settings owner | Organizer config (`event-settings.json`) for the active event |
| Pairing initiator | Creates short-lived phone pairing materials via Cloud |
| Never block desk work on Cloud failure | Sync is best-effort; warn, don’t stop registration |

### 4.2 FoxBridge Cloud

| Responsibility | Notes |
|----------------|-------|
| Shared conference workspace | Multi-device view of the same event |
| Device pairing & sessions | One-scan pairing, scanner sessions, revocation |
| Sync hub for phones | Attendee lookup, entitlements, meal validation writes |
| Event coordination metadata | Last desktop sync time, session labels, etc. |
| Not a second registration system | Does not own registration forms or checkout |
| Current tech | Supabase — implementation detail, not the architecture name |

### 4.3 Phones

| Responsibility | Notes |
|----------------|-------|
| Volunteer meal / roaming workflows | QR scan, entitlement check, validate meal |
| Sync exclusively with FoxBridge Cloud | No RegFox credentials |
| Session from pairing | Short setup; no organizer cloud admin on phone |
| Offline later | Local queue → Cloud when reconnecting (not built) |
| Out of scope | Badge printing, publish, Event Settings editing, registration admin |

### 4.4 Registration platforms (RegFox today)

| Responsibility | Notes |
|----------------|-------|
| Authoritative registrations | People, purchases, custom fields, official payment status |
| Accept scoped operational writes | Today: check-in. Future: only when product + API support exist |
| No direct phone access | Phones never call the registration API |

---

## 5. Event lifecycle

```
Create / open event in FoxBridge
        │
        ▼
Connect registration platform (RegFox API + event id)
        │
        ▼
Initial registration sync → Desktop durable store (target)
        │
        ▼
Optional: enable FoxBridge Cloud for the event (seamless config — target)
        │
        ▼
Publish / sync registration snapshot + entitlements → Cloud
        │
        ▼
Pair phones → scanner sessions
        │
        ▼
Live operations (desk + phones)
        │
        ▼
Continuous sync (see §6)
        │
        ▼
Event closed / archive (future) — retain ops history, revoke sessions
```

**Today’s gaps vs target:** Public Cloud defaults can be packaged (Sprint 21.5); privileged Desktop ops use desk credentials + Edge Functions in production (Sprint 21.6+), with legacy local service-role only for development/migration. Attendees are durable on disk (Local Event Store); ordinary organizers enroll with a one-time code rather than pasting every Cloud key.

---

## 6. Synchronization lifecycle

### 6.1 Registration sync (upstream → FoxBridge)

1. Desktop fetches registrants from the registration platform.
2. Maps into internal `Attendee` model (platform-specific adapters).
3. Writes durable local registration cache (**target**; today: memory).
4. Derives meal entitlements with shared meal logic.
5. When Cloud is enabled for the event, pushes Cloud-safe registration projection + entitlements.
6. Records last successful sync timestamps (local + Cloud).

Triggered by: initial connect, Refresh registrations, reconnect after offline, and scheduled refresh if added later.

### 6.2 Operational sync (FoxBridge Desktop ↔ Cloud ↔ Phones)

| Flow | Direction | Purpose |
|------|-----------|---------|
| Publish registration projection | Desktop → Cloud | Phones can look up attendees & entitlements |
| Phone meal validation | Phone → Cloud | Shared meal redemptions |
| Pull meal validations | Cloud → Desktop | Desk/dashboard offline-capable merge (**implemented** via Sync Manager schedule + `sync()`) |
| Check-in | Desktop → RegFox (+ local); optional mirror → Cloud (**target**) | Upstream status + FoxBridge history |
| Badge print log | Desktop local; optional Cloud aggregate (**future**) | Reprint history |
| Event Settings / Quick Info config | Desktop local; optional Cloud mirror for multi-desk (**future**) | Organizer prefs |

### 6.3 Write-back to registration platforms

Allowed only as **explicit operational writes** with a dedicated adapter:

| Write | Status |
|-------|--------|
| Check-in | Implemented (desktop → RegFox) |
| Payment status | Future; must not silently rewrite RegFox finances |
| Organizer notes | Future if upstream supports or FoxBridge-only notes |
| Meal / badge | Stay in FoxBridge / Cloud; do not invent RegFox meal APIs |

Phones never write to registration platforms.

---

## 7. Pairing workflow

One-scan product (Sprint 21.7) for desk-enrolled Desktops:

1. Organizer opens **Connect a phone** (desk enrolled + scanner HTTPS origin packaged or configured).
2. Desktop best-effort publishes attendees (soft warning if publish lags; QR still shown when attendees exist).
3. Desktop creates a short-lived pairing token via `desktop-create-pairing` (desk credential) or legacy path.
4. Desktop shows HTTPS QR only: `https://<scanner-origin>/pair?token=<raw>` — no Cloud keys, conference id, or desk secrets.
5. Phone Camera opens the PWA; mobile redeems immediately via `exchange_scanner_pairing_token` using packaged public Cloud config.
6. Desktop polls `desktop-pairing-status` → **Phone connected**; volunteer reaches Ready to Scan.
7. Expired codes auto-renew on Desktop; failures use plain-language organizer copy.

**Policy:** Pairing materials never contain RegFox API keys or desk credentials. Pairing tokens are not privileged Desk credentials.

Implementation: [`SUPABASE_ARCHITECTURE.md`](./SUPABASE_ARCHITECTURE.md), `electron/mobile/pairingRepository.ts`, `ConnectPhonePanel`.

---

## 8. Offline behavior

### Desktop (required)

- Full desk workflow against **local durable data** when Cloud or RegFox is unreachable.
- Local meal validation and badge print continue.
- Check-in: queue or fail gracefully if RegFox is down (**policy TBD in implementation sprint**; today requires live RegFox POST).
- Cloud publish/pull deferred; surface non-technical “phones may be out of date” warnings when relevant.

### Phones (MVP today / target)

- **Today:** Online-only against Cloud.
- **Target:** Cache last known entitlements; queue validations; flush on reconnect with first-write-wins meal policy.

### Registration platform offline

- Desktop continues with last synced registrations.
- Do not invent new attendees while offline.
- Mark registration data “last updated …” so staff know freshness.

---

## 9. Reconnection behavior

1. **Desktop regains RegFox:** Run registration sync; merge into local cache; push Cloud projection if Cloud enabled.
2. **Desktop regains Cloud:** Push pending local ops (outbox); pull Cloud ops since last cursor; update dashboards/SQLite.
3. **Phone reconnects:** Flush validation outbox; refresh attendee/entitlement reads; drop session only if revoked.
4. **Never auto-duplicate meal redemptions** — uniqueness `(conference, attendee, meal_key)` remains the law.

Reconnection is **automatic** from the volunteer’s point of view; organizers are not asked to “publish” as a separate mental model over time (publish becomes an internal Sync step).

---

## 10. Sync policies (not generic conflict resolution)

FoxBridge does **not** ship a general-purpose conflict engine. Each data class has a named policy.

### 10.1 Policy vocabulary

| Policy | Meaning |
|--------|---------|
| **Upstream wins** | Registration platform value replaces FoxBridge projection on sync |
| **First write wins** | First successful insert kept; later duplicates return “already exists” |
| **Local ops append** | New operational events append; no overwrite of prior successes |
| **Desktop config wins** | Organizer desktop Event Settings is authoritative for that event |
| **Mirror only** | Copy for display/coordination; do not become a second authority |
| **No sync** | Remains device-local until a later sprint promotes it |

### 10.2 Data sync matrix

**Sprint 23.5a:** Cloud operational check-in table + desk-auth `desktop-check-in` / `desktop-pull-check-ins`. Principal and Linked share Cloud-first write path. Sync entity `check_in_state` polls ~12s. Local overlay `event_attendee_check_ins` merges over registration snapshot.

**Sprint 23.5b1:** Principal-only upstream reconciliation manager + RegFox adapter. Durable retry metadata (migration **018**: `upstream_retry_eligible`, `upstream_next_attempt_at`, `upstream_attempt_count`).

**Sprint 23.5b2:** Append-only check-in audit (migration **019**) + Principal-only upstream health summary in FoxBridge Sync panel. See `docs/CHECK_IN_ARCHITECTURE.md`.

| Data | Source of truth | Sync directions | Conflict / merge policy | Future considerations |
|------|-----------------|-----------------|-------------------------|------------------------|
| **Registrations** (attendees, purchases, custom fields) | Registration platform | Platform → Desktop → Cloud (projection) | **Upstream wins** on each successful registration sync | Durable Desktop cache; Cloud projection may omit sensitive PII by policy |
| **Meal entitlements** (derived) | Derived from registrations via shared meal rules | Desktop → Cloud (replace set per conference sync) | **Upstream-derived replace** on publish (full entitlement refresh) | Keep derivation shared; never edit entitlements on phone |
| **Meal scans / validations** | FoxBridge ops (Desktop local and/or Cloud) | Phone → Cloud; Desktop local; **Cloud ↔ Desktop pull/push (target)** | **First write wins** per `(conference_id, attendee_id, meal_key)` | Desktop must ingest Cloud rows into SQLite for offline parity |
| **Check-ins** | FoxBridge Cloud operational table (live); registration platform via Principal adapter (23.5b) | Desktop → Cloud (desk-auth); peers ← `check_in_state` (~12s) | **First successful Cloud check-in wins**; original `checked_in_at` preserved | RegFox upstream adapter in 23.5b; no fake local-only success |
| **Badge print history** | Desktop SQLite | **No sync** (today) | N/A local append | Optional Cloud aggregate for reprint analytics |
| **Payments** (display snapshot) | Registration platform | Platform → Desktop (and optional Cloud display fields) | **Upstream wins** | Write-back only as explicit future product; never silent |
| **Organizer notes** | FoxBridge (unless upstream notes API exists) | Desktop ↔ Cloud (**future**) | **Last organizer edit wins** with timestamp (desktop author) | Prefer FoxBridge-owned notes over inventing RegFox fields |
| **Attendee Quick Info values** | Resolved from registrations + purchases at read time | Not synced as separate payloads | N/A — computed | Stay derived; don’t store rendered Quick Info rows in Cloud |
| **Event Settings** (e.g. `attendeeDisplay.fieldKeys`) | Desktop `event-settings.json` keyed by event | **No sync** (today) | **Desktop config wins** | Optional Cloud mirror for second desk / restore |
| **Pairing tokens / scanner sessions** | FoxBridge Cloud | Desktop creates; Phone exchanges; Desktop polls | Token single-use; session revoked centrally | Session admin UI; device list |

---

## 11. Mapping from “manual Supabase config” to Sync

| Today (pain) | Sync target |
|--------------|-------------|
| Paste service URL, anon key, service-role key | Seamless event linking / signed-in organizer or install-bound Cloud project |
| Separate mobile Vite env vs desktop settings | One Cloud environment; phone builds pointed at Sync host |
| Optional “publish” as operator concept | Internal Sync step after registration refresh |
| Advanced-only Cloud panels | Sync health visible in Operations in plain language |
| Supabase named as the architecture | **FoxBridge Cloud**; Supabase is the current backend |

Supabase remains a valid implementation of FoxBridge Cloud. Replacing Supabase later should not rewrite Desktop/phone product contracts if Sync boundaries are respected.

---

## 12. Reuse vs major additions

### 12.1 Reuse as-is or with thin wrappers

| Area | Location |
|------|----------|
| Publish pipeline | `electron/cloud/publishAttendeesRepository.ts`, `buildPublishPayload.ts` |
| Conference resolve | `electron/cloud/conferenceRepository.ts` |
| Pairing | `electron/mobile/pairingRepository.ts`, mobile `pairingService` / `PairScreen` |
| Meal validate RPC client | mobile `mealValidationService`; SQL `validate_meal` |
| Shared meal / dashboard pure logic | `src/shared/meals/*`, `getValidatableMeals` |
| Local ops SQLite patterns | `mealValidationRepository`, `badgePrintLogRepository`, `attendeeCheckInRepository` |
| RegFox adapter | `RegFoxService`, `mapRegistrantToAttendee`, check-in POST |
| Event Settings + Quick Info | `event-settings.json`, discovery + resolve services |
| Cloud status store pattern | `cloudPublishStore.ts` |

### 12.2 Major architectural additions (future sprints)

1. **Named Sync module** (Desktop Sync client + Cloud contracts) sitting above Supabase specifics  
2. **Durable local attendee/registration cache** (SQLite or equivalent)  
3. **Desktop pull of Cloud meal validations into SQLite** (+ outbox for desktop→Cloud meal writes if desktop meals stay primary anywhere)  
4. **Sync cursors / outbox** for offline reconnect  
5. **Seamless Cloud provisioning / linking** (eliminate manual key paste for organizers)  
6. **Phone offline cache + validation outbox**  
7. **Optional Cloud mirrors** for check-in / Event Settings  
8. **RLS / security hardening** for multi-tenant Sync (implementation detail tracked with Supabase doc)  
9. **Scoped write-back framework** (check-in as first adapter; payment/notes later)

---

## 13. Implementation status

| Sprint | Status |
|--------|--------|
| **21.0** | Design — this document |
| **21.1** | Desktop Sync foundation — Cloud → SQLite meal validation pull via `electron/sync` (`sync()`), no UI |
| **21.2** | Local Event Store — durable `event_attendees` SQLite table; Desktop reads local after import |
| **21.3** | Event identity foundation — SQLite `events` + `activeEventId`; Local Event Store / Event Settings / sync cursors associate with FoxBridge Event |
| **21.4** | Sync scheduling & lifecycle — main-process Sync Manager owns initial + periodic best-effort `sync()` |
| **21.5** | Seamless Cloud configuration foundation — FoxBridge Cloud public defaults + config abstraction; no privileged keys in builds |
| **21.6** | Trusted Cloud operations boundary — event-scoped desk credentials + Edge Functions; no local service-role for production |
| **21.7** | Simplified phone pairing — one-scan HTTPS QR; Desktop waiting/connected/expired states; non-technical organizer errors |
| **21.8** | Organizer Sync enrollment UX — Setup Wizard + Operations Home share enrollment/status |
| **21.9** | End-to-end Sync deployment readiness — checklists, packaging vars, migration 010 enrollment digest fix |
| **21.10** | Live clean-install validation PASS — packaged Desktop desk enroll → pair → meal → Cloud→SQLite |
| **22.0** | Device trust / self-service provisioning architecture (design only) — [`DEVICE_TRUST_ARCHITECTURE.md`](./DEVICE_TRUST_ARCHITECTURE.md) |
| **22.1** | Principal Desktop provisioning backend — migration 011, `desktop-claim-principal`, main-process claim IPC |
| **22.2** | Principal Desktop self-service Setup UX — Wizard claim, transfer confirmation, Operations Home role status |
| **22.3** | Linked Desktop join codes + Connected Desktops management |
| **22.4** | Principal escalation security closeout — Linked cannot silent-claim; ownership form required |
| **22.5** | Linked UX polish — canonicalize, countdown, installation identity (migrations 013–015) |
| **22 FINAL** | Live-validated multi-Mac universal packaging + Cloud deploy |

Canonical operator runbook: [`FOXBRIDGE_SYNC_DEPLOYMENT.md`](./FOXBRIDGE_SYNC_DEPLOYMENT.md). Canonical device trust: [`DEVICE_TRUST_ARCHITECTURE.md`](./DEVICE_TRUST_ARCHITECTURE.md). Canonical local event lock / re-auth: [`EVENT_SESSION_ARCHITECTURE.md`](./EVENT_SESSION_ARCHITECTURE.md) (Sprint **23.2** Connect wizard + Reopen lock; Sync Manager skips while locked).

### Sprint 22.3 — Linked join codes

| Item | Detail |
|------|--------|
| **Schema** | `012_linked_desk_join_codes.sql` |
| **Issue** | Principal-only `desktop-issue-join-code` (~15 min) |
| **Redeem** | `desktop-redeem-join` → Linked desk, 48 h |
| **Manage** | `desktop-list-desks` / `desktop-revoke-desk` |
| **Test** | `npm run test:linked-desk-join` |

### Sprint 22.2 — Principal Setup UX

| Item | Detail |
|------|--------|
| **Primary path** | RegFox connected → Set up FoxBridge Sync → Principal claim (main process) |
| **Transfer** | Explicit confirmation when another Principal exists |
| **Fallback** | Operator enrollment code (Sprint 21) still available |
| **Optional** | Set up later — local desk workflows remain usable |
| **Test** | `npm run test:principal-setup-ux` |

### Sprint 22.1 — Principal claim backend

| Item | Detail |
|------|--------|
| **Migration** | `011_principal_desk_provisioning.sql` |
| **Edge** | `desktop-claim-principal` (`confirmTransfer` / `needsTransferConfirmation`) |
| **Legacy desks** | `role=legacy`; operator enroll preserved |
| **Test** | `npm run test:principal-claim` |
| **UI** | Landed in 22.2 |

### Sprint 22.0 — Device trust (design)

| Item | Detail |
|------|--------|
| **Problem** | Sprint 21 requires operator SQL conference + enrollment code for first desk |
| **Principal** | Cloud-verified registration ownership → Principal desk credential |
| **Linked** | Principal join code (~15 min, single-use) → Linked desk credential (48 h) |
| **Scanner** | Unchanged Sprint 21 pairing |
| **RegFox key in Cloud** | Ephemeral verify only; never persist |
| **Implementation** | Not in 22.0 — see Sprint 22.1 scope in device-trust doc |

### Sprint 21.10 — Live validation

| Item | Detail |
|------|--------|
| **Result** | Clean-install A–O **PASS** (incl. O: restart kept event, Sync Connected, Meal Dashboard validation) |
| **Cloud** | Project `upsjnvlllkeucjarbnnx`; conference RegFox `1012457` (`d00f67ca-2d5b-4e3e-b7bb-659bc0031363`) |
| **Scanner** | `https://fox-bridge.vercel.app` |
| **Desktop** | Packaged build with public Cloud config; **no** local service-role |
| **Close Sprint 21?** | **Yes** — Sync feature/enablement track closed; RLS/offline remain backlog |

### Sprint 21.9 — Deployment & validation

| Item | Detail |
|------|--------|
| **Purpose** | Validate Sync can be deployed and used without organizer Supabase/service-role knowledge |
| **Fix** | Migration `010_fix_issue_desk_enrollment_digest.sql` — `issue_desk_enrollment_code` search_path includes `extensions` |
| **Checklist** | [`FOXBRIDGE_SYNC_DEPLOYMENT.md`](./FOXBRIDGE_SYNC_DEPLOYMENT.md) |
| **Automated** | `npm run test:sync-deployment-readiness` (repo packaging/schema; not live Cloud E2E) |
| **Manual** | Clean-install §3 + failure/recovery §4 in the deployment doc |

### Sprint 21.8 — Organizer enrollment UX

| Item | Detail |
|------|--------|
| **Surfaces** | Setup Wizard (after RegFox) + Operations Home Sync status/connect |
| **Shared logic** | `FoxBridgeSyncEnrollment` + `src/shared/sync/foxbridgeSyncStatus.ts` |
| **Wizard** | Always shown; Connected + Next when valid; else enroll + Set up later |
| **Recovery** | Operations Home reopen of same enroll panel (re-enrollment) |
| **Jargon** | Organizer copy uses FoxBridge Sync / enrollment code only |
| **Test** | `npm run test:foxbridge-sync-status` |

### Sprint 21.7 — Simplified phone pairing

| Item | Detail |
|------|--------|
| **QR** | HTTPS FoxBridge Scanner URL + short-lived pairing token only (`/pair?token=…`) |
| **Not in QR** | Cloud URL, publishable/service keys, conference id, desk credential |
| **Desktop** | `ConnectPhonePanel` phases: generating, waiting, connected, expired (auto-renew), failed |
| **Mobile** | Packaged public Cloud config; Camera opens URL → redeem token → Ready to Scan |
| **Auth distinction** | Pairing token → phone scanner session; desk device token → Desktop privileged Cloud ops |
| **Test** | `npm run test:pairing` |

### Sprint 21.6 — Trusted Cloud operations boundary

Privileged Desktop Cloud writes no longer require a packaged or everyday local service-role key.

| Item | Detail |
|------|--------|
| **Enrollment** | One-time short-lived code (`desk_enrollment_codes`) → Edge Function `desktop-enroll` |
| **Desk credential** | `desk_devices` token hash, bound to one `conference_id`, revocable |
| **Transport** | Desktop uses packaged/public Cloud config + desk token → Edge Functions (service role only in Cloud) |
| **Moved ops** | Publish attendees/entitlements, resolve conference, create pairing, pairing status, ensure scanner session |
| **Reads** | Meal validation pull / dashboards use anon client where RLS allows |
| **Legacy** | Local service-role path remains for development/migration only (`legacy_service_role`) |
| **Schema** | `supabase/migrations/009_desk_devices.sql` |
| **Functions** | `supabase/functions/desktop-*` |
| **Test** | `npm run test:desk-credential` |

Operator issue (SQL as service_role):

```sql
SELECT * FROM issue_desk_enrollment_code('<conference_uuid>', 60, 'Registration desk 1');
```

### Sprint 21.5 — Seamless Cloud configuration foundation

Product-facing **FoxBridge Cloud** configuration is separated from Supabase implementation details.

| Layer | Contents | Who sets it |
|-------|----------|-------------|
| **Public (non-secret)** | Cloud endpoint URL + publishable client key (+ scanner HTTPS origin) | Packaged defaults (`FOXBRIDGE_CLOUD_*` at packaging/CI), or Advanced override, or local `.env` |
| **Privileged** | Desktop service credential | Local secrets store / developer env **only** — never packaged into distributed builds |
| **Implementation** | Supabase client adapters | `supabaseClient.ts`, repositories |

**Resolution (public):** explicit settings → packaged defaults → local env.  
**Resolution (privileged):** secrets → `SUPABASE_SERVICE_ROLE_KEY` env.  

Ordinary organizers should not paste URL/anon/service-role during setup when packaging supplies public defaults. Production Desktop publish/pairing use desk enrollment + Edge Functions (Sprint 21.6+); local privileged keys remain development/migration only. See [`FOXBRIDGE_SYNC_DEPLOYMENT.md`](./FOXBRIDGE_SYNC_DEPLOYMENT.md).

| Item | Detail |
|------|--------|
| **Abstraction** | `electron/cloud/cloudConfig.ts` + `src/shared/models/CloudConfig.ts` |
| **Defaults** | `electron/config/appDefaults.ts` — empty placeholders in repo |
| **Adapter** | `supabaseConfig.ts` remains; resolves via Cloud abstraction |
| **Advanced UI** | Development / migration override only |
| **Test** | `npm run test:cloud-config` |

### Sprint 21.4 — Sync scheduling & lifecycle

Desktop Sync is an independent main-process subsystem. Entity pull logic remains in `syncService.sync()`; timing and overlap live in `syncManager`.

| Item | Detail |
|------|--------|
| **Owner** | `electron/sync/syncManager.ts` — `startDesktopSyncManager` / `stopDesktopSyncManager` / `requestDesktopSyncBestEffort` |
| **Interval** | `DESKTOP_SYNC_INTERVAL_MS` (5 minutes) in `syncManagerHelpers.ts` |
| **Initial run** | After app init via `startDesktopSyncManager()` (fire-and-forget; never blocks startup) |
| **Preconditions** | Active FoxBridge Event (`activeEventId`) + Cloud configured; otherwise silent skip |
| **Overlap** | In-progress flag — concurrent requests/intervals no-op until the current run finishes |
| **Offline** | Best-effort / fail silent; local workflows continue; next interval retries |
| **Event scope** | `sync()` still passes `settings.activeEventId` into handlers/cursors |
| **Legacy hooks** | Successful publish + connection-test still call `requestDesktopSyncBestEffort` (manager-owned, non-blocking) |
| **Future entities** | Register another `SyncEntityHandler` in `ENTITY_HANDLERS` — no new timers |
| **Test** | `npm run test:sync-manager` |

### Sprint 21.3 — Event identity foundation

FoxBridge Events are independent of registration platforms. RegFox page ids remain on `AppSettingsPublic.regfoxEventId` for existing RegFox workflows; associations prefer `events.id` / `activeEventId`.

| Item | Detail |
|------|--------|
| **Table** | `events` — `id`, `name`, `registration_platform`, `platform_event_id`, `created_at`, `last_synced_at` |
| **Settings** | `activeEventId` (FoxBridge) alongside `regfoxEventId` (legacy RegFox) |
| **Write path** | RegFox connect/load → `activateRegFoxEvent` → store attendees under FoxBridge Event id |
| **Boot** | `ensureActiveEventIdentityFromSettings` rekeys legacy Local Event Store + Event Settings aliases |
| **Sync cursors** | Prefer `events[foxbridgeEventId].conferences[…]`; conference-only keys still mirrored |
| **Not in this sprint** | UI changes, multi-event switcher, full SoT cutover away from `regfoxEventId` |
| **Test** | `npm run test:event-identity` |

### Sprint 21.2 — Local Event Store foundation

**Pipeline:** Registration adapter (RegFox today) → map to `Attendee[]` → Local Event Store (`event_attendees`) → in-memory cache → Desktop workflows.

| Item | Detail |
|------|--------|
| **Table** | `event_attendees` — platform-agnostic payload JSON + `event_id`, `source_platform`, `synced_at` |
| **Repository** | `electron/db/eventAttendeeRepository.ts` |
| **Write path** | `replaceAttendeeCacheFromRegistrationSync` after RegFox connect/load/update |
| **Read path** | Hydrate cache on boot; `regfox:getAttendees` returns local when non-empty |
| **Still RegFox** | Connect + Refresh registrations (`updateRegistrations` / empty-store first download) |
| **Not in SQLite** | Event Settings UI prefs (`event-settings.json`) |
| **Test** | `npm run test:local-event-store` |

Future registration adapters: map to `Attendee`, call `replaceAttendeeCacheFromRegistrationSync({ sourcePlatform: '…' })` — same Local Event Store.

### Sprint 21.1 — Desktop Sync Service (meal validations)

**Pipeline:** Cloud (`meal_validations`) → `sync()` → entity handler → SQLite `meal_validations` → existing repositories/UI.

| Item | Detail |
|------|--------|
| **Entry point** | `electron/sync/syncService.ts` → `sync()` / `syncBestEffort()` |
| **Invocation** | Owned by Sync Manager (Sprint 21.4). Legacy: after successful Cloud publish; after successful mobile-service connection test. |
| **Entity** | `meal_validations` only (`electron/sync/entities/mealValidationSync.ts`) |
| **Policy** | First write wins (`UNIQUE(attendee_id, meal_key)`); preserve Cloud timestamps; `importSyncedMealValidation` does not change `validateMeal()` |
| **Incremental** | Cursor in `userData/desktop-sync-cursors.json` (`validated_at` + cloud `id`) |
| **Offline** | If Cloud unavailable / no conference → `skipped` no-op |
| **Extension** | Register another `SyncEntityHandler` in `ENTITY_HANDLERS` |

Suggested next: tighten anon RLS; phone offline outbox; optional Desktop→Cloud meal upload.

---

## 14. Non-goals (original Sprint 21.0 design sprint)

- Implementing Sync code *during 21.0* (landed starting 21.1)  
- Replacing RegFox as registration UI  
- Making phones talk to RegFox  
- Generic CRDT / multi-master conflict studio  
- Requiring Cloud for Desktop-only conferences  

---

## 15. Open questions for later sprints

1. Exact PII policy for Cloud projections (email is published today; product may tighten).  
2. Offline check-in: queue vs require live RegFox.  
3. Whether desktop meal validations should also upload to Cloud when Desktop meal UI is enabled.  
4. Multi-desk Event Settings: mirror now or wait until a second physical desk is common.  
5. Cloud provisioning UX: hosted FoxBridge account vs bring-your-own Supabase project for self-hosters.
