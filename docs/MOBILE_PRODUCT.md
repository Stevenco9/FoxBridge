# FoxBridge Mobile — Product Definition

**Status:** Implemented (Sprint 11–13B)  
**Last updated:** July 2026  
**Audience:** Anyone designing or building the FoxBridge mobile experience

This document defines what the **mobile volunteer app** is for—and what it is **not** for. FoxBridge Desktop remains the operational hub for registration desks, badge printing, and administration. Mobile exists to serve people standing in meal lines with a phone in one hand.

Related docs: [`VISION.md`](./VISION.md), [`PRODUCT_DECISIONS.md`](./PRODUCT_DECISIONS.md), [`SUPABASE_ARCHITECTURE.md`](./SUPABASE_ARCHITECTURE.md)

---

## Purpose

The FoxBridge mobile app helps **volunteers at the point of service** confirm who an attendee is and record meal redemption quickly. It is a narrow tool for high-throughput, high-pressure moments—not a pocket-sized copy of the desktop app.

If a feature does not directly help a volunteer serve the next person in line, it does not belong on mobile.

---

## Users

### Primary: Meal-line volunteers

People stationed at buffet entrances, ticket tables, or roped-off meal areas. They may be first-time volunteers, assigned for a single two-hour shift, and unfamiliar with RegFox or FoxBridge internals.

**They need to:**

- Identify an attendee from a badge QR code in seconds
- See which meals that person is entitled to today
- Mark a meal as used with confidence
- Recover quickly from a bad scan or “already validated” situation

**They do not need to:**

- Edit registration data
- Configure events or integrations
- Print badges
- Browse the full attendee directory for fun

### Secondary: Roaming registration volunteers

Staff moving through a lobby or overflow area who may help with **lookup and meal validation** when the main desk is backed up. Same core workflow as meal volunteers; they are not running full check-in or badge printing from mobile in the MVP.

### Explicitly not mobile users (use desktop)

- Event administrators
- IT setup / RegFox credential entry
- Badge layout design
- Bulk publish, reporting, and conference configuration

Those workflows stay on **FoxBridge Desktop** by design.

---

## Primary workflows

### Workflow A — Validate a meal (default)

This is the **only workflow mobile must nail** for AdAgrA and early releases.

```
Scan QR → See attendee name + entitlements → Tap meal → Done
```

| Step | Volunteer sees | System does |
|------|----------------|-------------|
| 1. Scan | Camera viewfinder, large scan target | Reads stable QR identifier from badge |
| 2. Identify | Attendee name (large), optional meal choice / dietary hint | Loads attendee + entitlements from cache or Supabase |
| 3. Validate | List of today’s validatable meals with clear **Validate** buttons | Writes validation; shows **Already used** if duplicate |
| 4. Next | Empty scan state or “Scan next badge” prompt | Ready for the next person immediately |

**Target path length:** one scan, zero to one taps (if only one meal applies), then ready for the next scan.

### Workflow C — Pair a phone (organizer → volunteer)

```
Organizer taps Connect a phone → Volunteer scans QR with Camera app → Ready to scan
```

| Step | Volunteer sees | System does |
|------|----------------|-------------|
| 1. Pair | Camera app opens hosted PWA | `/pair?token=` exchanges one-time pairing token for scanner session |
| 2. Ready | Conference name + Scan attendee badge | Session stored; no sign-in, name, or conference picker |
| 3. Scan | Same as Workflow A | Lookup + validate meals |

Manual sign-in (`/sign-in`) and conference picker remain **development fallbacks only** (`import.meta.env.DEV`).

### Workflow B — Manual code entry (fallback)

When the camera fails (damaged badge, glare, forgotten badge):

```
Enter code → Same identify + validate screen
```

Manual entry is a **fallback**, not the happy path. It must exist but should not dominate the UI.

No RegFox API keys, no account creation, no event configuration on mobile.

---

## Out of scope for mobile (guardrails)

To prevent scope creep, treat the following as **desktop-only** unless there is an exceptional, documented reason:

- Badge preview and printing
- Attendee search/browse as a primary navigation mode
- Editing attendee records or RegFox fields
- Publishing attendees to Supabase
- Printer setup, layout editors, admin dashboards
- Multi-event management
- Detailed reports and exports

When in doubt, ask: *Would a volunteer standing in a lunch line need this right now?* If no, defer to desktop.

---

## Environmental constraints

Mobile is used in real conference conditions, not ideal lab settings. Every design and engineering choice should assume:

### Sunlight and glare

- Outdoor lines, bright lobbies, and windows behind attendees are normal.
- High-contrast UI (dark text on light background or vice versa with strong separation).
- Avoid low-contrast gray-on-gray status text for critical states.
- Camera UX should tolerate partial QR visibility; offer immediate retry without modal dialogs.

### Gloves and cold hands

- Volunteers often wear food-service gloves or work in cold weather.
- **Minimum tap target: 48px**; prefer full-width meal buttons.
- Avoid swipe-only gestures, long-press, or precise drag interactions.
- Primary actions at the bottom of the screen (thumb reach).

### Weak or intermittent connectivity

- Wi‑Fi in gyms, camps, and convention halls is unreliable.
- Online-first MVP is acceptable; **offline queue is a planned requirement**, not optional forever.
- Never block the volunteer with a spinner longer than ~1 second without a clear message.
- Failed network writes must show a recoverable state (“Saved locally — will sync”) rather than silent failure.

### Long lines and social pressure

- The person behind the attendee is watching. Errors must be **short, plain language**, and actionable.
- “Already validated” is informational, not alarming—volunteer may need to redirect the attendee politely.
- Minimize confirmation dialogs; destructive actions are rare on mobile MVP (validation is append-only).

### Noise and distraction

- Volunteers may be interrupted mid-scan.
- Screen should recover to a clear idle state after inactivity.
- Attendee context should remain visible until the volunteer explicitly clears or scans the next badge.

---

## Success metrics

Use these as release gates and regression checks—not vanity analytics.

| Metric | Target | Why it matters |
|--------|--------|----------------|
| **Scan-to-result time** | **< 2 seconds** (p95) on good connectivity | Line throughput; volunteer confidence |
| **Scan-to-result offline** | **< 1 second** from local cache (when implemented) | Connectivity cannot stall the line |
| **Taps to validate single meal** | **1 tap** after scan (when one entitlement applies) | One-handed, gloved operation |
| **Taps to validate (multi-meal)** | **1 tap per meal**, no nested menus | Clear entitlement list |
| **Failed scan recovery** | **< 3 seconds** to retry or manual entry | Badges are crumpled, laminated, reflective |
| **Training time** | New volunteer productive in **< 2 minutes** | Shift handoffs are constant |
| **Error comprehension** | Volunteer can explain next step without asking IT | Plain-language errors only |

### Qualitative success

- Volunteers describe the app as “just scan and tap.”
- Organizers trust mobile validations the same as desktop validations.
- No one asks for “the full FoxBridge app on my phone” during meal service.

---

## Information hierarchy on screen

When an attendee is identified, show only what volunteers need **in this order**:

1. **Name** (largest text)
2. **Meals available now** — buttons with clear labels (e.g. “Friday Lunch”)
3. **Already used** — visually distinct, not disabled without explanation
4. **Secondary context** — meal choice (chicken/beef), dietary note (one line max)
5. **Technical ids** — hidden or collapsed; never required reading

Do not show email, phone, full purchase history, or registration admin fields on the default validation screen.

---

## Relationship to desktop and cloud

| Layer | Mobile role |
|-------|-------------|
| **RegFox** | Never contacted directly from mobile |
| **FoxBridge Desktop** | Publishes attendee + entitlement data; issues scanner codes |
| **Supabase** | Mobile reads entitlements; writes validations (when implemented) |
| **SQLite (desktop)** | Independent; desktop meal validation continues without mobile |

Mobile is a **client**, not a source of truth. Validations sync up; conflicts resolve by `(attendee_id, meal_key)` uniqueness per conference.

---

## MVP vs later

### AdAgrA / first mobile release

- Mobile web PWA (not native app store)
- Camera QR scan + manual fallback
- Read entitlements, write validations (online-first acceptable)
- Scanner code login
- Large buttons, high contrast, minimal screens

### Later (only if metrics above are met)

- Offline cache + validation outbox
- Haptic feedback on successful validation
- Optional second language
- Read-only “line stats” for lead volunteer (not full admin)

---

## Design review checklist

Before adding any mobile feature, confirm:

- [ ] Helps a **meal or roaming volunteer** during live service
- [ ] Works in **sunlight** and with **gloved hands**
- [ ] Degrades gracefully on **weak Wi‑Fi**
- [ ] Keeps **scan-to-result under 2 seconds** on happy path
- [ ] Does **not** duplicate desktop admin capabilities
- [ ] Uses language a first-time volunteer understands without training docs

If any answer is “no,” the feature belongs on desktop—or not at all.

---

## Document history

| Date | Change |
|------|--------|
| July 2026 | Initial mobile product definition |
