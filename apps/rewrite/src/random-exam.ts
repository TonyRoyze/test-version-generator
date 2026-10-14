import type { Question, RandomSource } from './exam'
import type { QuestionBankResource } from './question-bank-workspaces'

export type BankDraw = { bankId: string; count: number }

/** Draw without replacement, validating the whole request before selecting. */
export function drawExamQuestions(
  banks: readonly QuestionBankResource[],
  draws: readonly BankDraw[],
  total: number,
  random: RandomSource = Math.random,
): Question[] {
  if (!Number.isSafeInteger(total) || total < 1) throw new Error('Enter a whole number of at least 1 for the total.')
  const seen = new Set<string>()
  const pools = draws.map(({ bankId, count }) => {
    if (seen.has(bankId)) throw new Error('Choose each Question Bank only once.')
    seen.add(bankId)
    const bank = banks.find(({ id }) => id === bankId)
    if (!bank) throw new Error('A selected Question Bank is no longer available.')
    if (!Number.isSafeInteger(count) || count < 0 || count > bank.questions.length) {
      throw new Error(`Choose between 0 and ${bank.questions.length} questions from ${bank.name}.`)
    }
    return { bank, count }
  })
  if (draws.reduce((sum, draw) => sum + draw.count, 0) !== total) {
    throw new Error('The counts from your Question Banks must add up to the total.')
  }
  return pools.flatMap(({ bank, count }) => {
    const pool = [...bank.questions]
    for (let index = 0; index < count; index += 1) {
      const pick = index + Math.floor(random() * (pool.length - index))
      ;[pool[index], pool[pick]] = [pool[pick]!, pool[index]!]
    }
    return pool.slice(0, count)
  })
}

export function replacementQuestion(
  bank: QuestionBankResource,
  original: Question,
  usedIds: readonly string[],
  random: RandomSource = Math.random,
): Question | null {
  const used = new Set([...usedIds, original.id])
  const pool = bank.questions.filter((question) => question.type === original.type && !used.has(question.id))
  return pool.length ? pool[Math.floor(random() * pool.length)]! : null
}
