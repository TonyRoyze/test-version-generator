import { cloudSyncGeneration, getCloudSyncStatus, setCloudSyncStatus } from './cloud-sync-status'
import type { SupabaseClient } from '@supabase/supabase-js'
import { accountBackupBlob, captureAccount, readAccountBackup, replaceAccount, type AccountSnapshot } from './account-backup'
import { LOCAL_STORAGE_NAME, EXAM_STORE, QUESTION_BANK_REGISTRY_STORE } from './storage-schema'

export type CloudHead = { owner_id: string; revision: string; object_path: string; updated_at: string }
type Baseline = { revision: string; digest: string }
const bucket = 'account-snapshots'
const baselineKey = (id: string) => `cloud-account:${id}:baseline`
export let cloudStartupError = ''
export let canImportBrowserWork = false
export class CloudConflict extends Error {
  constructor(public head: CloudHead) { super('Another device has saved changes. Choose which copy to keep.') }
}
export function syncDecision(localDigest: string, baseline: Baseline | null, remote: CloudHead | null) {
  if (!remote) return baseline ? 'conflict-deleted' : 'upload'
  if (baseline?.revision === remote.revision) return localDigest === baseline.digest ? 'unchanged' : 'upload'
  return baseline && localDigest === baseline.digest ? 'download' : 'conflict'
}
function baselineFor(id: string): Baseline | null {
  try { return JSON.parse(localStorage.getItem(baselineKey(id)) ?? 'null') } catch { return null }
}
function remember(id: string, revision: string, digest: string) {
  localStorage.setItem(baselineKey(id), JSON.stringify({ revision, digest }))
}
export async function snapshotDigest(snapshot: AccountSnapshot) {
  const content = JSON.stringify({ ...snapshot.manifest, createdAt: '', localStorage: {} })
  const parts: BlobPart[] = [content]
  for (const [path, bytes] of snapshot.binaries) parts.push(path, bytes.slice().buffer)
  const digest = await crypto.subtle.digest('SHA-256', await new Blob(parts).arrayBuffer())
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
export function snapshotHasWork(snapshot: AccountSnapshot) {
  return snapshot.manifest.databases.some(database => database.name.includes('-exam-') ||
    database.stores.some(store => [EXAM_STORE, QUESTION_BANK_REGISTRY_STORE, 'canonical-questions', 'media-assets'].includes(store.name) && store.entries.length > 0))
}
export async function cloudHead(client: SupabaseClient, id: string): Promise<CloudHead | null> {
  const { data, error } = await client.from('account_heads').select('*').eq('owner_id', id).maybeSingle()
  if (error) throw new Error(`Cloud storage is unavailable: ${error.message}`)
  return data
}
export async function downloadCloud(client: SupabaseClient, head: CloudHead) {
  const { data, error } = await client.storage.from(bucket).download(head.object_path)
  if (error) throw error
  return readAccountBackup(data)
}
export async function uploadCloud(client: SupabaseClient, id: string, snapshot: AccountSnapshot, expected: CloudHead | null) {
  const revision = crypto.randomUUID()
  const path = `${id}/${revision}.zip`
  const blob = await accountBackupBlob(snapshot)
  if (blob.size > 50 * 1024 * 1024) throw new Error('Your account exceeds the 50 MB cloud limit. Download a backup to keep a copy.')
  const upload = await client.storage.from(bucket).upload(path, blob, { contentType: 'application/zip', upsert: false })
  if (upload.error) throw upload.error
  const row = { owner_id: id, revision, object_path: path, updated_at: new Date().toISOString() }
  const result = expected
    ? await client.from('account_heads').update(row).eq('owner_id', id).eq('revision', expected.revision).select('revision').maybeSingle()
    : await client.from('account_heads').insert(row).select('revision').maybeSingle()
  // Keep uploaded objects on ambiguous network failures: the head may have committed.
  if (result.error || !result.data) {
    const current = await cloudHead(client, id)
    if (current?.revision !== revision) {
      if (current) throw new CloudConflict(current)
      throw result.error ?? new Error('The cloud copy changed. Try syncing again.')
    }
  }
  remember(id, revision, await snapshotDigest(snapshot))
  // Older objects remain recoverable. No delete can race another device's download.
  return row
}

/** Only called before workspace connections open. Existing unsynced work is never overwritten. */
export async function prepareCloudAccount(client: SupabaseClient, id: string) {
  const snapshot = await captureAccount()
  const existing = snapshotHasWork(snapshot)
  let remote: CloudHead | null
  try { remote = await cloudHead(client, id) } catch (error) {
    if (!existing) throw error
    cloudStartupError = 'Cloud storage could not be reached. You are working with this device’s copy. Sync from Settings when connected.'
    return
  }
  canImportBrowserWork = !remote && !existing
  const action = sessionStorage.getItem(`cloud-account:${id}:action`)
  if (action === 'import-local') {
    if (remote || existing) {
      sessionStorage.removeItem(`cloud-account:${id}:action`)
      throw new Error('Import browser work only into an empty account. Use a backup to replace existing work.')
    }
    await replaceAccount(await captureAccount(new Date(), LOCAL_STORAGE_NAME))
    sessionStorage.removeItem(`cloud-account:${id}:action`)
    return
  }
  const digest = await snapshotDigest(snapshot)
  if (remote && (action === 'download' || (!existing && !baselineFor(id)) || syncDecision(digest, baselineFor(id), remote) === 'download')) {
    const incoming = await downloadCloud(client, remote)
    await replaceAccount(incoming)
    remember(id, remote.revision, await snapshotDigest(incoming))
  }
  sessionStorage.removeItem(`cloud-account:${id}:action`)
}
async function performSync(client: SupabaseClient, id: string, overwrite?: CloudHead) {
  const snapshot = await captureAccount()
  const remote = await cloudHead(client, id)
  const decision = syncDecision(await snapshotDigest(snapshot), baselineFor(id), remote)
  if (overwrite) {
    if (remote?.revision !== overwrite.revision) {
      if (remote) throw new CloudConflict(remote)
      throw new Error('The cloud copy was removed. Reload and try again.')
    }
    await uploadCloud(client, id, snapshot, remote)
    return 'uploaded'
  }
  if (decision === 'conflict' && remote) throw new CloudConflict(remote)
  if (decision === 'conflict-deleted') throw new Error('The cloud copy was removed. Download a backup before restoring cloud storage.')
  if (decision === 'download') return 'download'
  if (decision === 'upload') await uploadCloud(client, id, snapshot, remote)
  return decision === 'unchanged' ? 'unchanged' : 'uploaded'
}
export function reloadCloudAccount(id: string, action: 'download' | 'import-local') {
  sessionStorage.setItem(`cloud-account:${id}:action`, action)
  window.location.reload()
}

/** A status check never uploads or replaces work. Cache only the remote head;
 * always compare the current local content with its synced baseline. */
let checkedHead: { id: string; head: CloudHead | null; at: number } | null = null
export async function checkCloudSync(client: SupabaseClient, id: string, refreshRemote = false) {
  if (getCloudSyncStatus().state === 'syncing') return
  let generation = cloudSyncGeneration()
  try {
    if (refreshRemote || checkedHead?.id !== id || Date.now() - checkedHead.at > 30_000) {
      setCloudSyncStatus({ state: 'checking' })
      generation = cloudSyncGeneration()
      const head = await cloudHead(client, id)
      if (generation !== cloudSyncGeneration()) return
      checkedHead = { id, head, at: Date.now() }
    }
    const digest = await snapshotDigest(await captureAccount())
    if (generation !== cloudSyncGeneration()) return
    const decision = syncDecision(digest, baselineFor(id), checkedHead!.head)
    setCloudSyncStatus({ state: decision === 'unchanged' ? 'synced'
      : decision === 'upload' ? 'pending'
      : decision === 'download' ? 'remote'
      : 'conflict' })
  } catch (error) {
    if (generation === cloudSyncGeneration()) {
      checkedHead = null
      setCloudSyncStatus({ state: 'error', detail: error instanceof Error ? error.message : 'Could not check cloud storage.' })
    }
  }
}

export async function syncAccount(client: SupabaseClient, id: string, overwrite?: CloudHead) {
  setCloudSyncStatus({ state: 'syncing' })
  checkedHead = null
  try {
    const result = await performSync(client, id, overwrite)
    if (result === 'download') setCloudSyncStatus({ state: 'remote' })
    else {
      setCloudSyncStatus({ state: 'checking' })
      await checkCloudSync(client, id, true)
    }
    return result
  } catch (error) {
    setCloudSyncStatus({ state: error instanceof CloudConflict ? 'conflict' : 'error', detail: error instanceof Error ? error.message : 'Cloud sync failed. Your work remains on this device.' })
    throw error
  }
}
