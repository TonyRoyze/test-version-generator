import { expect, test } from 'bun:test'
import { createQuestion, type Question } from './exam'
import { createExamStore, createAuthoringState, createMemoryBackend } from './exam-store'
import { questionOrderScope, sortExamQuestions } from './exam-question-order'

function fixture() {
  const store = createExamStore({ backend: createMemoryBackend(), initial: createAuthoringState() })
  const questions = ['Zebra', 'apple', 'Question 10', 'Question 2'].map((text) => ({
    ...createQuestion('multiple-choice'),
    doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] },
  } as Question))
  for (const question of questions) store.createInQuestionBank(question)
  store.addManyToWorkingCopy(questions)
  const other = createQuestion('open')
  store.createInQuestionBank(other)
  store.addToWorkingCopy(other, { kind: 'new-section', afterSectionId: null })
  return { store, questions, other, ...store.selectedExam() }
}

test('a single question expands to its section; multiple, empty and stale scopes stay safe', () => {
  const { exam, arrangement, questions, other } = fixture()
  const ids = questions.map(({ id }) => id)
  expect(questionOrderScope(exam, arrangement, [ids[1]!])).toEqual(ids)
  expect(questionOrderScope(exam, arrangement, [ids[1]!, other.id])).toEqual([ids[1]!, other.id])
  expect(questionOrderScope(exam, arrangement, [])).toEqual([])
  expect(questionOrderScope(exam, arrangement, ['missing'])).toEqual([])
})

test('bank sorting preserves equal-bank order, unselected positions and sections and undoes once', () => {
  const { store, exam, arrangement, questions, other } = fixture()
  const [a, fixed, b, c] = questions.map(({ id }) => id) as [string, string, string, string]
  const names = { [a]: 'Zoology', [b]: 'algebra', [c]: 'algebra', [other.id]: 'AAA' }
  const scope = [a, b, c, other.id]
  expect(sortExamQuestions(exam, arrangement, scope, 'bank-asc', names).questionOrder).toEqual([b, fixed, c, a, other.id])
  store.sortSelectedQuestions(scope, 'bank-asc', names)
  expect(store.selectedExam().arrangement.questionOrder).toEqual([b, fixed, c, a, other.id])
  store.undo()
  expect(store.selectedExam().arrangement.questionOrder).toEqual(arrangement.questionOrder)
  expect(sortExamQuestions(exam, arrangement, scope, 'bank-desc', names)).toBe(arrangement)
})

test('text sorting is natural; missing bank names sort last in either direction', () => {
  const { exam, arrangement, questions } = fixture()
  const [z, a, ten, two] = questions.map(({ id }) => id) as [string, string, string, string]
  const ids = [z, a, ten, two]
  expect(sortExamQuestions(exam, arrangement, ids, 'text-asc', {}).questionOrder.slice(0, 4)).toEqual([a, two, ten, z])
  expect(sortExamQuestions(exam, arrangement, ids, 'text-desc', {}).questionOrder.slice(0, 4)).toEqual([z, ten, two, a])
  for (const sort of ['bank-asc', 'bank-desc'] as const) {
    expect(sortExamQuestions(exam, arrangement, ids, sort, { [two]: 'A' }).questionOrder.slice(0, 4)).toEqual([two, z, a, ten])
  }
})
