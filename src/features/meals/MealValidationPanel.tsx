import { useState } from 'react'
import type { Attendee } from '../../shared/models'
import {
  findAttendeeByQrValue,
  formatAttendeeDisplayName,
  formatDietaryRestriction,
  getDietaryRestrictionInfo,
  getMealChoiceLabel,
  getMealPlanPurchases,
  getValidatableMeals,
  isMealValidated,
} from './mealValidation'
import './MealValidationPanel.css'

interface MealValidationPanelProps {
  attendees: Attendee[]
  selectedAttendee: Attendee | null
  validatedMealKeys: Set<string>
  onValidateMeal: (attendeeId: string, mealPurchaseId: string) => void
  disabled?: boolean
}

export default function MealValidationPanel({
  attendees,
  selectedAttendee,
  validatedMealKeys,
  onValidateMeal,
  disabled = false,
}: MealValidationPanelProps) {
  const [qrValue, setQrValue] = useState('')
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookedUpAttendee, setLookedUpAttendee] = useState<Attendee | null>(null)

  const displayAttendee = lookedUpAttendee ?? selectedAttendee

  const handleLookup = (): void => {
    const attendee = findAttendeeByQrValue(attendees, qrValue)
    if (!attendee) {
      setLookedUpAttendee(null)
      setLookupError('No attendee found for that QR value.')
      return
    }

    setLookedUpAttendee(attendee)
    setLookupError(null)
  }

  const handleSubmit = (event: { preventDefault: () => void }): void => {
    event.preventDefault()
    handleLookup()
  }

  const mealPlans = displayAttendee ? getMealPlanPurchases(displayAttendee.purchases) : []
  const validatableMeals = displayAttendee ? getValidatableMeals(displayAttendee) : []
  const mealChoice = displayAttendee ? getMealChoiceLabel(displayAttendee.purchases) : null
  const dietaryInfo = displayAttendee
    ? getDietaryRestrictionInfo(displayAttendee.customFields)
    : null

  return (
    <aside className="meal-validation-panel">
      <h2 className="meal-validation-panel__title">Meal Validation</h2>
      <p className="meal-validation-panel__subtitle">
        Enter or paste a scanned QR value, or select an attendee from the list.
      </p>

      <form className="meal-validation-panel__form" onSubmit={handleSubmit}>
        <label className="meal-validation-panel__label" htmlFor="meal-qr-input">
          QR value
        </label>
        <input
          id="meal-qr-input"
          className="meal-validation-panel__input"
          type="text"
          value={qrValue}
          onChange={(event) => setQrValue(event.target.value)}
          placeholder="Paste attendee id from QR scan"
          disabled={disabled}
          autoComplete="off"
        />
        <button
          type="submit"
          className="meal-validation-panel__lookup-button"
          disabled={disabled || !qrValue.trim()}
        >
          Look up attendee
        </button>
      </form>

      {lookupError && (
        <p className="meal-validation-panel__error" role="alert">
          {lookupError}
        </p>
      )}

      {displayAttendee && (
        <div className="meal-validation-panel__result">
          <h3 className="meal-validation-panel__name">
            {formatAttendeeDisplayName(displayAttendee)}
          </h3>

          <dl className="meal-validation-panel__details">
            <div className="meal-validation-panel__detail">
              <dt>Meal plans</dt>
              <dd>
                {mealPlans.length === 0 ? (
                  'None selected'
                ) : (
                  <ul className="meal-validation-panel__list">
                    {mealPlans.map((purchase) => (
                      <li key={purchase.id}>{purchase.name}</li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>

            <div className="meal-validation-panel__detail">
              <dt>Validatable meals</dt>
              <dd>
                {validatableMeals.length === 0 ? (
                  'None available'
                ) : (
                  <ul className="meal-validation-panel__meal-actions">
                    {validatableMeals.map((meal) => {
                      const alreadyValidated = isMealValidated(
                        validatedMealKeys,
                        displayAttendee.id,
                        meal.id,
                      )

                      return (
                        <li key={meal.id} className="meal-validation-panel__meal-action">
                          <div className="meal-validation-panel__meal-labels">
                            <span className="meal-validation-panel__meal-name">
                              {meal.name}
                            </span>
                            {meal.source === 'mealPlan' && (
                              <span className="meal-validation-panel__meal-source">
                                Included in meal plan
                              </span>
                            )}
                          </div>
                          {alreadyValidated ? (
                            <span
                              className="meal-validation-panel__validated-badge"
                              role="status"
                            >
                              Already validated
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="meal-validation-panel__validate-button"
                              onClick={() =>
                                onValidateMeal(displayAttendee.id, meal.id)
                              }
                              disabled={disabled}
                            >
                              Validate meal
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </dd>
            </div>

            <div className="meal-validation-panel__detail">
              <dt>Meal choice</dt>
              <dd>{mealChoice ?? 'Not selected'}</dd>
            </div>

            <div className="meal-validation-panel__detail">
              <dt>Dietary restriction</dt>
              <dd>{dietaryInfo ? formatDietaryRestriction(dietaryInfo) : 'Not provided'}</dd>
            </div>
          </dl>

          <p className="meal-validation-panel__meta">Attendee id: {displayAttendee.id}</p>
        </div>
      )}
    </aside>
  )
}
