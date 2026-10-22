import { expect, test } from '@playwright/test'
import { createQuestion } from '../src/exam'
import { multipartPartsNodeOf, type ProseMirrorJSON } from '../src/question-doc'
import { seedAuthoringState } from './seed-authoring'

for (const type of ['essay', 'structured-essay'] as const) {
  test(`${type} continuations retain every subpart in order when the preview rerenders`, async ({ page }) => {
    const errors: string[] = []
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    const question = createQuestion(type)
    const box = multipartPartsNodeOf(question.doc)!
    const template = (box.content as ProseMirrorJSON[])[0]!
    const texts: string[] = []
    const working: { answer: string; explanation: string }[] = []
    box.content = Array.from({ length: 3 }, (_, index) => {
      const part = structuredClone(template)
      part.attrs = { ...(part.attrs as object), id: `part-${index}` }
      ;(part.content as ProseMirrorJSON[])[1]!.content = [{ type: 'paragraph' }, {
        type: 'ordered_list', attrs: { order: 1 }, content: Array.from({ length: 35 }, (_, sub) => {
          const text = `Response ${index + 1}.${sub + 1}`
          texts.push(text)
          const content: ProseMirrorJSON[] = [{ type: 'paragraph', content: [{ type: 'text', text }] }]
          if (sub % 7 === 0) {
            const explanation = `Working ${index + 1}.${sub + 1}`
            working.push({ answer: text, explanation })
            content.push({ type: 'code_block', attrs: { language: 'latex' }, content: [{ type: 'text', text: 'm = CVM' }] }, { type: 'paragraph', content: [{ type: 'text', text: explanation }] })
          }
          return { type: 'list_item', content }
        }),
      }]
      return part
    })
    await seedAuthoringState(page, { questionBank: { questions: [question] }, workingCopy: { title: 'Essay continuation', questionIds: [question.id] }, dirty: false })
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Export', exact: true })
    await dialog.getByRole('checkbox', { name: 'Student test' }).uncheck()
    const preview = dialog.getByLabel('Export Preview')
    await expect(preview).toContainText('Response 1.1')
    for (const sheet of await preview.locator('.exam-page').all()) {
      await expect(sheet.locator('.answer-key-entry')).toHaveCount(1)
      const labels = await sheet.locator('.answer-key-part-letter').allTextContents()
      expect(new Set(labels).size).toBe(labels.length)
    }
    const answers = preview.locator('.answer-key-suggested li > p:first-child')
    await expect(answers).toHaveText(texts)
    await dialog.getByRole('checkbox', { name: 'Student test' }).check()
    await dialog.getByRole('checkbox', { name: 'Student test' }).uncheck()
    await expect(answers).toHaveText(texts)
    for (const unit of working) {
      const answer = preview.locator('li').filter({ has: page.getByText(unit.answer, { exact: true }) })
      await expect(answer.getByText(unit.explanation, { exact: true })).toBeVisible()
      await expect(answer.locator('.doc-math--block')).toHaveCount(1)
    }
    expect(errors.filter(error => /same key|unique.*key/i.test(error))).toEqual([])
    const download = page.waitForEvent('download', { timeout: 8000 })
    await dialog.getByRole('button', { name: 'Download PDF', exact: true }).click()
    const file = await download
    expect(await file.failure()).toBeNull()
    const { readFile } = await import('node:fs/promises')
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const loading = getDocument({ data: new Uint8Array(await readFile((await file.path())!)) })
    const pdf = await loading.promise
    const responses: string[] = []
    for (let number = 1; number <= pdf.numPages; number++) {
      const content = await (await pdf.getPage(number)).getTextContent()
      const pageText = content.items.map(item => 'str' in item ? item.str : '').join(' ')
      for (const unit of working) {
        if (new RegExp(`${unit.answer}(?![0-9])`).test(pageText)) expect(pageText).toContain(unit.explanation)
      }
      const numbers = content.items.filter(item => 'str' in item && item.str === '1.')
      expect(numbers).toHaveLength(1)
      for (const label of type === 'essay' ? ['(A)', '(B)', '(C)'] : []) {
        expect(content.items.filter(item => 'str' in item && item.str === label).length).toBeLessThanOrEqual(1)
      }
      responses.push(...content.items.flatMap(item => 'str' in item ? item.str.match(/Response \d+\.\d+/g) ?? [] : []))
    }
    expect(responses).toEqual(texts)
    await loading.destroy()
  })

}
