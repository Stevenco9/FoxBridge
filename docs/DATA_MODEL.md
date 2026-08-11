# FoxBridge — Data Model

This document describes FoxBridge's internal domain models. These shapes are independent of any external registration API—integrations map upstream data into these models before it enters Core or the local cache.

See also: [`src/shared/models/Attendee.ts`](../src/shared/models/Attendee.ts)

---

## Attendee

### Purpose

The central record for a person registered for an event. Attendees are stored in the Desktop **Local Event Store** (`event_attendees` SQLite table) as the canonical working dataset after import, with an in-memory cache for hot reads.

### Primary fields

| Field | Description |
|-------|-------------|
| `id` | FoxBridge-local identifier |
| `registrationId` | Identifier from the upstream registration system |
| `confirmationCode` | Human-readable reference code |
| `eventId` | Parent event |
| `firstName`, `lastName`, `email`, `phone` | Contact information |
| `organization`, `jobTitle`, `department` | Organization details |
| `purchases` | Registered items (tickets, sessions, add-ons) |
| `payment` | Normalized RegFox payment snapshot (status + amounts) |
| `customFields` | Additional form answers |
| `checkedIn`, `checkedInAt` | Check-in status |
| `badgePrinted`, `badgePrintedAt` | Badge print status |
| `createdAt`, `updatedAt`, `syncedAt` | Record lifecycle timestamps |
| `metadata` | Open-ended extension bag |

### Relationships

- Belongs to one **Event** (`eventId`)
- Has many **Purchases** (embedded)
- Has one **Payment** snapshot (embedded; sourced from RegFox)
- Has many **Custom Fields** (embedded)
- May have one or more **Check-In** records (future; status currently denormalized on Attendee)
- May have one or more **Badge** print records (future; status currently denormalized on Attendee)

### Available field catalog (Sprint 20.1)

Organizers will eventually configure which attributes appear as highlights on the attendee details panel. Field discovery is a pure shared service (`discoverAvailableAttendeeFields`) over imported `Attendee` records:

| Source | Keys | How discovered |
|--------|------|----------------|
| Built-in | e.g. `firstName`, `email`, `checkedIn` | Fixed catalog from the Attendee model |
| Derived | `fullName`, `cityState`, `registrationType` | Fixed composites (resolved later from other fields) |
| Payment | `payment.status`, amounts, currency | Fixed nested payment snapshot |
| Custom | `custom:<path>` | Union of `customFields` across attendees |
| Purchase | `purchase:<id>` | Union of `purchases` (tickets, meals, add-ons, etc.) |

Discovery does not call RegFox and does not change import storage.

### Local Event Store (Sprint 21.2)

Desktop SQLite separates concerns:

| Store | Contents |
|-------|----------|
| **`event_attendees`** | Canonical local registration working dataset (platform-agnostic `Attendee` JSON + `source_platform`) |
| **Operational tables** | `meal_validations`, `attendee_check_ins`, `badge_print_logs` |
| **`event-settings.json`** | Event-specific UI prefs (Attendee Display field keys, future badge/meal UI config) |

Registration adapters (RegFox today) map into `Attendee[]` and call `replaceAttendeeCacheFromRegistrationSync`. Desktop workflows read the local store after import; Connect / Refresh still pull from the registration platform.

### FoxBridge Event identity (Sprint 21.3)

A platform-independent **Event** lives in SQLite `events` and is distinct from a registration platform’s page/form id:

| Field | Description |
|-------|-------------|
| `id` | FoxBridge-stable UUID (`activeEventId` in AppSettings) |
| `name` | Display name |
| `registrationPlatform` | e.g. `regfox` |
| `platformEventId` | Upstream id (RegFox page id — still stored as `regfoxEventId`) |
| `createdAt`, `lastSyncedAt` | Lifecycle timestamps |

**Associations (prefer FoxBridge `Event.id`):**

| Store | Key |
|-------|-----|
| Local Event Store (`event_attendees.event_id`) | FoxBridge Event id after connect/load/boot migration |
| Event Settings (`event-settings.json`) | FoxBridge id primary; platform id mirrored/aliased |
| Sync cursors (`desktop-sync-cursors.json`) | Optional `events[foxbridgeEventId].conferences[…]` |

`AppSettingsPublic.regfoxEventId` stays for existing RegFox workflows. New event-scoped code should prefer `activeEventId`. This sprint does **not** force a full source-of-truth cutover away from `regfoxEventId`.

Future registration platforms create a FoxBridge Event with their own `registrationPlatform` + `platformEventId` and reuse the same associations.

### Event settings file (Sprint 20.2)

Organizer preferences that differ by event live in Electron `userData/event-settings.json` (not `AppSettingsPublic`, not SQLite):

```json
{
  "version": 1,
  "events": {
    "<foxbridgeEventId or legacy regfoxEventId>": {
      "attendeeDisplay": { "fieldKeys": ["fullName", "custom:…"] }
    }
  }
}
```

- Prefer FoxBridge Event id keys; RegFox page ids still resolve via aliasing
- `attendeeDisplay.fieldKeys` stores stable catalog keys from Sprint 20.1
- Additional sections (badge layout, meals, …) can be added under each event later
- IPC: `getEventSettings` / `patchEventSettings`

### Future expansion

- Meal redemption flags and timestamps
- QR code payload or scan history
- Volunteer notes and role assignments
- Separate Check-In and Badge entities instead of denormalized status fields
- Multi-event attendee linking (post-MVP)
- On-site payment recording (Sprint 16B) — local operational history, separate from RegFox
- Configurable highlight-field selection UI over the Sprint 20.1 catalog + 20.2 persistence (**Sprint 20.3:** organizer UI; **Sprint 20.4:** Quick Info rendering on details panel)
- Persist badge layout under the same event-settings document
- Reorder controls for Attendee Display items

---

## Payment

### Purpose

A read-only snapshot of registration payment state mapped from RegFox. FoxBridge displays this for door staff; it does **not** update RegFox payment records in Sprint 16A.

RegFox remains the source of truth for official payment status. The normalized model supports deposits, partial payments, and remaining balances for future events, even when the current event is primarily paid versus unpaid.

### Primary fields

| Field | Description |
|-------|-------------|
| `status` | `paid`, `pending` (shown as “Unpaid”), `cancelled`, `refunded`, or `unknown` |
| `totalAmount` | Registration total when known; otherwise `null` |
| `amountPaid` | Derived as total − balance when both are known; otherwise `null` |
| `balanceDue` | Outstanding amount when known; otherwise `null` |
| `currency` | ISO currency code when known |
| `upstreamStatus` | Original RegFox status string |
| `source` | Currently always `regfox` |

### Rules

- Missing monetary values stay `null` — FoxBridge does not invent zeros for absent fields.
- `fieldData[].amount` line items are not summed into the registration total.
- Positive `outstandingAmount` is treated as the remaining balance (payment plans / partials).
- For statuses that still await payment (`pending offline payment`, etc.), when RegFox reports `outstandingAmount` as `0` or omits it, FoxBridge uses `total`/`amount` as balance due — matching the RegFox UI observed on live AdAgrA data.
- Sprint 16A is display-only; no RegFox payment writes and no local “mark paid” actions.

### Relationships

- Belongs to one **Attendee** (embedded on Attendee)

---

## Purchase

### Purpose

Represents a line item an attendee registered for—such as a ticket type, session, meal, or add-on. Purchases drive badge content, access rules, and future redemption tracking.

### Primary fields

| Field | Description |
|-------|-------------|
| `id` | Unique identifier for this purchase line |
| `name` | Display name (e.g. "General Admission", "VIP Lunch") |
| `quantity` | Number of units purchased |
| `category` | Optional grouping (e.g. "ticket", "meal", "session") |

### Relationships

- Belongs to one **Attendee** (embedded array on Attendee)
- May reference an **Event**-level product or ticket definition (future)

### Future expansion

- Price and currency on individual purchase lines (registration-level payment lives on Attendee.payment)
- Redemption status (e.g. meal picked up)
- Session time and location
- SKU or product code for reporting
- Refund or transfer status on a purchase line

---

## Custom Field

### Purpose

Captures registration form answers that do not map to standard attendee fields. Custom fields preserve flexible form data from the upstream system without hard-coding every possible question.

### Primary fields

| Field | Description |
|-------|-------------|
| `key` | Stable machine-readable identifier |
| `label` | Human-readable field label |
| `value` | Answer value (`string`, `number`, `boolean`, `string[]`, or `null`) |

### Relationships

- Belongs to one **Attendee** (embedded array on Attendee)
- May appear on **Badge** layouts as merge fields (future)

### Future expansion

- Field type hint (text, select, checkbox, date)
- Visibility rules (badge-only, staff-only)
- Validation constraints
- Localized labels

---

## Event *(placeholder)*

### Purpose

Represents a single event that FoxBridge is operating against. Events scope attendees, sync configuration, and badge templates. Multi-event support is planned for post-MVP.

### Primary fields *(planned)*

| Field | Description |
|-------|-------------|
| `id` | FoxBridge-local identifier |
| `externalId` | Identifier from the upstream registration system |
| `name` | Event display name |
| `startDate`, `endDate` | Event date range |
| `timezone` | Event timezone |
| `syncedAt` | Last successful data sync |

### Relationships

- Has many **Attendees**
- Has one or more **Badge** templates (future)
- Configures sync and check-in rules (future)

### Future expansion

- Multi-event switching in a single install
- Per-event printer and badge defaults
- Volunteer role scoping per event
- Dashboard and reporting aggregates

---

## Badge *(placeholder)*

### Purpose

Describes the printable badge content and layout for an attendee. Separates what appears on a label from the raw attendee record and printer mechanics.

### Primary fields *(planned)*

| Field | Description |
|-------|-------------|
| `id` | Unique badge record identifier |
| `attendeeId` | Attendee this badge was generated for |
| `templateId` | Layout template used |
| `fields` | Resolved merge-field values at print time |
| `printedAt` | When the badge was printed |
| `reprintCount` | Number of times reprinted |

### Relationships

- Belongs to one **Attendee**
- Uses an **Event**-level template (future)
- Produced by a print job (integration layer; not modeled here)

### Future expansion

- Badge designer with custom layouts
- Preview rendering before print
- QR code or barcode payload
- Print history and audit trail
- Multiple badge types per attendee (e.g. staff vs. attendee)

---

## Check-In *(placeholder)*

### Purpose

Records when and how an attendee was checked in at the event. Currently check-in status is denormalized on Attendee; a dedicated model will support audit history and multiple check-in methods.

### Primary fields *(planned)*

| Field | Description |
|-------|-------------|
| `id` | Unique check-in record identifier |
| `attendeeId` | Attendee who was checked in |
| `checkedInAt` | ISO 8601 timestamp |
| `method` | How check-in occurred (search, QR scan, manual) |
| `checkedInBy` | Volunteer or staff identifier (future) |

### Relationships

- Belongs to one **Attendee**
- Scoped to one **Event**
- May reference a scan or search session (future)

### Future expansion

- QR code scanning as a check-in method
- Undo or override with reason
- Offline check-in queue with sync reconciliation
- Check-in location or station tracking
- Volunteer login and role attribution
