import type { UpstreamCheckInReconciler } from './upstreamCheckInTypes'
import { regFoxCheckInReconciler } from './adapters/regFoxCheckInReconciler'

const REGISTRY: ReadonlyMap<string, UpstreamCheckInReconciler> = new Map([
  [regFoxCheckInReconciler.platformId, regFoxCheckInReconciler],
])

/**
 * Resolve reconciler from trusted Event.registrationPlatform.
 * Returns null when no writeback adapter exists (caller marks not_applicable).
 */
export function getUpstreamCheckInReconciler(
  registrationPlatform: string | null | undefined,
): UpstreamCheckInReconciler | null {
  const key = registrationPlatform?.trim().toLowerCase()
  if (!key) {
    return null
  }
  return REGISTRY.get(key) ?? null
}

export function listRegisteredUpstreamCheckInPlatforms(): string[] {
  return [...REGISTRY.keys()]
}
