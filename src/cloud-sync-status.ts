/** Shared by the cloud operations and the storage badge, including across routes. */
export type CloudSyncState = 'local' | 'checking' | 'synced' | 'pending' | 'syncing' | 'conflict' | 'remote' | 'error'
export type CloudSyncStatus = { state: CloudSyncState; detail?: string }
let status: CloudSyncStatus = { state: 'local' }
let generation = 0
const listeners = new Set<() => void>()
export const getCloudSyncStatus = () => status
export const cloudSyncGeneration = () => generation
export function subscribeCloudSync(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function setCloudSyncStatus(next: CloudSyncStatus) {
  generation += 1
  status = next
  for (const listener of listeners) listener()
}
