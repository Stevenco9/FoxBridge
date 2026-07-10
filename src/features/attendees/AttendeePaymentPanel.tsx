import type { ReactNode } from 'react'
import type { AttendeePayment } from '../../shared/models'
import { formatMoney } from '../../shared/payments/money'
import {
  formatPaymentListIndicator,
  getPaymentStatusLabel,
} from '../../shared/payments/normalizePayment'
import './AttendeePaymentPanel.css'

interface AttendeePaymentPanelProps {
  payment: AttendeePayment
}

function DetailRow({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="payment-panel__row">
      <dt className="payment-panel__label">{label}</dt>
      <dd className="payment-panel__value">{value}</dd>
    </div>
  )
}

export default function AttendeePaymentPanel({ payment }: AttendeePaymentPanelProps) {
  const statusLabel = getPaymentStatusLabel(payment.status)

  return (
    <aside className="payment-panel" aria-label="Payment status">
      <h2 className="payment-panel__title">Payment</h2>

      <dl className="payment-panel__details">
        <DetailRow label="Status" value={statusLabel} />
        {payment.totalAmount != null && (
          <DetailRow
            label="Total"
            value={formatMoney(payment.totalAmount, payment.currency)}
          />
        )}
        {payment.amountPaid != null && (
          <DetailRow
            label="Paid"
            value={formatMoney(payment.amountPaid, payment.currency)}
          />
        )}
        {payment.balanceDue != null && (
          <DetailRow
            label="Balance due"
            value={formatMoney(payment.balanceDue, payment.currency)}
          />
        )}
        {payment.currency && <DetailRow label="Currency" value={payment.currency} />}
      </dl>

      <p className="payment-panel__source">Payment status from RegFox</p>
    </aside>
  )
}

/** Compact text indicator for attendee list rows. */
export function AttendeePaymentListBadge({
  payment,
}: {
  payment: AttendeePayment
}): ReactNode {
  const statusClass =
    payment.status === 'paid'
      ? 'payment-badge--paid'
      : payment.status === 'pending'
        ? 'payment-badge--unpaid'
        : payment.status === 'cancelled' || payment.status === 'refunded'
          ? 'payment-badge--closed'
          : 'payment-badge--unknown'

  return (
    <span className={`payment-badge ${statusClass}`}>
      {formatPaymentListIndicator(payment)}
    </span>
  )
}
