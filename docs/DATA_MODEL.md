# FoxBridge — Data Model

This document describes FoxBridge's internal domain models. These shapes are independent of any external registration API—integrations map upstream data into these models before it enters Core or the local cache.

See also: [`src/shared/models/Attendee.ts`](../src/shared/models/Attendee.ts)

---

## Attendee

### Purpose

The central record for a person registered for an event. Attendees are cached locally for fast search, check-in, and badge workflows at the door.

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
| `customFields` | Additional form answers |
| `checkedIn`, `checkedInAt` | Check-in status |
| `badgePrinted`, `badgePrintedAt` | Badge print status |
| `createdAt`, `updatedAt`, `syncedAt` | Record lifecycle timestamps |
| `metadata` | Open-ended extension bag |

### Relationships

- Belongs to one **Event** (`eventId`)
- Has many **Purchases** (embedded)
- Has many **Custom Fields** (embedded)
- May have one or more **Check-In** records (future; status currently denormalized on Attendee)
- May have one or more **Badge** print records (future; status currently denormalized on Attendee)

### Future expansion

- Meal redemption flags and timestamps
- QR code payload or scan history
- Volunteer notes and role assignments
- Separate Check-In and Badge entities instead of denormalized status fields
- Multi-event attendee linking (post-MVP)

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

- Price and currency
- Redemption status (e.g. meal picked up)
- Session time and location
- SKU or product code for reporting
- Refund or transfer status

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
