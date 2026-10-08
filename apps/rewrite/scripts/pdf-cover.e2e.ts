import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { PDFDocument, PDFDict, PDFName } from 'pdf-lib'
import { test, expect } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

test('the browser exports the Royal Institute cover with its bundled logo and footer', async ({ page }) => {
  await page.goto('/about')
  await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible()
  const bytes = await page.evaluate(async () => {
    const { FIXTURES } = await import(/* @vite-ignore */ '/src/export-fixtures.ts')
    const { DEFAULT_EXAM_COVER } = await import(/* @vite-ignore */ '/src/page-cover.ts')
    const { planExport } = await import(/* @vite-ignore */ '/src/export-plan.ts')
    const { createPublicationPdf } = await import(/* @vite-ignore */ '/src/pdf-export.ts')
    const fixture = FIXTURES[0]
    const plan = planExport({ ...fixture, exam: { ...fixture.exam, coverPage: { ...DEFAULT_EXAM_COVER, assessment: 'THIRD TERM - UNIT TEST 2', grade: 'GRADE 09 - NATIONAL' } }, selection: { test: true, answerKey: false } })
    return Array.from(await createPublicationPdf([plan]))
  })
  const document = await getDocument({ data: new Uint8Array(bytes) }).promise
  const coverText = (await (await document.getPage(1)).getTextContent()).items.map(item => 'str' in item ? item.str : '').join(' ')
  expect(coverText).toContain('Total')
  expect(coverText).toContain('GRADE 09 - NATIONAL')
  const pageText = (await (await document.getPage(2)).getTextContent()).items.map(item => 'str' in item ? item.str : '').join(' ')
  expect(pageText).toContain('Royal Institute International School')
  const packaged = await PDFDocument.load(new Uint8Array(bytes))
  const images = packaged.getPage(0).node.Resources()!.lookup(PDFName.of('XObject'), PDFDict)
  expect(images.keys()).toHaveLength(1)
  await writeFile('/tmp/test-parrot-cover-fixed.pdf', Buffer.from(bytes))
})
