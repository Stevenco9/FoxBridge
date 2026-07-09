# FoxBridge — Supabase Architecture (Planning)

**Status:** Design only — not implemented  
**Last updated:** July 2026  
**Audience:** Developers continuing FoxBridge after desktop MVP

This document describes the planned **Supabase-backed mobile meal scanner** system. It does **not** replace the current desktop SQLite workflow. FoxBridge Desktop remains the reliable registration-day tool; Supabase enables mobile scanning from anywhere on the event network (or offline with later sync).

Related docs: [`PROJECT_STATE.md`](./PROJECT_STATE.md), [`PRODUCT_DECISIONS.md`](./PRODUCT_DECISIONS.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md)

---

## 1. Why Supabase

FoxBridge needs a shared, online store that mobile scanners can reach without depending on the desktop machine's LAN IP or uptime. Supabase is a good fit for this phase because:

| Need | How Supabase helps |
|------|-------------------|
| **Shared cloud database** | Postgres with real-time subscriptions for optional live updates |
| **Mobile-friendly API** | Auto-generated REST and client SDKs; works from mobile browsers |
| **Auth when ready** | Built-in auth + Row Level Security (RLS) for conference-scoped access |
| **Fast MVP path** | Managed Postgres, no custom backend to deploy for first mobile release |
| **Offline later** | Client SDK + local IndexedDB/SQLite patterns pair well with queued sync |
| **Low ops burden** | Small conference teams should not run their own sync server |

**Why not only the desktop local scanner server?**

The localhost/LAN HTTP server in Electron is useful for same-room testing and optional fallback, but it requires phones to reach the desktop machine, does not survive desktop sleep/restart gracefully, and has no built-in multi-device sync story. Supabase is the **durable hub**; desktop remains the **authoritative sync agent** from RegFox.

**Why not replace desktop SQLite with Supabase immediately?**

Registration day must work if Wi‑Fi or Supabase is down. Desktop SQLite is local, fast, and already proven for meal validation. Cloud sync is additive—not a replacement—for AdAgrA and early events.

---

## 2. High-level architecture

```
┌─────────────────┐
│     RegFox      │  Source of truth for registration data
│  (Webconnex v2) │
└────────┬────────┘
         │ API key (desktop only)
         ▼
┌─────────────────────────────────────────────────────────────┐
│                   FoxBridge Desktop                          │
│  Electron + React                                            │
│  • Download & map attendees                                  │
│  • Badge print, check-in, meal validation (primary UI)       │
│  • Sanitize + upload entitlements to Supabase                │
│  • Optional: pull validations down from Supabase             │
└────────┬───────────────────────────────┬────────────────────┘
         │                               │
         │ read/write                    │ service role / sync
         ▼                               ▼
┌─────────────────┐              ┌─────────────────┐
│  SQLite (local) │              │    Supabase     │
│  foxbridge.db   │              │    (Postgres)   │
│  meal_validations│             │  conferences    │
│  (+ future cache)│             │  attendees      │
└─────────────────┘              │  meal_entitlements│
                                 │  meal_validations │
                                 │  scanner_sessions │
                                 └────────┬──────────┘
                                          │ anon / scanner JWT + RLS
                                          ▼
                                 ┌─────────────────┐
                                 │ Mobile web       │
                                 │ scanner (PWA)    │
                                 │ • QR scan        │
                                 │ • validate meals │
                                 │ • offline queue  │
                                 └─────────────────┘
```

### Component roles

| Component | Role |
|-----------|------|
| **RegFox** | Authoritative registration, purchases, custom fields |
| **FoxBridge Desktop** | RegFox sync, badge printing, primary meal validation, Supabase upload/download |
| **SQLite** | Local operational DB; works offline on registration day |
| **Supabase** | Shared conference data + mobile validation writes |
| **Mobile web scanner** | Roaming meal lines; reads entitlements, writes validations |

### What stays on desktop only

- RegFox API key
- Full attendee PII export (email, phone) — only **sanitized** fields go to Supabase
- Badge printing and Brother printer integration
- Primary “source of truth” UI when staff are at the desk

---

## 3. Recommended data flow

### 3.1 Desktop sync from RegFox (unchanged)

1. Desktop calls RegFox `/search/registrants` (paginated).
2. Registrants map into internal `Attendee` model (`mapRegistrantToAttendee`).
3. Meal classification runs (`mealPlan`, `individualMeal`, `mealChoice`).
4. `getValidatableMeals(attendee)` expands plans into individual meal keys.

This flow already exists. Supabase adds a **publish step** after mapping.

### 3.2 Desktop uploads sanitized data to Supabase

After RegFox sync (manual “Publish to cloud” or automatic on interval):

1. Upsert **conference** row (event id, name, sync timestamp).
2. Upsert **attendees** — stable `attendee_id`, display name, `registration_id`, optional meal choice label, dietary flags as needed for scanning (not full custom field dump).
3. Replace or upsert **meal_entitlements** per attendee — one row per validatable meal key (`meal_key`, `meal_label`, source plan if applicable).

**Sanitization rules:**

- Upload only fields required for meal scanning and volunteer display.
- Do **not** upload email, phone, or RegFox API credentials.
- QR lookup key matches desktop: stable attendee id (`getAttendeeQrValue` semantics).

### 3.3 Mobile reads from Supabase

1. Volunteer opens mobile web scanner URL (conference-specific or generic with scanner code).
2. Authenticates with **conference access credential** or **scanner session code** (see Security).
3. Scans badge QR → `attendee_id`.
4. Fetches attendee + `meal_entitlements` (+ existing `meal_validations` for “already used” UI).

### 3.4 Mobile writes meal validations to Supabase

1. Volunteer taps **Validate** for a meal.
2. Mobile inserts into `meal_validations` with `source = 'mobile'`, `validated_by` = scanner session id.
3. `UNIQUE (conference_id, attendee_id, meal_key)` prevents duplicate redemption at the database level.

### 3.5 Desktop pulls validations back (later)

Optional sync job on desktop:

1. Query Supabase for validations since last pull timestamp.
2. Merge into local SQLite (`meal_validations`), respecting uniqueness.
3. Desktop UI shows combined state (desktop + mobile sources).

**Conflict rule:** First successful insert wins per `(attendee_id, meal_key)` within a conference. Duplicate attempts return “already validated” — same as desktop SQLite today.

### 3.6 Sync direction summary

```
RegFox ──► Desktop ──► Supabase ──► Mobile
                ▲                      │
                └──── validations ─────┘
                      (optional pull)
```

Desktop SQLite remains writable without Supabase. Mobile writes go to Supabase first; desktop pull is eventual consistency.

---

## 4. Proposed Supabase tables

Naming uses snake_case in Postgres. `conference_id` scopes all event data.

### 4.1 `conferences`

One row per RegFox event / FoxBridge conference.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | Supabase-generated |
| `slug` | `text` UNIQUE | URL-safe identifier, e.g. `adagra-2026` |
| `name` | `text` | Display name |
| `regfox_event_id` | `text` | Upstream event id (desktop only in config; not exposed to mobile) |
| `timezone` | `text` | e.g. `America/Denver` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |
| `last_desktop_sync_at` | `timestamptz` | Last successful publish from desktop |

### 4.2 `attendees`

Sanitized attendee rows for scanner lookup.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | Supabase row id |
| `conference_id` | `uuid` FK | |
| `attendee_id` | `text` | Stable QR id (unique per conference) |
| `registration_id` | `text` | RegFox registration id |
| `display_name` | `text` | First + last |
| `meal_choice_label` | `text` nullable | e.g. “Chicken” — optional for scanner UI |
| `dietary_summary` | `text` nullable | Short volunteer-facing string |
| `updated_at` | `timestamptz` | |

**Unique:** `(conference_id, attendee_id)`

### 4.3 `meal_entitlements`

Expanded validatable meals (same logic as desktop `getValidatableMeals`).

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `conference_id` | `uuid` FK | |
| `attendee_id` | `text` | Matches `attendees.attendee_id` |
| `meal_key` | `text` | e.g. `mealPan.thursdayDinner` |
| `meal_label` | `text` | Display name |
| `source` | `text` | `individual` \| `mealPlan` |
| `source_plan_id` | `text` nullable | e.g. `mealPan.fullMealPlan` |
| `updated_at` | `timestamptz` | |

**Unique:** `(conference_id, attendee_id, meal_key)`

Desktop publish replaces entitlements for an attendee on each sync (delete + insert or upsert).

### 4.4 `meal_validations`

Operational redemption records (mirrors desktop SQLite shape).

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `conference_id` | `uuid` FK | |
| `attendee_id` | `text` | |
| `meal_key` | `text` | |
| `meal_label` | `text` | Snapshot at validation time |
| `validated_at` | `timestamptz` | |
| `validated_by` | `text` nullable | Scanner session id or volunteer label |
| `source` | `text` | `mobile` \| `desktop` \| `sync` |
| `client_id` | `text` nullable | Idempotency key from offline queue |

**Unique:** `(conference_id, attendee_id, meal_key)`

### 4.5 `scanner_sessions` (or `scanner_users`)

Volunteer/device access for a conference. Start with **scanner_sessions** for MVP (no full user accounts).

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `conference_id` | `uuid` FK | |
| `code` | `text` | Human-enterable scanner code (hashed at rest) |
| `label` | `text` | e.g. “Meal line 1 – Friday lunch” |
| `expires_at` | `timestamptz` nullable | Auto-revoke after event |
| `revoked_at` | `timestamptz` nullable | |
| `created_at` | `timestamptz` | |
| `last_seen_at` | `timestamptz` nullable | |

Alternative: **`scanner_users`** with Supabase Auth email/password for recurring staff — defer until post-AdAgrA.

**MVP recommendation:** Conference admin generates one or more **scanner codes** on desktop (or Supabase dashboard during bootstrap). Mobile app stores session token after code exchange.

---

## 5. Security principles

### 5.1 Never expose RegFox API key to mobile

- RegFox credentials live only in FoxBridge Desktop (`.env`, main process).
- Supabase rows never contain `regfox_api_key`.
- Mobile clients use Supabase anon key + scoped auth, not RegFox.

### 5.2 Conference access credentials / scanner code

| Layer | Approach |
|-------|----------|
| **MVP** | Time-limited scanner code per conference or meal station |
| **Exchange** | Mobile POSTs code → receives short-lived JWT or session row id |
| **Scope** | Session limited to one `conference_id`; read entitlements, insert validations only |

Desktop generates codes during “Publish to cloud” or a **Scanner codes** admin panel.

### 5.3 Row Level Security (RLS) — implement before production mobile

Enable RLS on all tables. Example policies (conceptual):

- **anon/authenticated scanner role:** `SELECT` on `attendees`, `meal_entitlements`, `meal_validations` where `conference_id = session.conference_id`.
- **scanner role:** `INSERT` on `meal_validations` where `conference_id = session.conference_id` (no update/delete).
- **service role (desktop sync):** Full upsert on attendees, entitlements; read validations for pull.
- **No public read** of all conferences or cross-conference data.

RLS is **planned for implementation**, not optional for a public mobile URL.

### 5.4 Data minimization

Mobile receives only what meal-line volunteers need: name, entitlements, validation status, optional meal choice/dietary summary. No bulk export of attendee list to unauthenticated clients.

### 5.5 Transport and secrets

- HTTPS only (Supabase default).
- Supabase **service role key** only in desktop main process (same boundary as RegFox key).
- Supabase **anon key** in mobile PWA is acceptable once RLS is enforced.

---

## 6. Offline strategy

Mobile scanners will often operate in gymnasiums and camps with poor Wi‑Fi. Plan for offline-first **after** online MVP.

### 6.1 Local cache on mobile

- On login / periodic sync: download `attendees`, `meal_entitlements`, and recent `meal_validations` for the conference into **IndexedDB** (or SQLite via Capacitor if native later).
- Cache subset strategies:
  - **Full conference** — feasible for AdAgrA-scale (~hundreds of attendees).
  - **LRU / search** — for larger events later.

### 6.2 Offline validation queue

When offline:

1. Scan QR → lookup in local cache.
2. Validate meal → append to **outbox queue** (local storage) with generated `client_id` (UUID).
3. UI shows “Pending sync” until uploaded.

Queue record shape mirrors `meal_validations` insert payload.

### 6.3 Sync when online

1. Flush outbox in order (or parallel with idempotency).
2. Server applies `INSERT ... ON CONFLICT DO NOTHING` on `(conference_id, attendee_id, meal_key)`.
3. Refresh local validations from server.

### 6.4 Conflict resolution

| Scenario | Resolution |
|----------|------------|
| Same meal validated twice on same device | Block in UI; queue dedupes by `client_id` |
| Same meal validated on two devices offline | First insert wins; second gets **already validated** |
| Desktop SQLite + mobile Supabase both record same meal | Uniqueness per conference; desktop pull merges without duplicate rows |
| Stale entitlement cache | Desktop re-publish updates entitlements; mobile refresh on reconnect |

**Canonical rule:** `(conference_id, attendee_id, meal_key)` uniqueness is the single redemption lock — aligned with desktop SQLite today.

---

## 7. AdAgrA MVP scope

AdAgrA is the first real conference deployment. Supabase mobile support is **optional reinforcement**, not a gate for registration day.

| Capability | AdAgrA MVP |
|------------|------------|
| Desktop search, badges, print | **Required** — primary tool |
| Desktop SQLite meal validation | **Required** |
| Desktop RegFox sync | **Required** |
| Local scanner server (localhost) | Optional dev / same-room fallback |
| Supabase project + tables | Optional if time allows; design ready |
| Mobile web scanner | Optional — roaming meal lines only |
| Mobile offline queue | **Defer** — online-first acceptable for MVP |
| Native iOS/Android app | **Out of scope** |
| RLS + scanner codes | **Required before** public mobile URL |

**Operational default:** If Supabase or mobile is unavailable, staff use FoxBridge Desktop at the meal station (QR paste or list selection) — already implemented.

---

## 8. Future product scope

Beyond AdAgrA, FoxBridge may evolve into a hosted product. Supabase fits the multi-tenant shape; desktop remains the sync agent.

| Feature | Description |
|---------|-------------|
| **Hosted onboarding** | Web flow to create conference, connect RegFox, invite volunteers |
| **Language selection** | i18n for mobile scanner + desktop UI |
| **API key and page ID setup** | Self-service RegFox credential entry (stored encrypted, desktop-only) |
| **Packaged desktop installer** | Signed macOS/Windows builds with auto-update |
| **Polished mobile scanner** | PWA with camera QR, haptics, large tap targets, offline mode |
| **Multi-event** | One org, many `conferences` rows; desktop picks active event |
| **Analytics** | Meal throughput, peak times, validation source breakdown |
| **Scanner user accounts** | Replace single-use codes with Supabase Auth for returning volunteers |

None of the above is implemented in this planning phase.

---

## Relationship to current desktop implementation

| Today (implemented) | Future (Supabase path) |
|---------------------|------------------------|
| SQLite `meal_validations` | Supabase `meal_validations` + optional desktop pull |
| In-memory attendee cache | Desktop publish → Supabase `attendees` + `meal_entitlements` |
| Local scanner server `GET /api/attendees/:id` | Mobile reads same logical payload from Supabase |
| `getValidatableMeals()` in shared TS | Same function used at publish time on desktop |
| No cloud | Supabase as shared hub |

**Explicit non-goals for first Supabase implementation:**

- Replacing desktop SQLite
- Exposing RegFox to mobile
- Mobile meal validation without RLS
- Native app store distribution

---

## Suggested implementation order (when coding begins)

1. Create Supabase project and tables (migrations).
2. Desktop: Supabase service module in main process (service role key).
3. Desktop: “Publish conference to cloud” action after RegFox sync.
4. RLS policies + scanner code exchange (Edge Function or RPC).
5. Mobile PWA: login with code → scan → validate (online only).
6. Desktop: pull validations into SQLite.
7. Mobile: IndexedDB cache + offline outbox.

---

## Open questions (resolve during implementation)

1. **One Supabase project per org vs per conference** — start with one project, many conferences.
2. **Entitlement refresh frequency** — on every RegFox sync vs manual publish button.
3. **Dietary fields on mobile** — full summary vs boolean + description snippet.
4. **Real-time** — Supabase realtime for validation updates on desktop dashboard (nice-to-have).

---

## Document history

| Date | Change |
|------|--------|
| July 2026 | Initial architecture planning (no code) |
