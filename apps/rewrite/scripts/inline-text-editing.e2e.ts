import { expect, test } from '@playwright/test'
import { seedAuthoringState } from './seed-authoring'
import { DEFAULT_EXAM_COVER } from '../src/page-cover'

for (const label of ['School name', 'Instruction 1', 'Section heading', 'Section directions', 'Unit title']) {
  test(`${label} keeps typing local until focus leaves the field`, async ({ page }) => {
    await seedAuthoringState(page, {
      questionBank: { questions: [] },
      workingCopy: {
        title: 'Typing regression',
        questionIds: [],
        coverPage: label === 'Unit title' ? { ...DEFAULT_EXAM_COVER, templateId: 'paper-book' } : DEFAULT_EXAM_COVER,
        sections: [{ id: 'section-1', title: 'Original heading', instructions: 'Original directions' }],
      },
      dirty: false,
    })
    const save = page.getByRole('button', { name: 'Save', exact: true })
    if (await save.isEnabled()) await save.click()
    await expect(save).toBeDisabled()
    const field = page.getByRole('textbox', { name: label, exact: true })
    await field.click()
    await field.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(0, 0))
    for (const [index, character] of [...'New '].entries()) {
      await page.keyboard.type(character)
      // Deliberately type slower than pagination's debounce, as a person can.
      await page.waitForTimeout(250)
      await expect(field).toBeFocused()
      await expect(field).toHaveJSProperty('selectionStart', index + 1)
    }
    const original = label === 'Unit title' ? DEFAULT_EXAM_COVER.subject : label === 'School name' ? DEFAULT_EXAM_COVER.schoolName
      : label === 'Instruction 1' ? DEFAULT_EXAM_COVER.instructions[0]
        : label === 'Section heading' ? 'Original heading' : 'Original directions'
    await expect(field).toHaveValue(`New ${original}`)
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
    await field.press(label.startsWith('Section') ? 'Enter' : 'Tab')
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
    await page.reload()
    await expect(field).toHaveValue(`New ${original}`)
  })
}
