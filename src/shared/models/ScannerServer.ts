export interface ScannerServerStatus {
  running: boolean
  host: string
  port: number
  baseUrl: string | null
  attendeeCacheLoaded: boolean
  attendeeCount: number
}

export interface ScannerAttendeeMeal {
  id: string
  name: string
  source: 'individual' | 'mealPlan'
  sourcePlanId?: string
}

export interface ScannerAttendeeResponse {
  attendeeId: string
  name: string
  registrationId: string
  validatableMeals: ScannerAttendeeMeal[]
}
