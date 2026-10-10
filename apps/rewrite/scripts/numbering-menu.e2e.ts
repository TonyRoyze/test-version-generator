import { expect, test } from '@playwright/test'
import { seedAuthoringState } from './seed-authoring'
import { FIXTURES } from '../src/export-fixtures'

test('compact numbering menus change sequence and punctuation independently', async ({ page }) => {
  const question = FIXTURES[6]!.exam.questions.find((question) => question.type === 'multiple-choice')!
  await seedAuthoringState(page, {
    questionBank: { questions: [question] },
    workingCopy: { title: 'Numbering menus', questionIds: [question.id] },
    dirty: false,
  })
  const sheetQuestion = page.locator('.exam-workspace .exam-question[data-question-id]').first()
  const openLabels = async () => {
    await sheetQuestion.click({ button: 'right' })
    await page.getByRole('menuitem', { name: /^Question numbers/ }).hover()
    await expect(page.getByRole('menuitemradio', { name: 'Numbers', exact: true })).toBeVisible()
  }
  await openLabels()
  await expect(page.getByRole('menuitem', { name: / · sequence| · punctuation/ })).toHaveCount(0)
  await page.getByRole('menuitemradio', { name: 'Lowercase letters', exact: true }).click()
  await expect(sheetQuestion.locator('.question-number').first()).toHaveText('a.')
  await openLabels()
  await expect(page.getByRole('menuitemradio', { name: 'Lowercase letters', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('menuitemradio', { name: 'Full stop', exact: true })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('menuitemradio', { name: 'Closing bracket', exact: true }).click()
  await expect(sheetQuestion.locator('.question-number').first()).toHaveText('a)')
  await openLabels()
  await expect(page.getByRole('menuitemradio', { name: 'Lowercase letters', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('menuitemradio', { name: 'Closing bracket', exact: true })).toHaveAttribute('aria-checked', 'true')
})
