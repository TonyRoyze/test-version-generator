import { expect, test } from 'bun:test'
import { createQuestion } from './exam'
import { buildExportDocument, planExport, unmeasured } from './export-plan'
import { createExamDocx } from './docx-export'
import { docxFingerprint } from './docx-fingerprint'
import { layoutFingerprint } from './export-fingerprint'
import { printFingerprint } from './print-fingerprint'

function request(count: number) {
  const questions = Array.from({ length: count }, () => ({ ...createQuestion('multiple-choice'), topics: ['Hidden topic'], difficulty: 'easy' as const }))
  return { exam: { title: 'MCQ grid', questions }, arrangement: { id: 'working', letter: '', questionOrder: questions.map(q => q.id), choiceOrder: {} }, selection: { test: false, answerKey: true }, measure: unmeasured }
}

test('multiple-choice answers fill rows of at most four columns and omit topic tags', () => {
  const input = request(10)
  const plan = planExport(input)
  const rows = plan.pages.flatMap(p => p.items).filter(i => i.kind === 'answer-key-grid-row')
  expect(rows.map(row => row.entries.map(entry => entry.number))).toEqual([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10]])
  expect(rows.every(row => row.columns === 4)).toBe(true)
  expect(JSON.stringify(rows)).not.toContain('Hidden topic')
  expect(JSON.stringify(buildExportDocument(input.exam, input.arrangement, input.selection).answerKey)).not.toContain('Hidden topic')
})

test('answer grids use fewer columns on a narrower page', () => {
  const input = request(8)
  const plan = planExport({ ...input, exam: { ...input.exam, margins: { top: 1, right: 2, bottom: 1, left: 2 } } })
  const rows = plan.pages.flatMap(p => p.items).filter(i => i.kind === 'answer-key-grid-row')
  expect(rows.every(row => row.columns >= 1 && row.columns < 4)).toBe(true)
  expect(rows.flatMap(row => row.entries).map(entry => entry.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
})

test('print and DOCX retain all answers in grid reading order, including the partial last row', async () => {
  const plan = planExport(request(10))
  const expected = layoutFingerprint([plan])
  expect(printFingerprint([plan])).toEqual(expected)
  expect(await docxFingerprint(await (await createExamDocx([plan], async () => null)).arrayBuffer())).toEqual(expected)
})

for (const type of ['essay', 'structured-essay'] as const) {
  test(`${type} answers never enter the multiple-choice grid when section numbering restarts`, () => {
    const input = request(8)
    const written = createQuestion(type)
    const other = createQuestion(type)
    const mc = input.exam.questions
    const exam = { ...input.exam, questions: [...mc, written, other], numberingRestarts: [written.id],
      sections: [
        { id: 'mc', title: 'Multiple Choice', instructions: '' },
        { id: 'written', title: 'Written', instructions: '' },
      ],
      sectionOf: Object.fromEntries([...mc.map(q => [q.id, 'mc']), [written.id, 'written'], [other.id, 'written']]),
    }
    const plan = planExport({ ...input, exam, arrangement: { ...input.arrangement, questionOrder: [...mc, written, other].map(q => q.id) } })
    const rows = plan.pages.flatMap(p => p.items).filter(i => i.kind === 'answer-key-grid-row')
    expect(rows.flatMap(row => row.entries).every(entry => !entry.parts)).toBe(true)
    expect(plan.pages.flatMap(p => p.items).filter(i => i.kind === 'answer-key-entry' && i.answerLayout === 'tree')).toHaveLength(2)
  })
}
