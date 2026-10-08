import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { IDBFactory } from 'fake-indexeddb'
import { captureAccount, replaceAccount, accountBackupBlob, readAccountBackup, type AccountSnapshot } from './account-backup'
import { snapshotDigest, syncDecision, type CloudHead } from './cloud-account'
import { LOCAL_STORAGE_NAME, selectAccountStorage, STORAGE_VERSION } from './storage-schema'

const remote: CloudHead = { owner_id: 'owner', revision: 'revision-2', object_path: 'owner/2.zip', updated_at: 'today' }

describe('cloud conflict decisions', () => {
  test('first upload and unchanged work do not conflict', () => {
    expect(syncDecision('local', null, null)).toBe('upload')
    expect(syncDecision('same', { revision: remote.revision, digest: 'same' }, remote)).toBe('unchanged')
  })
  test('publishes local edits only against the revision they were based on', () => {
    expect(syncDecision('new', { revision: remote.revision, digest: 'old' }, remote)).toBe('upload')
    expect(syncDecision('new', { revision: 'revision-1', digest: 'old' }, remote)).toBe('conflict')
    expect(syncDecision('new', null, remote)).toBe('conflict')
  })
  test('downloads remote edits only when local content is unchanged', () => {
    expect(syncDecision('same', { revision: 'revision-1', digest: 'same' }, remote)).toBe('download')
    expect(syncDecision('same', { revision: 'revision-1', digest: 'same' }, null)).toBe('conflict-deleted')
  })
})

const fixture = (): AccountSnapshot => ({
  manifest: {
    format: 'test-parrot-account', version: 1, createdAt: new Date().toISOString(), storageVersion: STORAGE_VERSION, localStorage: {},
    databases: [{ name: LOCAL_STORAGE_NAME, version: STORAGE_VERSION, stores: [
      { name: 'exams', keyPath: 'id', autoIncrement: false, indexes: [], entries: [{ key: 'exam', value: { id: 'exam', title: 'Private exam' } }] },
      { name: 'media-assets', keyPath: 'hash', autoIncrement: false, indexes: [], entries: [{ key: 'image', value: { hash: 'image', bytes: { $tp: 'bytes', file: 'binary/00000.bin' } } }] },
    ] }],
  },
  binaries: new Map([['binary/00000.bin', new Uint8Array([1, 2, 3])]]),
})

describe('account isolation and portable media', () => {
  let previousIndexedDB: PropertyDescriptor | undefined
  let previousLocalStorage: PropertyDescriptor | undefined
  beforeEach(() => {
    previousIndexedDB = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')
    previousLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() })
    const values = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      get length() { return values.size }, key: (i: number) => [...values.keys()][i] ?? null,
      getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k),
    } })
  })
  afterEach(() => {
    selectAccountStorage(null)
    if (previousIndexedDB) Object.defineProperty(globalThis, 'indexedDB', previousIndexedDB)
    else Reflect.deleteProperty(globalThis, 'indexedDB')
    if (previousLocalStorage) Object.defineProperty(globalThis, 'localStorage', previousLocalStorage)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  })
  test('a portable backup restores into the selected account without changing another account', async () => {
    selectAccountStorage('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    await replaceAccount(fixture())
    const a = await captureAccount()
    expect(a.manifest.databases[0]!.name).toBe(LOCAL_STORAGE_NAME)
    selectAccountStorage('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
    expect((await captureAccount()).manifest.databases).toHaveLength(0)
    await replaceAccount(await readAccountBackup(await accountBackupBlob(a)))
    expect([...((await captureAccount()).binaries.values().next().value!)]).toEqual([1, 2, 3])
    selectAccountStorage(null)
    expect((await captureAccount()).manifest.databases).toHaveLength(0)
    selectAccountStorage('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    expect(await snapshotDigest(await captureAccount())).toBe(await snapshotDigest(a))
  })
  test('digest ignores capture time but detects changed image bytes', async () => {
    const first = fixture()
    const second = fixture()
    second.manifest.createdAt = 'different'
    expect(await snapshotDigest(first)).toBe(await snapshotDigest(second))
    second.binaries.set('binary/00000.bin', new Uint8Array([9, 9, 9]))
    expect(await snapshotDigest(first)).not.toBe(await snapshotDigest(second))
  })
})
