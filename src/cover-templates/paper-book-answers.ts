import type { PageItem, PlannedChoice } from '../export-plan'

export type PaperBookAnswer = { number: string; answer: string; reason?: string }

export const paperBookAnswerText = ({ number, answer }: PaperBookAnswer): string =>
  `${number}${/[.)\]]$/.test(number) ? '' : '.'} ${answer}`

export type PaperBookReasonPart =
  | { type: 'text'; value: string; marks?: string[] }
  | { type: 'math'; value: string }

const RICH_REASON_PREFIX = '\u001ePB1:'

export function richPaperBookReason(parts: PaperBookReasonPart[]): string {
  return RICH_REASON_PREFIX + JSON.stringify(parts)
}

export function paperBookReasonParts(reason: string): PaperBookReasonPart[] {
  if (reason.startsWith(RICH_REASON_PREFIX)) {
    try {
      const decoded: unknown = JSON.parse(reason.slice(RICH_REASON_PREFIX.length))
      if (Array.isArray(decoded)) return decoded.filter((part): part is PaperBookReasonPart =>
        typeof part === 'object' && part !== null &&
        ((Reflect.get(part, 'type') === 'text' && typeof Reflect.get(part, 'value') === 'string') ||
         (Reflect.get(part, 'type') === 'math' && typeof Reflect.get(part, 'value') === 'string')),
      )
    } catch { /* Treat malformed rich data as ordinary text. */ }
  }
  const parts: PaperBookReasonPart[] = []
  const delimiter = /\\\(([\s\S]*?)\\\)/g
  let offset = 0
  for (const match of reason.matchAll(delimiter)) {
    const index = match.index ?? 0
    if (index > offset) parts.push({ type: 'text', value: reason.slice(offset, index) })
    parts.push({ type: 'math', value: match[1] ?? '' })
    offset = index + match[0].length
  }
  if (offset < reason.length) parts.push({ type: 'text', value: reason.slice(offset) })
  return parts
}

const answerOf = (choices: readonly PlannedChoice[]): string | null => {
  const correct = choices.find((choice) => choice.correct)
  return correct ? correct.displayLabel ?? correct.letter : null
}

/** The objective answers for the question pieces printed on this page. */
export function paperBookAnswersOf(items: readonly PageItem[]): PaperBookAnswer[] {
  const answers: PaperBookAnswer[] = []
  for (const item of items) {
    if (item.kind !== 'question') continue
    const { question } = item
    const number = question.displayNumber ?? String(question.number)

    if (item.parts) {
      for (const part of item.parts) {
        const answer = answerOf(part.choices)
        if (answer) answers.push({ number: `${number}${part.displayLabel ?? part.letter}`, answer })
      }
      continue
    }

    if (item.matching) {
      for (const prompt of item.matching.prompts) {
        const match = item.matching.bank.find((candidate) => candidate.letter === prompt.letter)
        if (match) answers.push({ number: prompt.displayNumber ?? String(prompt.number), answer: match.displayLabel ?? match.letter })
      }
      continue
    }

    const answer = answerOf(question.choices)
    const rawReason = question.answerReason?.trim()
    const reason = rawReason?.startsWith(RICH_REASON_PREFIX) ? rawReason : rawReason?.replace(/\s+/g, ' ')
    if (answer) answers.push({ number, answer, ...(reason ? { reason } : {}) })
  }
  return answers
}

export function paperBookAnswerLines(items: readonly PageItem[]): string[] {
  return ['para «emphasis»Answers«/»', ...paperBookAnswersOf(items).flatMap((entry) => [
    `para ${paperBookAnswerText(entry)}`,
    ...(entry.reason ? [`para ${paperBookReasonParts(entry.reason).map((part) => {
      if (part.type === 'math') return `⟨math:${part.value.replace(/\s+/g, ' ').trim()}⟩`
      const value = part.value.replace(/\s+/g, ' ')
      const marks = part.marks ?? []
      return marks.length ? `«${marks.join(',')}»${value}«/»` : value
    }).join('').replace(/\s+/g, ' ').trim()}`] : []),
  ])]
}
