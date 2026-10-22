import { expect, test } from '@playwright/test'
import { createQuestion } from '../src/exam'
import { seedAuthoringState } from './seed-authoring'

test('multiple-choice key fills four columns and hides topics in preview and PDF', async ({ page }) => {
  const questions = Array.from({ length: 40 }, (_, index) => ({
    ...createQuestion('multiple-choice'), topics: ['Topic must stay hidden'], difficulty: 'easy' as const,
    doc: { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: `Question ${index + 1}` }] },
      { type: 'multipleChoice', content: Array.from({ length: 4 }, (_, choice) => ({ type: 'multipleChoiceChoice', attrs: { id: `${index}-${choice}`, correct: choice === index % 4 }, content: [{ type: 'paragraph', content: [{ type: 'text', text: `Choice ${choice + 1}` }] }] })) },
    ] },
  }))
  await seedAuthoringState(page, { questionBank: { questions }, workingCopy: { title: 'Compact answer key', questionIds: questions.map(q => q.id) }, dirty: false })
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Export', exact: true })
  await dialog.getByRole('checkbox', { name: 'Student test' }).uncheck()
  const preview = dialog.getByLabel('Export Preview')
  await expect(preview.locator('.exam-page')).toHaveCount(1)
  await expect(preview.locator('.answer-key-grid-row')).toHaveCount(10)
  await expect(preview.locator('.answer-key-entry')).toHaveCount(40)
  await expect(preview).not.toContainText('Topic must stay hidden')
  await expect(preview.locator('.answer-key-answer')).toHaveText(Array.from({ length: 40 }, (_, index) => ['A', 'B', 'C', 'D'][index % 4]!))
  const first = await preview.locator('.answer-key-grid-row').first().locator('.answer-key-entry').all()
  const cells = await Promise.all(first.map(cell => cell.boundingBox()))
  for (let index = 1; index < 4; index++) {
    expect(cells[index]!.y).toBe(cells[0]!.y)
    expect(cells[index]!.x).toBeGreaterThan(cells[index - 1]!.x)
  }
  const secondRow = await preview.locator('.answer-key-grid-row').nth(1).boundingBox()
  expect(secondRow!.y).toBeGreaterThan(cells[0]!.y)
  await preview.screenshot({ path: test.info().outputPath('multiple-choice-grid.png') })
  const pending = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Download PDF', exact: true }).click()
  const file = await pending
  expect(await file.failure()).toBeNull()
  const { readFile } = await import('node:fs/promises')
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loading = getDocument({ data: new Uint8Array(await readFile((await file.path())!)) })
  const document = await loading.promise
  expect(document.numPages).toBe(1)
  const items = (await (await document.getPage(1)).getTextContent()).items.filter(item => 'str' in item)
  const text = items.map(item => item.str).join(' ')
  expect(text).not.toContain('Topic must stay hidden')
  for (let number = 1; number <= 40; number++) expect(items.some(item => item.str === `${number}.`)).toBe(true)
  const positions = ['1.', '2.', '3.', '4.'].map(number => items.find(item => item.str === number)!.transform)
  for (let index = 1; index < 4; index++) {
    expect(positions[index]![5]).toBe(positions[0]![5])
    expect(positions[index]![4]).toBeGreaterThan(positions[index - 1]![4])
  }
  await loading.destroy()
})

test('essay and structured-essay keys stay full width when numbering repeats after the MCQ section', async ({ page }) => {
  const mc = Array.from({ length: 4 }, () => createQuestion('multiple-choice'))
  const essays = Array.from({ length: 2 }, () => createQuestion('essay'))
  const structured = Array.from({ length: 2 }, () => createQuestion('structured-essay'))
  const questions = [...mc, ...essays, ...structured]
  const sections = [
    { id: 'mc', title: 'Multiple Choice', instructions: '' },
    { id: 'essay', title: 'Essay', instructions: '' },
    { id: 'structured', title: 'Structured Essay', instructions: '' },
  ]
  await seedAuthoringState(page, { questionBank: { questions }, workingCopy: {
    title: 'Mixed answer key', questionIds: questions.map(q => q.id), sections,
    sectionOf: Object.fromEntries([...mc.map(q => [q.id, 'mc']), ...essays.map(q => [q.id, 'essay']), ...structured.map(q => [q.id, 'structured'])]),
    numberingRestarts: [essays[0]!.id, structured[0]!.id],
  }, dirty: false })
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Export', exact: true })
  await dialog.getByRole('checkbox', { name: 'Student test' }).uncheck()
  const preview = dialog.getByLabel('Export Preview')
  await expect(preview.locator('.answer-key-grid-row')).toHaveCount(1)
  await expect(preview.locator('.answer-key-grid-row [data-answer-layout="tree"]')).toHaveCount(0)
  const written = preview.locator('.answer-key-entry[data-answer-layout="tree"]')
  await expect(written).toHaveCount(4)
  const cell = await preview.locator('.answer-key-grid-row .answer-key-entry').first().boundingBox()
  const boxes = await Promise.all((await written.all()).map(entry => entry.boundingBox()))
  for (let index = 0; index < boxes.length; index++) {
    expect(boxes[index]!.width).toBeGreaterThan(cell!.width * 3)
    if (index) {
      expect(boxes[index]!.x).toBe(boxes[index - 1]!.x)
      expect(boxes[index]!.y).toBeGreaterThan(boxes[index - 1]!.y)
    }
  }
})
