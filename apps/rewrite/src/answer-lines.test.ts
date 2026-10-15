import { expect, test } from 'bun:test'
import { withAnswerLines } from './answer-lines'
import { essayStem } from './essay'
import { FIXTURES, paragraph, text } from './export-fixtures'
import { partsOf, workSpaceOf } from './exam'
import { planExport, STUDENT_TEST } from './export-plan'

test('markers split rich paragraphs at the authored position without mutating stored content', () => {
  const nodes = [paragraph(text('First <2', { type: 'strong' }), text('lines>Second <1line>Third'))]
  const original = structuredClone(nodes)
  expect(withAnswerLines(nodes)).toEqual([
    paragraph(text('First ', { type: 'strong' })),
    { type: 'answer_lines', attrs: { lines: 2 } },
    paragraph(text('Second ')),
    { type: 'answer_lines', attrs: { lines: 1 } },
    paragraph(text('Third')),
  ])
  expect(nodes).toEqual(original)
})

test('code and invalid markers stay literal; ordinary question types retain their text', () => {
  const nodes = [paragraph(text('<0lines> <21lines> <2lines>', { type: 'inlineCode' })),
    { type: 'code_block', content: [text('<2lines>')] }, paragraph(text('<0lines> <21lines> <two lines>'))]
  expect(withAnswerLines(nodes)).toEqual(nodes)
  expect(essayStem([paragraph(text('<2lines>'))], 'open')).toEqual([paragraph(text('<2lines>'))])
  expect(withAnswerLines([paragraph(text('<20LINES>'))])[1]).toEqual({ type: 'answer_lines', attrs: { lines: 20 } })
})

test('each nested subquestion keeps its lines and written Parts never gain Short Answer space', () => {
  const fixture = FIXTURES.find((item) => item.name === 'essay subquestions with inline answer lines')!
  const part = partsOf(fixture.exam.questions[0]!)[0]!
  expect(workSpaceOf(fixture.exam, part.id).height).toBe(0)
  expect(workSpaceOf({ ...fixture.exam, workSpace: { [part.id]: { height: 96, style: 'lines', fill: false } } }, part.id).height).toBe(0)
  const plan = planExport({ ...fixture, selection: STUDENT_TEST })
  const item = plan.pages.flatMap((page) => page.items).find((item) => item.kind === 'question')!
  expect(item.kind).toBe('question')
  if (item.kind !== 'question') return
  const stem = item.parts[0]!.stem
  expect(JSON.stringify(stem)).not.toContain('<2lines>')
  expect(JSON.stringify(stem).match(/"answer_lines"/g)).toHaveLength(3)
  expect(item.parts[0]!.workSpace).toBeNull()
})
