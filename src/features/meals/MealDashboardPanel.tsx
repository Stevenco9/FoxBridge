import { useCallback, useEffect, useState } from 'react'
import type { MealDashboardData } from '../../shared/models/MealDashboard'
import './MealDashboardPanel.css'

interface MealDashboardPanelProps {
  open: boolean
  onClose: () => void
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return '—'
  }

  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatPercent(value: number | null): string {
  if (value == null) {
    return '—'
  }
  return `${value}%`
}

export default function MealDashboardPanel({ open, onClose }: MealDashboardPanelProps) {
  const [data, setData] = useState<MealDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(async (): Promise<void> => {
    if (!window.electronAPI?.getMealDashboard) {
      setError('Meal Dashboard is only available in the desktop app.')
      setData(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electronAPI.getMealDashboard()
      if (!result.success) {
        setData(null)
        setError(result.error)
        return
      }

      setData(result.data)
      setError(null)
    } catch (loadError) {
      setData(null)
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load the meal dashboard.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    void loadDashboard()
  }, [open, loadDashboard])

  if (!open) {
    return null
  }

  const isEmpty =
    !isLoading &&
    !error &&
    data != null &&
    data.summary.totalValidations === 0

  return (
    <div className="meal-dashboard" role="dialog" aria-modal="true" aria-labelledby="meal-dashboard-title">
      <button
        type="button"
        className="meal-dashboard__backdrop"
        aria-label="Close meal dashboard"
        onClick={onClose}
      />
      <section className="meal-dashboard__panel">
        <header className="meal-dashboard__header">
          <div>
            <h2 id="meal-dashboard-title" className="meal-dashboard__title">
              Meal Dashboard
            </h2>
            <p className="meal-dashboard__subtitle">
              {data?.conferenceName ?? 'Active conference'} · read-only
            </p>
          </div>
          <div className="meal-dashboard__header-actions">
            <button
              type="button"
              className="meal-dashboard__refresh"
              onClick={() => void loadDashboard()}
              disabled={isLoading}
            >
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </button>
            <button type="button" className="meal-dashboard__close" onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        <p className="meal-dashboard__refreshed">
          Last refreshed: {data ? formatTimestamp(data.refreshedAt) : '—'}
          {data?.entitlementSource === 'regfox_cache'
            ? ' · Entitled counts from current RegFox registrations'
            : data?.entitlementSource === 'supabase_fallback'
              ? ' · Entitled counts from last phone publish (refresh registrations for live RegFox counts)'
              : ''}
        </p>

        {isLoading && !data && (
          <div className="meal-dashboard__state" role="status">
            Loading meal validations from Supabase…
          </div>
        )}

        {error && (
          <div className="meal-dashboard__state meal-dashboard__state--error" role="alert">
            {error}
          </div>
        )}

        {isEmpty && (
          <div className="meal-dashboard__state" role="status">
            No meal validations have been recorded for this conference yet.
          </div>
        )}

        {data && !error && (
          <>
            <div className="meal-dashboard__cards">
              <article className="meal-dashboard__card">
                <h3>Total validations</h3>
                <p>{data.summary.totalValidations}</p>
              </article>
              <article className="meal-dashboard__card">
                <h3>Attendees served</h3>
                <p>{data.summary.distinctAttendeesServed}</p>
              </article>
              <article className="meal-dashboard__card">
                <h3>Meals with scans</h3>
                <p>{data.summary.mealsWithValidations}</p>
              </article>
              <article className="meal-dashboard__card">
                <h3>Most recent</h3>
                <p className="meal-dashboard__card-time">
                  {formatTimestamp(data.summary.mostRecentValidationAt)}
                </p>
              </article>
            </div>

            <section className="meal-dashboard__section">
              <h3 className="meal-dashboard__section-title">Meals</h3>
              <div className="meal-dashboard__table-wrap">
                <table className="meal-dashboard__table">
                  <thead>
                    <tr>
                      <th scope="col">Meal</th>
                      <th scope="col">Validated</th>
                      <th scope="col">Entitled (RegFox)</th>
                      <th scope="col">Served</th>
                      <th scope="col">Last scan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.meals.map((meal) => (
                      <tr key={meal.mealKey}>
                        <td>{meal.mealDisplayName}</td>
                        <td>{meal.validatedCount}</td>
                        <td>{meal.entitledCount ?? '—'}</td>
                        <td>{formatPercent(meal.percentServed)}</td>
                        <td>{formatTimestamp(meal.mostRecentValidationAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="meal-dashboard__section">
              <h3 className="meal-dashboard__section-title">Recent scans</h3>
              {data.recentScans.length === 0 ? (
                <p className="meal-dashboard__muted">No recent scans.</p>
              ) : (
                <div className="meal-dashboard__table-wrap">
                  <table className="meal-dashboard__table">
                    <thead>
                      <tr>
                        <th scope="col">Attendee</th>
                        <th scope="col">Meal</th>
                        <th scope="col">When</th>
                        <th scope="col">Scanner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentScans.map((scan, index) => (
                        <tr key={`${scan.validatedAt}-${scan.attendeeDisplayName}-${index}`}>
                          <td>{scan.attendeeDisplayName}</td>
                          <td>{scan.mealDisplayName}</td>
                          <td>{formatTimestamp(scan.validatedAt)}</td>
                          <td>{scan.scannerLabel ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </div>
  )
}
