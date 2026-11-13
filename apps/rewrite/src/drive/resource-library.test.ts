import { afterEach, beforeEach, expect, test } from 'bun:test'
import { IDBFactory } from 'fake-indexeddb'
import { createExamWorkspaceService } from '../exam-workspaces'
import { createQuestionBankWorkspaceService } from '../question-bank-workspaces'
import { createDriveResourceLibrary } from './resource-library'
import { browserSyncStateStore, emptySyncState } from './sync-state'
import { selectAccountStorage } from '../storage-schema'
import { createQuestion, partsOf } from '../exam'
import { bankIdentities } from '../portable-question-identities'
import type { QuestionBankRecordQuestion } from '../question-bank-export'

let originals: Map<string, PropertyDescriptor | undefined>
beforeEach(() => {
  originals = new Map(['indexedDB', 'localStorage', 'window'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  } })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() })
  selectAccountStorage(null)
})
afterEach(() => {
  selectAccountStorage(null)
  for (const [key, value] of originals) {
    if (value) Object.defineProperty(globalThis, key, value)
    else Reflect.deleteProperty(globalThis, key)
  }
})

test('opening an Exam is unchanged for Drive, while changing its Working Copy is an edit', async () => {
  let clock = 0
  const exams = createExamWorkspaceService({ now: () => new Date(1_700_000_000_000 + clock++ * 1000) })
  const banks = createQuestionBankWorkspaceService()
  const library = createDriveResourceLibrary(exams, banks)
  const exam = await exams.create(createQuestion('open'))
  const before = await library.modifiedAt(exam.id)
  await exams.open(exam.id)
  expect(await library.modifiedAt(exam.id)).toBe(before)
  const backend = exams.backendFor(exam.id)
  const state = (await backend.read())!
  await backend.write({ ...state, workingCopy: { ...state.workingCopy, title: 'Changed locally' }, dirty: true })
  await backend.close()
  const revision = (await exams.recent()).find(candidate => candidate.id === exam.id)!.contentRevision
  expect(revision?.modifiedAt).toBe(before)
  expect(await library.modifiedAt(exam.id)).not.toBe(before)
})

test('deleting a synced bank leaves a tombstone for the next explicit Drive sync', async () => {
  const exams = createExamWorkspaceService()
  const banks = createQuestionBankWorkspaceService()
  const bank = await banks.create()
  const state = emptySyncState()
  state.files[`bank:${bank.id}`] = { kind: 'bank', fileId: 'drive-bank', localModifiedAt: bank.lastUpdatedAt, md5: 'hash', ownedByMe: true }
  browserSyncStateStore.write(state)
  await banks.permanentlyDeleteBank(bank.id, ids => exams.forceDeleteQuestions(ids))
  const { entries } = await createDriveResourceLibrary(exams, banks).snapshot()
  expect(entries).toContainEqual(expect.objectContaining({ kind: 'bank', id: bank.id, trashedAt: bank.lastUpdatedAt }))
})

test('Drive mappings are isolated for each signed-in Test Parrot account', () => {
  selectAccountStorage('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
  browserSyncStateStore.write({ ...emptySyncState(), account: { email: 'first@example.com' } })
  selectAccountStorage('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
  expect(browserSyncStateStore.read().account).toBeUndefined()
  browserSyncStateStore.write({ ...emptySyncState(), account: { email: 'second@example.com' } })
  selectAccountStorage('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
  expect(browserSyncStateStore.read().account?.email).toBe('first@example.com')
})

test('Drive identities include Multipart Parts and their answer ids', () => {
  const question = createQuestion('multipart')
  const parts = partsOf(question)
  expect(parts.length).toBeGreaterThan(0)
  const record = { id: 'q1', parts: parts.map((part, i) => ({ id: `p${i}`, choices: part.choices.map((_, j) => ({ id: `p${i}a${j}` })) })) } as QuestionBankRecordQuestion
  const identities = bankIdentities([question], [record])
  expect(identities.get('q1')).toBe(question.id)
  parts.forEach((part, i) => {
    expect(identities.get(`p${i}`)).toBe(part.id)
    part.choices.forEach((choice, j) => expect(identities.get(`p${i}a${j}`)).toBe(choice.id))
  })
})
