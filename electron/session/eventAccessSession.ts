import { randomUUID } from 'node:crypto'
import type {
  EventAccessStatus,
  EventUnlockMethod,
} from '../../src/shared/models/EventAccessSession'
import {
  EVENT_ACCESS_LOCKED_CODE,
  EVENT_ACCESS_LOCKED_MESSAGE,
} from '../../src/shared/models/EventAccessSession'

/**
 * Main-process-only authorization to use one FoxBridge Event in this process.
 * Never written to disk — a new Electron process always starts locked.
 */

export interface EventAccessSession {
  eventId: string
  conferenceId: string | null
  unlockedAt: number
  unlockMethod: EventUnlockMethod
  sessionId: string
}

export interface EstablishEventAccessSessionInput {
  eventId: string
  conferenceId?: string | null
  unlockMethod: EventUnlockMethod
}

export class EventAccessLockedError extends Error {
  readonly code = EVENT_ACCESS_LOCKED_CODE

  constructor(message: string = EVENT_ACCESS_LOCKED_MESSAGE) {
    super(message)
    this.name = 'EventAccessLockedError'
  }
}

let activeSession: EventAccessSession | null = null
let onUnlockedListeners: Array<() => void> = []
let onLockedListeners: Array<() => void> = []

export function getEventAccessSession(): EventAccessSession | null {
  return activeSession
}

export function isEventAccessUnlocked(): boolean {
  return activeSession !== null
}

export function getEventAccessSessionStatus(): EventAccessStatus {
  if (!activeSession) {
    return {
      locked: true,
      eventId: null,
      conferenceId: null,
      unlockMethod: null,
      unlockedAt: null,
      sessionId: null,
    }
  }

  return {
    locked: false,
    eventId: activeSession.eventId,
    conferenceId: activeSession.conferenceId,
    unlockMethod: activeSession.unlockMethod,
    unlockedAt: new Date(activeSession.unlockedAt).toISOString(),
    sessionId: activeSession.sessionId,
  }
}

/**
 * Establish process event access after a trusted authorization path succeeds.
 * Must only be called from main-process claim / redeem / enroll / RegFox connect.
 */
export function establishEventAccessSession(
  input: EstablishEventAccessSessionInput,
): EventAccessStatus {
  const eventId = input.eventId.trim()
  if (!eventId) {
    throw new Error('eventId is required to establish event access.')
  }

  const wasLocked = activeSession === null
  activeSession = {
    eventId,
    conferenceId: input.conferenceId?.trim() || null,
    unlockedAt: Date.now(),
    unlockMethod: input.unlockMethod,
    sessionId: randomUUID(),
  }

  if (wasLocked) {
    for (const listener of onUnlockedListeners) {
      try {
        listener()
      } catch (error) {
        console.warn(
          '[event-access-session] onUnlocked listener failed',
          error instanceof Error ? error.message : String(error),
        )
      }
    }
  }

  return getEventAccessSessionStatus()
}

/** Invalidate the process session immediately. Does not delete persistent event data. */
export function lockEventAccessSession(): EventAccessStatus {
  const wasUnlocked = activeSession !== null
  activeSession = null

  if (wasUnlocked) {
    for (const listener of onLockedListeners) {
      try {
        listener()
      } catch (error) {
        console.warn(
          '[event-access-session] onLocked listener failed',
          error instanceof Error ? error.message : String(error),
        )
      }
    }
  }

  return getEventAccessSessionStatus()
}

export function assertEventAccessUnlocked(): void {
  if (!activeSession) {
    throw new EventAccessLockedError()
  }
}

/** Subscribe to unlock (e.g. start Sync Manager). Returns unsubscribe. */
export function onEventAccessUnlocked(listener: () => void): () => void {
  onUnlockedListeners.push(listener)
  return () => {
    onUnlockedListeners = onUnlockedListeners.filter((item) => item !== listener)
  }
}

/** Subscribe to lock (e.g. stop Sync Manager / scanner). Returns unsubscribe. */
export function onEventAccessLocked(listener: () => void): () => void {
  onLockedListeners.push(listener)
  return () => {
    onLockedListeners = onLockedListeners.filter((item) => item !== listener)
  }
}

/** Test helper — reset module state between cases. */
export function resetEventAccessSessionForTests(): void {
  activeSession = null
  onUnlockedListeners = []
  onLockedListeners = []
}
