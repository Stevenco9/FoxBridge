# FoxBridge Sync — Production Deployment & Validation

**Sprint 21.9 runbook; updated through Sprint 23 (migrations through 019).** Maintainer/operator checklist for preparing FoxBridge Cloud and validating Sync end-to-end on a clean, production-style Desktop install.

Organizers running the event do **not** need this document. They use Setup Wizard → Connect to your event + Operations Home.

This is **not** an automatic deploy. Run the commands below against your Cloud project manually.

**Sprint 23 CLOSED — live-validated:** EventAccessSession, Linked operational parity, Cloud-first check-in, Principal upstream reconciliation (RegFox adapter #1), durable retry, audit/health. See [`CHECK_IN_ARCHITECTURE.md`](./CHECK_IN_ARCHITECTURE.md).

---

## Status legend (Sprint 21.9 audit)

| Status | Meaning |
|--------|---------|
| **PASS** | Repo design + code path verified; ready when Cloud/package steps below are completed |
| **NEEDS MANUAL VALIDATION** | Correct in code; must be proven against a real deployed Cloud + packaged Desktop/Mobile |
| **BLOCKED** | Cannot complete until listed operator/packaging work is done |

**Sprint 21.10 update:** Clean-install checklist §3 (A–O) **PASS** against production Cloud + packaged Desktop + hosted Scanner (`https://fox-bridge.vercel.app`). After restart: event/attendees available, FoxBridge Sync remained Connected without re-enrollment, phone meal validation remained visible in Meal Dashboard. No local service-role key. Sprint 21 Sync feature/enablement track is **closed**; remaining items are security/offline backlog.

---

## Preconditions

- Access to the FoxBridge Cloud (Supabase) project as an operator (`service_role` SQL / Edge deploy).
- Ability to build Desktop and Mobile with public packaging variables (CI or local packaging machine).
- A RegFox event suitable for clean-install testing.

---

## 1. Backend deployment checklist (exact order)

**Sprint 22 FINAL (live-validated):** Principal self-service + Linked Desktops + Connected Desktops. Apply migrations **011–015**. Prefer Principal claim / Join existing event for organizers; operator enrollment is Advanced/support only.

**Sprint 22.5 update:** Migrations **013–015** (installation identity, rejoined audit, ambiguous `conference_id` fix). Redeploy `desktop-redeem-join`. Use **`npm run dist:mac`** (universal) for multi-Mac validation — not `pack:mac` (host-arch only).

Complete these **before** issuing enrollment codes to organizers (or before relying on Principal claim / Linked join).

### 1.1 Apply SQL migrations (001 → 019)

Apply every file in `supabase/migrations/` in numeric order, including:

| Migration | Required for |
|-----------|----------------|
| `001`–`004` | conferences, attendees, entitlements, meal validations, `validate_meal` |
| `005` + `008` | scanner pairing tokens + hosted-safe `exchange_scanner_pairing_token` |
| `007` | `validate_meal` PL/pgSQL ambiguity fix |
| `009` | `desk_devices`, `desk_enrollment_codes`, enrollment tables |
| **`010`** | **hosted-safe `issue_desk_enrollment_code` (`search_path = public, extensions`)** |
| **`011`** | Principal roles + canonical event identity + `provision_principal_desk_device` (Sprint 22.1) |
| **`012`** | Linked join codes + revoke RPC + Linked audit actions (Sprint 22.3) |
| **`013`** | Linked `installation_id` + rejoin reactivation (Sprint 22.5) |
| **`014`** | `linked_desktop_rejoined` audit action fix |
| **`015`** | Redeem join ambiguous `conference_id` fix |
| **`016`** | Operational attendee snapshot columns (Sprint 23.4a) |
| **`017`** | Operational multi-desk check-in table (Sprint 23.5a) |
| **`018`** | Durable upstream retry metadata (Sprint 23.5b1) |
| **`019`** | Check-in / upstream audit table (Sprint 23.5b2) |

**Migration 010 is required** for operator enrollment-code issuance on hosted Supabase.  
**Migration 011 is required** before deploying `desktop-claim-principal`. If duplicate `(registration_platform, external_event_id)` groups exist, 011 raises an error — resolve duplicates manually (do not auto-merge).  
**Migrations 012–015 are required** for Linked join / Connected Desktops / stable rejoin.  
**Migrations 016–019 are required** for Sprint 23 operational snapshot, Cloud check-in, upstream retry, and audit.

CLI (if the project is linked):

```bash
# From repository root — deploys pending migrations to the linked remote project.
npx supabase db push
```

Or paste each migration into the Supabase SQL editor in order.

Optional but recommended for production: do **not** rely on `006_organizer_test_scanner.sql` in production (dev helper for temporary organizer test scanners).

### 1.2 Deploy all Sprint 21.6 Edge Functions

Deploy these functions (service role stays in Cloud function secrets only):

| Function | Role |
|----------|------|
| `desktop-enroll` | Exchange one-time enrollment code → desk credential (`legacy` role after 011) |
| `desktop-claim-principal` | Self-service Principal claim via ephemeral RegFox verify (Sprint 22.1). Sprint **23.2:** same-install reactivation via `reactivateDeskToken` after RegFox proof. **Redeploy** after verified-rotate fix (must `.select` updated Principal row; do not return a rotated raw token unless `token_hash` changed). |
| `desktop-issue-join-code` | Principal issues Linked connection code (~15 min) (Sprint 22.3) |
| `desktop-redeem-join` | Redeem join code → Linked desk (48 h) |
| `desktop-list-desks` | Principal lists desks (safe metadata only) |
| `desktop-revoke-desk` | Principal revokes a Linked desk |
| `desktop-resolve-conference` | Desk status / conference resolve (**read-only** conference identity — do not rewrite `regfox_event_id` from Desktop settings) |
| `desktop-publish` | Publish attendees + meal entitlements (**Principal-only**; conference-scoped snapshot replace; operational snapshot v1 — migration **016**) |
| `desktop-pull-attendees` | Desk-authenticated **paginated** pull of Principal-published **operational** attendees + entitlements (Linked hydration + Sync Manager `attendee_snapshot`) |
| `desktop-check-in` | Sprint **23.5a** — desk-auth operational check-in write (Principal + Linked); no RegFox |
| `desktop-pull-check-ins` | Sprint **23.5a** — incremental operational check-in pull for Sync |
| `desktop-pull-pending-check-ins` | Sprint **23.5b1** — Principal-only eligible upstream reconciliation pull |
| `desktop-update-check-in-upstream-status` | Sprint **23.5b1** — Principal-only upstream status writeback |
| `desktop-upstream-check-in-health` | Sprint **23.5b2** — Principal-only upstream health counts (no PII) |
| `desktop-create-pairing` | Create pairing token (hash stored) |
| `desktop-pairing-status` | Poll whether phone redeemed pairing |
| `desktop-ensure-scanner-session` | Legacy/fallback scanner session ensure |

```bash
npx supabase functions deploy desktop-enroll
npx supabase functions deploy desktop-claim-principal
npx supabase functions deploy desktop-issue-join-code
npx supabase functions deploy desktop-redeem-join
npx supabase functions deploy desktop-list-desks
npx supabase functions deploy desktop-revoke-desk
npx supabase functions deploy desktop-resolve-conference
npx supabase functions deploy desktop-publish
npx supabase functions deploy desktop-pull-attendees
npx supabase functions deploy desktop-check-in
npx supabase functions deploy desktop-pull-check-ins
npx supabase functions deploy desktop-pull-pending-check-ins
npx supabase functions deploy desktop-update-check-in-upstream-status
npx supabase functions deploy desktop-upstream-check-in-health
npx supabase functions deploy desktop-create-pairing
npx supabase functions deploy desktop-pairing-status
npx supabase functions deploy desktop-ensure-scanner-session
```

Confirm each function has access to `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` via the platform’s Edge secret environment (default on hosted Supabase).

### 1.3 Bootstrap the conference row

Desk Path never invents a Cloud conference for organizers. Create one conference per event (SQL as service_role):

```sql
INSERT INTO conferences (name)
VALUES ('Your Event Name')
RETURNING id, name;
```

Record the returned `id` (UUID).

### 1.4 Issue a one-time enrollment code

Requires migrations **009 + 010**:

```sql
SELECT * FROM issue_desk_enrollment_code(
  '<conference_uuid>'::uuid,
  60,                 -- TTL minutes (clamped 5..1440)
  'Registration desk 1'
);
```

Give the organizer only the **`raw_code`** value (for example `ABCD-EFGH-IJKL`). Do not share service-role keys, URLs, or desk tokens with organizers.

Smoke-check: if this RPC errors on `digest`, migration **010** was not applied.

### 1.5 Confirm pairing + meal RPCs

As a quick schema smoke (optional):

```sql
-- Should exist and be executable by anon (mobile will call it):
SELECT proname FROM pg_proc WHERE proname IN (
  'exchange_scanner_pairing_token',
  'validate_meal',
  'issue_desk_enrollment_code'
);
```

---

## 2. Production build-time variables

### 2.1 Desktop packaging (non-secret)

Inject at packaging/CI time so a clean install has Cloud without Advanced paste:

| Variable | Purpose |
|----------|---------|
| `FOXBRIDGE_CLOUD_URL` | FoxBridge Cloud endpoint URL |
| `FOXBRIDGE_CLOUD_PUBLISHABLE_KEY` | Publishable/anon client key (preferred) |
| `FOXBRIDGE_CLOUD_ANON_KEY` | Alias for publishable key |
| `FOXBRIDGE_SCANNER_URL` | HTTPS origin for phone pairing QR (preferred) |
| `MOBILE_APP_URL` | Alias for scanner HTTPS origin |

Vite bakes these into the Electron main process via `vite.config.ts` → `electron/config/appDefaults.ts`.

**Do not set** `SUPABASE_SERVICE_ROLE_KEY` (or any secret/service-role) for packaging. It must not appear in installers.

Example local packaging:

```bash
export FOXBRIDGE_CLOUD_URL='https://YOUR_PROJECT.supabase.co'
export FOXBRIDGE_CLOUD_PUBLISHABLE_KEY='YOUR_ANON_OR_PUBLISHABLE_KEY'
export FOXBRIDGE_SCANNER_URL='https://scanner.your-conference.example.com'
npm run dist:mac   # or dist:win / pack:mac
```

GitHub Actions `build-windows.yml` currently builds **without** injecting `FOXBRIDGE_CLOUD_*`. For a production Windows artifact that works offline-of-Advanced, add repository secrets/vars and pass them into the `dist:win` step before relying on that workflow for Sync-ready installers.

### 2.2 Mobile / Scanner PWA (non-secret)

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Same Cloud project URL |
| `VITE_SUPABASE_ANON_KEY` | Same publishable/anon key |

```bash
cd apps/mobile
# configure .env (never commit secrets; anon key is public-by-design under RLS)
npm run build
# Host the build at the HTTPS origin configured as FOXBRIDGE_SCANNER_URL
```

QR codes do **not** carry Cloud URL/keys. The hosted Scanner build must already know the project.

### 2.3 Explicit non-requirements for production bundles

| Artifact | Must NOT require |
|----------|------------------|
| Desktop installer | service-role, secret key, privileged DB credentials, root `.env` |
| Mobile/Scanner build | service-role / secret key |

Desk device tokens are created **after** enrollment and stored only in that machine’s Electron `userData` secrets — they are not packaging inputs.

---

## 3. Clean-install validation checklist (manual)

Use a machine with **no prior FoxBridge userData** (or delete userData after quitting the app). Test the **installed** build packaged with section 2 variables — not only `npm run dev`.

| Step | Action | Expected |
|------|--------|----------|
| A | Install FoxBridge (DMG/EXE) | App launches; Setup Wizard on first run |
| B | Connect RegFox (API key + page ID) | Attendees load |
| C | Event selected/active | Conference name / attendees visible |
| D | Reach FoxBridge Sync step | Wizard shows Sync after RegFox |
| E | Enter one-time enrollment code from §1.4 | Connecting… |
| F | Confirm Connected | ✓ Connected + Next (no Supabase jargon) |
| G | Publish / refresh registrations | Attendees available to Cloud (desk publish) |
| H | Operations Home → Connect a phone | Pairing UI opens |
| I | Generate pairing QR | HTTPS `/pair?token=…` only |
| J | Scan QR with phone Camera app | Opens Scanner site |
| K | Phone reaches Ready to Scan | Pairing redeemed; Desktop shows connected |
| L | Validate a real/test meal on phone | Success on device |
| M | Confirm validation in Cloud | Row in `meal_validations` for that conference |
| N | Desktop Sync pull | Validation appears in local SQLite (initial sync and/or ≤5 min interval) |
| O | Restart Desktop | Event data + Sync Connected enrollment survive |

SQLite spot-check (macOS example):

```bash
sqlite3 ~/Library/Application\ Support/foxbridge/foxbridge.db \
  "SELECT attendee_id, meal_key, meal_label, validated_at, source FROM meal_validations ORDER BY validated_at DESC LIMIT 10;"
```

---

## 4. Failure / recovery validation (manual)

| Case | How to provoke | Expected |
|------|----------------|----------|
| Expired enrollment code | Issue code with short TTL; wait; enroll | Organizer-safe expired-code message; can enter a new code |
| Invalid enrollment code | Typo / random code | Invalid-code message; no credential stored |
| Revoked desk token | Operator sets `desk_devices.revoked_at` | Sync needs reconnect; re-enroll with new code |
| Cloud temporarily offline | Disconnect network during status/publish | Desktop local ops still work; Sync reconnects when online |
| Pairing token expires | Wait out QR TTL | Desktop auto-renews / Create a new code |
| Desktop restart | Quit + reopen after enroll | Still Connected; local event store intact |
| Phone reconnects | Re-pair or reopen Scanner session | Can scan again within session rules |
| Sync interval with no network | Offline through 5-minute tick | Soft skip/fail; no crash; retries later |
| Duplicate meal scan | Validate same meal twice on phone | First write wins; second rejected/already validated; Desktop pull skips existing |

---

## 5. Automated verification vs manual validation

### Automated (repo)

```bash
npm run test:sync-deployment-readiness
npm run test:foxbridge-sync-status
npm run test:desk-credential
npm run test:pairing
npm run test:cloud-config
npm run test:sync-manager
npm run test:desktop-sync
```

These assert migrations/functions packaging policy, status helpers, transport preference, pairing URL shape, config resolution, and sync manager scheduling — **not** a live Supabase project.

### Manual (still required)

Everything in §3 and §4 against a real Cloud project + packaged Desktop + hosted Scanner.

---

## 6. Component readiness (audit)

| Component | Status | Notes |
|-----------|--------|-------|
| Packaged Desktop public Cloud config | **NEEDS MANUAL VALIDATION** | Code path PASS; requires non-empty `FOXBRIDGE_CLOUD_*` at build |
| Organizer desk enrollment UX | **PASS** (code) / **NEEDS MANUAL VALIDATION** (live) | Wizard + Operations Home share enroll logic |
| Migration 009+010 enrollment issuance | **PASS** (repo) / **NEEDS MANUAL VALIDATION** (apply 010 remotely) | 010 fixes hosted `digest` resolution |
| Edge Functions (`desktop-*`) | **PASS** (repo) / **NEEDS MANUAL VALIDATION** (deploy) | Must be deployed after 009 |
| Attendee publish via desk | **PASS** (code) / **NEEDS MANUAL VALIDATION** | `desktop-publish` |
| Pairing QR (HTTPS token only) | **PASS** (code) / **NEEDS MANUAL VALIDATION** | Needs packaged/hosted scanner URL |
| Mobile Scanner Ready to Scan | **PASS** (code) / **NEEDS MANUAL VALIDATION** | Needs matching `VITE_SUPABASE_*` build |
| Meal validation → Cloud | **PASS** (code) / **NEEDS MANUAL VALIDATION** | `validate_meal` RPC |
| Desktop Sync Manager → SQLite | **PASS** (code) / **NEEDS MANUAL VALIDATION** | Anon pull; first-write-wins |
| Production without local service-role | **PASS** (design) | Desk credential + Edge; legacy Advanced only for migration/dev |
| Conference bootstrap / code issuance | **NEEDS MANUAL VALIDATION** | Operator SQL; not in organizer UI |
| Tight anon RLS | Future backlog | Broad `USING (true)` reads remain; not a Sync enablement blocker |
| Phone offline outbox | Future backlog | Online validation assumed |

No Sync architecture redesign was required for this sprint beyond migration **010**.

---

## 7. Operator commands still required (not automated by this repo)

1. `npx supabase db push` (or SQL editor apply **001–019** in order).
2. Deploy all required `desktop-*` Edge Functions (see §1.2 inventory, including Sprint 23 check-in/upstream).
3. Insert `conferences` row; run Principal claim / join / enrollment as appropriate.
4. Package Desktop with `FOXBRIDGE_CLOUD_*` + `FOXBRIDGE_SCANNER_URL`.
5. Build & host Mobile Scanner with `VITE_SUPABASE_*` at that HTTPS origin.
6. Run clean-install checklist §3 and failure cases §4.

---

## 8. Sprint 21 close recommendation

**Closed after Sprint 21.10 live clean-install A–O PASS.**

Keep as separate backlog (not Sync enablement blockers):

- Tighten anon RLS (conference-scoped SELECT policies)
- Phone offline cache + validation outbox
- Optional CI injection of `FOXBRIDGE_CLOUD_*` for Windows packaging artifacts
