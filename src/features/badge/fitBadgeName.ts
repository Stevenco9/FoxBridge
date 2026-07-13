/**
 * Responsive badge name fitting: prefer max size on one line, then a balanced
 * two-line word break, then incremental font reduction. Never truncates.
 */

export interface FitBadgeNameOptions {
  name: string
  /** Available width in CSS pixels (e.g. element.clientWidth). */
  maxWidth: number
  /** Available height in CSS pixels (e.g. element.clientHeight). */
  maxHeight: number
  maxFontSizePt: number
  minFontSizePt: number
  /**
   * Line-height multiplier. Use >= 1 so glyph descenders (p, g, y) are not clipped.
   */
  lineHeight: number
  fontSizeStepPt?: number
  measureWidth: (text: string, fontSizePt: number) => number
}

export interface FitBadgeNameResult {
  fontSizePt: number
  lines: string[]
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

function splitWords(name: string): string[] {
  return normalizeName(name).split(' ').filter(Boolean)
}

/** CSS px per pt at the standard 96dpi used by browsers / Electron. */
export const CSS_PX_PER_PT = 96 / 72

/**
 * Vertical space required for `lineCount` lines, in CSS pixels.
 * maxHeight from layout (clientHeight) is also in CSS pixels — never compare raw pt.
 */
export function lineBlockHeightPx(
  fontSizePt: number,
  lineCount: number,
  lineHeight: number,
): number {
  return fontSizePt * CSS_PX_PER_PT * lineHeight * lineCount
}

function fitsHeight(
  fontSizePt: number,
  lineCount: number,
  lineHeight: number,
  maxHeightPx: number,
): boolean {
  return lineBlockHeightPx(fontSizePt, lineCount, lineHeight) <= maxHeightPx + 0.5
}

/**
 * Choose a word break that keeps both lines within maxWidth and prefers
 * similar visual widths (not one long line + one short word).
 */
export function chooseBalancedWordBreak(
  words: string[],
  fontSizePt: number,
  maxWidth: number,
  measureWidth: (text: string, fontSizePt: number) => number,
): [string, string] | null {
  if (words.length < 2) {
    return null
  }

  let best: { lines: [string, string]; score: number } | null = null

  for (let i = 1; i < words.length; i += 1) {
    const line1 = words.slice(0, i).join(' ')
    const line2 = words.slice(i).join(' ')
    const width1 = measureWidth(line1, fontSizePt)
    const width2 = measureWidth(line2, fontSizePt)

    if (width1 > maxWidth || width2 > maxWidth) {
      continue
    }

    const widthDelta = Math.abs(width1 - width2)
    const midpoint = words.length / 2
    const balancePenalty = Math.abs(i - midpoint) * (maxWidth * 0.02)
    const score = widthDelta + balancePenalty

    if (!best || score < best.score) {
      best = { lines: [line1, line2], score }
    }
  }

  return best?.lines ?? null
}

/**
 * Last-resort wrap into two lines. Prefers breaks that keep both lines within
 * maxWidth, then breaks at whitespace, then minimizes overflow.
 */
export function chooseCharacterBreak(
  text: string,
  fontSizePt: number,
  maxWidth: number,
  measureWidth: (text: string, fontSizePt: number) => number,
): [string, string] {
  const value = normalizeName(text)
  if (value.length < 2) {
    return [value, '']
  }

  let bestFitting: { lines: [string, string]; score: number } | null = null
  let bestAny: { lines: [string, string]; score: number } | null = null

  for (let i = 1; i < value.length; i += 1) {
    const line1 = value.slice(0, i).trimEnd()
    const line2 = value.slice(i).trimStart()
    if (!line1 || !line2) {
      continue
    }

    const width1 = measureWidth(line1, fontSizePt)
    const width2 = measureWidth(line2, fontSizePt)
    const overflow =
      Math.max(0, width1 - maxWidth) + Math.max(0, width2 - maxWidth)
    const widthDelta = Math.abs(width1 - width2)
    const brokenAtSpace = /\s$/.test(value.slice(0, i)) || /^\s/.test(value.slice(i))
    const spaceBonus = brokenAtSpace ? 0 : maxWidth * 0.05
    const score = overflow * 1000 + widthDelta + spaceBonus
    const candidate = { lines: [line1, line2] as [string, string], score }

    if (!bestAny || score < bestAny.score) {
      bestAny = candidate
    }

    if (overflow === 0 && (!bestFitting || score < bestFitting.score)) {
      bestFitting = candidate
    }
  }

  if (bestFitting) {
    return bestFitting.lines
  }

  // Greedy: fill line 1 to maxWidth, remainder on line 2.
  let cut = 1
  for (let i = 1; i < value.length; i += 1) {
    const prefix = value.slice(0, i).trimEnd()
    if (!prefix) {
      continue
    }
    if (measureWidth(prefix, fontSizePt) <= maxWidth) {
      cut = i
    } else {
      break
    }
  }

  // Prefer the last whitespace at or before the cut when present.
  const prefixRegion = value.slice(0, cut)
  const spaceIdx = prefixRegion.lastIndexOf(' ')
  if (spaceIdx > 0) {
    cut = spaceIdx
  }

  const line1 = value.slice(0, cut).trimEnd()
  const line2 = value.slice(cut).trimStart()
  if (line1 && line2) {
    return [line1, line2]
  }

  return bestAny?.lines ?? [value, '']
}

/**
 * Fit an attendee name into at most two centered lines within a badge zone.
 */
export function fitBadgeName(options: FitBadgeNameOptions): FitBadgeNameResult {
  const name = normalizeName(options.name)
  if (!name) {
    return { fontSizePt: options.maxFontSizePt, lines: [''] }
  }

  const {
    maxWidth,
    maxHeight,
    maxFontSizePt,
    minFontSizePt,
    lineHeight,
    measureWidth,
  } = options
  const step = options.fontSizeStepPt ?? 1
  const words = splitWords(name)

  const maxSize = Math.max(minFontSizePt, maxFontSizePt)
  const minSize = Math.min(minFontSizePt, maxFontSizePt)

  for (let fontSizePt = maxSize; fontSizePt >= minSize; fontSizePt -= step) {
    const size = Math.round(fontSizePt * 1000) / 1000

    if (
      fitsHeight(size, 1, lineHeight, maxHeight) &&
      measureWidth(name, size) <= maxWidth
    ) {
      return { fontSizePt: size, lines: [name] }
    }

    if (!fitsHeight(size, 2, lineHeight, maxHeight)) {
      continue
    }

    const wordBreak = chooseBalancedWordBreak(words, size, maxWidth, measureWidth)
    if (wordBreak) {
      return { fontSizePt: size, lines: wordBreak }
    }
  }

  // At minimum size: force a character break if word breaks still overflow.
  const forcedSize = minSize
  if (fitsHeight(forcedSize, 2, lineHeight, maxHeight)) {
    const wordBreak = chooseBalancedWordBreak(
      words,
      forcedSize,
      maxWidth,
      measureWidth,
    )
    if (wordBreak) {
      return { fontSizePt: forcedSize, lines: wordBreak }
    }

    const characterBreak = chooseCharacterBreak(
      name,
      forcedSize,
      maxWidth,
      measureWidth,
    )
    return {
      fontSizePt: forcedSize,
      lines: characterBreak[1] ? characterBreak : [characterBreak[0]],
    }
  }

  // Height only allows one line even at minimum — keep one line at min size.
  return { fontSizePt: forcedSize, lines: [name] }
}

/** Default top-zone name sizing (matches current badge CSS). */
export const BADGE_NAME_MAX_FONT_PT = 32
export const BADGE_NAME_MIN_FONT_PT = 16
/** Must clear descenders; 0.9 clipped lowercase p/g/y inside overflow:hidden. */
export const BADGE_NAME_LINE_HEIGHT = 1.05
export const BADGE_NAME_FONT_WEIGHT = 900
export const BADGE_NAME_LETTER_SPACING_EM = -0.02
export const BADGE_NAME_FONT_FAMILY =
  "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

/**
 * Canvas-based width measure with letter-spacing approximation for browser use.
 */
export function createCanvasTextMeasurer(
  fontFamily: string = BADGE_NAME_FONT_FAMILY,
  fontWeight: number = BADGE_NAME_FONT_WEIGHT,
  letterSpacingEm: number = BADGE_NAME_LETTER_SPACING_EM,
): (text: string, fontSizePt: number) => number {
  let canvas: HTMLCanvasElement | null = null
  let context: CanvasRenderingContext2D | null = null

  return (text: string, fontSizePt: number): number => {
    if (typeof document === 'undefined') {
      // Node/test fallback without canvas: rough proportional estimate.
      return text.length * fontSizePt * 0.55
    }

    if (!canvas) {
      canvas = document.createElement('canvas')
      context = canvas.getContext('2d')
    }
    if (!context) {
      return text.length * fontSizePt * 0.55
    }

    context.font = `${fontWeight} ${fontSizePt}pt ${fontFamily}`
    const metrics = context.measureText(text)
    const letterSpacingPx = fontSizePt * (96 / 72) * letterSpacingEm
    const extra = text.length > 0 ? letterSpacingPx * (text.length - 1) : 0
    return metrics.width + extra
  }
}
