# FoxBridge Operational Check-In Architecture (Sprint 23.5)

**Status:** **SPRINT 23 CLOSED — LIVE VALIDATED** (23.5a Cloud-first check-in + 23.5b1 RegFox reconciler + 23.5b2 audit/health)

## Principle

FoxBridge Cloud is the **live multi-desk operational check-in authority**.

Registration platforms (RegFox first) remain upstream sources of registration data.
Upstream check-in reconciliation is Principal-mediated and **platform-adapter-owned**.

Linked desktops never receive registration-platform API keys.

FoxBridge operational check-in is authoritative in real time.
Upstream reconciliation is Principal-owned, platform-adapter-based, and observable through
lightweight Principal diagnostics (Sprint 23.5b2).

## Layers

| Layer | Role | Platform knowledge |
|-------|------|--------------------|
| `conference_attendee_check_ins` | Live operational state | None |
| Edge `desktop-check-in` / `desktop-pull-check-ins` | Desk-auth write + pull | None |
| Sync entity `check_in_state` | Multi-desk converge (~12s) | None |
| Local `event_attendee_check_ins` overlay | Effective UI merge | None |
| Principal `UpstreamCheckInReconcilerManager` | Drain pending/failed-retryable | Selects adapter |
| Platform adapter (e.g. RegFox) | Upstream API write | Yes |
| `conference_attendee_check_in_audit` | Append-only audit | Platform id optional |
| `desktop-upstream-check-in-health` | Principal health counts | None |

## Effective UI state

```
operational overlay (event_id, attendee_id) when present
  else base attendee snapshot checkedIn
```

Registration snapshot refresh must **not** erase newer operational overlays.

## Upstream reconciliation (23.5b1)

Operational check-in never waits on upstream.

Principal-only Edge:

- `desktop-pull-pending-check-ins` — eligible rows only
- `desktop-update-check-in-upstream-status` — result writeback

### Durable retry model (migration **018**)

| Column | Purpose |
|--------|---------|
| `upstream_retry_eligible` | `false` = terminal / exhausted / N/A — **never auto-pulled** |
| `upstream_next_attempt_at` | Backoff deadline; NULL = eligible now if retry_eligible |
| `upstream_attempt_count` | Deterministic backoff + max attempts without Desktop RAM |

Auto-pull filter:

```
checked_in
AND status IN (pending, failed)
AND upstream_retry_eligible = true
AND (next_attempt_at IS NULL OR next_attempt_at <= now)
```

RegFox already-checked-in (error code **8500**) → `synced`.

Unsupported `registration_platform` → `not_applicable` + `retry_eligible=false`.

## Audit & Principal health (23.5b2)

Migration **019** — `conference_attendee_check_in_audit` (append-only).

Actions:

- `attendee_checked_in`
- `attendee_check_in_duplicate`
- `upstream_check_in_synced`
- `upstream_check_in_failed`

Audit writes are best-effort and must not fail operational check-in.

Principal FoxBridge Sync panel shows subtle upstream health:

- **OK** — no waiting / attention rows (short-lived pending &lt; ~90s stays OK)
- **Waiting** — durable pending / retryable failures
- **Attention** — terminal / retry-exhausted counts

Linked desks do not see Principal upstream diagnostics.

## Sprint slices

- **23.5a:** Cloud write + multi-desk convergence
- **23.5b1:** Generic reconciler + RegFox adapter + durable retry writeback
- **23.5b2:** Audit + Principal health visibility

## Out of scope

- Undo / check-out
- Mobile registration check-in
- Broad anon RLS on check-in tables
- Storing upstream API keys in Cloud
- Complex manual retry UI
