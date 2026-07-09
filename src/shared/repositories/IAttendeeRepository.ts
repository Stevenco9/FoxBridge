import type { Attendee } from '../models'

/**
 * Internal contract for attendee storage in FoxBridge.
 *
 * Implementations handle persistence details; consumers depend only on this
 * interface. Data is expressed using FoxBridge domain models, not external
 * API or platform shapes.
 */
export interface IAttendeeRepository {
  /**
   * Returns every attendee in the local store.
   */
  getAll(): Promise<Attendee[]>

  /**
   * Returns a single attendee by FoxBridge-local id, or null if not found.
   */
  getById(id: string): Promise<Attendee | null>

  /**
   * Finds attendees matching a free-text query (e.g. name, email, confirmation code).
   */
  search(query: string): Promise<Attendee[]>

  /**
   * Persists a new attendee record and returns the saved attendee.
   */
  save(attendee: Attendee): Promise<Attendee>

  /**
   * Updates an existing attendee record and returns the updated attendee.
   */
  update(attendee: Attendee): Promise<Attendee>

  /**
   * Removes an attendee record by FoxBridge-local id.
   */
  delete(id: string): Promise<void>

  /**
   * Synchronizes attendee data from the upstream source of truth.
   * Implementation and sync strategy are defined by the integration layer.
   */
  sync(): Promise<void>
}
