import { Modal } from '@/components/modal'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  CloudAlert,
  CloudCheck,
  CloudDownload,
  CloudOff,
  CloudUpload,
  Download,
  RefreshCw,
  Settings,
  Upload,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import {
  accountBackupBlob,
  AccountBackupError,
  accountBackupFileName,
  captureAccount,
  readAccountBackup,
  stageRestore,
  type AccountManifest,
} from './account-backup'
import './account-menu.css'
import {
  checkCloudSync,
  CloudConflict,
  reloadCloudAccount,
  syncAccount,
} from './cloud-account'
import {
  getCloudSyncStatus,
  setCloudSyncStatus,
  subscribeCloudSync,
} from './cloud-sync-status'
import type { PersistentStorageStatus } from './durable-storage'
import { supabase } from './supabase'
import { navigate } from './use-route'

/**
 * Where the work lives, and the way to keep it. An icon in the top bar says
 * the work is saved in this browser and points to Settings, which holds the
 * backup: download the whole account as one file, or restore from one.
 */

export const SETTINGS_PATH = '/settings'

async function downloadBackup() {
  const blob = await accountBackupBlob(await captureAccount())
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = accountBackupFileName()
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function AccountBadge({ status }: { status: PersistentStorageStatus }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const sync = useSyncExternalStore(subscribeCloudSync, getCloudSyncStatus)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [syncError, setSyncError] = useState('')
  const refresh = useRef<(() => void) | null>(null)
  const presentation = {
    local: { icon: CloudOff, label: 'Saved in this browser', detail: 'Go to Settings to sync or export your data.' },
    checking: { icon: RefreshCw, label: 'Checking cloud sync', detail: 'Comparing this device’s work with your cloud copy.' },
    synced: { icon: CloudCheck, label: 'Synced to cloud', detail: 'This device matches the last checked cloud copy.' },
    pending: { icon: CloudUpload, label: 'Changes not synced', detail: 'Your work is saved in this browser. Use Sync now in Settings to upload it.' },
    syncing: { icon: RefreshCw, label: 'Syncing to cloud', detail: 'Saving your work to your private cloud account.' },
    conflict: { icon: CloudAlert, label: 'Sync needs attention', detail: 'The cloud copy has changed. Open Settings and sync to choose which copy to keep.' },
    remote: { icon: CloudDownload, label: 'Cloud changes available', detail: 'Open Settings and sync to load the newer cloud copy.' },
    error: { icon: CloudAlert, label: 'Cloud sync unavailable', detail: 'Your work remains on this device. Open Settings to retry.' },
  }[sync.state]
  const SyncIcon = presentation.icon

  const syncNow = async () => {
    if (!supabase || syncing) return
    setSyncing(true)
    setSyncMessage('')
    setSyncError('')
    setCloudSyncStatus({ state: 'syncing' })
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      const userId = data.session?.user.id
      if (!userId) {
        setSyncError('Sign in to sync your work.')
        navigate(SETTINGS_PATH)
        return
      }
      const result = await syncAccount(supabase, userId)
      if (result === 'download') {
        reloadCloudAccount(userId, 'download')
        return
      }
      setCloudSyncStatus({ state: 'synced' })
      setSyncMessage(result === 'unchanged' ? 'Your cloud copy is up to date.' : 'Your work is saved to the cloud.')
    } catch (error) {
      if (error instanceof CloudConflict) {
        setCloudSyncStatus({ state: 'conflict' })
        setSyncError('The cloud copy changed. Open Settings to choose which copy to keep.')
      } else {
        const detail = error instanceof Error ? error.message : 'Sync failed. Try again.'
        setCloudSyncStatus({ state: 'error', detail })
        setSyncError(detail)
      }
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (!supabase) return
    let stopped = false
    let checking = false
    let userId: string | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    const check = async (remote = false) => {
      if (stopped || checking || !userId || document.hidden) return
      checking = true
      try { await checkCloudSync(supabase!, userId, remote) } finally { checking = false }
    }
    refresh.current = () => { void check(true) }
    // Inputs invalidate a green badge immediately; checking the stored digest
    // distinguishes an actual edit from an unrelated form interaction.
    const edited = () => {
      if (getCloudSyncStatus().state === 'synced') setCloudSyncStatus({ state: 'checking' })
      clearTimeout(timer)
      timer = setTimeout(() => { void check() }, 700)
    }
    const focused = () => { void check(true) }
    void supabase.auth.getSession().then(({ data, error }) => {
      if (stopped) return
      if (error) { setCloudSyncStatus({ state: 'error', detail: error.message }); return }
      userId = data.session?.user.id ?? null
      if (!userId) { setCloudSyncStatus({ state: 'local' }); return }
      if (getCloudSyncStatus().state === 'local') setCloudSyncStatus({ state: 'checking' })
      void check(true)
    }).catch(() => { if (!stopped) setCloudSyncStatus({ state: 'error' }) })
    const interval = setInterval(() => { void check() }, 5000)
    document.addEventListener('input', edited)
    document.addEventListener('change', edited)
    window.addEventListener('focus', focused)
    window.addEventListener('online', focused)
    return () => {
      stopped = true
      refresh.current = null
      clearInterval(interval)
      clearTimeout(timer)
      document.removeEventListener('input', edited)
      document.removeEventListener('change', edited)
      window.removeEventListener('focus', focused)
      window.removeEventListener('online', focused)
    }
  }, [])



  return (
    <div className="account-badge" ref={root}>
      <Popover open={open} onOpenChange={next => { setOpen(next); if (next) refresh.current?.() }}>
      <PopoverTrigger asChild>
      <Button variant="plain" size="content"
        type="button"
        className="storage-badge-button"
        data-status={status}
        data-sync-status={sync.state}
        aria-label={`Where your work is stored: ${presentation.label}`}
        title={presentation.label}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <SyncIcon aria-hidden="true" className={sync.state === 'syncing' || sync.state === 'checking' ? 'account-spin' : undefined} />
      </Button>
      </PopoverTrigger>
        <PopoverContent align="end" className="account-panel" id={panelId} role="region" aria-label="Where your work is stored">
          <strong role="status">{sync.state === 'local' ? 'Your work is saved in your browser.' : presentation.label}</strong>
          <p>{presentation.detail}</p>
          {sync.detail && <p className="account-warning">{sync.detail}</p>}
          {syncMessage && <p role="status" className="account-ok">{syncMessage}</p>}
          {syncError && <p role="alert" className="account-warning">{syncError}</p>}
          {status === 'denied' && (
            <p className="account-warning">
              Persistent storage was denied. Your browser may clear this local data when space is needed.
            </p>
          )}
          <div className="account-actions">
            <Button variant="default" type="button" className="primary-button account-action" disabled={syncing || !supabase} onClick={() => void syncNow()}>
              <RefreshCw aria-hidden="true" className={syncing ? 'account-spin' : undefined} />
              {syncing ? 'Syncing…' : 'Sync now'}
            </Button>
            <Button variant="outline"
              type="button"
              className="secondary-button account-action"
              onClick={() => { setOpen(false); navigate(SETTINGS_PATH) }}
            >
              <Settings aria-hidden="true" />
              Settings
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}


export function BackupSettings({ status }: { status: PersistentStorageStatus }) {
  const [restoring, setRestoring] = useState<{ file: File; manifest: AccountManifest } | null>(null)
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const backup = async () => {
    setBusy('backup')
    setError('')
    try {
      await downloadBackup()
    } catch {
      setError('The backup could not be created. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const chooseRestore = async (file: File | undefined) => {
    if (!file) return
    setBusy('restore')
    setError('')
    try {
      const snapshot = await readAccountBackup(file)
      setRestoring({ file, manifest: snapshot.manifest })
    } catch (caught) {
      setError(caught instanceof AccountBackupError ? caught.message : 'This backup could not be read.')
    } finally {
      setBusy(null)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <section className="site-card account-settings" aria-labelledby="settings-backup">
      <h2 id="settings-backup">Back up your work</h2>
      <p>
        Exams, Question Banks, Working Copies, and Export History are saved in this browser. Download
        a backup now and then, and restore it here or in another browser.
      </p>
      {status === 'denied' && (
        <p className="account-warning">
          Persistent storage was denied. Your browser may clear this local data when space is needed.
        </p>
      )}
      {status === 'granted' && <p className="account-ok">Persistent browser storage is enabled.</p>}
      <div className="account-actions">
        <Button variant="outline" type="button" className="secondary-button account-action" onClick={backup} disabled={busy !== null}>
          {busy === 'backup' ? <RefreshCw aria-hidden="true" className="account-spin" /> : <Download aria-hidden="true" />}
          {busy === 'backup' ? 'Preparing…' : 'Download backup'}
        </Button>
        <Button variant="outline" type="button" className="secondary-button account-action" onClick={() => fileInput.current?.click()} disabled={busy !== null}>
          <Upload aria-hidden="true" />
          {busy === 'restore' ? 'Reading…' : 'Restore…'}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".zip,application/zip"
          hidden
          aria-label="Choose an account backup to restore"
          onChange={(event) => void chooseRestore(event.target.files?.[0])}
        />
      </div>
      {error && <p className="account-warning" role="alert">{error}</p>}
      {restoring && (
        <RestoreDialog
          file={restoring.file}
          manifest={restoring.manifest}
          onClose={() => setRestoring(null)}
        />
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------

function AccountModal({ title, onClose, children, className = '' }: {
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  return <Modal title={title} onClose={onClose} className={`account-dialog ${className}`}>
    <header className="resource-picker-header">
      <h2>{title}</h2>
      <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}><X /></Button>
    </header>
    {children}
  </Modal>
}

function RestoreDialog({ file, manifest, onClose }: {
  file: File
  manifest: AccountManifest
  onClose: () => void
}) {
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null)
  const [error, setError] = useState('')
  const made = new Date(manifest.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  const restore = async () => {
    setBusy('restore')
    setError('')
    try {
      await stageRestore({ bytes: await file.arrayBuffer() })
      window.location.reload()
    } catch {
      setError('The backup could not be restored. Nothing in this browser was changed.')
      setBusy(null)
    }
  }
  const backupFirst = async () => {
    setBusy('backup')
    setError('')
    try {
      await downloadBackup()
    } catch {
      setError('The backup could not be created. Try again.')
    } finally {
      setBusy(null)
    }
  }
  return (
    <AccountModal title="Restore this backup?" onClose={onClose}>
      <p className="account-dialog-copy">
        <strong>{file.name}</strong> was made {made}. Restoring replaces every Exam, Question Bank,
        Working Copy, and Export History in this browser with the ones in the backup, then reloads
        Test Parrot.
      </p>
      {error && <p className="account-warning" role="alert">{error}</p>}
      <div className="account-actions account-actions--end">
        <Button variant="outline" type="button" className="secondary-button account-action" disabled={busy !== null} onClick={() => void backupFirst()}>
          <Download aria-hidden="true" />
          {busy === 'backup' ? 'Preparing…' : 'Download current work first'}
        </Button>
        <Button variant="default" type="button" className="primary-button" disabled={busy !== null} onClick={() => void restore()}>
          {busy === 'restore' ? 'Restoring…' : 'Replace and reload'}
        </Button>
      </div>
    </AccountModal>
  )
}
