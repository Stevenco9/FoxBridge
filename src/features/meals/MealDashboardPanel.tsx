import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAttendeeFullName } from '../attendees/searchAttendees'
import { getAttendeeQrValue } from '../badge/getAttendeeQrValue'
import {
  filterMealDetailAttendees,
  sortMealDetailAttendees,
} from '../../shared/meals/buildMealDetailReport'
import { resolveCanonicalMealServiceId } from '../../shared/meals/canonicalMealOrder'
import { getValidatableMeals } from './mealValidation'
import AttendeeMealStatusPanel from './AttendeeMealStatusPanel'
import type { Attendee } from '../../shared/models'
import type {
  MealDashboardData,
  MealDetailData,
  MealDetailSortMode,
  MealDetailStatusFilter,
} from '../../shared/models/MealDashboard'
import './MealDashboardPanel.css'

interface MealDashboardPanelProps {
  open: boolean
  attendees: Attendee[]
  onClose: () => void
}

type SummaryTab = 'meals' | 'people'
type PeopleCheckInFilter = 'all' | 'checked_in' | 'not_checked_in'

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

function matchesAttendeeName(attendee: Attendee, query: string): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) {
    return true
  }

  const fullName = getAttendeeFullName(attendee).toLowerCase()
  const first = attendee.firstName.toLowerCase()
  const last = attendee.lastName.toLowerCase()
  return fullName.includes(normalized) || first.includes(normalized) || last.includes(normalized)
}

export default function MealDashboardPanel({
  open,
  attendees,
  onClose,
}: MealDashboardPanelProps) {
  const [data, setData] = useState<MealDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [summaryTab, setSummaryTab] = useState<SummaryTab>('meals')
  const [peopleQuery, setPeopleQuery] = useState('')
  const [peopleCheckInFilter, setPeopleCheckInFilter] = useState<PeopleCheckInFilter>('all')
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null)
  const [attendeeRefreshToken, setAttendeeRefreshToken] = useState(0)

  const [selectedMealKey, setSelectedMealKey] = useState<string | null>(null)
  const [detail, setDetail] = useState<MealDetailData | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<MealDetailStatusFilter>('all')
  const [nameQuery, setNameQuery] = useState('')
  const [sortMode, setSortMode] = useState<MealDetailSortMode>('name_asc')

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

  const loadDetail = useCallback(async (mealKey: string): Promise<void> => {
    if (!window.electronAPI?.getMealDashboardDetail) {
      setDetailError('Meal detail is only available in the desktop app.')
      setDetail(null)
      return
    }

    setIsDetailLoading(true)
    setDetailError(null)

    try {
      const result = await window.electronAPI.getMealDashboardDetail(mealKey)
      if (!result.success) {
        setDetail(null)
        setDetailError(result.error)
        return
      }

      setDetail(result.data)
      setDetailError(null)
    } catch (loadError) {
      setDetail(null)
      setDetailError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load meal detail.',
      )
    } finally {
      setIsDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    void loadDashboard()
  }, [open, loadDashboard])

  useEffect(() => {
    if (!open) {
      setSummaryTab('meals')
      setPeopleQuery('')
      setPeopleCheckInFilter('all')
      setSelectedAttendeeId(null)
      setAttendeeRefreshToken(0)
      setSelectedMealKey(null)
      setDetail(null)
      setDetailError(null)
      setStatusFilter('all')
      setNameQuery('')
      setSortMode('name_asc')
    }
  }, [open])

  const openMealDetail = (mealKey: string): void => {
    setSelectedAttendeeId(null)
    setSelectedMealKey(mealKey)
    setStatusFilter('all')
    setNameQuery('')
    setSortMode('name_asc')
    void loadDetail(mealKey)
  }

  const openAttendeeDetail = (attendeeId: string): void => {
    setSelectedMealKey(null)
    setDetail(null)
    setDetailError(null)
    setSelectedAttendeeId(attendeeId)
    setAttendeeRefreshToken(0)
  }

  const backToSummary = (): void => {
    setSelectedMealKey(null)
    setDetail(null)
    setDetailError(null)
    setIsDetailLoading(false)
    setSelectedAttendeeId(null)
    setStatusFilter('all')
    setNameQuery('')
    setSortMode('name_asc')
  }

  const handleRefresh = (): void => {
    if (selectedMealKey) {
      void loadDetail(selectedMealKey)
      return
    }
    if (selectedAttendeeId) {
      setAttendeeRefreshToken((token) => token + 1)
      return
    }
    void loadDashboard()
  }

  const selectedAttendee = useMemo(
    () => attendees.find((attendee) => attendee.id === selectedAttendeeId) ?? null,
    [attendees, selectedAttendeeId],
  )

  const peopleCheckInCounts = useMemo(() => {
    let checkedIn = 0
    let notCheckedIn = 0
    for (const attendee of attendees) {
      if (attendee.checkedIn) {
        checkedIn += 1
      } else {
        notCheckedIn += 1
      }
    }
    return { checkedIn, notCheckedIn, total: attendees.length }
  }, [attendees])

  const peopleMatches = useMemo(() => {
    const matches = attendees.filter((attendee) => {
      if (!matchesAttendeeName(attendee, peopleQuery)) {
        return false
      }
      if (peopleCheckInFilter === 'checked_in' && !attendee.checkedIn) {
        return false
      }
      if (peopleCheckInFilter === 'not_checked_in' && attendee.checkedIn) {
        return false
      }
      return true
    })
    return [...matches].sort((left, right) =>
      getAttendeeFullName(left).localeCompare(getAttendeeFullName(right), undefined, {
        sensitivity: 'base',
      }),
    )
  }, [attendees, peopleQuery, peopleCheckInFilter])

  const visibleAttendees = useMemo(() => {
    if (!detail) {
      return []
    }
    return sortMealDetailAttendees(
      filterMealDetailAttendees(detail.attendees, statusFilter, nameQuery),
      sortMode,
    )
  }, [detail, statusFilter, nameQuery, sortMode])

  if (!open) {
    return null
  }

  const showingMealDetail = selectedMealKey != null
  const showingAttendeeDetail = selectedAttendeeId != null
  const showingNested = showingMealDetail || showingAttendeeDetail
  const isEmpty =
    !showingNested &&
    summaryTab === 'meals' &&
    !isLoading &&
    !error &&
    data != null &&
    data.summary.totalValidations === 0

  const detailBusy = isDetailLoading
  const summaryBusy = isLoading
  const refreshBusy = showingMealDetail ? detailBusy : summaryBusy

  const title = showingMealDetail
    ? (detail?.mealDisplayName ?? 'Meal detail')
    : showingAttendeeDetail
      ? (selectedAttendee
          ? getAttendeeFullName(selectedAttendee) || 'Attendee meals'
          : 'Attendee meals')
      : 'Meal Dashboard'

  return (
    <div className="meal-dashboard" role="dialog" aria-modal="true" aria-labelledby="meal-dashboard-title">
      <button
        type="button"
        className="meal-dashboard__backdrop"
        aria-label="Close meal dashboard"
        onClick={onClose}
      />
      <section className={`meal-dashboard__panel${showingNested ? ' meal-dashboard__panel--detail' : ''}`}>
        <header className="meal-dashboard__header">
          <div>
            <h2 id="meal-dashboard-title" className="meal-dashboard__title">
              {title}
            </h2>
            <p className="meal-dashboard__subtitle">
              {showingMealDetail
                ? `${data?.conferenceName ?? 'Active conference'} · read-only meal report`
                : showingAttendeeDetail
                  ? `${data?.conferenceName ?? 'Active conference'} · purchased vs validated`
                  : `${data?.conferenceName ?? 'Active conference'} · read-only`}
            </p>
          </div>
          <div className="meal-dashboard__header-actions">
            {showingNested && (
              <button type="button" className="meal-dashboard__back" onClick={backToSummary}>
                Back
              </button>
            )}
            <button
              type="button"
              className="meal-dashboard__refresh"
              onClick={handleRefresh}
              disabled={refreshBusy && !showingAttendeeDetail}
            >
              {refreshBusy && !showingAttendeeDetail ? 'Refreshing…' : 'Refresh'}
            </button>
            <button type="button" className="meal-dashboard__close" onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        {!showingNested && (
          <p className="meal-dashboard__refreshed">
            Last refreshed: {data ? formatTimestamp(data.refreshedAt) : '—'}
            {data?.entitlementSource === 'regfox_cache'
              ? ' · Entitled counts from current RegFox registrations'
              : data?.entitlementSource === 'supabase_fallback'
                ? ' · Entitled counts from last phone publish (refresh registrations for live RegFox counts)'
                : ''}
          </p>
        )}

        {showingMealDetail && (
          <p className="meal-dashboard__refreshed">
            Last refreshed: {detail ? formatTimestamp(detail.refreshedAt) : '—'}
            {detail?.entitlementSource === 'regfox_cache'
              ? ' · Entitled list from current RegFox registrations'
              : detail?.entitlementSource === 'supabase_fallback'
                ? ' · Entitled list from last phone publish'
                : ''}
          </p>
        )}

        {!showingNested && (
          <div className="meal-dashboard__tabs" role="tablist" aria-label="Meal dashboard views">
            <button
              type="button"
              role="tab"
              aria-selected={summaryTab === 'meals'}
              className={`meal-dashboard__tab${summaryTab === 'meals' ? ' meal-dashboard__tab--active' : ''}`}
              onClick={() => setSummaryTab('meals')}
            >
              By meal
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={summaryTab === 'people'}
              className={`meal-dashboard__tab${summaryTab === 'people' ? ' meal-dashboard__tab--active' : ''}`}
              onClick={() => setSummaryTab('people')}
            >
              By attendee
            </button>
          </div>
        )}

        {!showingNested && summaryTab === 'meals' && isLoading && !data && (
          <div className="meal-dashboard__state" role="status">
            Loading meal validations from Supabase…
          </div>
        )}

        {!showingNested && summaryTab === 'meals' && error && (
          <div className="meal-dashboard__state meal-dashboard__state--error" role="alert">
            {error}
          </div>
        )}

        {isEmpty && (
          <div className="meal-dashboard__state" role="status">
            No meal validations have been recorded for this conference yet.
          </div>
        )}

        {!showingNested && summaryTab === 'meals' && data && !error && (
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
              <p className="meal-dashboard__muted">
                Select a meal to view who is entitled and who has been served.
              </p>
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
                      <tr
                        key={meal.mealKey}
                        className="meal-dashboard__meal-row"
                        tabIndex={0}
                        role="button"
                        aria-label={`Open detail for ${meal.mealDisplayName}`}
                        onClick={() => openMealDetail(meal.mealKey)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            openMealDetail(meal.mealKey)
                          }
                        }}
                      >
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

        {!showingNested && summaryTab === 'people' && (
          <section className="meal-dashboard__section">
            <h3 className="meal-dashboard__section-title">Find an attendee</h3>
            <p className="meal-dashboard__muted">
              Search by name, then open someone to see meals purchased and which were validated.
            </p>

            <div className="meal-dashboard__cards">
              <article className="meal-dashboard__card">
                <h3>Total</h3>
                <p>{peopleCheckInCounts.total}</p>
              </article>
              <article className="meal-dashboard__card">
                <h3>Checked in</h3>
                <p>{peopleCheckInCounts.checkedIn}</p>
              </article>
              <article className="meal-dashboard__card">
                <h3>Not checked in</h3>
                <p>{peopleCheckInCounts.notCheckedIn}</p>
              </article>
            </div>

            <label className="meal-dashboard__search meal-dashboard__search--wide">
              <span className="meal-dashboard__search-label">Name</span>
              <input
                type="search"
                value={peopleQuery}
                onChange={(event) => setPeopleQuery(event.target.value)}
                placeholder="Search attendee name"
                autoFocus
              />
            </label>

            <div className="meal-dashboard__filters" role="group" aria-label="Check-in filter">
              {(
                [
                  ['all', 'All'],
                  ['checked_in', 'Checked in'],
                  ['not_checked_in', 'Not checked in'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`meal-dashboard__filter${peopleCheckInFilter === value ? ' meal-dashboard__filter--active' : ''}`}
                  onClick={() => setPeopleCheckInFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            {attendees.length === 0 ? (
              <div className="meal-dashboard__state" role="status">
                No registrations loaded yet. Refresh registrations on the home screen first.
              </div>
            ) : peopleMatches.length === 0 ? (
              <div className="meal-dashboard__state" role="status">
                {peopleQuery.trim()
                  ? 'No attendees match that name and check-in filter.'
                  : peopleCheckInFilter === 'checked_in'
                    ? 'No checked-in attendees.'
                    : peopleCheckInFilter === 'not_checked_in'
                      ? 'Everyone is checked in.'
                      : 'No attendees to show.'}
              </div>
            ) : (
              <div className="meal-dashboard__table-wrap meal-dashboard__people-list">
                <table className="meal-dashboard__table">
                  <thead>
                    <tr>
                      <th scope="col">Attendee</th>
                      <th scope="col">Check-in</th>
                      <th scope="col">Meals purchased</th>
                      <th scope="col">Meals validated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {peopleMatches.map((attendee) => {
                      const purchasedMeals = getValidatableMeals(attendee)
                      const mealCount = purchasedMeals.length
                      const name = getAttendeeFullName(attendee) || 'Unnamed attendee'
                      const qrIdentifier = getAttendeeQrValue(attendee)
                      const validatedKeys = data
                        ? [
                            ...(data.attendeeValidatedMealKeys[qrIdentifier] ?? []),
                            ...(data.attendeeValidatedMealKeys[attendee.id] ?? []),
                          ]
                        : null
                      const purchasedKeys = new Set(
                        purchasedMeals.map((meal) => resolveCanonicalMealServiceId(meal.id)),
                      )
                      const validatedCount =
                        validatedKeys == null
                          ? null
                          : new Set(
                              validatedKeys
                                .map(resolveCanonicalMealServiceId)
                                .filter((mealKey) => purchasedKeys.has(mealKey)),
                            ).size
                      return (
                        <tr
                          key={attendee.id}
                          className="meal-dashboard__meal-row"
                          tabIndex={0}
                          role="button"
                          aria-label={`Open meals for ${name}`}
                          onClick={() => openAttendeeDetail(attendee.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              openAttendeeDetail(attendee.id)
                            }
                          }}
                        >
                          <td>{name}</td>
                          <td>
                            <span
                              className={`meal-dashboard__status meal-dashboard__status--${attendee.checkedIn ? 'served' : 'not_served'}`}
                            >
                              {attendee.checkedIn ? 'Checked in' : 'Not checked in'}
                            </span>
                          </td>
                          <td>{mealCount}</td>
                          <td>{validatedCount ?? '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {showingAttendeeDetail && selectedAttendee && (
          <AttendeeMealStatusPanel
            attendee={selectedAttendee}
            refreshToken={attendeeRefreshToken}
          />
        )}

        {showingAttendeeDetail && !selectedAttendee && (
          <div className="meal-dashboard__state meal-dashboard__state--error" role="alert">
            That attendee is no longer in the loaded registration list.
          </div>
        )}

        {showingMealDetail && isDetailLoading && !detail && (
          <div className="meal-dashboard__state" role="status">
            Loading meal detail…
          </div>
        )}

        {showingMealDetail && detailError && (
          <div className="meal-dashboard__state meal-dashboard__state--error" role="alert">
            {detailError}
          </div>
        )}

        {showingMealDetail && detail && !detailError && (
          <>
            <div className="meal-dashboard__cards">
              <article className="meal-dashboard__card">
                <h3>Entitled</h3>
                <p>{detail.totalEntitled}</p>
              </article>
              <article className="meal-dashboard__card">
                <h3>Served</h3>
                <p>{detail.totalServed}</p>
              </article>
              <article className="meal-dashboard__card">
                <h3>Not served</h3>
                <p>{detail.totalNotServed}</p>
              </article>
              <article className="meal-dashboard__card">
                <h3>Served %</h3>
                <p>{formatPercent(detail.percentServed)}</p>
              </article>
              <article className="meal-dashboard__card">
                <h3>Most recent</h3>
                <p className="meal-dashboard__card-time">
                  {formatTimestamp(detail.mostRecentValidationAt)}
                </p>
              </article>
            </div>

            <div className="meal-dashboard__toolbar">
              <div className="meal-dashboard__filters" role="group" aria-label="Status filter">
                {(
                  [
                    ['all', 'All'],
                    ['served', 'Served'],
                    ['not_served', 'Not Served'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`meal-dashboard__filter${statusFilter === value ? ' meal-dashboard__filter--active' : ''}`}
                    onClick={() => setStatusFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="meal-dashboard__search">
                <span className="meal-dashboard__search-label">Search</span>
                <input
                  type="search"
                  value={nameQuery}
                  onChange={(event) => setNameQuery(event.target.value)}
                  placeholder="Attendee name"
                />
              </label>

              <label className="meal-dashboard__sort">
                <span className="meal-dashboard__search-label">Sort</span>
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as MealDetailSortMode)}
                >
                  <option value="name_asc">Name A–Z</option>
                  <option value="name_desc">Name Z–A</option>
                  <option value="served_newest">Served most recently</option>
                  <option value="served_oldest">Served oldest first</option>
                </select>
              </label>
            </div>

            {detail.totalEntitled === 0 ? (
              <div className="meal-dashboard__state" role="status">
                No one is currently entitled to this meal.
              </div>
            ) : visibleAttendees.length === 0 ? (
              <div className="meal-dashboard__state" role="status">
                {nameQuery.trim()
                  ? 'No attendees match that name.'
                  : statusFilter === 'served'
                    ? 'No served attendees for this meal.'
                    : statusFilter === 'not_served'
                      ? 'Everyone entitled to this meal has been served.'
                      : 'No attendees to show.'}
              </div>
            ) : (
              <>
                {detail.totalServed === 0 && statusFilter !== 'served' && (
                  <div className="meal-dashboard__state" role="status">
                    {detail.totalEntitled} entitled · none served yet.
                  </div>
                )}
                <div className="meal-dashboard__table-wrap">
                  <table className="meal-dashboard__table">
                    <thead>
                      <tr>
                        <th scope="col">Attendee</th>
                        <th scope="col">Status</th>
                        <th scope="col">Validated</th>
                        <th scope="col">Scanner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleAttendees.map((row) => (
                        <tr key={row.attendeeId}>
                          <td>{row.attendeeDisplayName}</td>
                          <td>
                            <span
                              className={`meal-dashboard__status meal-dashboard__status--${row.status}`}
                            >
                              {row.status === 'served' ? 'Served' : 'Not Served'}
                            </span>
                          </td>
                          <td>{formatTimestamp(row.validatedAt)}</td>
                          <td>{row.scannerLabel ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  )
}
