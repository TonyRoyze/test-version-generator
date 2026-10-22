import { expect, test } from '@playwright/test'
import { createQuestion } from '../src/exam'
import { seedAuthoringState } from './seed-authoring'

test('question images and crops are centered without changing their authored width', async ({ page }) => {
  await page.goto('/about')
  await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible()
  const src = await page.evaluate(async () => {
    const { saveImage } = await import(/* @vite-ignore */ '/src/local-images.ts')
    const canvas = new OffscreenCanvas(200, 100)
    const context = canvas.getContext('2d')!
    context.fillStyle = '#3e718a'
    context.fillRect(0, 0, 200, 100)
    return saveImage(await canvas.convertToBlob({ type: 'image/png' }))
  })
  const question = createQuestion('open')
  question.doc = { type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Describe these diagrams.' }] },
    { type: 'image-block', attrs: { src, size: 0.5, caption: 'Half width' } },
    { type: 'image-block', attrs: { src, size: 0.25, caption: 'Cropped', crop: { left: 0, top: 0, right: 0.5, bottom: 1, width: 200, height: 100 } } },
    { type: 'image-block', attrs: { src, size: 1, caption: 'Full width' } },
  ] }
  await seedAuthoringState(page, { questionBank: { questions: [question] }, workingCopy: { title: 'Centered diagrams', questionIds: [question.id] }, dirty: false })
  const figures = page.locator('.draft-document .question-stem .doc-figure')
  await expect(figures).toHaveCount(3)
  for (let index = 0; index < 3; index++) {
    const figure = figures.nth(index)
    const picture = index === 1 ? figure.locator('.doc-crop') : figure.locator('img')
    await expect(picture).toBeVisible()
    await expect.poll(async () => {
      const outer = await figure.boundingBox()
      const inner = await picture.boundingBox()
      return Math.abs(inner!.x + inner!.width / 2 - outer!.x - outer!.width / 2)
    }).toBeLessThan(1)
    const outer = await figure.boundingBox()
    const inner = await picture.boundingBox()
    expect(inner!.width / outer!.width).toBeCloseTo([0.5, 0.25, 1][index]!, 2)
  }
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Export', exact: true })
  await dialog.getByRole('checkbox', { name: 'Answer key' }).uncheck()
  const pending = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Download PDF', exact: true }).click()
  expect(await (await pending).failure()).toBeNull()
})
