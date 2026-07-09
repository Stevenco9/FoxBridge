import { ipcMain } from 'electron'
import {
  getMealValidationsForAttendee,
  validateMeal,
} from './db/mealValidationRepository'
import type { ValidateMealRequest } from '../src/shared/models/MealValidation'

export function registerMealValidationHandlers(): void {
  ipcMain.removeHandler('meals:getValidationsForAttendee')
  ipcMain.handle('meals:getValidationsForAttendee', (_event, attendeeId: string) => {
    if (!attendeeId?.trim()) {
      return []
    }

    return getMealValidationsForAttendee(attendeeId.trim())
  })

  ipcMain.removeHandler('meals:validateMeal')
  ipcMain.handle('meals:validateMeal', (_event, request: ValidateMealRequest) => {
    if (!request?.attendeeId?.trim() || !request.mealKey?.trim() || !request.mealLabel?.trim()) {
      throw new Error('Attendee id, meal key, and meal label are required.')
    }

    return validateMeal({
      attendeeId: request.attendeeId.trim(),
      mealKey: request.mealKey.trim(),
      mealLabel: request.mealLabel.trim(),
      validatedBy: request.validatedBy ?? null,
    })
  })
}
