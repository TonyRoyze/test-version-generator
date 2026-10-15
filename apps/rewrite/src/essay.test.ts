import { describe, expect, test } from 'bun:test'
import { createQuestion, partsOf, workSpaceOf } from './exam'
import { essayPartLabel, essayStem } from './essay'
import { planExport, unmeasured, numbersTakenBy } from './export-plan'
import { FIXTURES } from './export-fixtures'
import { prepareQuestionBankExport, QUESTION_BANK_FORMAT_VERSION } from './question-bank-export'
import { inspectQuestionBankRecordValue, importedQuestionsFromRecord } from './question-bank-import'
import { createExamStore, createMemoryBackend } from './exam-store'
import { createExamDocx } from './docx-export'
import JSZip from 'jszip'

for (const type of ['structured-essay', 'essay'] as const) {
  describe(type, () => {
    const fixture = FIXTURES.find((item) => item.name === `${type} with shared material and written parts`)!
    test('starts with one written part and retains its distinct type through sharing', async () => {
      const question = createQuestion(type)
      expect(partsOf(question)).toHaveLength(1)
      expect(partsOf(question)[0]!.type).toBe('written')
      const prepared = await prepareQuestionBankExport({ id: 'bank', name: 'Essays', createdAt: '', lastUpdatedAt: '', questions: fixture.exam.questions })
      expect(prepared.record.formatVersion).toBe(QUESTION_BANK_FORMAT_VERSION)
      const imported = importedQuestionsFromRecord((await inspectQuestionBankRecordValue(prepared.record)).record)
      expect(imported[0]!.type).toBe(type)
      expect(partsOf(imported[0]!)).toHaveLength(2)
      expect(partsOf(imported[0]!)[0]!.suggestedAnswer).toBeDefined()
    })
    test('prints one parent number, labelled parts and the following question as number 2', () => {
      const plan = planExport({ ...fixture, selection: { test: true, answerKey: false } })
      const questions = plan.pages.flatMap((page) => page.items.filter((item) => item.kind === 'question'))
      expect(questions[0]!.question.number).toBe(1)
      expect(numbersTakenBy(questions[0]!.question)).toBe(1)
      expect(questions.at(-1)!.question.number).toBe(2)
      expect(questions[0]!.question.parts?.map((part) => part.displayLabel)).toEqual(type === 'essay' ? ['(A)', '(B)'] : ['(i)', '(ii)'])
      expect(questions[0]!.question.parts?.[0]?.workSpace).toBeNull()
      expect(questions[0]!.question.parts?.[0]?.type).toBe('written')
    })
    test('written Parts ignore legacy Short Answer spacing and undo restores the whole question', () => {
      const question = createQuestion(type)
      const store = createExamStore({ backend: createMemoryBackend() })
      store.addToWorkingCopy(question)
      const part = partsOf(question)[0]!
      expect(workSpaceOf(store.selectedExam().exam, part.id).height).toBe(0)
      const height = type === 'essay' ? 64 : 0
      store.setQuestionWorkSpace([part.id], { height, fill: false })
      expect(workSpaceOf(store.selectedExam().exam, part.id).height).toBe(0)
      const legacy = { ...fixture.exam, questions: [question], workSpace: { [part.id]: { height: 96, style: 'lines' as const, fill: true } } }
      expect(workSpaceOf(legacy, part.id).height).toBe(0)
      // Ignored Short Answer settings add no phantom undo step.
      store.undo()
      expect(store.getState().workingCopy.questionIds).toEqual([])
      store.redo()
      expect(store.getState().workingCopy.questionIds).toEqual([question.id])
    })
    test('DOCX preserves roman and alphabetic subquestion numbering', async () => {
      const plan = planExport({ ...fixture, measure: unmeasured, selection: { test: true, answerKey: false } })
      const blob = await createExamDocx([plan], async () => null)
      const zip = await JSZip.loadAsync(await blob.arrayBuffer())
      const numbering = await zip.file('word/numbering.xml')!.async('string')
      expect(numbering).toContain('lowerRoman')
      expect(numbering).toContain('lowerLetter')
      expect(numbering).toContain('(%1)')
    })
  })
}

test('essay labels and nested lists are derived without changing authored content', () => {
  expect(essayPartLabel('essay', 26)).toBe('(AA)')
  expect(essayPartLabel('structured-essay', 8)).toBe('(ix)')
  const nodes = [{ type: 'ordered_list', content: [{ type: 'list_item', content: [{ type: 'paragraph' }, { type: 'ordered_list', content: [] }] }] }]
  const original = structuredClone(nodes)
  const converted = essayStem(nodes, 'essay')
  expect(converted[0]!.attrs).toEqual({ essaySequence: 'lower-roman' })
  expect(nodes).toEqual(original)
})


test('a single Essay Part omits its letter while Structured Essay retains roman labels', async () => {
  expect(essayPartLabel('essay', 0, 1)).toBe('')
  expect(essayPartLabel('essay', 0, 2)).toBe('(A)')
  expect(essayPartLabel('structured-essay', 0, 1)).toBe('(i)')
  const fixture = FIXTURES.find((item) => item.name === 'an Essay with one unlettered written Part')!
  const plan = planExport({ ...fixture, selection: { test: true, answerKey: true } })
  const question = plan.pages.flatMap((page) => page.items).find((item) => item.kind === 'question')!
  if (question.kind !== 'question') throw new Error('Missing Essay')
  expect(question.parts[0]!.displayLabel).toBe('')
  const key = plan.pages.flatMap((page) => page.items).find((item) => item.kind === 'answer-key-entry')!
  if (key.kind !== 'answer-key-entry') throw new Error('Missing Essay key')
  expect(key.parts?.[0]?.displayLabel).toBe('')
  const zip = await JSZip.loadAsync(await (await createExamDocx([plan], async () => null)).arrayBuffer())
  const xml = await zip.file('word/document.xml')!.async('string')
  expect(xml).toContain('Explain the transformation.')
  expect(xml).not.toContain('(A)')
})
