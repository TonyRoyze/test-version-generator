import { expect, test } from '@playwright/test'
import { createQuestion } from '../src/exam'
import { multipartPartsNodeOf, type ProseMirrorJSON } from '../src/question-doc'
import { seedAuthoringState } from './seed-authoring'

const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
for (const type of ['essay', 'structured-essay'] as const) {
  test(`${type} answer key lays out question, parts and nested answers as a vertical tree`, async ({ page }) => {
    const question = createQuestion(type)
    const box = multipartPartsNodeOf(question.doc)!
    const part = (box.content as ProseMirrorJSON[])[0]!
    const other = structuredClone(part)
    other.attrs = { ...(other.attrs as object), id: 'other-part' }
    ;(part.content as ProseMirrorJSON[])[1]!.content = [{ type: 'paragraph' }, {
      type: 'ordered_list', attrs: { order: 1 }, content: [{ type: 'list_item', content: [
        paragraph('First response'), { type: 'ordered_list', attrs: { order: 1 }, content: [{ type: 'list_item', content: [paragraph('Nested response')] }] },
      ] }],
    }]
    ;(other.content as ProseMirrorJSON[])[1]!.content = [paragraph('Second part response')]
    box.content = [part, other]
    await seedAuthoringState(page, { questionBank: { questions: [question] }, workingCopy: { title: 'Answer hierarchy', questionIds: [question.id] }, dirty: false })
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Export', exact: true })
    await dialog.getByRole('checkbox', { name: 'Student test' }).uncheck()
    const entry = dialog.getByLabel('Export Preview').locator('.answer-key-entry')
    await expect(entry).toHaveAttribute('data-answer-layout', 'tree')
    await expect(entry.locator('.answer-key-answer')).toHaveCount(0)
    const labels = entry.locator('.answer-key-part-letter')
    await expect(labels).toHaveText(type === 'essay' ? ['(A)', '(B)'] : ['(i)', '(ii)'])
    const number = await entry.locator(':scope > span').first().boundingBox()
    const partLabel = await labels.first().boundingBox()
    const subpart = await entry.locator('.answer-key-suggested > ol > li > p').boundingBox()
    const nested = await entry.getByText('Nested response', { exact: true }).boundingBox()
    const second = await labels.nth(1).boundingBox()
    expect(partLabel!.y).toBeGreaterThan(number!.y)
    expect(subpart!.y).toBeGreaterThan(partLabel!.y)
    expect(nested!.y).toBeGreaterThan(subpart!.y)
    expect(second!.y).toBeGreaterThan(nested!.y)
    expect(partLabel!.x).toBeGreaterThan(number!.x)
    expect(subpart!.x).toBeGreaterThan(partLabel!.x)
    expect(nested!.x).toBeGreaterThan(subpart!.x)
    await dialog.getByLabel('Export Preview').screenshot({ path: test.info().outputPath('answer-tree.png') })
    const download = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Download PDF', exact: true }).click()
    expect(await (await download).failure()).toBeNull()
  })
}
