import { useState } from 'react'
import type { Attendee } from '../../shared/models'
import {
  type BadgeLayoutSelection,
  getAvailableBadgeFields,
  MAX_FIELDS_PER_SLOT,
  NONE_FIELD_ID,
  normalizeSlotFields,
  resolveBadgeFieldValues,
} from './badgeFields'
import './BadgePreview.css'

interface BadgePreviewPanelProps {
  attendee: Attendee
  layout: BadgeLayoutSelection
  onLayoutChange: (layout: BadgeLayoutSelection) => void
}

type BadgeSlot = keyof BadgeLayoutSelection

function MultiFieldDropdown({
  label,
  values,
  options,
  onChange,
}: {
  label: string
  values: string[]
  options: { id: string; label: string }[]
  onChange: (values: string[]) => void
}) {
  const optionIds = new Set(options.map((option) => option.id))
  const selectedIds = values.filter(
    (id) => id !== NONE_FIELD_ID && optionIds.has(id),
  )
  const selectedLabels = selectedIds
    .map((id) => options.find((option) => option.id === id)?.label)
    .filter((labelText): labelText is string => Boolean(labelText))

  const summaryText =
    selectedLabels.length > 0 ? selectedLabels.join(', ') : 'Choose fields...'

  const handleToggle = (fieldId: string, checked: boolean): void => {
    let next = [...selectedIds]

    if (checked) {
      if (next.length >= MAX_FIELDS_PER_SLOT) {
        return
      }
      next.push(fieldId)
    } else {
      next = next.filter((id) => id !== fieldId)
    }

    onChange(normalizeSlotFields(next))
  }

  return (
    <div className="badge-multi-dropdown">
      <span className="badge-field-select__label">{label}</span>
      <details className="badge-multi-dropdown__details">
        <summary className="badge-multi-dropdown__summary">{summaryText}</summary>
        <div className="badge-multi-dropdown__menu">
          {options.length === 0 ? (
            <p className="badge-multi-dropdown__empty">No fields available for this attendee.</p>
          ) : (
            options.map((option) => (
            <label key={option.id} className="badge-multi-dropdown__option">
              <input
                type="checkbox"
                checked={selectedIds.includes(option.id)}
                disabled={
                  !selectedIds.includes(option.id) &&
                  selectedIds.length >= MAX_FIELDS_PER_SLOT
                }
                onChange={(event) => handleToggle(option.id, event.target.checked)}
              />
              <span>{option.label}</span>
            </label>
            ))
          )}
        </div>
      </details>
      <span className="badge-multi-dropdown__hint">
        Select up to {MAX_FIELDS_PER_SLOT} fields
      </span>
    </div>
  )
}

function BadgeFieldBlock({
  values,
  variant,
}: {
  values: string[]
  variant: 'top' | 'middle' | 'bottom'
}) {
  if (values.length === 0) {
    return (
      <div className={`badge-preview__block badge-preview__block--${variant}`}>
        <div className={`badge-preview__line badge-preview__line--${variant}`}>
          {'\u00A0'}
        </div>
      </div>
    )
  }

  return (
    <div className={`badge-preview__block badge-preview__block--${variant}`}>
      {values.map((value, index) => (
        <div
          key={`${variant}-${index}`}
          className={`badge-preview__line badge-preview__line--${variant}${
            index === 0 ? ' badge-preview__line--primary' : ''
          }`}
        >
          {value}
        </div>
      ))}
    </div>
  )
}

export default function BadgePreviewPanel({
  attendee,
  layout,
  onLayoutChange,
}: BadgePreviewPanelProps) {
  const availableFields = getAvailableBadgeFields(attendee)
  const fieldOptions = availableFields.map((field) => ({
    id: field.id,
    label: field.label,
  }))

  const topValues = resolveBadgeFieldValues(attendee, layout.top, availableFields)
  const middleValues = resolveBadgeFieldValues(attendee, layout.middle, availableFields)
  const bottomValues = resolveBadgeFieldValues(attendee, layout.bottom, availableFields)

  const [isPrinting, setIsPrinting] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)

  const updateSlot = (slot: BadgeSlot, values: string[]) => {
    onLayoutChange({
      ...layout,
      [slot]: normalizeSlotFields(values),
    })
  }

  const handlePrint = async (): Promise<void> => {
    if (!window.electronAPI?.printBadgePreview) {
      setPrintError('Printing is only available in the desktop app.')
      return
    }

    setIsPrinting(true)
    setPrintError(null)

    try {
      await window.electronAPI.printBadgePreview()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to open the print dialog.'
      setPrintError(message)
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <aside className="badge-panel">
      <h2 className="badge-panel__title">Badge Preview</h2>

      <div className="badge-panel__controls">
        <MultiFieldDropdown
          label="Top"
          values={layout.top}
          options={fieldOptions}
          onChange={(values) => updateSlot('top', values)}
        />
        <MultiFieldDropdown
          label="Middle"
          values={layout.middle}
          options={fieldOptions}
          onChange={(values) => updateSlot('middle', values)}
        />
        <MultiFieldDropdown
          label="Bottom"
          values={layout.bottom}
          options={fieldOptions}
          onChange={(values) => updateSlot('bottom', values)}
        />
      </div>

      <div className="badge-panel__preview-wrap">
        <div className="badge-preview" id="badge-preview-print-target" aria-label="Badge preview">
          <div className="badge-preview__content">
            <BadgeFieldBlock values={topValues} variant="top" />
            <BadgeFieldBlock values={middleValues} variant="middle" />
            <BadgeFieldBlock values={bottomValues} variant="bottom" />
          </div>
          <div className="badge-preview__qr" aria-hidden="true">
            QR
          </div>
        </div>
        <p className="badge-panel__size-note">
          3.9&quot; × 2.4&quot; label (horizontal) · up to {MAX_FIELDS_PER_SLOT} fields
          per area
        </p>
        <button
          type="button"
          className="badge-panel__print-button"
          onClick={() => void handlePrint()}
          disabled={isPrinting}
        >
          {isPrinting ? 'Opening Print Dialog...' : 'Print Test Badge'}
        </button>
        {printError && (
          <p className="badge-panel__print-error" role="alert">
            {printError}
          </p>
        )}
      </div>
    </aside>
  )
}
