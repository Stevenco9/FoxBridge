# FoxBridge — Architecture

## Purpose

FoxBridge is a companion application for RegFox event management. It gives event staff a fast, reliable way to search attendees, preview badges, and print labels at the door—without CSV exports or manual data handling.

The MVP targets desktop (Electron). The long-term vision includes mobile clients for on-the-go check-in and scanning.

## Guiding Principle: Source of Truth

**RegFox is the source of truth.** All attendee and event data originates in RegFox and is authoritative.

FoxBridge maintains a **local cache** of that data to enable:

- Fast search and UI responsiveness at the event
- Continued operation when network connectivity is limited or unavailable

The cache is a performance and resilience layer—not a second system of record. Changes that affect registration state flow through RegFox; FoxBridge syncs to stay current.

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

FoxBridge will eventually ship as **desktop and mobile clients** that share common business logic in Core and Services. Each client provides its own UI and platform-specific Integrations (e.g., desktop printing vs. mobile scanning), while RegFox remains the single source of truth and the local cache strategy applies to all clients.

## Current State (MVP)

The scaffolded desktop app includes only the UI shell. Core, Services, Integrations, and the local cache are planned for upcoming milestones per [PRODUCT.md](PRODUCT.md).
