import { useEffect, useState } from 'react'
import { useDriveSync, type SharingSummary } from './drive-sync-context'
import type { ResourceKind } from './sync-state'

export function DriveDeletionNotice({ kind, id }: { kind: ResourceKind; id: string }) {
  const drive = useDriveSync()
  const [sharing, setSharing] = useState<SharingSummary | null>(null)
  useEffect(() => {
    if (!drive?.connected) return
    let active = true
    void drive.sharing([{ kind, id }]).then(result => { if (active) setSharing(result) }).catch(() => undefined)
    return () => { active = false }
  }, [drive, kind, id])
  if (!sharing) return null
  if (sharing.othersOwn) return <p>This file is shared with you. Deleting it removes your local copy; the owner's file stays in Google Drive.</p>
  if (!sharing.owned) return null
  return <p>{sharing.counted && sharing.people > 0 ? `Shared with ${sharing.people} ${sharing.people === 1 ? 'person' : 'people'}. ` : ''}Your next sync moves its Drive copy to Google's trash for everyone it is shared with.</p>
}
