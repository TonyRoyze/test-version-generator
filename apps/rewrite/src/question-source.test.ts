import { expect, test } from 'bun:test'
import Ajv2020 from 'ajv/dist/2020'
import schema from './question-bank-record-0.12.0.schema.json'
import publicSchema from '../public/formats/question-bank/0.12.0/schema.json'
import { duplicateQuestion, SECTION_LABELS, type QuestionType } from './exam'
import { FIXTURES } from './export-fixtures'
import { prepareQuestionBankExport } from './question-bank-export'
import { importedQuestionsFromRecord, inspectQuestionBankRecordValue } from './question-bank-import'
import { browseQuestionBank, NO_FILTER } from './question-bank-view'
import { readingOfQuestion } from './question-reading-content'

for (const type of Object.keys(SECTION_LABELS) as QuestionType[]) {
  test(`${type} retains its source through duplication and sharing and can be found by it`, async () => {
    const original = FIXTURES.flatMap(fixture => fixture.exam.questions).find(question => question.type === type)!
    expect(original).toBeDefined()
    const source = type === 'essay' || type === 'structured-essay' ? 'GCE O/L 2024 2 (i) a)' : 'GCE O/L 2024 34'
    const question = { ...original, source }
    const bank = { id: 'bank', name: 'Past papers', createdAt: '', lastUpdatedAt: '', questions: [question] }
    expect(duplicateQuestion(question).source).toBe(source)
    const prepared = await prepareQuestionBankExport(bank)
    expect(prepared.record.bank.questions[0]!.source).toBe(source)
    const proposal = await inspectQuestionBankRecordValue(prepared.record)
    const [imported] = importedQuestionsFromRecord(proposal.record)
    expect(imported!.source).toBe(source)
    expect(readingOfQuestion(imported!).source).toBe(source)
    expect(browseQuestionBank({ questions: [imported!] }, { ...NO_FILTER, search: source.toLowerCase() })).toEqual([imported!])
    const validate = new Ajv2020({ strict: true }).compile(schema)
    expect(validate(prepared.record), JSON.stringify(validate.errors)).toBe(true)
    const invalid = structuredClone(prepared.record)
    Object.assign(invalid.bank.questions[0]!, { source: 2024 })
    await expect(inspectQuestionBankRecordValue(invalid)).rejects.toMatchObject({ code: 'invalid-structure' })
  })
}

test('the public source schema matches the application schema', () => {
  expect(publicSchema).toEqual(schema)
})

test('published source examples import, while an older record discards an unknown source', async () => {
  for (const name of ['minimal-multiple-choice', 'essay']) {
    const record = await Bun.file(new URL(`../public/formats/question-bank/0.12.0/examples/${name}.json`, import.meta.url)).json()
    const proposal = await inspectQuestionBankRecordValue(record)
    expect(proposal.record.bank.questions[0]!.source).toBe(record.bank.questions[0].source)
    record.formatVersion = '0.11.0'
    const older = await inspectQuestionBankRecordValue(record)
    expect(older.record.bank.questions[0]).not.toHaveProperty('source')
  }
})
