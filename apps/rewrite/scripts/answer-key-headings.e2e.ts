import { expect, test } from '@playwright/test'
import { createQuestion } from '../src/exam'
import { multipartPartNodesOf, type ProseMirrorJSON } from '../src/question-doc'
import { seedAuthoringState } from './seed-authoring'

function lines(first: string, count: number) {
  return { type: 'paragraph', content: Array.from({ length: count }, (_, index) => [
    ...(index ? [{ type: 'hardbreak' }] : []),
    { type: 'text', text: index === 0 ? first : `Answer line ${index + 1}` },
  ]).flat() }
}

for (const [type, title] of [['essay', 'Essay'], ['structured-essay', 'Structured Essay']] as const) {
  test(`${title} answer-key heading stays on the page where its first answer starts`, async ({ page }) => {
    const previous = createQuestion('open')
    previous.suggestedAnswer = { type: 'doc', content: [lines('Earlier section answer', 25)] }
    const question = createQuestion(type)
    const part = multipartPartNodesOf(question.doc)[0]!
    ;(part.content as ProseMirrorJSON[])[1]!.content = [lines('Written answer begins here', 30)]
    await seedAuthoringState(page, { questionBank: { questions: [previous, question] }, workingCopy: { title: 'Heading placement', questionIds: [previous.id, question.id] }, dirty: false })
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Export', exact: true })
    await dialog.getByRole('checkbox', { name: 'Student test' }).uncheck()
    const preview = dialog.getByLabel('Export Preview')
    await expect(preview.locator('.exam-page')).toHaveCount(2)
    const sheet = preview.locator('.exam-page').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
    await expect(sheet).toHaveCount(1)
    await expect(sheet).toContainText('Written answer begins here')
    await expect(sheet.locator('.answer-key-entry').first().locator(':scope > span').first()).toHaveText('2.')
    const download = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Download PDF', exact: true }).click()
    const file = await download
    expect(await file.failure()).toBeNull()
    const { readFile } = await import('node:fs/promises')
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const loading = getDocument({ data: new Uint8Array(await readFile((await file.path())!)) })
    const document = await loading.promise
    const texts: string[] = []
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const content = await (await document.getPage(pageNumber)).getTextContent()
      texts.push(content.items.map(item => 'str' in item ? item.str : '').join(' '))
    }
    const titledPages = texts.filter(text => text.includes(title))
    expect(titledPages).toHaveLength(1)
    expect(titledPages[0]).toContain('Written answer begins here')
    await loading.destroy()
  })
}
