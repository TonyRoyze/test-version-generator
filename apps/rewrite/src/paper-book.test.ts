import { expect, test } from 'bun:test'
import { COVER_PAGE_TEMPLATE_BY_ID } from './cover-templates/templates'
import { paperBookAnswersOf } from './cover-templates/paper-book-answers'
import { createExamDocx } from './docx-export'
import { docxFingerprint } from './docx-fingerprint'
import { FIXTURES } from './export-fixtures'
import { compareFingerprints, layoutFingerprint } from './export-fingerprint'
import { planExport } from './export-plan'
import { printFingerprint } from './print-fingerprint'
import { prepareQuestionBankExport } from './question-bank-export'
import { importedQuestionsFromRecord, inspectQuestionBankRecord } from './question-bank-import'

test('Paper Book lays out editable questions on its first page across print and DOCX', async () => {
  const fixture = FIXTURES[0]!
  const template = COVER_PAGE_TEMPLATE_BY_ID['paper-book']!
  const plan = planExport({
    ...fixture,
    exam: { ...fixture.exam, coverPage: { ...template.cover, templateId: template.id } },
    selection: { test: true, answerKey: false },
  })

  expect(plan.pages[0]?.furniture.paperBook).toBeDefined()
  expect(plan.pages[0]?.furniture.coverPage).toBeUndefined()
  expect(plan.pages[0]?.items.length).toBeGreaterThan(0)
  expect(paperBookAnswersOf(plan.pages[0]!.items)).toEqual([{ number: '1a', answer: 'A' }])

  const expected = layoutFingerprint([plan])
  expect(compareFingerprints(expected, printFingerprint([plan]))).toEqual([])
  const bytes = new Uint8Array(await (await createExamDocx([plan])).arrayBuffer())
  expect(compareFingerprints(expected, await docxFingerprint(bytes))).toEqual([])
})

test('Paper Book lists only the answers for the parts on each page', () => {
  const fixture = FIXTURES[1]!
  const template = COVER_PAGE_TEMPLATE_BY_ID['paper-book']!
  const plan = planExport({
    ...fixture,
    exam: { ...fixture.exam, coverPage: { ...template.cover, templateId: template.id } },
    selection: { test: true, answerKey: false },
  })

  expect(plan.pages.map((page) => paperBookAnswersOf(page.items))).toEqual([
    [{ number: '1a', answer: 'A' }],
    [{ number: '1b', answer: 'A' }, { number: '1c', answer: 'A' }],
  ])
})

test('Paper Book prints a question’s explanation beneath its correct choice', async () => {
  const fixture = FIXTURES[6]!
  const template = COVER_PAGE_TEMPLATE_BY_ID['paper-book']!
  const plan = planExport({
    ...fixture,
    exam: {
      ...fixture.exam,
      questions: fixture.exam.questions.map((question) =>
        question.type === 'multiple-choice'
          ? { ...question, answerReason: 'Pressure increases with depth.' }
          : question),
      coverPage: { ...template.cover, templateId: template.id },
    },
    selection: { test: true, answerKey: false },
  })

  expect(paperBookAnswersOf(plan.pages[0]!.items)).toContainEqual({
    number: '1', answer: 'B', reason: 'Pressure increases with depth.',
  })
  const expected = layoutFingerprint([plan])
  expect(expected.pages[0]?.content).toContain('para Pressure increases with depth.')
  expect(compareFingerprints(expected, printFingerprint([plan]))).toEqual([])
  const bytes = new Uint8Array(await (await createExamDocx([plan])).arrayBuffer())
  expect(compareFingerprints(expected, await docxFingerprint(bytes))).toEqual([])
})

test('an answer explanation survives Question Bank export and import', async () => {
  const fixture = FIXTURES[6]!
  const question = fixture.exam.questions.find((entry) => entry.type === 'multiple-choice')!
  const bank = {
    id: 'paper-book-bank',
    name: 'Paper Book',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastUpdatedAt: '2026-01-01T00:00:00.000Z',
    questions: [{ ...question, answerReason: 'Pressure increases with depth.' }],
  }
  const exported = await prepareQuestionBankExport(bank)
  const inspected = await inspectQuestionBankRecord(exported.recordBytes)
  expect(importedQuestionsFromRecord(inspected.record)[0]?.answerReason).toBe('Pressure increases with depth.')
})

test('Paper Book preserves authored explanation line breaks across print and DOCX', async () => {
  const fixture = FIXTURES[6]!
  const template = COVER_PAGE_TEMPLATE_BY_ID['paper-book']!
  const reason = 'Atomic number = 11\nMass number = 23\n\nCharge = +1'
  const plan = planExport({
    ...fixture,
    exam: {
      ...fixture.exam,
      questions: fixture.exam.questions.map((question) => question.type === 'multiple-choice' ? { ...question, answerReason: reason } : question),
      coverPage: { ...template.cover, templateId: template.id },
    },
    selection: { test: true, answerKey: false },
  })
  expect(paperBookAnswersOf(plan.pages[0]!.items)[0]?.reason).toBe(reason)
  const expected = layoutFingerprint([plan])
  expect(expected.pages[0]?.content).toContain('para Atomic number = 11⏎Mass number = 23⏎⏎Charge = +1')
  expect(compareFingerprints(expected, printFingerprint([plan]))).toEqual([])
  const bytes = new Uint8Array(await (await createExamDocx([plan])).arrayBuffer())
  expect(compareFingerprints(expected, await docxFingerprint(bytes))).toEqual([])
})
