import { expect, test } from '@playwright/test'
import { createQuestion } from '../src/exam'
import { multipartPartNodesOf, type ProseMirrorJSON } from '../src/question-doc'
import { seedAuthoringState } from './seed-authoring'

test('answer-only diagrams export to PDF and DOCX and are retained in export history', async ({ page }) => {
  await page.goto('/about')
  await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible()
  const src = await page.evaluate(async () => {
    const { saveImage } = await import(/* @vite-ignore */ '/src/local-images.ts')
    const canvas = new OffscreenCanvas(200, 100)
    canvas.getContext('2d')!.fillRect(0, 0, 200, 100)
    return saveImage(await canvas.convertToBlob({ type: 'image/png' }))
  })
  const questions = (['open', 'essay', 'structured-essay'] as const).map(type => {
    const question = createQuestion(type)
    const picture = { type: 'image-block', attrs: { src, size: 0.15, caption: 'Marking diagram', ...(type === 'open' ? {} : { crop: { left: 0, top: 0, right: 0.5, bottom: 1, width: 200, height: 100 } }) } }
    const content = [{ type: 'paragraph', content: [{ type: 'text', text: `Answer for ${type}` }] }, picture]
    if (type === 'open') question.suggestedAnswer = { type: 'doc', content }
    else (multipartPartNodesOf(question.doc)[0]!.content as ProseMirrorJSON[])[1]!.content = [
      { type: 'paragraph' }, { type: 'ordered_list', content: [{ type: 'list_item', content }] },
    ]
    return question
  })
  await seedAuthoringState(page, { questionBank: { questions }, workingCopy: { title: 'Answer diagrams', questionIds: questions.map(q => q.id) }, dirty: false })
  for (const format of ['PDF', 'DOCX'] as const) {
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Export', exact: true })
    await dialog.getByRole('checkbox', { name: 'Student test' }).uncheck()
    await dialog.getByRole('radio', { name: format, exact: true }).check()
    await expect(dialog.getByLabel('Export Preview').locator('.doc-figure img')).toHaveCount(3)
    const pending = page.waitForEvent('download')
    await dialog.getByRole('button', { name: `Download ${format}`, exact: true }).click()
    const file = await pending
    expect(await file.failure()).toBeNull()
    const { readFile } = await import('node:fs/promises')
    const bytes = await readFile((await file.path())!)
    if (format === 'PDF') {
      const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const loading = getDocument({ data: new Uint8Array(bytes) })
      const document = await loading.promise
      let images = 0
      for (let number = 1; number <= document.numPages; number++) {
        const operators = await (await document.getPage(number)).getOperatorList()
        images += operators.fnArray.filter(op => op === OPS.paintImageXObject).length
      }
      expect(images).toBe(3)
      await loading.destroy()
    } else {
      const { default: JSZip } = await import('jszip')
      const zip = await JSZip.loadAsync(bytes)
      const xml = await zip.file('word/document.xml')!.async('string')
      expect(xml.match(/<w:drawing>/g)).toHaveLength(3)
      expect(xml).not.toContain('[Image:')
    }
  }
  const hashes = await page.evaluate(async () => {
    const { createExamWorkspaceService } = await import(/* @vite-ignore */ '/src/exam-workspaces.ts')
    const workspaces = createExamWorkspaceService()
    return (await workspaces.backendFor((await workspaces.activeId())!).readExportHistory()).records.map(record => record.mediaHashes)
  })
  expect(hashes).toHaveLength(2)
  for (const assets of hashes) expect(assets).toContain(src.split('/').at(-1))
})
