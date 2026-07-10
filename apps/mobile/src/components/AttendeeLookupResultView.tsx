import type { AttendeeLookupResult } from '../models/attendee'
import './AttendeeLookupResultView.css'

interface AttendeeLookupResultProps {
  attendee: AttendeeLookupResult
}

export default function AttendeeLookupResultView({ attendee }: AttendeeLookupResultProps) {
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
        <h3 className="attendee-result__meals-title">Validatable meals</h3>
        {attendee.mealEntitlements.length > 0 ? (
          <ul className="meal-entitlement-list">
            {attendee.mealEntitlements.map((meal) => (
              <li key={meal.mealKey} className="meal-entitlement-list__item">
                <span className="meal-entitlement-list__name">{meal.mealLabel}</span>
                <span className="meal-entitlement-list__meta">
                  {meal.source === 'mealPlan' ? 'Included in meal plan' : 'Individual meal'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="attendee-result__empty">No validatable meals found for this attendee.</p>
        )}
      </div>

      <p className="attendee-result__note">Lookup only — meal validation is not enabled yet.</p>
    </section>
  )
}
