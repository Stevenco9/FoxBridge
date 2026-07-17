import { useEffect, useMemo, useState } from 'react'
import { getAttendeeQrValue } from '../badge/getAttendeeQrValue'
import { getValidatableMeals } from './mealValidation'
import { buildAttendeeMealStatusReport } from '../../shared/meals/buildAttendeeMealStatus'
import type { Attendee } from '../../shared/models'
import type { AttendeeMealStatusRow } from '../../shared/models/AttendeeMealStatus'
import type { AttendeeMealValidationInput } from '../../shared/meals/buildAttendeeMealStatus'
import './AttendeeMealStatusPanel.css'

interface AttendeeMealStatusPanelProps {
  attendee: Attendee
  /** Increment to force a reload without changing the selected attendee. */
  refreshToken?: number
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

export default function AttendeeMealStatusPanel({
  attendee,
  refreshToken = 0,
}: AttendeeMealStatusPanelProps) {
  const [cloudValidations, setCloudValidations] = useState<AttendeeMealValidationInput[]>([])
  const [localValidations, setLocalValidations] = useState<AttendeeMealValidationInput[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cloudAvailable, setCloudAvailable] = useState(true)

  const entitledMeals = useMemo(() => getValidatableMeals(attendee), [attendee])

  useEffect(() => {
    let isMounted = true

    async function loadValidations(): Promise<void> {
      setIsLoading(true)
      setError(null)

      const qrValue = getAttendeeQrValue(attendee)
      const lookupIds = [...new Set([qrValue, attendee.id].filter(Boolean))]

      try {
        const localPromise =
          window.electronAPI?.getMealValidationsForAttendee != null
            ? window.electronAPI.getMealValidationsForAttendee(attendee.id).then((rows) =>
                rows.map((row) => ({
                  mealKey: row.mealKey,
                  validatedAt: row.validatedAt,
                  scannerLabel: null as string | null,
                })),
              )
            : Promise.resolve([] as AttendeeMealValidationInput[])

        const cloudPromise =
          window.electronAPI?.getAttendeeMealValidations != null
            ? window.electronAPI.getAttendeeMealValidations(lookupIds)
            : Promise.resolve({
                success: true as const,
                data: { validations: [], cloudAvailable: false },
              })

        const [localRows, cloudResult] = await Promise.all([localPromise, cloudPromise])

        if (!isMounted) {
          return
        }

        setLocalValidations(localRows)

        if (!cloudResult.success) {
          setCloudValidations([])
          setCloudAvailable(false)
          setError(cloudResult.error)
          return
        }

        setCloudAvailable(cloudResult.data.cloudAvailable)
        setCloudValidations(
          cloudResult.data.validations.map((row) => ({
            mealKey: row.mealKey,
            validatedAt: row.validatedAt,
            scannerLabel: row.scannerLabel,
          })),
        )
        setError(null)
      } catch (loadError) {
        if (!isMounted) {
          return
        }
        setCloudValidations([])
        setLocalValidations([])
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load meal validation status.',
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadValidations()

    return () => {
      isMounted = false
    }
  }, [attendee, refreshToken])

  const report = useMemo(
    () =>
      buildAttendeeMealStatusReport({
        entitledMeals,
        validations: [...cloudValidations, ...localValidations],
      }),
    [entitledMeals, cloudValidations, localValidations],
  )

  return (
    <div className="attendee-meal-status" aria-label="Meal purchase and validation status">
      <p className="attendee-meal-status__summary">
        {isLoading
          ? 'Loading validation status…'
          : entitledMeals.length === 0
            ? 'No meals purchased'
            : `${report.summary.totalServed} of ${report.summary.totalPurchased} validated`}
      </p>

      {error && (
        <p className="attendee-meal-status__error" role="alert">
          {error}
        </p>
      )}

      {!isLoading && entitledMeals.length === 0 && (
        <p className="attendee-meal-status__empty">This attendee has no validatable meals.</p>
      )}

      {!isLoading && report.rows.length > 0 && (
        <div className="meal-dashboard__table-wrap">
          <table className="meal-dashboard__table">
            <thead>
              <tr>
                <th scope="col">Meal</th>
                <th scope="col">Status</th>
                <th scope="col">Validated</th>
                <th scope="col">Scanner</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row: AttendeeMealStatusRow) => (
                <tr key={row.mealKey}>
                  <td>
                    <span className="attendee-meal-status__meal-name">{row.mealDisplayName}</span>
                    {row.source === 'mealPlan' && (
                      <span className="attendee-meal-status__meal-source"> · Meal plan</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`attendee-meal-status__badge attendee-meal-status__badge--${row.status}`}
                    >
                      {row.status === 'served' ? 'Validated' : 'Not validated'}
                    </span>
                  </td>
                  <td>{formatTimestamp(row.validatedAt)}</td>
                  <td>{row.scannerLabel ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!cloudAvailable && !error && (
        <p className="attendee-meal-status__note">
          Phone scan history unavailable — showing local desktop validations only.
        </p>
      )}
    </div>
  )
}
