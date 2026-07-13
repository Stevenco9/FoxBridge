import { useLayoutEffect, useRef, useState } from 'react'
import {
  BADGE_NAME_FONT_FAMILY,
  BADGE_NAME_FONT_WEIGHT,
  BADGE_NAME_LETTER_SPACING_EM,
  BADGE_NAME_LINE_HEIGHT,
  BADGE_NAME_MAX_FONT_PT,
  BADGE_NAME_MIN_FONT_PT,
  createCanvasTextMeasurer,
  fitBadgeName,
  type FitBadgeNameResult,
} from './fitBadgeName'

interface FittedBadgeNameProps {
  name: string
  className: string
  maxFontSizePt?: number
  minFontSizePt?: number
}

const measureWidth = createCanvasTextMeasurer(
  BADGE_NAME_FONT_FAMILY,
  BADGE_NAME_FONT_WEIGHT,
  BADGE_NAME_LETTER_SPACING_EM,
)

function initialFit(name: string, maxFontSizePt: number): FitBadgeNameResult {
  return {
    fontSizePt: maxFontSizePt,
    lines: [name.trim() || ''],
  }
}

/**
 * Renders an attendee name that auto-fits within the first badge zone.
 * Font size and line breaks are written into the DOM so print markup matches preview.
 */
export default function FittedBadgeName({
  name,
  className,
  maxFontSizePt = BADGE_NAME_MAX_FONT_PT,
  minFontSizePt = BADGE_NAME_MIN_FONT_PT,
}: FittedBadgeNameProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [fit, setFit] = useState<FitBadgeNameResult>(() =>
    initialFit(name, maxFontSizePt),
  )

  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) {
      return
    }

    const applyFit = (): void => {
      const width = element.clientWidth
      const height = element.clientHeight
      if (width <= 0 || height <= 0) {
        return
      }

      const next = fitBadgeName({
        name,
        maxWidth: width,
        maxHeight: height,
        maxFontSizePt,
        minFontSizePt,
        lineHeight: BADGE_NAME_LINE_HEIGHT,
        measureWidth,
      })
      setFit(next)
    }

    applyFit()

    const observer = new ResizeObserver(() => {
      applyFit()
    })
    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [name, maxFontSizePt, minFontSizePt])

  const lines = fit.lines.filter((line) => line.length > 0)
  const displayLines = lines.length > 0 ? lines : ['']

  return (
    <div
      ref={containerRef}
      className={`${className} badge-preview__line--fitted-name`}
      style={{
        fontSize: `${fit.fontSizePt}pt`,
        lineHeight: BADGE_NAME_LINE_HEIGHT,
        letterSpacing: `${BADGE_NAME_LETTER_SPACING_EM}em`,
        fontWeight: BADGE_NAME_FONT_WEIGHT,
      }}
      data-badge-name-fit={`${fit.fontSizePt}pt/${displayLines.length}`}
    >
      {displayLines.map((line, index) => (
        <span key={`${index}-${line}`} className="badge-preview__name-line">
          {line}
        </span>
      ))}
    </div>
  )
}
