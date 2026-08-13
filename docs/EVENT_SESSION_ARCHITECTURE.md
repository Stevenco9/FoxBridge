# FoxBridge — Event Access Session Architecture

**Sprint:** 23.0–23.5  
**Status:** **SPRINT 23 CLOSED — LIVE VALIDATED** (EventAccessSession, operational parity, Cloud-first check-in, Principal upstream reconciliation)  
**Depends on:** Sprint 22 device trust ([`DEVICE_TRUST_ARCHITECTURE.md`](./DEVICE_TRUST_ARCHITECTURE.md))  
**Related:** [`CHECK_IN_ARCHITECTURE.md`](./CHECK_IN_ARCHITECTURE.md), [`SYNC_ARCHITECTURE.md`](./SYNC_ARCHITECTURE.md), [`PRODUCT_DECISIONS.md`](./PRODUCT_DECISIONS.md), [`PROJECT_STATE.md`](./PROJECT_STATE.md)

This document is the **canonical** design for locked vs unlocked event access, process-scoped sessions, setup unlock flows, and main-process enforcement. Device trust (Principal / Linked / join codes) remains defined in [`DEVICE_TRUST_ARCHITECTURE.md`](./DEVICE_TRUST_ARCHITECTURE.md) — this doc only describes how those mechanisms interact with **local event-access sessions**.

---

## Sprint 23.2 — unified Connect wizard & Reopen lock

| Item | Behavior |
|------|----------|
| Normal flow | Language → **Connect to your event** → Set up my event **or** Join existing (no separate FoxBridge Sync step; no Set up later) |
| Principal | Explicit RegFox API key + Event ID every unlock → `connectRegFox` → `claimPrincipal` → `EventAccessSession(principal)` |
| Linked | Connection code only → redeem → `EventAccessSession(linked)` |
| Same-install Principal | Edge `reactivateDeskToken`: after RegFox proof, rotate token on the **same** active Principal row (no duplicate / false transfer). Rotate must return the updated row; Desktop persists + read-back verifies before unlock. |
| Connected Desktops | Principal-only Cloud calls (`desktop-list-desks` / issue / revoke) are the authority — UI must not treat local/session Principal as sufficient if desk credential is stale |
| Event isolation | EventAccessSession.eventId scopes attendee cache / Local Event Store reads. Linked join activates a Cloud-conference FoxBridge Event, clears prior cache, pulls `desktop-pull-attendees` for that conference only. Empty B ≠ Event A data. Local Event Store row key is **`(event_id, id)`** (platform attendee id scoped per FoxBridge Event) so A↔B switching cannot UNIQUE-collide. |
| Linked convergence | While unlocked, Sync Manager entity `attendee_snapshot` polls `conferences.last_desktop_sync_at` (5 min) and pulls **operational snapshot v1** (payment, check-in display, purchases, customFields, org, …) when Principal published a newer snapshot. Immediate pull on join/unlock and on Linked “Refresh registrations” (Cloud→local, never RegFox). **Principal never Cloud-replaces registration attendees** (RegFox → local → Cloud publish only). **Attendee publish is Principal-only.** |
| Cloud publish | Must load Local Event Store by session event id; abort unless sessionEventId = store event = desk conference. Never publish process-global cache. `desktop-publish` replaces conference attendee + entitlement snapshots (**Principal role required**). |
| Reopen Setup | Confirm → `lockEventAccess()` → Connect flow; **no** `resetSetup`; persistent data kept |
| Fresh process | Assume locked until status resolves (no Operations flash); `setupComplete` never bypasses lock |
| Post-unlock first-run | Principal: printer → mobile → ready; Linked: printer → ready (skip mobile) |
| Returning unlock | Skip remaining setup → Operations Home |
| Tests | `npm run test:setup-wizard-event-connection`, `npm run test:principal-reactivation-credential`, `npm run test:event-attendee-isolation`, `npm run test:linked-multi-event-sync`, `npm run test:principal-attendee-no-downgrade` |

**Deploy note (Sprint 23 final):** Apply migrations **016–019**. Redeploy check-in/upstream Edge functions (`desktop-check-in`, `desktop-pull-check-ins`, `desktop-pull-pending-check-ins`, `desktop-update-check-in-upstream-status`, `desktop-upstream-check-in-health`) plus `desktop-claim-principal`, `desktop-pull-attendees`, `desktop-resolve-conference`, `desktop-publish`. Desktop rebuild; local SQLite `user_version=3` migrates in place (preserve userData).

**Product principle (Sprint 23.5):** Linked Desktop = full operational workstation. Principal = administrative owner + registration-platform upstream authority. Both desks check in via FoxBridge Cloud; Principal reconciles upstream (RegFox adapter in 23.5b1). See [`CHECK_IN_ARCHITECTURE.md`](./CHECK_IN_ARCHITECTURE.md).

---

## Sprint 23.1 — implementation (main-process foundation)

| Item | Location / behavior |
|------|---------------------|
| Session service | `electron/session/eventAccessSession.ts` — in-memory only |
| Shared types / locked code | `src/shared/models/EventAccessSession.ts` (`EVENT_ACCESS_LOCKED`) |
| Lifecycle | `electron/session/eventAccessLifecycle.ts` — start Sync/scanner on unlock; stop on lock |
| Renderer status | `session:getEventAccessStatus`, `session:lockEventAccess` (no arbitrary unlock IPC) |
| Establish (trusted only) | Successful `connectRegFox` → `regfox`; `claimPrincipal` → `principal`; `redeemJoin` → `linked`; `enrollDesktop` → `legacy` |
| Boot | Hydrate Local Event Store internally; **do not** start Sync Manager or scanner until unlock |
| App gate | `eventLocked \|\| !setupComplete \|\| forceSetup` → existing Setup Wizard (steps unchanged) |
| Persisted RegFox / desk | Remain on disk; **never** auto-unlock a fresh process |
| Tests | `npm run test:event-access-session` |

**Unlock methods:** `principal` \| `linked` \| `legacy`  
(Sprint 23.2 removes `regfox`-only unlock from Connect; Principal path always claims.)

### Background services while locked

| Service | Behavior |
|---------|----------|
| Desktop Sync Manager | Not started at boot; `decideScheduledSyncStart` → `skip_event_locked` if somehow requested |
| Local scanner HTTP | Not auto-started; `scannerServer:start` guarded |
| Attendee cache hydrate | Allowed in main at boot for later unlock — **not** exposed via `regfox:getAttendees` until unlocked |

### Locked IPC error

Throw `EventAccessLockedError` with `code: EVENT_ACCESS_LOCKED` and stable message. Renderer: `isEventAccessLockedError()`.

---

## Product model

FoxBridge must **not** forget or delete an event when the app quits.

Separate:

| Concept | Lifetime | Purpose |
|---------|----------|---------|
| **Persistent event data** | Survives quit / crash / reboot | Attendees, history, settings, installation identity, Cloud device records, appropriate secrets metadata |
| **Active event-access session** | **Current Electron process only** | Authorization to *use* event data and operations in this process |

A new FoxBridge application process always starts **LOCKED**. The user must prove authorization again before accessing event data or operations.

**Do not** rely on clearing secrets during shutdown. Shutdown hooks are unreliable as a security boundary. Prefer an **in-memory / process-scoped** session so a new process naturally starts locked.

---

## Desired process behavior

| Lifecycle event | Expected session |
|-----------------|------------------|
| Computer sleeps | Remain **unlocked** |
| Window closes; Electron process still running (typical macOS) | Remain **unlocked** |
| Window reopens in same process | Remain **unlocked** |
| True quit (`Cmd+Q` / app quit) → next launch | Start **LOCKED** |
| Machine restart / shutdown → next launch | Start **LOCKED** |
| Crash / unexpected process death → next launch | Start **LOCKED** |
| Settings → Reopen Setup Wizard → confirm | **Lock immediately** → setup flow |
| Cancel that warning | **No state change** |

---

## Current state (pre–Sprint 23) — investigation summary

### Setup Wizard today

Step order in `src/features/setup/SetupWizard.tsx`:

`welcome` → `language` → `regfox` → `foxbridgeSync` → `printer` → `mobile` → `ready`

App gate (`src/App.tsx`): show wizard when `!setupComplete || forceSetup`; otherwise Operations Home (`AttendeeSearchScreen`).

There is **no** EventAccessSession. Persisted desk credentials and RegFox secrets unlock Cloud/ops on relaunch automatically.

### Why blank RegFox fields can appear to advance

1. **Fresh Connect with empty fields:** Primary button is **not** disabled for empty inputs (`disabled={isBusy}` only). Click calls `connectRegFox`, which **rejects** empty key/event id in `settingsService.connectRegFox` and stays on the step. So blanks do **not** successfully connect on first run.
2. **Actual skip path:** If `regfoxConfigured && attendeeCount > 0`, wizard sets `regfoxConnected = true` and the button becomes **Next**, which advances to `foxbridgeSync` **without** re-reading the (often blank) API key field or re-verifying RegFox. This happens on Reopen Setup Wizard and any remount where secrets + attendees already exist.

Sync step still allows **Set up later** → `printer` without desk enrollment. Operator enrollment remains Advanced-only (Sprint 22.4).

### Reopen Setup Wizard today

| Item | Behavior |
|------|----------|
| Confirmation | **None** — immediate |
| Mutation | `settings:resetSetup` → `setupComplete: false` only + React `forceSetup` |
| Secrets / desk / installation / SQLite / conference | **All retained** |
| Security effect | UI returns to wizard; **event data remains reachable via IPC** if something still invokes handlers |

Documented intent in project state (“returns without deleting SQLite”) matches code for data retention, but there is no lock session.

### Persistence / auto-restore today

- Desk token in `secrets.bin` (safeStorage) / fallback — **persists across quit**
- `readDeskCredentialSync()` used on demand — **no re-auth**
- `will-quit` stops sync manager, scanner, closes DB — **does not clear secrets**
- macOS: `window-all-closed` does not quit → process (and any future in-memory session) can survive window close

---

## Target: process-scoped Event Access Session

### Name / ownership

**`EventAccessSession`** — owned exclusively by the **main process** (trusted boundary).

Conceptual shape (implemented in 23.1):

```ts
type EventUnlockMethod = 'principal' | 'linked' | 'legacy' | 'regfox'

interface EventAccessSession {
  /** FoxBridge Event / activeEventId and/or conferenceId — identity of unlocked event */
  eventId: string
  conferenceId: string | null
  unlockedAt: number
  unlockMethod: EventUnlockMethod
  /** Process-local id */
  sessionId: string
}
```

**Critical property:** This object (or equivalent) must live in **main-process memory only**. It must **not** be written to `app-settings.json`, SQLite, `secrets.bin`, or any other durable store. A new Electron process therefore always starts with `session === null` → **LOCKED**.

### Why main process (not renderer)

- Renderer is untrusted relative to IPC: hiding React routes alone is insufficient.
- All sensitive reads/writes already go through `ipcMain.handle` in Electron.
- A single main-process guard can deny attendee/meal/badge/Cloud ops while locked even if a compromised or stale UI calls IPC.
- Renderer may **observe** locked/unlocked via a safe status channel; it must not be the source of truth.

### How the UI learns locked vs unlocked

Recommended:

1. Main exposes something like `session:getStatus` → `{ locked: boolean, unlockMethod?, eventId?, … }` (no secrets).
2. Optionally push `session:changed` events when lock/unlock occurs.
3. `App.tsx` (or successor) renders:
   - **Locked** → Connect / unlock setup surface (language + Connect to your event)
   - **Unlocked** + incomplete first-run prefs → remaining setup (printer / mobile / ready) if still needed
   - **Unlocked** + ready → Operations Home

`setupComplete` remains a **first-run / prefs completion** flag, **not** authorization. After Sprint 23:

- `setupComplete === true` must **not** unlock a fresh process by itself.
- Unlock requires a live `EventAccessSession`.

---

## Proposed Setup Wizard state machine (normal users)

```
[Fresh process]
  → always LOCKED

Choose Language
  → Connect to your event

Connect to your event
  ├── Set up my event
  │     → RegFox API key + Event/Page ID (both required; cannot proceed empty)
  │     → Verify RegFox access successfully
  │     → Principal path (Sprint 22 claim / reactivate — see below)
  │     → establish EventAccessSession (unlockMethod: principal)
  │     → remaining setup (printer / mobile) if needed → Operations Home
  │
  └── Join an existing FoxBridge Event
        → Connection code only (no RegFox key / event ID)
        → Linked redeem (Sprint 22.5 installation rejoin)
        → establish EventAccessSession (unlockMethod: linked)
        → Operations Home / remaining setup

Normal users must NOT see:
  - separate post-RegFox “FoxBridge Sync” decision screen
  - operator enrollment codes
  - Supabase / desk-token / service-role terminology
```

Sprint 21 operator enrollment remains **Advanced / support / legacy** only.

### Interaction with Sprint 22 Principal claim

**Invariant preserved:** Prior Principal role, persisted desk token, or `setupComplete` alone never unlocks. Fresh RegFox ownership proof is required for Principal unlock.

**Architectural preference for same-machine relaunch (A over naive B):**

| Option | Meaning | Recommendation |
|--------|---------|----------------|
| **A** | Fresh RegFox proof unlocks session and **reuses** the existing logical Principal desk credential when it is still valid for that event | **Prefer** for quit/relaunch on the same install |
| **B** | Always run full `desktop-claim-principal` provision/transfer (new token; may revoke prior Principal) | Use when no usable Principal credential exists, or when this machine is **taking over** Principal (explicit transfer) |

Rationale: Restart must not look like Principal **transfer**. Stable logical Principal device identity should be preserved where safe; **authorization** still comes only from fresh RegFox proof + establishing the in-memory session.

**Today’s claim Edge path always mints a new token** via `provision_principal_desk_device` (effectively B). Later 23.x may need a small unlock/reactivate path (or claim flag) that:

1. Ephemerally verifies RegFox ownership (same as claim),
2. Confirms the local Principal desk token still matches an **active** Principal row for that conference,
3. Does **not** revoke/recreate unless transfer is required,

…then main process creates `EventAccessSession`. If Cloud validation fails (revoked, wrong event, missing token), fall back to full claim/transfer UX.

Until that exists, implementation must still **never** unlock from disk alone; interim approaches may verify RegFox locally + validate desk against Cloud resolve/status without treating restart as transfer — exact API is an implementation detail for 23.1+, not 23.0.

### Linked fresh-process unlock

```
Join an existing FoxBridge Event
  → fresh Principal-issued connection code
  → redeem (installation UUID persisted; Sprint 22.5 rejoin)
  → EventAccessSession (unlockMethod: linked)
```

**Do not** auto-unlock from an unexpired persisted 48-hour Linked desk token after process restart.

Cloud Linked row: **do not revoke merely because the app quit.** Distinction:

| Layer | Meaning |
|-------|---------|
| Cloud `desk_devices` Linked authorization | May remain valid until expiry/revoke |
| Local `EventAccessSession` | Ends when process ends |

Persisted Linked desk token may remain on disk for bookkeeping / next redeem overwrite / optional status probes that are carefully gated — but **must not** authorize event IPC or UI while locked.

---

## Reopen Setup Wizard → Lock Event (23.2)

### Target UX

**Title:** Return to event setup?

**Message:** Continuing will lock the current event on this computer. Saved attendee data, meal history, badge history, and event settings remain saved. To access again: registration-platform credentials **or** a new connection code from the Principal Desktop.

**Actions:** Cancel | Lock Event & Continue

| Action | Behavior |
|--------|----------|
| **Cancel** | No mutation of session, settings, secrets, or UI mode |
| **Lock Event & Continue** | Clear **in-memory** `EventAccessSession` immediately; hide/protect event ops; enter Connect/setup flow; **preserve** persistent event data |

### What must change vs today

| Today | Target |
|-------|--------|
| No confirmation | Mandatory confirmation |
| Only `setupComplete = false` | Invalidate session **first**; then enter setup UI |
| IPC still serves attendees/meals/Cloud | Main-process guards deny event ops while locked |
| Wizard can Next past blank RegFox if previously connected | Principal path always requires fresh credential entry + verify for unlock |

---

## Persistence classification

### Keep (durable across lock / quit)

- Installation UUID (`installation.json`)
- Language / UI preferences
- Local attendee store (`foxbridge.db` / Local Event Store)
- Meal validations, badge print logs, check-ins
- Quick Info / event-settings.json
- Event metadata needed for data integrity (`activeEventId`, conference ids as needed)
- Cloud device/audit records (server-side)
- Preferred printer, sync cursors, cloud publish state (as operational continuity — not as unlock keys)
- RegFox API key in local secrets (**credential material**, not session) — still required to be **re-entered or re-proven** for Principal unlock UX as designed; presence on disk alone does not unlock
- Desk token fields on disk (Cloud bookkeeping) — **not** session

### Session-only (never durable)

- `EventAccessSession` / unlocked flag / unlock method / session nonce
- Any “remember unlock across quit” flag

### Clear / replace on re-authentication

| Event | Behavior |
|-------|----------|
| Successful Principal unlock for **same** event | Prefer reuse Principal desk identity; refresh token only if Cloud requires |
| Principal **transfer** to this machine | Existing Sprint 22 transfer: new Principal credential; prior Principal revoked in Cloud |
| Successful Linked redeem | Replace local desk credential with new Linked token (Sprint 22); same installation id |
| Lock Event & Continue | Clear session only; do **not** wipe SQLite / installation / history |
| User connects a **different** RegFox event | Existing connect/replace attendee cache semantics; out of scope to redesign in 23.0 — document carefully in 23.1 |

### Must not unlock alone (fresh process)

Cached attendees, conference UUID, RegFox event ID, installation UUID, old Principal/Linked role, persisted desk credential, `setupComplete`, prior successful connection, Cloud metadata.

---

## Enforcement boundary (IPC / main process)

**Locked means more than hiding buttons.** While `EventAccessSession` is null:

### Must guard (deny or return locked error)

**Attendees / RegFox ops:** `regfox:getAttendees`, `regfox:updateRegistrations`, `regfox:checkInAttendee`

**Meals:** `meals:getValidationsForAttendee`, `meals:validateMeal`, `cloud:getMealDashboard`, `cloud:getMealDashboardDetail`, `cloud:getAttendeeMealValidations`

**Badge / real attendee print:** `print:badgePreview`, `print:getBadgePrintStatus`

**Cloud event ops:** `cloud:publishAttendees`, `cloud:setupMobileScanner`, `cloud:getConnectPhoneInfo`, `cloud:createScannerPairing`, `cloud:getPairingStatus`, `cloud:issueJoinCode`, `cloud:listDesks`, `cloud:revokeDesk`

**Sensitive status:** `cloud:getStatus`, `cloud:getMobileScannerInfo`, and `settings:getSetupStatus` — either deny or return a **redacted** locked DTO (no conference name / attendee counts / role that enables ops)

**Event settings:** `eventSettings:get` / `eventSettings:patch`

**Public settings:** Prefer stripped DTO while locked (language OK; event/conference fields withheld) or gate patches that change event identity

**Scanner:** Do not `scannerServer:start` while locked; stop or refuse serving if locked mid-flight

### Background work (same threat model)

While locked / before unlock on boot:

- Do **not** auto-run Desktop Sync Manager publish/pull against the event
- Do **not** auto-start scanner serving attendee data
- Attendee cache may exist on disk but must not be exposed via IPC or HTTP until unlocked

### Leave available while locked (setup / unlock)

- Language save (constrained)
- Printer list / preferred printer / test badge (fixture)
- `regfox:connect` (ownership path) — or successor that also establishes session after Principal success
- `cloud:claimPrincipal`, `cloud:redeemJoin`
- `cloud:enrollDesktop` (Advanced/legacy only)
- `cloud:getConfigInfo`, connectivity probes that do not dump attendees
- New `session:getStatus` / lock confirmation APIs
- `settings:initialize`

### Finish / reset

- `settings:completeSetup` — only meaningful after unlock (prefs completion)
- Reopen path — becomes **confirm → clear session → setup UI**, not silent `setupComplete` flip alone

---

## Sprint 22 security invariants (must remain)

- RegFox ownership proof for Principal; key not persisted in Cloud
- Linked cannot self-promote; Linked desk token cannot claim Principal
- One active Principal per event; transfer needs independent RegFox proof + confirmation
- Principal-issued Linked codes; ~15 min; single-use; hash-stored
- ~48 h Linked Cloud authorization; revocable
- Stable opaque installation UUID = identity, not authorization
- No Desktop service-role in production
- Operator enrollment = legacy/support only
- Phone pairing security unchanged

Event session is an **additional** local boundary; it does not replace Cloud desk auth.

---

## “Set up later” recommendation (do not remove in 23.0 code yet)

| Option | Verdict |
|--------|---------|
| Keep on Connect-to-event screen | **Not recommended** — useful event ops require an event; skipping confuses first-run |
| Remove entirely | Acceptable for production organizers |
| **Relocate** | **Recommended:** omit from normal Connect flow; if retained, Advanced/support only (e.g. printer lab without Cloud), clearly labeled as limited |

23.0: recommend only. Implementation decides in 23.1 with product approval.

---

## Anticipated later 23.x / backend changes

**23.0:** documentation only — **no** schema, migrations, or Edge changes.

Likely **optional** later (not required to start local session work):

| Change | Why |
|--------|-----|
| Principal unlock/reactivate Edge or claim flag | Avoid treating quit/relaunch as Principal transfer when same install re-proves RegFox |
| Redacted status DTOs | Safer locked `getSetupStatus` / `getCloudStatus` |
| Boot order in `main.ts` | Defer sync manager + scanner until session unlock |

**Not anticipated as required for core lock model:** new migrations for session tables (sessions must not be durable), changes to join-code TTL, or phone pairing schema.

---

## Edge cases & security notes

| Scenario | Expected |
|----------|----------|
| **Crash** | Next process locked; data intact |
| **Sleep / wake** | Same process → stay unlocked |
| **Window close / reopen (macOS)** | Same process → stay unlocked |
| **Quit / relaunch** | Locked until Principal or Linked unlock |
| **Principal transfer** | Unchanged Sprint 22 Cloud rules; local session established only after successful transfer proof |
| **Linked revoke while app open** | Next Cloud-authenticated call fails (Sprint 22); local session may still show unlocked until next failed op or explicit lock — implementation should surface “connection lost” and may clear session on definitive revoke |
| **Linked 48 h expiry while open** | Same as revoke for Cloud ops; do not silently extend via local session alone |
| **Network loss while unlocked** | Local SQLite ops may continue; Cloud ops fail soft; session remains until quit/lock |
| **Renderer invokes IPC while locked** | Main returns explicit locked/unauthorized error; no attendee payload |
| **Shutdown hook clearing secrets** | **Out of scope / rejected** as primary control |

---

## Recommended Sprint 23 implementation slices

### 23.1 — Main-process EventAccessSession + IPC guards ✅

- In-memory session; fresh process always locked
- Trusted establish on RegFox connect / Principal claim / Linked redeem / legacy enroll
- Event-sensitive IPC denied with `EVENT_ACCESS_LOCKED`
- Sync Manager + scanner deferred until unlock
- Existing Setup Wizard steps unchanged; App shows wizard while locked

### 23.2 — Setup Wizard reconnect flow + Reopen lock confirmation ✅

- Connect to your event (Set up my event / Join existing); no Sync decision / Set up later
- Explicit RegFox re-entry + Principal claim → session `principal`
- Linked join code → session `linked`
- Same-install Principal reactivation via `reactivateDeskToken` (Edge)
- Reopen Setup: confirm → lock session → Connect flow

### 23.3 — Validation / closeout

- Live multi-Mac validation of lock / unlock / reopen
- Confirm Edge `desktop-claim-principal` redeployed
- Docs polish; no Sprint 24 visual work

---

## Explicit non-goals for remaining 23.x vs done

**23.1 done:** session service, IPC guards, boot deferral, trusted establish, tests.

**Still not in 23.1:** Setup Wizard redesign, Reopen confirmation UX, schema/Edge changes, Sprint 24 visual work, clearing RegFox key from safeStorage on quit.
