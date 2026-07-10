import type { MealRowState } from '../models/mealValidation'
import PrimaryButton from './PrimaryButton'
import type { AttendeeLookupResult } from '../models/attendee'
import './AttendeeLookupResultView.css'

interface AttendeeLookupResultProps {
  attendee: AttendeeLookupResult
  mealStates: MealRowState[]
  onValidateMeal: (mealKey: string, mealLabel: string) => void
}

function getStatusLabel(status: MealRowState['status']): string {
  switch (status) {
    case 'available':
      return 'Available'
    case 'validating':
      return 'Validating…'
    case 'validated':
      return 'Validated'
    case 'already_validated':
      return 'Already validated'
    case 'error':
      return 'Error'
  }
}

function getStatusClass(status: MealRowState['status']): string {
  switch (status) {
    case 'validated':
      return 'meal-entitlement-list__status--validated'
    case 'already_validated':
      return 'meal-entitlement-list__status--already-validated'
    case 'error':
      return 'meal-entitlement-list__status--error'
    case 'validating':
      return 'meal-entitlement-list__status--validating'
    default:
      return 'meal-entitlement-list__status--available'
  }
}

export default function AttendeeLookupResultView({
  attendee,
  mealStates,
  onValidateMeal,
}: AttendeeLookupResultProps) {
  return (
    <section className="attendee-result" aria-live="polite">
      <div className="attendee-result__hero">
        <p className="attendee-result__label">Attendee</p>
        <h2 className="attendee-result__name">{attendee.displayName}</h2>
      </div>

      {attendee.registrationId && (
        <div className="status-card attendee-result__card">
          <p className="status-card__label">Registration ID</p>
          <p className="status-card__value">{attendee.registrationId}</p>
        </div>
      )}

      <div className="attendee-result__meals">
        <h3 className="attendee-result__meals-title">Meals</h3>
        {mealStates.length > 0 ? (
          <ul className="meal-entitlement-list">
            {mealStates.map((meal) => {
              const canValidate = meal.status === 'available' || meal.status === 'error'

              return (
                <li key={meal.mealKey} className="meal-entitlement-list__item">
                  <div className="meal-entitlement-list__header">
                    <span className="meal-entitlement-list__name">{meal.mealLabel}</span>
                    <span
                      className={`meal-entitlement-list__status ${getStatusClass(meal.status)}`}
                    >
                      {getStatusLabel(meal.status)}
                    </span>
                  </div>
                  <span className="meal-entitlement-list__meta">
                    {meal.source === 'mealPlan' ? 'Included in meal plan' : 'Individual meal'}
                  </span>
                  {meal.errorMessage && (
                    <p className="meal-entitlement-list__error" role="alert">
                      {meal.errorMessage}
                    </p>
                  )}
                  {canValidate && (
                    <PrimaryButton
                      className="meal-entitlement-list__button"
                      onClick={() => onValidateMeal(meal.mealKey, meal.mealLabel)}
                      disabled={meal.status === 'validating'}
                    >
                      Validate meal
                    </PrimaryButton>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="attendee-result__empty">No validatable meals found for this attendee.</p>
        )}
      </div>
    </section>
  )
}
