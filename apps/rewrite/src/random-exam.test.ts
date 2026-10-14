import { describe, expect, test } from 'bun:test'
import { createQuestion } from './exam'
import { drawExamQuestions, replacementQuestion } from './random-exam'
import type { QuestionBankResource } from './question-bank-workspaces'

const bank = (id: string, count: number): QuestionBankResource => ({
  id, name: id, createdAt: '', lastUpdatedAt: '',
  questions: Array.from({ length: count }, () => createQuestion('open')),
})

describe('random exam selection', () => {
  test('draws exact quotas without repeats and leaves canonical banks untouched', () => {
    const banks = [bank('biology', 5), bank('chemistry', 4)]
    const before = structuredClone(banks)
    const selected = drawExamQuestions(banks, [{ bankId: 'biology', count: 3 }, { bankId: 'chemistry', count: 2 }], 5, () => 0.8)
    expect(selected).toHaveLength(5)
    expect(new Set(selected.map(({ id }) => id)).size).toBe(5)
    expect(selected.filter((question) => banks[0]!.questions.includes(question))).toHaveLength(3)
    expect(selected.filter((question) => banks[1]!.questions.includes(question))).toHaveLength(2)
    expect(banks).toEqual(before)
  })
  test('refuses mismatched totals, exhausted banks, fractions and missing banks', () => {
    const banks = [bank('biology', 2)]
    for (const [count, total] of [[1, 2], [3, 3], [1.5, 1.5], [-1, 1], [0, 0]]) {
      expect(() => drawExamQuestions(banks, [{ bankId: 'biology', count: count! }], total!)).toThrow()
    }
    expect(() => drawExamQuestions(banks, [{ bankId: 'missing', count: 1 }], 1)).toThrow()
    expect(() => drawExamQuestions(banks, [{ bankId: 'biology', count: 1 }, { bankId: 'biology', count: 1 }], 2)).toThrow()
  })
  test('replacements exclude the original, used questions and other types', () => {
    const source = bank('biology', 3)
    source.questions.push(createQuestion('true-false'))
    const [original, used, available] = source.questions
    expect(replacementQuestion(source, original!, [original!.id, used!.id], () => 0)).toBe(available!)
    expect(replacementQuestion(source, original!, source.questions.map(({ id }) => id))).toBeNull()
  })
})
