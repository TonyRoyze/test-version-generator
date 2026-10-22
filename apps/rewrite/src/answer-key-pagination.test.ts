import { expect, test } from 'bun:test'
import { multipartPartNodesOf, type ProseMirrorJSON } from './question-doc'
import { FIXTURES } from './export-fixtures'
import { pageContentHeight, planExport, type Measure } from './export-plan'

test('an essay answer key splits long answers across pages without losing text', () => {
  const source = FIXTURES.find(f => f.name === 'an Essay with one unlettered written Part')!
  const fixture = { ...source, exam: structuredClone(source.exam) }
  const paragraphs = Array.from({ length: 30 }, (_, i) => ({ type: 'paragraph', content: [{ type: 'text', text: `Answer ${i}` }] }))
  const doc = fixture.exam.questions[0]!.doc
  const part = multipartPartNodesOf(doc)[0]!
  const answer = (part.content as ProseMirrorJSON[])[1]!
  answer.content = paragraphs
  const measure: Measure = { itemHeight: item => item.kind === 'answer-key-entry'
    ? 30 + (item.parts ?? []).reduce((sum, p) => sum + 25 + (p.suggestedAnswer?.length ?? 0) * 100, 0) + (item.suggestedAnswer?.length ?? 0) * 100
    : 20 }
  const plan = planExport({ ...fixture, measure, selection: { test: false, answerKey: true } })
  expect(plan.pages.length).toBeGreaterThan(1)
  for (const page of plan.pages) expect(page.items.reduce((sum, item) => sum + measure.itemHeight(item), 0)).toBeLessThanOrEqual(pageContentHeight(page.header, plan.pageSize))
  const answers = plan.pages.flatMap(p => p.items).flatMap(i => i.kind === 'answer-key-entry' ? (i.parts ?? []).flatMap(p => p.suggestedAnswer ?? []) : [])
  expect(answers).toEqual(paragraphs)
})

test('a single formatted paragraph continues across pages with every character retained', () => {
  const source = FIXTURES.find(f => f.name === 'an Essay with one unlettered written Part')!
  const exam = structuredClone(source.exam)
  const answer = (multipartPartNodesOf(exam.questions[0]!.doc)[0]!.content as ProseMirrorJSON[])[1]!
  const text = 'Conservation of energy. '.repeat(500)
  answer.content = [{ type: 'paragraph', content: [{ type: 'text', text, marks: [{ type: 'strong' }] }] }]
  const textOf = (node: ProseMirrorJSON): string => typeof node.text === 'string' ? node.text : (Array.isArray(node.content) ? (node.content as ProseMirrorJSON[]).map(textOf).join('') : '')
  const measure: Measure = { itemHeight: item => item.kind === 'answer-key-entry'
    ? 60 + (item.parts ?? []).flatMap(p => p.suggestedAnswer ?? []).reduce((sum, node) => sum + textOf(node).length, 0)
    : 20 }
  const plan = planExport({ ...source, exam, measure, selection: { test: false, answerKey: true } })
  const nodes = plan.pages.flatMap(p => p.items).flatMap(i => i.kind === 'answer-key-entry' ? (i.parts ?? []).flatMap(p => p.suggestedAnswer ?? []) : [])
  expect(nodes.map(textOf).join('')).toBe(text)
  expect(nodes.length).toBeGreaterThan(1)
  expect(nodes.every(n => (n.content as ProseMirrorJSON[]).every(child => JSON.stringify(child.marks) === '[{"type":"strong"}]'))).toBe(true)
  for (const page of plan.pages) expect(page.items.reduce((sum, item) => sum + measure.itemHeight(item), 0)).toBeLessThanOrEqual(pageContentHeight(page.header, plan.pageSize))
})

for (const type of ['essay', 'structured-essay'] as const) {
  for (const count of [1, 4, 8]) {
    test(`${type} heading follows its first answer when ${count} answer blocks cross a page boundary`, async () => {
      const { createQuestion } = await import('./exam')
      const { pageSizeOf } = await import('./export-plan')
      const question = createQuestion(type)
      const part = multipartPartNodesOf(question.doc)[0]!
      const blocks = Array.from({ length: count }, (_, index) => ({ type: 'paragraph', content: [{ type: 'text', text: `Answer ${index}` }] }))
      ;(part.content as ProseMirrorJSON[])[1]!.content = blocks
      const previous = createQuestion('open')
      const firstRoom = pageContentHeight('answer-key', pageSizeOf(undefined))
      const fullRoom = pageContentHeight('answer-key-later', pageSizeOf(undefined))
      // Four blocks fill a continuation page exactly, leaving no room for a
      // heading unless that answer is split further.
      const blockHeight = count === 4 ? (fullRoom - 40) / 4 : 200
      const measure: Measure = { itemHeight: item => {
        if (item.kind === 'answer-key-section') return 20
        if (item.kind !== 'answer-key-entry') return 0
        if (item.number === 1) return firstRoom - 60
        return 40 + (item.parts ?? []).reduce((sum, part) => sum + (part.suggestedAnswer?.length ?? 0) * blockHeight, 0)
      } }
      const plan = planExport({ exam: { title: 'Headings', questions: [previous, question] }, arrangement: { id: 'working', letter: '', questionOrder: [previous.id, question.id], choiceOrder: {} }, selection: { test: false, answerKey: true }, measure })
      const page = plan.pages.find(page => page.items.some(item => item.kind === 'answer-key-section' && item.title === (type === 'essay' ? 'Essay' : 'Structured Essay')))!
      expect(page).toBeDefined()
      const headingIndex = page.items.findIndex(item => item.kind === 'answer-key-section' && item.title === (type === 'essay' ? 'Essay' : 'Structured Essay'))
      expect(page.items[headingIndex + 1]).toMatchObject({ kind: 'answer-key-entry', number: 2 })
      for (const page of plan.pages) expect(page.items.reduce((sum, item) => sum + measure.itemHeight(item), 0)).toBeLessThanOrEqual(pageContentHeight(page.header, plan.pageSize))
      const answers = plan.pages.flatMap(page => page.items).flatMap(item => item.kind === 'answer-key-entry' && item.number === 2 ? (item.parts ?? []).flatMap(part => part.suggestedAnswer ?? []) : [])
      expect(answers).toEqual(blocks)
    })
  }
}
