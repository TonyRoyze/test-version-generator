// How an Exam's labels print: the sequence behind them and the marks around them.
//
// A label is one of the short marks a test hangs off its content — a question's
// number, an answer's letter, a Part's letter. Today each is fixed: questions are
// numbered `1.`, answers are lettered `A.`, Parts are lettered `a.`, and a
// Word Bank's answers are lettered like any other answer. An Exam may choose
// differently, the way it already chooses its heading size, its text size and
// its page furniture: a school that writes `i)` for its answers sets that once
// and every answer on the paper follows.
//
// A style is a sequence and a set of brackets, kept apart so a teacher can reach
// any combination — `a)`, `(a)`, `iv.` — from two dropdowns rather than a list of
// named presets. The plan turns a style into the finished string, so no adapter
// ever decides what a label looks like.
//
// A style is only *offered* where it fits. A question's number and a Part's
// letter sit in a fixed 34px column, so `LXXXVIII` cannot go there whatever the
// brackets say; an answer's label floats beside its text, so it can be wider.
// `offeredStyles` is that rule, measured rather than guessed — see
// `LABEL_COLUMN_PX` and the width table below.

/** The order a label counts in. */
export type LabelSequence =
  | 'decimal'
  | 'lower-alpha'
  | 'upper-alpha'
  | 'lower-roman'
  | 'upper-roman'

export const LABEL_SEQUENCES: readonly LabelSequence[] = [
  'decimal',
  'lower-alpha',
  'upper-alpha',
  'lower-roman',
  'upper-roman',
]

/** The marks a label carries: `a`, `a.`, `a)` or `(a)`. */
export type LabelBrackets = 'plain' | 'dot' | 'close' | 'paren'

export const LABEL_BRACKETS: readonly LabelBrackets[] = ['plain', 'dot', 'close', 'paren']

/** One kind of label as an Exam prints it. */
export type LabelStyle = {
  sequence: LabelSequence
  brackets: LabelBrackets
}

export const LABEL_SEQUENCE_LABELS: Record<LabelSequence, string> = {
  decimal: 'Numbers',
  'lower-alpha': 'Lowercase letters',
  'upper-alpha': 'Uppercase letters',
  'lower-roman': 'Lowercase roman',
  'upper-roman': 'Uppercase roman',
}

export const LABEL_BRACKET_LABELS: Record<LabelBrackets, string> = {
  plain: 'None',
  dot: 'Full stop',
  close: 'Closing bracket',
  paren: 'Both brackets',
}

/** The three kinds of label an Exam styles, and what each prints by default. A
 *  question's number, a matching set's Items and an answer's letter are separate
 *  kinds: a matching Item *is* a question number, so it follows `questions`, and a
 *  Word Bank answer is an answer, so it follows `answers`. */
export type LabelKind = 'questions' | 'answers' | 'parts'

export const LABEL_KINDS: readonly LabelKind[] = ['questions', 'answers', 'parts']

export const LABEL_KIND_LABELS: Record<LabelKind, string> = {
  questions: 'Question numbers',
  answers: 'Answer labels',
  parts: 'Part labels',
}

/** Today's styles, and the styles of an Exam that has never chosen one. Answers
 *  are capital letters and Parts lower-case so a student can tell a Part from an
 *  answer at a glance; that is the one distinction the defaults carry, and it is
 *  why Parts do not simply reuse the answer style. */
export const DEFAULT_LABEL_STYLES: Record<LabelKind, LabelStyle> = {
  questions: { sequence: 'decimal', brackets: 'dot' },
  answers: { sequence: 'upper-alpha', brackets: 'dot' },
  parts: { sequence: 'lower-alpha', brackets: 'dot' },
}

export function isLabelSequence(value: unknown): value is LabelSequence {
  return LABEL_SEQUENCES.includes(value as LabelSequence)
}

export function isLabelBrackets(value: unknown): value is LabelBrackets {
  return LABEL_BRACKETS.includes(value as LabelBrackets)
}

/** Whether a stored value is a label style this build can print. The single
 *  guard, so storage and import agree on what a readable record is. */
export function isLabelStyle(value: unknown): value is LabelStyle {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const style = value as Record<string, unknown>
  return (
    Object.keys(style).every((key) => key === 'sequence' || key === 'brackets')
    && isLabelSequence(style.sequence)
    && isLabelBrackets(style.brackets)
  )
}

/** A style with one part changed and the rest left as they are — what a dropdown
 *  hands back when a teacher changes the sequence but not the brackets, or the
 *  other way round. */
export function withLabelStyle(style: LabelStyle, change: Partial<LabelStyle>): LabelStyle {
  return { sequence: change.sequence ?? style.sequence, brackets: change.brackets ?? style.brackets }
}

const ALPHABET_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const ALPHABET_LOWER = 'abcdefghijklmnopqrstuvwxyz'

/** The letters of the alphabet, in order: `A`, `B`, … then `AA`, `AB`, …. The one
 *  generator — an answer's label, a Part's label and a Word Bank answer's label
 *  all come from here, so no two of them can drift. */
function alphaAt(index: number, upper: boolean): string {
  const alphabet = upper ? ALPHABET_UPPER : ALPHABET_LOWER
  let letters = ''
  let remaining = index
  do {
    letters = alphabet[remaining % 26]! + letters
    remaining = Math.floor(remaining / 26) - 1
  } while (remaining >= 0)
  return letters
}

const ROMAN_VALUES: readonly (readonly [number, string])[] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
]

/** The number in roman numerals, upper or lower case. */
function romanAt(value: number, upper: boolean): string {
  let numerals = ''
  let remaining = value
  for (const [amount, numerals_] of ROMAN_VALUES) {
    while (remaining >= amount) {
      numerals += numerals_
      remaining -= amount
    }
  }
  return upper ? numerals : numerals.toLowerCase()
}

/** The bare sequence token at `index` (zero-based), before its brackets. */
export function sequenceTokenAt(sequence: LabelSequence, index: number): string {
  switch (sequence) {
    case 'decimal':
      return String(index + 1)
    case 'lower-alpha':
      return alphaAt(index, false)
    case 'upper-alpha':
      return alphaAt(index, true)
    case 'lower-roman':
      return romanAt(index + 1, false)
    case 'upper-roman':
      return romanAt(index + 1, true)
  }
}

/** The finished label for the item at `index` (zero-based) — `A.`, `(iv)`, `7` —
 *  exactly as it prints, brackets and all. The one place a label is made. */
export function labelAt(style: LabelStyle, index: number): string {
  const token = sequenceTokenAt(style.sequence, index)
  return labelForToken(style, token)
}

/** Apply the style's punctuation to a semantic token such as T or F. */
export function labelForToken(style: LabelStyle, token: string): string {
  switch (style.brackets) {
    case 'plain':
      return token
    case 'dot':
      return `${token}.`
    case 'close':
      return `${token})`
    case 'paren':
      return `(${token})`
  }
}

/** The label for the item numbered `value` (one-based), for a counter that is a
 *  number rather than a position — a question's number, a matching set's Items. */
export function labelOfValue(style: LabelStyle, value: number): string {
  return labelAt(style, value - 1)
}

/** Whether two Exams label one kind alike. Absent and the kind's default agree,
 *  so a draft that has never been styled compares equal to a stored default. */
export function sameLabelStyle(
  kind: LabelKind,
  left: LabelStyle | undefined,
  right: LabelStyle | undefined,
): boolean {
  const first = left ?? DEFAULT_LABEL_STYLES[kind]
  const second = right ?? DEFAULT_LABEL_STYLES[kind]
  return first.sequence === second.sequence && first.brackets === second.brackets
}

export type ExamLabelStyles = Partial<Record<LabelKind, LabelStyle>>

export function labelStyleOf(styles: ExamLabelStyles | undefined, kind: LabelKind): LabelStyle {
  return styles?.[kind] ?? DEFAULT_LABEL_STYLES[kind]
}

export function isExamLabelStyles(value: unknown): value is ExamLabelStyles {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return Object.entries(value).every(([kind, style]) =>
    LABEL_KINDS.includes(kind as LabelKind) && isLabelStyle(style),
  )
}

export function withExamLabelStyle(
  styles: ExamLabelStyles | undefined,
  kind: LabelKind,
  style: LabelStyle,
): ExamLabelStyles | undefined {
  const next = { ...styles }
  if (sameLabelStyle(kind, style, DEFAULT_LABEL_STYLES[kind])) delete next[kind]
  else next[kind] = style
  return Object.keys(next).length ? next : undefined
}

export function sameExamLabelStyles(left: ExamLabelStyles | undefined, right: ExamLabelStyles | undefined): boolean {
  return LABEL_KINDS.every((kind) => sameLabelStyle(kind, left?.[kind], right?.[kind]))
}

// ---------------------------------------------------------------------------
// Which styles a label's column can hold.
//
// A question's number and a Part's letter print in a fixed 34px grid column
// (`QUESTION_NUMBER_COLUMN_WIDTH` in export-plan.ts, mirrored by
// `.exam-question` and `.multipart-part-print` in styles.css). A style that
// overflows it does not wrap — the label is `white-space: nowrap` — it runs into
// the question's own text. An answer's label floats beside its text with no
// column of its own, so what bounds it is the answer text it would crowd, not a
// grid track.
//
// The widths below are Georgia's advance widths at the sheet's own body size and
// weight (15px bold, `EXAM_TYPE_PX.body` in export-typography.ts), measured in
// the browser. They are a table rather than a font metric because the plan runs
// in Node for the PDF and DOCX adapters and in `bun test`, with no canvas to ask.

const GLYPH_PX = {
  digits: [10.52, 7.35, 9.4, 9.37, 9.74, 8.99, 9.72, 8.31, 10.14, 9.72],
  upper: [
    11.37, 11.36, 10.73, 12.51, 10.82, 10.07, 12.11, 13.7, 6.69, 8.93, 12.25, 10.28, 15.35,
    12.59, 12.3, 10.52, 12.3, 11.96, 9.73, 10.26, 12.5, 11.43, 16.9, 12.13, 10.98, 10.34,
  ],
  lower: [
    8.94, 9.68, 7.97, 9.95, 8.58, 5.9, 8.65, 10.2, 5.3, 5.19, 9.48, 5.16, 15.23, 10.35,
    9.54, 9.87, 9.73, 7.8, 7.69, 5.96, 10.15, 8.5, 12.95, 8.82, 8.43, 7.88,
  ],
  '.': 4.92,
  ')': 6.7,
  '(': 6.7,
} as const

const BRACKET_PX: Record<string, number> = { '.': GLYPH_PX['.'], ')': GLYPH_PX[')'], '(': GLYPH_PX['('] }

function glyphWidth(character: string): number {
  const bracket = BRACKET_PX[character]
  if (bracket !== undefined) return bracket
  const code = character.charCodeAt(0)
  if (character >= '0' && character <= '9') return GLYPH_PX.digits[code - 48]!
  if (character >= 'A' && character <= 'Z') return GLYPH_PX.upper[code - 65]!
  return GLYPH_PX.lower[code - 97]!
}

/** How wide a label prints, in the same pixels the plan measures pages in. */
export function labelWidth(label: string): number {
  return [...label].reduce((width, character) => width + glyphWidth(character), 0)
}

/** The width of the fixed column a question's number and a Part's letter print
 *  in: `QUESTION_NUMBER_COLUMN_WIDTH` in export-plan.ts. */
export const LABEL_COLUMN_PX = 34

/** How much of a five-column choice cell an answer's label may take before it
 *  crowds the answer text out of its own column. Wider than the fixed column
 *  because an answer's label floats: there is no track to overflow, only room to
 *  take. */
export const ANSWER_LABEL_PX = 48

/** How far a label of each kind is held to its widest form. A test numbers as
 *  many questions as it has room for and a question has as many answers as its
 *  author gave it, so the count a style must survive is the count that kind of
 *  label really reaches — not a number large enough to look safe. */
export const LABEL_REFERENCE_COUNT: Record<LabelKind, number> = {
  questions: 99,
  answers: 26,
  parts: 26,
}

/** The width a kind of label must fit. */
export function labelBudgetOf(kind: LabelKind): number {
  return kind === 'answers' ? ANSWER_LABEL_PX : LABEL_COLUMN_PX
}

/** Whether a style's widest label fits where that kind of label prints. The
 *  widest label is not the last one: `xxviii` is far wider than `c`, so a style
 *  is measured across the whole range it has to cover, not at its end. */
export function labelFits(style: LabelStyle, kind: LabelKind): boolean {
  const budget = labelBudgetOf(kind)
  const count = LABEL_REFERENCE_COUNT[kind]
  for (let value = 1; value <= count; value += 1) {
    const isCount = kind === 'questions'
    const label = isCount ? labelOfValue(style, value) : labelAt(style, value - 1)
    if (labelWidth(label) > budget) return false
  }
  return true
}

/** The styles a kind of label can be set to, each sequence with only the
 *  brackets that fit beside it — so choosing `(a)` never leaves a teacher looking
 *  for a `(1)` that cannot be printed. Order follows `LABEL_SEQUENCES`, and the
 *  default is always among them. */
export function offeredStyles(kind: LabelKind): { sequence: LabelSequence; brackets: LabelBrackets[] }[] {
  return LABEL_SEQUENCES.map((sequence) => ({
    sequence,
    brackets: LABEL_BRACKETS.filter((brackets) => labelFits({ sequence, brackets }, kind)),
  })).filter((entry) => entry.brackets.length > 0)
}

/** The brackets a kind of label offers for one sequence. */
export function offeredBrackets(kind: LabelKind, sequence: LabelSequence): LabelBrackets[] {
  return LABEL_BRACKETS.filter((brackets) => labelFits({ sequence, brackets }, kind))
}
