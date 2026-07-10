/**
 * Internal RegFox / Webconnex API shapes.
 * Not exported outside the integration layer.
 */

export interface RegFoxFieldDataItem {
  label?: string
  path?: string
  value?: string | number | boolean | null
  amount?: string
}

export interface RegFoxBilling {
  firstName?: string
  lastName?: string
  phone?: string
  company?: string
  organization?: string
  jobTitle?: string
  department?: string
}

export interface RegFoxRegistrant {
  id?: number
  displayId?: string
  formId?: number
  orderEmail?: string
  orderNumber?: string
  billing?: RegFoxBilling
  fieldData?: RegFoxFieldDataItem[] | Record<string, unknown>
  checkedIn?: boolean
  dateCheckedIn?: string
  dateCreated?: string
  dateUpdated?: string
  levelLabel?: string
  levelKey?: string
  /**
   * Registrant / payment lifecycle status from RegFox
   * (e.g. completed, pending, canceled, pending offline payment).
   * Confirmed present on live /search/registrants responses.
   */
  status?: string
  /**
   * Registration total. Live responses return this as a string; numbers are
   * accepted defensively. Prefer `total` when both `total` and `amount` exist.
   */
  amount?: string | number
  /** Registration total (confirmed on live responses; often mirrors `amount`). */
  total?: string | number
  /** Unpaid balance / outstanding amount (confirmed on live responses). */
  outstandingAmount?: string | number
  /** ISO currency code (confirmed on live responses). */
  currency?: string
}

export interface RegFoxListResponse<T> {
  responseCode?: number
  data?: T[]
  hasMore?: boolean
  totalResults?: number
  /** Response-envelope cursor for the next page (not necessarily the last row's id). */
  startingAfter?: number | string
  error?: {
    message?: string
  }
}

export interface RegFoxCheckInResponseData {
  id?: number
  date?: string
  displayId?: string
}

export interface RegFoxMutationResponse<T> {
  responseCode?: number
  data?: T
  error?: {
    message?: string
  }
}
