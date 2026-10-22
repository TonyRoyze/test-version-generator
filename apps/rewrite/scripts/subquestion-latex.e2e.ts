import { expect, test } from '@playwright/test'

const LATEX = String.raw`\begin{aligned}
M(\mathrm{CuSO_4}) &= 64 + 32 + (16 \times 4) = 160\ \mathrm{g\,mol^{-1}}\\
V &= \frac{500}{1000} = 0.5\ \mathrm{dm^3}\\
m &= CVM\\
  &= 1 \times 0.5 \times 160\\
  &= 80\ \mathrm{g}
\end{aligned}`

for (const [type, label] of [['essay', 'Essay'], ['structured-essay', 'Structured essay']] as const) {
  test(`${type} accepts a complete aligned LaTeX block in a subquestion answer`, async ({ page }) => {
    await page.goto('/about')
    await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible()
    const id = await page.evaluate(async () => {
      const { createQuestionBankWorkspaceService } = await import(/* @vite-ignore */ '/src/question-bank-workspaces.ts')
      return (await createQuestionBankWorkspaceService().create()).id
    })
    await page.goto(`/question-bank?id=${id}`)
    await page.getByRole('button', { name: 'New question', exact: true }).click()
    await page.getByRole('menuitem', { name: label, exact: true }).click()
    const editor = page.getByRole('dialog', { name: 'Question editor' })
    await editor.getByRole('button', { name: 'Add subquestions', exact: true }).click()
    await page.keyboard.insertText('Calculate the mass of copper sulfate.')
    await editor.getByRole('button', { name: 'Answer subquestions', exact: true }).click()
    const answer = editor.locator('.sa-body').getByRole('listitem').first()
    await answer.locator('p').first().click()
    await answer.evaluate((element, source) => {
      const clipboardData = new DataTransfer()
      clipboardData.setData('text/plain', source)
      element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }))
    }, LATEX)
    await expect(answer.locator('.milkdown-code-block')).toHaveCount(1)
    // The field must enclose rich blocks as well as its leading paragraph.
    // Otherwise the equation belongs to the answer but looks pasted outside it.
    const field = answer.locator(':scope > .children > .content-dom')
    await expect.poll(() => field.evaluate(element => parseFloat(getComputedStyle(element).borderTopWidth))).toBeGreaterThan(0)
    const boundary = await field.boundingBox()
    const equation = await answer.locator('.milkdown-code-block').boundingBox()
    expect(boundary).not.toBeNull()
    expect(equation).not.toBeNull()
    expect(equation!.y).toBeGreaterThanOrEqual(boundary!.y)
    expect(equation!.y + equation!.height).toBeLessThanOrEqual(boundary!.y + boundary!.height)

    await page.keyboard.press('Control+Enter')
    await expect(editor).toBeHidden()
    await page.reload()
    await page.locator('.question-bank-reading-edit').first().click()
    await expect(editor.locator('.sa-body .milkdown-code-block')).toHaveCount(1)
    const saved = await page.evaluate(async (id) => {
      const { createQuestionBankWorkspaceService } = await import(/* @vite-ignore */ '/src/question-bank-workspaces.ts')
      return (await createQuestionBankWorkspaceService().read(id))!.questions[0]!
    }, id)
    expect(JSON.stringify(saved.doc)).toContain(JSON.stringify(LATEX).slice(1, -1))
    await page.keyboard.press('Control+Enter')
    const examId = await page.evaluate(async (id) => {
      const { createQuestionBankWorkspaceService } = await import(/* @vite-ignore */ '/src/question-bank-workspaces.ts')
      const { createExamWorkspaceService } = await import(/* @vite-ignore */ '/src/exam-workspaces.ts')
      const bank = await createQuestionBankWorkspaceService().read(id)
      return (await createExamWorkspaceService().create(bank!.questions[0]!)).id
    }, id)
    await page.goto(`/editor?exam=${examId}`)
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Export', exact: true })
    await dialog.getByRole('checkbox', { name: 'Student test' }).uncheck()
    await expect(dialog.getByLabel('Export Preview').locator('.katex .mtable')).toHaveCount(1)
    await expect(dialog.getByLabel('Export Preview').locator('.katex-error')).toHaveCount(0)
    const download = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Download PDF', exact: true }).click()
    expect(await (await download).failure()).toBeNull()
  })
}
