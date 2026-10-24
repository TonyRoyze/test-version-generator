import { expect, test } from '@playwright/test'

for (const [type, label, firstLabel] of [['structured-essay', 'Structured essay', '(i)'], ['essay', 'Essay', '(A)']] as const) {
  test(`${label} can be authored, saved and reopened with written parts and subquestions`, async ({ page }) => {
    await page.goto('/about')
    await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible()
    const id = await page.evaluate(async () => {
      const { createQuestionBankWorkspaceService } = await import(/* @vite-ignore */ '/src/question-bank-workspaces.ts') as typeof import('../src/question-bank-workspaces')
      const service = createQuestionBankWorkspaceService()
      const bank = await service.create()
      await service.commit(bank.id, { kind: 'rename', name: 'Science II' })
      return bank.id
    })
    await page.goto(`/question-bank?id=${id}`)
    await page.getByRole('button', { name: 'New question', exact: true }).click()
    await page.getByRole('menuitem', { name: label, exact: true }).click()
    const editor = page.getByRole('dialog', { name: 'Question editor' })
    await expect(editor).toBeVisible()
    const part = editor.locator('.multipart-part').first()
    await expect(part.getByText('Suggested Answer', { exact: true })).toBeVisible()
    await expect(editor).not.toContainText('Answer space: type')
    await expect(editor).not.toContainText('Type <2lines>')
    if (type === 'essay') expect(await part.locator('.multipart-part-label').evaluate((element) => getComputedStyle(element, '::after').content)).toBe('none')
    await expect(part.getByRole('button', { name: 'Part type: Short Answer', exact: true })).toBeHidden()
    const stem = part.locator('.multipart-part-stem p').first()
    await stem.click()
    await page.keyboard.type('Study the power station diagram.')
    await part.getByRole('button', { name: 'Add subquestions', exact: true }).click()
    const items = part.getByRole('listitem')
    await expect(items).toHaveCount(1)
    await items.first().locator('p').first().click()
    await page.keyboard.insertText('Name the input energy. <2lines>')
    await page.keyboard.press('Enter')
    await expect(items).toHaveCount(2)
    await items.last().locator('p').first().click()
    await page.keyboard.insertText('Calculate the power. <3lines>')
    await expect(part.getByRole('listitem')).toHaveCount(2)
    await part.getByRole('button', { name: 'Answer subquestions', exact: true }).click()
    const answerSlots = part.locator('.sa-body').getByRole('listitem')
    await expect(answerSlots).toHaveCount(2)
    await answerSlots.nth(0).locator('p').first().click()
    await page.keyboard.insertText('Chemical energy from fuel.')
    await answerSlots.nth(1).locator('p').first().click()
    await page.keyboard.insertText('Power is energy divided by time.')
    await expect(part.getByRole('button', { name: 'Answer subquestions', exact: true })).toBeDisabled()
    await page.keyboard.press('Control+Enter')
    await expect(editor).toBeHidden()
    await expect(page.locator('.question-reading-parts')).toContainText('Name the input energy.')
    await expect(page.locator('.question-reading-parts > li').first()).toHaveAttribute('data-part-label', type === 'essay' ? '' : firstLabel)
    await page.reload()
    await expect(page.locator('.question-reading-parts')).toContainText('Calculate the power.')
    const saved = await page.evaluate(async ({ id, type }) => {
      const { createQuestionBankWorkspaceService } = await import(/* @vite-ignore */ '/src/question-bank-workspaces.ts') as typeof import('../src/question-bank-workspaces')
      const bank = await createQuestionBankWorkspaceService().read(id)
      return bank!.questions.find((question) => question.type === type)!.type
    }, { id, type })
    expect(saved).toBe(type)
    await page.locator('.question-bank-reading-edit').first().click()
    await expect(editor).toBeVisible()
    await expect(editor.locator('.multipart-part-stem').getByRole('listitem')).toHaveCount(2)
    await expect(editor.locator('.sa-body').getByRole('listitem').nth(0)).toContainText('Chemical energy from fuel.')
    await expect(editor.locator('.sa-body').getByRole('listitem').nth(1)).toContainText('Power is energy divided by time.')
    await expect(editor.locator('.multipart-part-stem')).toContainText('<2lines>')
    await expect(editor.locator('.multipart-part-stem')).toContainText('<3lines>')
    await editor.getByRole('button', { name: 'Add Part', exact: true }).last().click()
    await expect(editor.getByRole('menuitem', { name: 'Multiple Choice', exact: true })).toHaveCount(0)
    await expect(editor.getByRole('menuitem', { name: 'Short Answer', exact: true })).toHaveCount(0)
    await expect(editor.locator('.multipart-part')).toHaveCount(2)
    if (type === 'essay') expect(await part.locator('.multipart-part-label').evaluate((element) => getComputedStyle(element, '::after').content)).not.toBe('none')
    await editor.locator('.multipart-part-stem').last().locator('p').first().click()
    await page.keyboard.insertText('Explain the role of the transformer.')
    await page.keyboard.press('Control+Enter')
    await expect(editor).toBeHidden()
    const examId = await page.evaluate(async (id) => {
      const { createQuestionBankWorkspaceService } = await import(/* @vite-ignore */ '/src/question-bank-workspaces.ts') as typeof import('../src/question-bank-workspaces')
      const { createExamWorkspaceService } = await import(/* @vite-ignore */ '/src/exam-workspaces.ts') as typeof import('../src/exam-workspaces')
      const bank = await createQuestionBankWorkspaceService().read(id)
      return (await createExamWorkspaceService().create(bank!.questions[0]!)).id
    }, id)
    await page.goto(`/editor?exam=${examId}`)
    await expect(page.locator('.draft-document .multipart-part-print')).toHaveCount(2)
    await expect(page.locator('.draft-document .question-count')).toHaveText('1.')
    await expect(page.locator('.draft-document .part-count').first()).toHaveText(firstLabel)
    await expect(page.locator('.draft-document')).toContainText('Calculate the power.')
    await expect(page.locator('.draft-document .multipart-part-print').first()).not.toContainText('Chemical energy from fuel.')
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    const exportDialog = page.getByRole('dialog', { name: 'Export', exact: true })
    await exportDialog.getByRole('checkbox', { name: 'Student test' }).uncheck()
    await expect(exportDialog.getByLabel('Export Preview')).toContainText('Chemical energy from fuel.')
    await expect(exportDialog.getByLabel('Export Preview')).toContainText('Power is energy divided by time.')
    const download = page.waitForEvent('download')
    await exportDialog.getByRole('button', { name: 'Download PDF', exact: true }).click()
    expect(await (await download).failure()).toBeNull()
    await expect(exportDialog).toBeHidden()
    const printedPart = page.locator('.draft-document .multipart-part-print').first()
    await expect(printedPart).not.toContainText('<2lines>')
    await expect(printedPart).not.toContainText('<3lines>')
    const subquestions = printedPart.locator('ol > li')
    await expect(subquestions.first()).toContainText('Name the input energy.')
    await expect(subquestions.first().locator('.work-space-line')).toHaveCount(2)
    await expect(subquestions.last()).toContainText('Calculate the power.')
    await expect(subquestions.last().locator('.work-space-line')).toHaveCount(3)
    await expect(page.locator('.draft-document .work-space-line')).toHaveCount(5)
    await expect(page.locator('.draft-document').getByRole('separator', { name: /Work space for question/ })).toHaveCount(0)
  })
}

for (const type of ['essay', 'structured-essay'] as const) {
  test(`${type} exports a multi-page answer key with a long nested subquestion answer`, async ({ page }) => {
    const { seedAuthoringState } = await import('./seed-authoring')
    const { createQuestion } = await import('../src/exam')
    const { multipartPartNodesOf } = await import('../src/question-doc')
    const question = createQuestion(type)
    const part = multipartPartNodesOf(question.doc)[0]!
    const answer = (part.content as Record<string, unknown>[])[1]!
    answer.content = [{ type: 'paragraph' }, { type: 'ordered_list', attrs: { order: 1 }, content: [
      { type: 'list_item', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First subquestion answer.' }] }] },
      { type: 'list_item', content: [{ type: 'paragraph' }, { type: 'ordered_list', attrs: { order: 1 }, content: [
        { type: 'list_item', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Long nested answer. ' + 'Energy is conserved throughout the transformation. '.repeat(500) + 'End of nested answer.' }] }] },
      ] }] },
    ] }]
    await seedAuthoringState(page, { questionBank: { questions: [question] }, workingCopy: { title: 'Long essay key', questionIds: [question.id] }, dirty: false })
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Export', exact: true })
    await dialog.getByRole('checkbox', { name: 'Student test' }).uncheck()
    const preview = dialog.getByLabel('Export Preview')
    await expect(preview).toContainText('First subquestion answer.')
    await expect(preview).toContainText('End of nested answer.')
    expect(await preview.locator('.exam-page').count()).toBeGreaterThan(1)
    const download = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Download PDF', exact: true }).click()
    const file = await download
    expect(await file.failure()).toBeNull()
    const { PDFDocument } = await import('pdf-lib')
    const { readFile } = await import('node:fs/promises')
    const bytes = await readFile((await file.path())!)
    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getPageCount()).toBeGreaterThan(1)
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const loading = getDocument({ data: new Uint8Array(bytes) })
    const readable = await loading.promise
    const texts: string[] = []
    for (let number = 1; number <= readable.numPages; number++) {
      const content = await (await readable.getPage(number)).getTextContent()
      texts.push(content.items.map(item => 'str' in item ? item.str : '').join(' '))
    }
    const text = texts.join(' ').replace(/\s+/g, ' ')
    expect(text).toContain('First subquestion answer.')
    expect(text).toContain('End of nested answer.')
    // Page furniture can interrupt a sentence in extracted PDF text.
    // Count each distinctive word to detect truncated or duplicated answers.
    for (const word of ['Energy', 'conserved', 'throughout', 'transformation']) {
      expect(text.match(new RegExp(`\\b${word}\\b`, 'g'))).toHaveLength(500)
    }
    await loading.destroy()
  })
}
