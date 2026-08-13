# FoxBridge — Self-Service Provisioning & Device Trust Architecture

**Sprint:** 22.0–**22.5** — **COMPLETE / LIVE-VALIDATED** (August 2026)  
**Status:** Principal self-service + Linked Desktops + Connected Desktops + security/UX closeouts  
**Depends on:** Sprint 21 FoxBridge Sync (desk enrollment, Edge Functions, pairing)  
**Related:** [`SYNC_ARCHITECTURE.md`](./SYNC_ARCHITECTURE.md), [`SUPABASE_ARCHITECTURE.md`](./SUPABASE_ARCHITECTURE.md), [`FOXBRIDGE_SYNC_DEPLOYMENT.md`](./FOXBRIDGE_SYNC_DEPLOYMENT.md), [`EVENT_SESSION_ARCHITECTURE.md`](./EVENT_SESSION_ARCHITECTURE.md) (Sprint 23 — local lock / re-auth; does not replace this device-trust model)

**Sprint 23 note:** Cloud Principal / Linked authorization records are **not** the same as the Desktop process-scoped **EventAccessSession**. A valid desk credential must not auto-unlock event UI after quit; see event-session architecture. Same-install Principal relaunch (23.2) may rotate the Principal token on the existing desk row after fresh RegFox proof (`reactivateDeskToken`) without treating relaunch as a transfer. After rotation, Desktop must persist and read-back the **new** raw desk token before Principal-only Cloud ops; UI must not treat EventAccessSession/local status as Principal if the desk credential Cloud accepts is not an active Principal.

**Cross-event isolation:** While unlocked, `EventAccessSession.eventId` is the only authority for Local Event Store / in-memory attendee cache reads. Linked join must activate a FoxBridge Event for the joined Cloud conference, clear prior cache, and hydrate via desk-authenticated `desktop-pull-attendees` for that conference only. Event A local history may remain on disk but must never be returned for Event B.

**Known Cloud RLS debt (flagged, not expanded):** migration `003` `anon_read_attendees` / `anon_read_meal_entitlements` use `USING (true)` (cross-conference readable to anon). Desktop Linked hydration uses service-role Edge + desk conference scope instead. Do not broaden anon further; tighten in a dedicated security sprint.

---

## Sprint 22 FINAL — live validation summary

**Result: PASS** (multi-Mac universal Desktop + hosted Cloud migrations **011–015**).

Validated:

- Principal self-provisioning via RegFox ownership proof; Principal status on Operations Home
- Connected Desktops: issue code, live ~15‑minute countdown, list/revoke Linked
- Linked join on second Mac (dashed + undashed/lowercase); 48‑hour temporary desk; event data correct
- Linked ordinary desk ops allowed; Principal-only controls denied
- Principal revoke → Linked loses Cloud access on next authenticated call; local data intact
- Secure Principal escalation fix re-tested (Linked/revoked cannot silent-claim)
- Rejoin with fresh code reuses stable installation UUID / same logical desk row
- Restart persistence; universal packaging (`dist:mac`) on Intel + Apple Silicon

**Artifacts (not committed):** `release/mac-universal/FoxBridge.app`, `release/FoxBridge-0.1.2-mac-universal.dmg`

**Use `npm run dist:mac` for multi-Mac validation** — `pack:mac` on Apple Silicon is host-arch only and fails on Intel.

---

## Sprint 22.5 closeout (redeem regression)

**Live blocker (post-014):** Linked redeem with `installation_id` failed with Postgres `42702` — `column reference "conference_id" is ambiguous` inside `redeem_desk_join_code`. Cause: `RETURNS TABLE (... conference_id ...)` output variables shadowed `desk_devices.conference_id` in the installation lookup added by migration 013. Desktop always sends `installation_id`, so every redeem hit this path. Join codes remained **unused** (transaction rolled back). Desktop often surfaced this as generic Cloud unavailable when the Edge/RPC error payload was collapsed.

| Fix | Detail |
|-----|--------|
| Migration **015** | Qualify `desk_devices` / `desk_join_codes` columns in redeem (aliases `d` / `c`) |
| Edge `desktop-redeem-join` | Surface ambiguous / details+hint; map to migration-015 diagnostic |
| Sync error mapping | Do not treat deterministic join failures as Cloud unavailable |

**Deploy:** apply **015** (function replace). Redeploy `desktop-redeem-join` for clearer errors. Desktop rebuild optional for error mapping (redeem works after 015 alone).

SQL round-trip script: `scripts/sql/linked_join_roundtrip_regression.sql`.

---

## Sprint 22.5 closeout (audit constraint + UX)

| Fix | Detail |
|-----|--------|
| Migration **014** | Allow `linked_desktop_rejoined` on `desk_device_audit` |
| Sync join UI | Always surface join errors; do not silently redisplay enter_code |
| Operations Home | Refresh Sync status whenever the Sync panel closes |
| Installation ID store | Never throw into the redeem path if disk persist fails |

---

## Sprint 22.5 Linked Desktop UX polish

| Item | Status |
|------|--------|
| Join-code canonicalize (dashed / undashed / case / whitespace) before hash | Implemented (Edge + Desktop) |
| Live join-code countdown from `expires_at` | Implemented (Connected Desktops) |
| Opaque `installation_id` per Desktop install | Implemented (`installation.json` in userData) |
| Revoke/expiry rejoin reactivates same Linked desk row | Implemented (migration **013** + **015** fix) |
| Fresh join code still required; new `token_hash` on rejoin | Preserved |
| Installation ID is identity only (not auth) | Preserved |

**Follow-up:** Linked desks created before 22.5 (no `installation_id`) may still appear as a second row the first time that Mac joins on a 22.5+ build; subsequent revoke/rejoin for that install stay stable.

---

## Sprint 22.4 security closeout (BLOCKER fixed in code — live re-test required)

**Incident:** A revoked Linked Desktop could open “Set up FoxBridge Sync,” silent-claim Principal using a locally stored RegFox API key (e.g. env migration / prior RegFox connect) plus a Linked-copied `regfoxEventId`, and transfer Principal without entering credentials.

**Invariant:** Possession/history of a Linked credential, revoked Linked token, cached conference/event ID, or transfer confirmation alone must **never** authorize Principal. Principal claim/transfer requires **fresh independent** registration-platform ownership proof (RegFox API key + event ID → Cloud `GET /forms/{id}`).

| Fix | Detail |
|-----|--------|
| Desktop claim | Silent reuse of stored RegFox secrets only for **legacy** upgrade; Linked/null require `ownershipRegFoxApiKey` + `ownershipRegFoxEventId` |
| Linked redeem | Does **not** write `regfoxEventId` into local settings; join response never includes RegFox API key |
| Edge `desktop-claim-principal` | Still requires RegFox verify; rejects requests that present a **Linked** desk token |
| Sync UX | Join existing (code) vs Set up my event (RegFox ownership form); operator enrollment code removed from normal Sync UI |
| Operator enroll | Preserved under **Settings → Advanced** only; creates `legacy`, never Principal |

**Follow-up (not blocking):** Linked desks minted before Sprint 22.5 lack `installation_id` and may duplicate once on first post-upgrade rejoin.

**Production-ready:** Sprint 22 device-trust + Linked flows are **live-validated**. Remaining backlog is non-blocking polish only.

---

## Sprint 22.3 implementation status

| Item | Status |
|------|--------|
| Migration `012_linked_desk_join_codes.sql` | Implemented |
| `desk_join_codes` (hashed, single-use, ~15 min) | Implemented |
| Edge `desktop-issue-join-code` (Principal-only) | Implemented |
| Edge `desktop-redeem-join` → `role=linked`, 48 h | Implemented |
| Edge `desktop-list-desks` / `desktop-revoke-desk` | Implemented |
| Linked expiry enforced in `requireDeskDevice` | Implemented (pre-existing + Linked mint) |
| Join existing event UX | Implemented |
| Principal Connected Desktops UI | Implemented |
| Audit: join issued/redeemed, linked created/revoked | Implemented |

---

## Sprint 22.2 implementation status

| Item | Status |
|------|--------|
| Setup Wizard “Set up FoxBridge Sync” Principal claim | Implemented |
| Explicit Principal transfer confirmation | Implemented (`confirmTransfer`) |
| Operations Home Principal / legacy / reconnect labels | Implemented |
| Enrollment-code + Advanced fallback | Preserved |
| Set up later (local-only) | Preserved |
| Linked join codes / Connected Desktops UI | **Landed in 22.3** |

---

## Sprint 22.1 implementation status

| Item | Status |
|------|--------|
| Migration `011_principal_desk_provisioning.sql` | Implemented |
| Canonical `(registration_platform, external_event_id)` + unique index | Implemented (fails migration if duplicate groups exist) |
| `desk_devices.role` (`principal` / `linked` / `legacy`) | Implemented |
| One active Principal unique index | Implemented |
| `provision_principal_desk_device` RPC | Implemented |
| Edge Function `desktop-claim-principal` | Implemented (ephemeral RegFox verify; transfer gated by `confirmTransfer`) |
| Desktop IPC `claimFoxBridgeCloudPrincipal` | Implemented (main-process secrets only) |
| Operator `desktop-enroll` fallback | Preserved; new enrolls get `role=legacy` |
| Linked join codes / Connected Desktops UI | **Landed in 22.3** |

### Legacy device policy (22.1)

- Existing Sprint 21 `desk_devices` rows migrate to **`role = legacy`**.
- Legacy desks keep standard desk ops (publish, pairing, resolve) — same as Principal for those ops.
- Legacy desks **cannot** use Principal-only management (`assertPrincipalRole`) when 22.3 adds join-code APIs.
- Operator enrollment codes continue to work and create **`legacy`** devices (emergency/fallback path).

### Principal claim lifecycle (22.1 / 22.4)

1. Organizer enters RegFox API key + event ID on **Set up my event** (or legacy desk upgrades using stored secrets only when `role=legacy`).  
2. Main process calls `desktop-claim-principal` with platform, event id, API key (HTTPS). **No desk token** is sent.  
3. Edge Function rejects Linked desk tokens if presented; verifies `GET /forms/{id}` independently; clears key from memory.  
4. Find-or-create conference by `(regfox, external_event_id)`; syncs `regfox_event_id`.  
5. If another active Principal exists and `confirmTransfer` is not true → **409** `needsTransferConfirmation` (confirmation is not ownership proof).  
6. After organizer confirms **with the same ownership credentials**, RPC `provision_principal_desk_device` revokes any active Principal, inserts new Principal, writes audit rows.  
7. Raw desk token returned once; stored via existing desk secret fields + `foxbridgeDeskRole=principal`.

### Operator enrollment disposition (Sprint 21, retained)

- SQL `issue_desk_enrollment_code` + Edge `desktop-enroll` remain for support/dev.
- Normal organizer Sync UI no longer exposes “I have an enrollment code.”
- Advanced Settings keeps the enrollment-code form; new enrolls are **`legacy`** and do not grant Principal.

---

## 1. Purpose

Sprint 21 proved Sync works when a FoxBridge operator:

1. Creates a Cloud `conferences` row, and  
2. Issues a one-time desk enrollment code.

That model is secure but **not self-service**. Sprint 22 designs how a new organizer can:

- Connect RegFox on Desktop,  
- Prove control of that registration event to FoxBridge Cloud,  
- Become the **Principal Desktop** for the corresponding FoxBridge Event,  
- Connect without a manually issued enrollment code,  
- Later invite **Linked Desktops** with short-lived join codes,

…without exposing service-role keys, weakening RLS, or treating Desktop-only assertions as proof of ownership.

**Implementation status:** 22.1 backend + 22.2 Principal Setup UX are implemented. Linked Desktop join codes / Connected Desktops UI remain Sprint 22.3+.

---

## 2. Current state (Sprint 21 facts)

### 2.1 RegFox access proof (Desktop today)

| Item | Fact |
|------|------|
| Storage | RegFox API key in Electron `safeStorage` secrets (`regfoxApiKey`); page/event ID in public settings (`regfoxEventId`) |
| Proof call | `GET https://api.webconnex.com/v2/public/forms/{eventId}` with header `apiKey: <key>` |
| Success | HTTP OK on that form fetch (`RegFoxService.testConnection`) |
| Attendee load | `GET /search/registrants?product=regfox.com&formId={eventId}&…` |
| Error distinction | HTTP **401** ≈ bad/missing key; **404** ≈ form/event not found for that credential context; messages are free-text, not typed codes |
| Cloud involvement | **None.** No Edge Function calls RegFox today |

Citations: `src/integrations/regfox/RegFoxService.ts`, `electron/settings/settingsService.ts` (`connectRegFox`), `electron/settings/secretStore.ts`.

### 2.2 Why “Desktop connected successfully” is not enough for Cloud

A malicious or modified Desktop could claim any `regfoxEventId` and ask Cloud to create a conference **without** ever holding a valid RegFox key for that event. Cloud must **independently** verify registration-platform control before creating or claiming an Event and minting Principal credentials.

### 2.3 Desk devices today

| Item | Fact |
|------|------|
| Table | `desk_devices` — `token_hash`, `conference_id`, optional `expires_at` / `revoked_at` |
| Enrollment | Operator SQL `issue_desk_enrollment_code` → Edge `desktop-enroll` |
| Roles | **None** — every desk token is equal |
| Default lifetime | Enroll leaves `expires_at` null (long-lived until revoke) |
| Ops | publish, resolve conference, create/status pairing, ensure scanner session |

### 2.4 Conference identity today

| Item | Fact |
|------|------|
| Column | `conferences.regfox_event_id` (text, nullable) |
| Uniqueness | **No UNIQUE constraint** — duplicates are schema-legal |
| Desk path | Does **not** create conferences; binds to enrolled `conference_id` |
| Legacy path | Service-role client may insert conference by `regfox_event_id` |

### 2.5 Phone scanners

Separate trust plane: pairing token → `scanner_sessions` → meal validate / reads. **Cannot** call desk Edge Functions. Unchanged by Sprint 22 design intent.

---

## 3. Product trust hierarchy

```text
Principal Desktop
    │  proves registration-platform control of the event
    │  long-lived event-scoped desk credential (Principal)
    │
    ├── issues short-lived join codes
    │
    └── Linked Desktop(s)
            │  redeem join code → 48-hour Linked credential
            │  cannot become Principal via Linked credential alone
            │
Phone Scanner
    separate, limited trust (Sprint 21 pairing)
    never inherits Desktop / Principal authority
```

| Level | How established | Credential | Must not |
|-------|-----------------|------------|----------|
| **Principal** | Cloud-verified registration ownership | Principal desk device token | Be granted solely from Linked token |
| **Linked** | Principal-issued join code | Linked desk device token (48h) | Issue Principal promotion; outlive policy without renew |
| **Scanner** | Principal/Linked phone pairing | Scanner session | Call desk ops; publish attendees; mint desk tokens |

---

## 4. Registration ownership verification (RegFox first)

### 4.1 Recommended pattern: ephemeral server-side verify

**Recommended for Sprint 22.1+:** a trusted Edge Function (working name: `desktop-claim-principal`) that:

1. Accepts **over TLS only**: `{ registrationPlatform: 'regfox', externalEventId, apiKey, deviceLabel? }` from a packaged Desktop with public Cloud config (anon/publishable key to invoke the function — same pattern as `desktop-enroll` today).  
2. **In memory**, calls RegFox `GET /forms/{externalEventId}` with the supplied `apiKey`.  
3. On HTTP OK: treat ownership as proven for that `(platform, externalEventId)`.  
4. **Never writes** the RegFox API key to Postgres, logs, or storage.  
5. Discards the key when the request ends.  
6. Idempotently creates or claims the FoxBridge Event (see §7).  
7. Mints a **Principal** desk device credential (hash stored; raw token returned once).  
8. Returns `{ deskToken, deskDeviceId, conferenceId, conferenceName, … }` — same local storage path as Sprint 21 desk secrets.

Desktop continues to keep the RegFox key **only** in local `safeStorage` for ongoing RegFox sync/check-in.

### 4.2 Must the RegFox API key reach FoxBridge Cloud?

| Option | Verdict |
|--------|---------|
| Cloud trusts Desktop “I connected” | **Rejected** — forgeable |
| RegFox OAuth / signed assertion for organizers | **Not available** in current FoxBridge RegFox integration |
| Ephemeral transmit to Edge Function for one verify call | **Recommended** — necessary for independent proof with current RegFox API |
| Persist RegFox key in FoxBridge Cloud | **Forbidden** unless a future product requirement is explicitly accepted (not proposed) |

**Answer:** Yes, the key must **transiently** reach a FoxBridge Cloud Edge Function for verification. It must **not** be stored. Mitigations: TLS, no logging of headers/body secrets, memory-only use, minimal retention (request lifetime), rate limits, anomaly alerts on claim attempts.

### 4.3 Future registration-platform adapters

Conceptual interface (not implemented):

```text
OwnershipVerifier.verify({
  platform: 'regfox' | 'future_platform',
  externalEventId: string,
  proof: platform-specific secret or token  // never persisted by FoxBridge Cloud
}) → { ok: true, displayName?: string } | { ok: false, reason }
```

RegFox proof = API key + successful `GET /forms/{id}`.  
Future platforms may use OAuth tokens, signed JWTs, or webhooks — Cloud still must verify **server-side**.

---

## 5. Principal Desktop trust model

| Aspect | Proposal |
|--------|----------|
| **Establishment** | Successful Cloud ownership verify (§4) for `(platform, externalEventId)` |
| **Credential** | Extend Sprint 21 `desk_devices` with role `principal` (schema in 22.1 — not in 22.0) |
| **Lifetime** | Event-scoped (`conference_id`); one logical Principal per Event (see §8 for transfer) |
| **Lifetime** | Long-lived (`expires_at` null) **or** long TTL with renewal via re-verify — product default: long-lived + revocable |
| **Local storage** | Existing `foxbridgeDeskToken` / deviceId / conferenceId / `foxbridgeDeskRole` in `safeStorage` |
| **Revocation** | Set `revoked_at`; optional “replace Principal” flow (§8) |
| **Allowed ops** | All Sprint 21 desk ops **plus** issue Linked join codes, list/revoke Linked devices, initiate Principal transfer after re-verify |

---

## 6. Linked Desktop trust model

| Aspect | Proposal |
|--------|----------|
| **Join code** | Short-lived, single-use code (reuse `desk_enrollment_codes` pattern or dedicated `desk_join_codes`) |
| **Who issues** | **Principal only** (Edge Function checks `role = principal` and not revoked/expired) |
| **Join code TTL** | **10–15 minutes** (recommend **15** as default; clamp e.g. 5–30) |
| **Redemption** | Edge Function (e.g. extend `desktop-enroll` or `desktop-redeem-join`) → creates `desk_devices` with `role = linked`, `expires_at = now() + 48 hours` |
| **Linked credential TTL** | **48 hours** hard expiry (`expires_at` already enforced by `requireDeskDevice`) |
| **Renewal** | Must obtain a **new** join code from Principal after expiry; Linked token alone cannot mint Principal or extend itself indefinitely |
| **Allowed ops** | Sprint 21 desk ops for the bound event: publish, pairing create/status, resolve conference, meal-related desk helpers as today |
| **Forbidden** | Issue join codes; revoke Principal; claim Principal; change Event identity; elevate self |
| **Revocation** | Principal (or re-verified Principal) sets Linked `revoked_at` |
| **Visibility** | Principal UI may list Linked devices (`id`, `label`, `created_at`, `expires_at`, `last_used_at`, `revoked_at`) — no raw tokens |

A Linked Desktop **must not** automatically become Principal.

---

## 7. Event identity & idempotency

### 7.1 External identity

Canonical external key:

```text
(registration_platform, external_event_id)
Example: ('regfox', '1012457')
```

Maps to **exactly one** FoxBridge Cloud Event (`conferences.id` today / FoxBridge Event id alignment with Sprint 21.3).

### 7.2 Required schema direction (22.1+)

- Add uniqueness: **UNIQUE (`registration_platform`, `external_event_id`)** (or UNIQUE(`regfox_event_id`) as interim if platform column deferred — prefer explicit platform column).  
- Claim/create path: `INSERT … ON CONFLICT DO UPDATE` / select-for-update so concurrent Principal claims cannot create duplicates.

### 7.3 Today’s gap

`conferences.regfox_event_id` has **no UNIQUE constraint**. Sprint 22.1 must fix this before self-service create/claim is safe.

---

## 8. Principal recovery / replacement

| Scenario | Behavior |
|----------|----------|
| Principal machine lost | Organizer runs claim/verify again from a new Desktop with RegFox key + event ID. Cloud detects Event already has Principal → returns `needsTransferConfirmation`; after **explicit organizer confirmation**, transfer: revoke prior Principal device(s), mint new Principal. |
| Principal machine replaced | Same as lost (re-verify ownership). |
| Two organizers independently prove control | Both share a valid RegFox key (common). **Last successful transfer wins** after revoke of previous Principal; Linked devices may remain until Principal revokes or they expire. Document as operational risk; optional future: require second factor. |
| Attacker claims already-provisioned Event | Must present valid RegFox proof for that event. If they steal the RegFox API key, they can transfer Principal — **same class of risk as losing RegFox console access**. Mitigation: RegFox key rotation + Principal transfer audit log. |
| RegFox API credentials rotated | New key still proves `GET /forms/{id}`. Old Desktop keeps working for RegFox locally once updated; Cloud Principal token unchanged until revoke/transfer. |
| Possession of Linked token only | **Cannot** become Principal. Must re-prove registration ownership. |

**Rule:** Linked credential ⊆ event ops; Principal authority ⊆ ownership proof.

---

## 9. Permission matrix

| Capability | Principal | Linked | Scanner |
|------------|:---------:|:------:|:-------:|
| Prove RegFox / claim Event | ✓ | ✗ | ✗ |
| Publish attendees / entitlements | ✓ | ✗ (Principal-only snapshot) | ✗ |
| Create phone pairing tokens | ✓ | ✓ | ✗ |
| Poll pairing status | ✓ | ✓ | ✗ |
| Redeem pairing → scanner session | ✗ | ✗ | ✓ (via mobile RPC) |
| Validate meals | ✗* | ✗* | ✓ |
| Issue Linked join codes | ✓ | ✗ | ✗ |
| List / revoke Linked devices | ✓ | ✗ | ✗ |
| Transfer / replace Principal | ✓ (via re-verify) | ✗ | ✗ |
| Call desk Edge Functions | ✓ | ✓ (while valid) | ✗ |
| Read Cloud via anon RLS | ✓ | ✓ | ✓ (limited) |
| Operational attendee snapshot (v1) | Publish | Pull / reconstruct | ✗ |

\*Desktop meal validation remains a local/desktop product feature, not a Cloud desk privilege.

**Sprint 23 FINAL — live-validated.** Linked Desktop = full **operational** workstation including Cloud-first check-in write. Upstream registration check-in reconciliation is Principal-only (never Linked). Principal never Cloud-replaces rich RegFox attendees. See [`CHECK_IN_ARCHITECTURE.md`](./CHECK_IN_ARCHITECTURE.md) + [`EVENT_SESSION_ARCHITECTURE.md`](./EVENT_SESSION_ARCHITECTURE.md).

---

## 10. Reuse of Sprint 21 infrastructure

| Asset | Reuse |
|-------|--------|
| `desk_devices` + hash tokens | **Extend** with `role`, enforce `expires_at` for Linked |
| `requireDeskDevice` / `deskAuth.ts` | **Extend** with role checks for privileged management ops |
| `desk_enrollment_codes` / issue+redeem pattern | **Reuse** for Linked join codes (or clone table with `issued_by_device_id`) |
| `desktop-enroll` | Keep for operator fallback; add Principal-claim + join-redeem functions |
| `desktop-publish`, pairing functions | Unchanged authorization except role-gated management |
| Local `safeStorage` desk secrets | Unchanged primary store |
| Phone pairing | **Unchanged** separate plane |
| Operator SQL enrollment | Remains emergency / migration path |

**Prefer extending Sprint 21 over replacing it.**

### 10.1 Can today’s `desk_devices` represent Principal vs Linked safely?

**Not without schema (or equivalent metadata) changes.** Today all devices are equal and enrollments are non-expiring by default. Sprint 22.0 does **not** change schema; Sprint 22.1 should add at least:

- `role text NOT NULL DEFAULT 'legacy'` check in (`principal`,`linked`,`legacy`)  
- Linked mint always sets `expires_at`  
- Unique partial index: at most one non-revoked Principal per `conference_id` (or explicit transfer that revokes the old one first)

---

## 11. Security non-negotiables

Do **not**:

- Ship or expose service-role to organizers  
- Weaken anon RLS to “fix” provisioning  
- Trust Desktop-supplied event IDs without Cloud verification  
- Allow Linked tokens to mint Principal  
- Persist registration-platform API keys in FoxBridge Cloud  

If RegFox ever removes API-key form access without a replacement proof mechanism, **stop and report a blocker** rather than weakening the model.

---

## 12. Unresolved / accepted risks

| Topic | Notes |
|-------|--------|
| Shared RegFox API keys | Multiple staff with the same key can transfer Principal; treat as org operational control |
| No RegFox OAuth | Ephemeral key to Edge Function is the available proof |
| Audit logging | 22.1 should log claim/transfer/join/revoke **without** secrets |
| Dual Principal race | Need transactional revoke+insert |
| `regfox_event_id` uniqueness | Must be fixed before self-service create |
| Legacy desk devices | Migrate existing tokens to `role=legacy` or `principal` by policy when enabling 22.x |

**No fundamental blocker** prevents designing Sprint 22.1 around ephemeral RegFox verify + extended desk roles — provided uniqueness and role checks ship with implementation.

---

## 13. Recommended Sprint 22.1 implementation scope

**In scope (first slice):**

1. Schema: platform + external id uniqueness; `desk_devices.role`; Principal uniqueness; join-code issuer metadata (or table).  
2. Edge Function: `desktop-claim-principal` (ephemeral RegFox verify, create/claim Event, mint Principal).  
3. Edge Function: Principal `desktop-issue-join-code` + redeem path minting Linked (15 min code / 48h device).  
4. Desktop UX: after RegFox connect, offer “Connect FoxBridge Sync” via claim (no operator code); Principal “Invite another computer”; Linked redeem UI.  
5. Preserve Sprint 21 operator enrollment as fallback.  
6. Tests: uniqueness, role matrix, ephemeral key not logged, Linked cannot claim Principal.  
7. Docs: update deployment runbook; deprecate “must SQL-issue first code” for ordinary organizers.

**Out of scope for 22.1:**

- Multi-platform verifiers beyond RegFox  
- Changing phone pairing  
- Full device-management console polish  
- Weakening Linked to permanent credentials  

---

## 14. Sprint 22.0 deliverable status

| Deliverable | Status |
|-------------|--------|
| Investigation of RegFox proof | Done (§2, §4) |
| Principal / Linked / Scanner model | Done (§3–§6, §9) |
| Recovery / identity / reuse | Done (§7–§8, §10) |
| Schema/API changes listed for 22.1 | Done (§10–§13) |
| Implementation | **Not started** (by design) |
