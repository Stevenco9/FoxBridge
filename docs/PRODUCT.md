# FoxBridge — Product Requirements Document

## Vision

FoxBridge is a desktop and mobile companion application for RegFox event management. It gives event staff a fast, reliable way to work with live attendee data at the door—without exports, spreadsheets, or manual sync steps.

## Goals

- Connect directly to RegFox so staff always work from current attendee data
- Reduce check-in and badge printing time at the event
- Keep the workflow simple enough for volunteers to learn in minutes
- Build a foundation that scales to mobile, scanning, and multi-event use

## MVP Scope

The MVP delivers a focused check-in and badge printing workflow:

- **RegFox integration** — Connect directly to RegFox; no CSV exports
- **Automatic sync** — Attendee data syncs automatically from RegFox
- **Attendee search** — Find attendees quickly during check-in
- **Badge preview** — Review badge layout and content before printing
- **Badge printing** — Print badges to Brother QL-820NWB label printers

## Out of Scope (for MVP)

The following are explicitly not part of the MVP:

- Mobile companion app
- QR code scanning
- Meal redemption tracking
- Volunteer login roles
- Dashboard and reporting
- Badge designer
- Multi-event support

## Future Features

Planned for post-MVP releases:

| Feature | Description |
|---------|-------------|
| Mobile companion app | On-the-go check-in and badge printing from phones and tablets |
| QR code scanning | Scan attendee QR codes for faster lookup and check-in |
| Meal redemption tracking | Track meal pickups and redemption status |
| Volunteer login roles | Role-based access for staff and volunteers |
| Dashboard and reporting | Event metrics, attendance summaries, and operational reports |
| Badge designer | Customize badge layout, fields, and branding |
| Multi-event support | Manage and switch between multiple events in one install |

## Success Criteria

The MVP is successful when:

1. The app connects to RegFox and syncs attendee data without manual exports
2. Staff can search for an attendee and print a badge in under one minute
3. Badges print correctly on Brother QL-820NWB printers
4. A new volunteer can complete a check-in and print flow with minimal training
5. The app builds and runs reliably throughout development (per project development rules)

## Milestones

| Milestone | Deliverable |
|-----------|-------------|
| M1 — Foundation | Project setup, RegFox connection, and automatic attendee sync |
| M2 — Search & preview | Attendee search and badge preview |
| M3 — Printing | Brother QL-820NWB badge printing end-to-end |
| M4 — MVP polish | UX refinement, error handling, and volunteer-ready onboarding |
