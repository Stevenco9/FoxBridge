# FoxBridge — Architecture

## Purpose

FoxBridge is a companion application for event registration platforms (today: RegFox). It gives event staff a fast, reliable way to search attendees, preview badges, print labels, and run on-site workflows at the door—without CSV exports or manual data handling.

The MVP targets desktop (Electron). The long-term vision includes mobile clients for on-the-go check-in and scanning.

Synchronization across Desktop, FoxBridge Cloud, phones, and registration platforms is specified in [`SYNC_ARCHITECTURE.md`](./SYNC_ARCHITECTURE.md). Supabase is the current Cloud backend ([`SUPABASE_ARCHITECTURE.md`](./SUPABASE_ARCHITECTURE.md)).

## Guiding Principles

### Operational layer, not a registration platform

**FoxBridge is not a replacement for registration platforms. It is an operational layer that synchronizes with them.**

Organizers continue to collect registrations, payments, and form answers in their existing platform. FoxBridge syncs that data, then focuses on what platforms usually leave to staff on the ground: check-in, badge printing, meal validation, and other live-event operations.

This principle constrains product and technical choices:

- Do not rebuild registration forms, checkout, or official payment administration inside FoxBridge
- Prefer sync and display of upstream registration data over inventing a second registration record
- Own on-site operational history in FoxBridge (meals, badge prints, check-ins) while registration remains authoritative upstream
- Design integrations so additional registration platforms can map into the same operational model over time

### Source of truth

**The connected registration platform is the source of truth for attendee and registration data.** Today that platform is RegFox.

All attendee and event registration data originates upstream and is authoritative.

FoxBridge maintains a **local event store** (SQLite `event_attendees`) plus an in-memory cache so Desktop remains usable offline after import. See [`SYNC_ARCHITECTURE.md`](./SYNC_ARCHITECTURE.md) and [`DATA_MODEL.md`](./DATA_MODEL.md).

The store is a performance and resilience layer for **operations**—not a second registration system of record. Changes that affect registration state flow through the registration platform; FoxBridge syncs to stay current.

## Layers

```
┌─────────────────────────────────────────┐
│  UI (React)                             │  Desktop & mobile presentation
├─────────────────────────────────────────┤
│  Core                                   │  Business logic, models, workflows
├─────────────────────────────────────────┤
│  Services                               │  Sync, search, badge, print orchestration
├─────────────────────────────────────────┤
│  Integrations                           │  RegFox API, label printers, local storage
└─────────────────────────────────────────┘
```

### UI

The presentation layer. Renders screens, handles user input, and stays thin—delegating decisions to Core and Services. Built with React in the Electron renderer for desktop; mobile clients will use the same patterns with platform-native shells.

### Core

Shared business logic: attendee models, check-in rules, badge field mapping, and validation. Core has no knowledge of Electron, React, or specific APIs. This separation keeps logic testable and reusable across clients.

### Services

Orchestration between Core and Integrations. Examples include sync scheduling, attendee search, badge preview generation, and print job dispatch. Services coordinate workflows without embedding UI or low-level API details.

### Integrations

Adapters to external systems and platform capabilities:

- **RegFox** — API client for fetching and syncing attendee data
- **Local storage** — Cache persistence (database or local store)
- **Printers** — Brother QL-820NWB and other label printer drivers

## Multi-Client Strategy

FoxBridge will eventually ship as **desktop and mobile clients** that share common business logic in Core and Services. Each client provides its own UI and platform-specific Integrations (e.g., desktop printing vs. mobile scanning), while the registration platform remains the source of truth for attendee data and the local cache strategy applies to all clients.

## Current State (MVP)

The scaffolded desktop app includes only the UI shell. Core, Services, Integrations, and the local cache are planned for upcoming milestones per [PRODUCT.md](PRODUCT.md).
