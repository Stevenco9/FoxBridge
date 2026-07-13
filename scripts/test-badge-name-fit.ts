import assert from 'node:assert/strict'
import {
  BADGE_NAME_LINE_HEIGHT,
  BADGE_NAME_MAX_FONT_PT,
  BADGE_NAME_MIN_FONT_PT,
  chooseBalancedWordBreak,
  chooseCharacterBreak,
  fitBadgeName,
  lineBlockHeightPx,
} from '../src/features/badge/fitBadgeName.ts'

/**
 * Deterministic width model for tests: each character is `0.55 * fontSizePt` wide.
 * Spaces count the same so wrapping math stays predictable without canvas.
 */
function measureWidth(text: string, fontSizePt: number): number {
  return text.length * fontSizePt * 0.55
}

function fit(
  name: string,
  maxWidth: number,
  maxHeight: number,
  maxFontSizePt = BADGE_NAME_MAX_FONT_PT,
  minFontSizePt = BADGE_NAME_MIN_FONT_PT,
) {
  return fitBadgeName({
    name,
    maxWidth,
    maxHeight,
    maxFontSizePt,
    minFontSizePt,
    lineHeight: BADGE_NAME_LINE_HEIGHT,
    measureWidth,
  })
}

function heightFor(lines: number, fontSizePt = BADGE_NAME_MAX_FONT_PT): number {
  return lineBlockHeightPx(fontSizePt, lines, BADGE_NAME_LINE_HEIGHT) + 1
}

function recoverName(lines: string[]): string {
  const spaced = lines.join(' ').replace(/\s+/g, ' ').trim()
  return spaced
}

// Short two-word name stays one line at max size.
{
  const result = fit('Ada Lovelace', 400, heightFor(1))
  assert.equal(result.lines.length, 1)
  assert.equal(result.lines[0], 'Ada Lovelace')
  assert.equal(result.fontSizePt, BADGE_NAME_MAX_FONT_PT)
}

// Medium three-word name: one line when width allows.
{
  const result = fit('María Elena Soto', 500, heightFor(1))
  assert.equal(result.lines.length, 1)
  assert.equal(result.fontSizePt, BADGE_NAME_MAX_FONT_PT)
}

// Long Spanish name wraps to two balanced lines at max size when one line is too wide.
{
  const name = 'José María García Hernández López'
  const oneLineWidth = measureWidth(name, BADGE_NAME_MAX_FONT_PT)
  const result = fit(name, oneLineWidth * 0.65, heightFor(2))
  assert.equal(result.lines.length, 2)
  assert.equal(result.lines.join(' '), name)
  assert.equal(result.fontSizePt, BADGE_NAME_MAX_FONT_PT)
  assert.ok(result.lines[0]!.split(' ').length >= 2)
  assert.ok(result.lines[1]!.split(' ').length >= 2)
}

// Accented characters are preserved.
{
  const name = 'Ángel Núñez Rodríguez'
  const result = fit(name, measureWidth(name, BADGE_NAME_MAX_FONT_PT) * 0.6, heightFor(2))
  assert.equal(result.lines.join(' '), name)
  assert.match(result.lines.join(' '), /Ángel/)
  assert.match(result.lines.join(' '), /Núñez/)
}

// Two-line height budget at max size is too small → font must shrink (pt vs px aware).
{
  const name = 'Marisol López López'
  const tightHeight = lineBlockHeightPx(BADGE_NAME_MAX_FONT_PT, 2, BADGE_NAME_LINE_HEIGHT) - 8
  const result = fit(name, 280, tightHeight)
  assert.equal(result.lines.length, 2)
  assert.ok(result.fontSizePt < BADGE_NAME_MAX_FONT_PT)
  assert.ok(
    lineBlockHeightPx(result.fontSizePt, 2, BADGE_NAME_LINE_HEIGHT) <= tightHeight + 0.5,
  )
}

// Constrained box forces font reduction with two fitting lines.
{
  const name = 'Guadalupe Fernanda Valenzuela Domínguez'
  const result = fit(name, 190, heightFor(2, 22))
  assert.equal(result.lines.length, 2)
  assert.ok(result.fontSizePt < BADGE_NAME_MAX_FONT_PT)
  assert.ok(result.fontSizePt >= BADGE_NAME_MIN_FONT_PT)
  assert.equal(result.lines.join(' '), name)
  for (const line of result.lines) {
    assert.ok(
      measureWidth(line, result.fontSizePt) <= 190 + 0.01,
      `line overflows: ${line} @ ${result.fontSizePt}pt`,
    )
  }
}

// Never more than two lines.
{
  const name = 'Ana Belén Cristina Isabel Patricia Romero Sánchez Vargas'
  const result = fit(name, 90, heightFor(2, 18))
  assert.ok(result.lines.length <= 2)
}

// Never truncates or adds ellipsis — full name remains recoverable.
{
  const name = 'Christopher Jonathan Alexander Montgomery Fitzgerald'
  const result = fit(name, 100, heightFor(2, 18))
  assert.ok(!result.lines.some((line) => line.includes('…') || line.includes('...')))
  const recovered = recoverName(result.lines).replace(/\s+/g, ' ')
  assert.equal(recovered.replace(/\s+/g, ''), name.replace(/\s+/g, ''))
}

// Word-break chooser prefers balanced widths.
{
  const words = ['Ana', 'María', 'López', 'Pérez']
  const breakLines = chooseBalancedWordBreak(words, 20, 200, measureWidth)
  assert.ok(breakLines)
  assert.deepEqual(breakLines, ['Ana María', 'López Pérez'])
}

// Character break for a single oversized token keeps both pieces within width when possible.
{
  const token = 'Supercalifragilisticexpialidocious'
  const [a, b] = chooseCharacterBreak(token, 16, 160, measureWidth)
  assert.ok(a.length > 0 && b.length > 0)
  assert.equal(`${a}${b}`, token)
  assert.ok(measureWidth(a, 16) <= 160 + 0.01)
  assert.ok(measureWidth(b, 16) <= 160 + 0.01)
}

// Minimum font size is respected.
{
  const name = 'Extremely Long Multi Word Attendee Name For Badge Testing Purposes'
  const result = fit(name, 60, heightFor(2, BADGE_NAME_MIN_FONT_PT))
  assert.ok(result.fontSizePt >= BADGE_NAME_MIN_FONT_PT)
}

// Height helper uses CSS px (not raw pt) so two 32pt lines need ~90px, not ~67.
{
  const twoLinePx = lineBlockHeightPx(32, 2, 1.05)
  assert.ok(twoLinePx > 85)
  assert.ok(twoLinePx < 95)
}

console.log('Badge name fit tests passed.')
