import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_LABEL_STYLES,
  LABEL_BRACKETS,
  LABEL_KINDS,
  LABEL_SEQUENCES,
  isLabelStyle,
  labelAt,
  labelFits,
  labelOfValue,
  labelWidth,
  offeredBrackets,
  offeredStyles,
  sameLabelStyle,
  sequenceTokenAt,
  withLabelStyle,
  type LabelStyle,
} from './number-style'

const style = (sequence: LabelStyle['sequence'], brackets: LabelStyle['brackets']): LabelStyle => ({
  sequence,
  brackets,
})

describe('sequence tokens', () => {
  test('count in decimal, then in letters past the alphabet', () => {
    expect(sequenceTokenAt('decimal', 0)).toBe('1')
    expect(sequenceTokenAt('decimal', 41)).toBe('42')
    expect(sequenceTokenAt('upper-alpha', 0)).toBe('A')
    expect(sequenceTokenAt('upper-alpha', 25)).toBe('Z')
    expect(sequenceTokenAt('lower-alpha', 25)).toBe('z')
  })

  test('roll past Z into AA rather than printing a punctuation character', () => {
    expect(sequenceTokenAt('upper-alpha', 26)).toBe('AA')
    expect(sequenceTokenAt('upper-alpha', 27)).toBe('AB')
    expect(sequenceTokenAt('upper-alpha', 51)).toBe('AZ')
    expect(sequenceTokenAt('upper-alpha', 52)).toBe('BA')
    expect(sequenceTokenAt('lower-alpha', 26)).toBe('aa')
  })

  test('count in roman numerals, in either case', () => {
    expect(sequenceTokenAt('lower-roman', 0)).toBe('i')
    expect(sequenceTokenAt('lower-roman', 3)).toBe('iv')
    expect(sequenceTokenAt('lower-roman', 7)).toBe('viii')
    expect(sequenceTokenAt('lower-roman', 13)).toBe('xiv')
    expect(sequenceTokenAt('lower-roman', 18)).toBe('xix')
    expect(sequenceTokenAt('lower-roman', 87)).toBe('lxxxviii')
    expect(sequenceTokenAt('upper-roman', 87)).toBe('LXXXVIII')
    expect(sequenceTokenAt('upper-roman', 98)).toBe('XCIX')
  })
})

describe('labels', () => {
  test('carry the brackets the style asks for, and nothing else when it asks for none', () => {
    expect(labelAt(style('upper-alpha', 'dot'), 0)).toBe('A.')
    expect(labelAt(style('upper-alpha', 'plain'), 0)).toBe('A')
    expect(labelAt(style('upper-alpha', 'close'), 0)).toBe('A)')
    expect(labelAt(style('upper-alpha', 'paren'), 0)).toBe('(A)')
  })

  test('reach the styles a teacher asks for by name', () => {
    expect(labelAt(style('lower-roman', 'close'), 0)).toBe('i)')
    expect(labelAt(style('lower-roman', 'close'), 1)).toBe('ii)')
    expect(labelAt(style('lower-roman', 'close'), 7)).toBe('viii)')
    expect(labelAt(style('lower-alpha', 'close'), 0)).toBe('a)')
    expect(labelAt(style('lower-alpha', 'close'), 1)).toBe('b)')
    expect(labelAt(style('lower-roman', 'paren'), 3)).toBe('(iv)')
    expect(labelAt(style('decimal', 'paren'), 0)).toBe('(1)')
  })

  test('are the same string whichever way the index arrives', () => {
    expect(labelOfValue(style('decimal', 'dot'), 7)).toBe('7.')
    expect(labelOfValue(style('lower-roman', 'dot'), 7)).toBe(
      labelAt(style('lower-roman', 'dot'), 6),
    )
  })

  test('a style that changes one part keeps the other', () => {
    expect(withLabelStyle(style('upper-alpha', 'dot'), { brackets: 'paren' })).toEqual(
      style('upper-alpha', 'paren'),
    )
    expect(withLabelStyle(style('upper-alpha', 'dot'), { sequence: 'lower-roman' })).toEqual(
      style('lower-roman', 'dot'),
    )
  })
})

describe('reading a stored style', () => {
  test('accepts only a whole pair this build knows', () => {
    expect(isLabelStyle({ sequence: 'decimal', brackets: 'dot' })).toBe(true)
    expect(isLabelStyle({ sequence: 'nope', brackets: 'dot' })).toBe(false)
    expect(isLabelStyle({ sequence: 'decimal', brackets: 'nope' })).toBe(false)
    expect(isLabelStyle({ sequence: 'decimal' })).toBe(false)
    expect(isLabelStyle({ sequence: 'decimal', brackets: 'dot', extra: 1 })).toBe(false)
    expect(isLabelStyle(['decimal', 'dot'])).toBe(false)
    expect(isLabelStyle(null)).toBe(false)
  })

  test("compares against the kind's own default, so absent means default", () => {
    expect(sameLabelStyle('answers', undefined, DEFAULT_LABEL_STYLES.answers)).toBe(true)
    expect(sameLabelStyle('questions', undefined, DEFAULT_LABEL_STYLES.answers)).toBe(false)
    expect(sameLabelStyle('parts', undefined, DEFAULT_LABEL_STYLES.parts)).toBe(true)
    expect(sameLabelStyle('parts', style('decimal', 'dot'), DEFAULT_LABEL_STYLES.parts)).toBe(false)
  })
})

describe('what a label column can hold', () => {
  test('every default is wide enough to print', () => {
    for (const kind of LABEL_KINDS) {
      expect(labelFits(DEFAULT_LABEL_STYLES[kind], kind)).toBe(true)
    }
  })

  test('a wide roman label is refused the fixed column a number prints in', () => {
    // `LXXXVIII` is the widest roman below a hundred, not `C`: a style is
    // measured across the range it must cover, not at its end.
    expect(labelFits(style('lower-roman', 'dot'), 'questions')).toBe(false)
    expect(labelFits(style('upper-roman', 'dot'), 'questions')).toBe(false)
    expect(labelFits(style('lower-roman', 'dot'), 'parts')).toBe(false)
  })

  test("an answer's label has room a number does not, so it may be roman", () => {
    expect(labelFits(style('lower-roman', 'close'), 'answers')).toBe(true)
    expect(labelFits(style('lower-roman', 'paren'), 'answers')).toBe(true)
    expect(labelFits(style('upper-roman', 'plain'), 'answers')).toBe(true)
    // `XXIII.` is a shade over the room an answer's label may take.
    expect(labelFits(style('upper-roman', 'dot'), 'answers')).toBe(false)
  })

  test('what is on offer is a subset of every style, and the default is among it', () => {
    for (const kind of LABEL_KINDS) {
      const offered = offeredStyles(kind)
      for (const { sequence, brackets } of offered) {
        for (const choice of brackets) {
          expect(LABEL_SEQUENCES).toContain(sequence)
          expect(LABEL_BRACKETS).toContain(choice)
          expect(labelFits({ sequence, brackets: choice }, kind)).toBe(true)
        }
      }
      const fallback = DEFAULT_LABEL_STYLES[kind]
      expect(offeredBrackets(kind, fallback.sequence)).toContain(fallback.brackets)
    }
  })

  test('an unlisted style is one that would overflow, never one that is merely rare', () => {
    for (const kind of LABEL_KINDS) {
      const offered = new Set(
        offeredStyles(kind).flatMap(({ sequence, brackets }) =>
          brackets.map((choice) => `${sequence}/${choice}`),
        ),
      )
      for (const sequence of LABEL_SEQUENCES) {
        for (const brackets of LABEL_BRACKETS) {
          expect(offered.has(`${sequence}/${brackets}`)).toBe(labelFits({ sequence, brackets }, kind))
        }
      }
    }
  })
})

describe('measured widths', () => {
  test('read the sheet body size in Georgia, so the cap is the stylesheet holding', () => {
    // A three-digit number is what the 34px column was sized for.
    expect(labelWidth('100.')).toBeCloseTo(33.3, 1)
    expect(labelWidth('XXVIII.')).toBeCloseTo(60.7, 1)
    expect(labelWidth('viii)')).toBeCloseTo(31.1, 1)
  })

  test('a label narrower than its budget is one the column can hold', () => {
    expect(labelWidth('(iv)')).toBeLessThan(34)
    expect(labelWidth('LXXXVIII)')).toBeGreaterThan(34)
  })
})
