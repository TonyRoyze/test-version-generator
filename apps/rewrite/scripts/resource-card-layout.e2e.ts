import { expect, test } from '@playwright/test'

test('resource cards share a size and clicking their lower edge opens the resource', async ({ page }) => {
  await page.goto('/about')
  await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible()
  const ids = await page.evaluate(async () => {
    const { createQuestionBankWorkspaceService } = await import(/* @vite-ignore */ '/src/question-bank-workspaces.ts') as typeof import('../src/question-bank-workspaces')
    const { createExamWorkspaceService } = await import(/* @vite-ignore */ '/src/exam-workspaces.ts') as typeof import('../src/exam-workspaces')
    const { createQuestion } = await import(/* @vite-ignore */ '/src/exam.ts') as typeof import('../src/exam')
    const banks = createQuestionBankWorkspaceService()
    const bank = await banks.create()
    await banks.commit(bank.id, { kind: 'rename', name: 'Card bank' })
    await banks.commit(bank.id, { kind: 'create-question', question: createQuestion('open') })
    const exams = createExamWorkspaceService()
    const exam = await exams.create()
    const backend = exams.backendFor(exam.id)
    const state = (await backend.read())!
    await backend.write({ ...state, workingCopy: { ...state.workingCopy, title: 'Card exam' }, dirty: true })
    return { bankId: bank.id, examId: exam.id }
  })
  await page.goto('/')
  const exam = page.locator('.exam-card')
  const bank = page.locator('.question-bank-card')
  const next = page.getByRole('button', { name: 'New Exam', exact: true })
  await expect(exam).toBeVisible()
  const dimensions = await Promise.all([exam, bank, next].map((card) => card.boundingBox()))
  expect(dimensions.map((box) => [Math.round(box!.width), Math.round(box!.height)])).toEqual(Array(3).fill([Math.round(dimensions[0]!.width), Math.round(dimensions[0]!.height)]))
  const examBox = dimensions[0]!
  await exam.click({ position: { x: 20, y: examBox.height - 10 } })
  await expect(page).toHaveURL(new RegExp(`/editor\\?exam=${ids.examId}`))
  await page.goto('/')
  const bankBox = (await bank.boundingBox())!
  await bank.click({ position: { x: 20, y: bankBox.height - 10 } })
  await expect(page).toHaveURL(new RegExp(`/question-bank\\?id=${ids.bankId}`))
  await page.goto('/exams')
  await page.getByRole('button', { name: 'Actions for Card exam', exact: true }).click()
  await expect(page.getByRole('menu', { name: 'Card exam actions' })).toBeVisible()
  await expect(page).toHaveURL(/\/exams$/)
})
