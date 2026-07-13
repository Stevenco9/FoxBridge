import type { ReactNode } from 'react'
import {
  AGRICULTURE_BOOK_ARIA_LABEL,
  AGRICULTURE_BOOK_TITLE,
} from './agricultureBookPurchase'
import './AttendeeBookIndicator.css'

/** Compact list-row book mark — render only for purchasers. */
export function AttendeeBookListIndicator(): ReactNode {
  return (
    <span
      className="attendee-list__book"
      title={AGRICULTURE_BOOK_ARIA_LABEL}
      aria-label={AGRICULTURE_BOOK_ARIA_LABEL}
      role="img"
    >
      📘
    </span>
  )
}

/** Detail-panel purchase row — render only for purchasers. */
export function AttendeeBookPurchasePanel(): ReactNode {
  return (
    <aside className="book-purchase-panel" aria-label={AGRICULTURE_BOOK_TITLE}>
      <h2 className="book-purchase-panel__title">Book</h2>
      <p className="book-purchase-panel__status">
        <span className="book-purchase-panel__icon" aria-hidden="true">
          📘
        </span>
        <span>
          {AGRICULTURE_BOOK_TITLE}: <strong>Purchased</strong>
        </span>
      </p>
    </aside>
  )
}
