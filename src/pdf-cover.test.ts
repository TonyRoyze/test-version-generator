import { expect, test } from 'bun:test'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createPublicationPdf, type PdfFontLoader } from './pdf-export'
import { FIXTURES, PIXEL_PNG } from './export-fixtures'
import { planExport } from './export-plan'
import { DEFAULT_EXAM_COVER } from './page-cover'

const files = { regular: 'FreeSerif', bold: 'FreeSerifBold', italic: 'FreeSerifItalic', boldItalic: 'FreeSerifBoldItalic', mono: 'FreeMono' }
const fonts: PdfFontLoader = style => Bun.file(new URL(`../public/fonts/${files[style]}.ttf`, import.meta.url)).arrayBuffer()

test('Royal Institute PDF preserves the preview logo, student rows, marks total, and school footer', async () => {
  const fixture = FIXTURES[0]!
  const plan = planExport({ ...fixture, exam: { ...fixture.exam, coverPage: DEFAULT_EXAM_COVER }, selection: { test: true, answerKey: false } })
  const requested: string[] = []
  const bytes = await createPublicationPdf([plan], async src => { requested.push(src); return PIXEL_PNG }, fonts)
  const pdf = await getDocument({ data: bytes, disableWorker: true }).promise
  const text = async (page: number) => (await (await pdf.getPage(page)).getTextContent()).items.filter(item => 'str' in item) as { str: string; transform: number[] }[]
  const cover = await text(1)
  expect(requested).toContain('/school-logo.png')
  expect(cover.some(item => item.str === 'Total')).toBe(true)
  const name = cover.find(item => item.str === 'Name:')!
  const classroom = cover.find(item => item.str === 'Class:')!
  const duration = cover.find(item => item.str.startsWith('Duration:'))!
  expect(name).toBeDefined()
  expect(classroom.transform[5]).toBeCloseTo(name.transform[5]!, 1)
  expect(duration.transform[5]).toBeLessThan(name.transform[5]!)
  const grade = cover.find(item => item.str === DEFAULT_EXAM_COVER.grade.toUpperCase())!
  const subject = cover.find(item => item.str === DEFAULT_EXAM_COVER.subject.toUpperCase())!
  expect(grade).toBeDefined()
  expect(subject.transform[5]).toBeLessThan(grade.transform[5]!)
  expect((await text(2)).map(item => item.str)).toContain('Royal Institute International School')
  expect((await text(2)).some(item => item.str.trim() === '1')).toBe(true)
})
