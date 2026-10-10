import { Button } from '@/components/ui/button'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyStagedRestore } from './account-backup'
import { LoginPage } from './account-settings'
import App from './App'
import { prepareCloudAccount } from './cloud-account'
import { domMeasure } from './dom-measure'
import { persistentStorageStatus } from './durable-storage'
import { loadExamStore } from './exam-store'
import { createExamWorkspaceService } from './exam-workspaces'
import { expireWaitingImports } from './import-history'
import { PopOverProvider } from './question-bank-pop-over'
import {
  createQuestionBankWorkspaceService,
  type QuestionBankResource,
} from './question-bank-workspaces'
import { questionBankCollection } from './resource-collections'
import { SignedOutApp } from './signed-out-app'
import { selectAccountStorage, STORAGE_NAME } from './storage-schema'
import './styles.css'
import { initialAuthAction, supabase } from './supabase'

const root = createRoot(document.getElementById('root')!)
const startingPath = window.location.pathname

function ExamStartupSkeleton() {
  return <main className="exam-startup" aria-label="Loading Exam editor">
    <header className="exam-startup-toolbar" aria-hidden="true">
      <img className="app-logo" src="/logo.png" alt="" width={36} height={36} />
      <div className="exam-startup-identity">
        <span className="exam-startup-shimmer exam-startup-title" />
        <span className="exam-startup-shimmer exam-startup-menus" />
      </div>
      <div className="exam-startup-actions">
        <span className="exam-startup-shimmer" />
        <span className="exam-startup-shimmer" />
        <span className="exam-startup-shimmer exam-startup-save" />
        <span className="exam-startup-shimmer exam-startup-export" />
      </div>
    </header>
    <div className="exam-startup-workspace" aria-hidden="true">
      <section className="exam-startup-paper-stage">
        <div className="exam-startup-paper">
          <span className="exam-startup-shimmer exam-startup-paper-heading" />
          <span className="exam-startup-shimmer exam-startup-paper-subheading" />
          <div className="exam-startup-paper-columns">
            <div className="exam-startup-paper-lines">
              {Array.from({ length: 13 }, (_, index) => <span
                className="exam-startup-shimmer"
                key={index}
                style={{ width: `${index % 4 === 3 ? 68 : 88 + (index % 3) * 4}%` }}
              />)}
            </div>
            <span className="exam-startup-shimmer exam-startup-answer-column" />
          </div>
        </div>
      </section>
      <aside className="exam-startup-bank">
        <span className="exam-startup-shimmer exam-startup-tab" />
        <div className="exam-startup-bank-panel">
          <span className="exam-startup-shimmer exam-startup-bank-title" />
          <span className="exam-startup-shimmer exam-startup-search" />
          <div className="exam-startup-bank-filters">
            <span className="exam-startup-shimmer" />
            <span className="exam-startup-shimmer" />
            <span className="exam-startup-shimmer" />
          </div>
          {Array.from({ length: 7 }, (_, index) => <span className="exam-startup-shimmer exam-startup-question" key={index} />)}
        </div>
      </aside>
    </div>
    <div className="exam-startup-status" role="status"><span className="exam-startup-spinner" />Loading Exam paper…</div>
  </main>
}

async function start() {
  let userId: string | null = null
  if (supabase) {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    userId = data.session?.user.id ?? null
    if (!userId || initialAuthAction === 'recovery' || initialAuthAction === 'invite') {
      root.render(initialAuthAction === 'recovery' || initialAuthAction === 'invite' ? <LoginPage /> : <SignedOutApp />)
      return
    }
    selectAccountStorage(userId)
    supabase.auth.onAuthStateChange((_event, session) => {
      if ((session?.user.id ?? null) !== userId) window.location.reload()
    })
  }
  if (startingPath === '/editor' || startingPath === '/cover-design') {
    root.render(<ExamStartupSkeleton />)
  }
  // The worker asks the requesting tab which account owns its image references.
  navigator.serviceWorker?.addEventListener('message', event => {
    if (event.data?.type === 'account-storage') event.ports[0]?.postMessage(STORAGE_NAME)
  })
  if ('serviceWorker' in navigator) {
    await navigator.serviceWorker.register('/image-worker.js')
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) { window.location.reload(); return }
  }
  if (supabase && userId) {
    // One editable tab per account prevents cross-tab restores and partial snapshots.
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const acquired = await new Promise<boolean>((resolve, reject) => {
      navigator.locks.request(`test-parrot-account:${userId}`, { ifAvailable: true }, async lock => {
        resolve(Boolean(lock))
        if (lock) await held
      }).catch(reject)
    })
    if (!acquired) {
      root.render(<main className="site-prose login-page"><h1>Account open in another tab</h1><p>Close the other tab, then reload to edit this account here.</p><Button variant="plain" size="content" onClick={() => window.location.reload()}>Reload</Button></main>)
      return
    }
    window.addEventListener('pagehide', () => release(), { once: true })
    window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload() })
    await prepareCloudAccount(supabase, userId)
  }
  // A restore replaces the account before anything below opens it.
  const restored = await applyStagedRestore()
  const restoreError = restored && !restored.applied
    ? 'The backup could not be restored, so nothing in this browser was changed.'
    : ''
  // A Source Document left waiting for more than seven days is deleted.
  void expireWaitingImports().catch(() => undefined)
  const workspaces = createExamWorkspaceService()
  const bankWorkspaces = createQuestionBankWorkspaceService()
  const startingOnEditor = startingPath === '/editor' || startingPath === '/cover-design'
  // Home has no workspace to restore, so it also clears an active placeholder
  // that was abandoned by closing or leaving the editor. A bare editor reload
  // deliberately retains that active workspace long enough to restore it.
  await workspaces.cleanupPristine({ includeActive: !startingOnEditor })
  const startingOnBank = window.location.pathname === '/question-bank'
  // The bank page's own bank is the active one, so it must survive the sweep
  // that disposes abandoned Untitled placeholders.
  await bankWorkspaces.cleanupPristine({ includeActive: !startingOnEditor && !startingOnBank })
  const parameters = new URLSearchParams(window.location.search)
  let store = null
  let bank: QuestionBankResource | null = null
  let editorId: string | null = null
  let error: string | null = restoreError || null

  if (startingOnBank) {
    // Unlike the editor's one-time launch parameters, the bank page keeps its
    // id in the URL: a Question Bank is a place with an address, and reload
    // and Back both have to find their way to the same one.
    const id = parameters.get('id')
    bank = id ? await bankWorkspaces.open(id) : null
    if (!bank) {
      error = 'That Question Bank is unavailable on this device.'
      window.history.replaceState(null, '', '/question-banks')
    }
  } else if (startingOnEditor) {
    const launchId = parameters.get('exam')
    // The editor and its cover designer both reopen the active Exam. A bare
    // route restores the one it was last on, and returns Home when there is none.
    const restore = async () => {
      const activeEditor = await bankWorkspaces.activeEditor()
      if (!activeEditor || !await workspaces.exists(activeEditor.resourceId)) return false
      editorId = activeEditor.resourceId
      store = await loadExamStore(workspaces.backendFor(activeEditor.resourceId), undefined, domMeasure.bankAnswerWidth)
      return true
    }
    if (launchId) {
      if (await workspaces.open(launchId)) {
        editorId = launchId
        store = await loadExamStore(workspaces.backendFor(launchId), undefined, domMeasure.bankAnswerWidth)
        window.history.replaceState(null, '', startingPath)
      } else {
        error = 'That Exam is unavailable on this device.'
        const restored = await restore()
        window.history.replaceState(null, '', restored || startingPath === '/cover-design' ? startingPath : '/')
      }
    } else {
      const restored = await restore()
      window.history.replaceState(null, '', restored || startingPath === '/cover-design' ? startingPath : '/')
    }
  }

  const [exams, banks, storageStatus] = await Promise.all([
    workspaces.recent(),
    bankWorkspaces.recent(),
    persistentStorageStatus(),
  ])
  const collection = await questionBankCollection(banks, bankWorkspaces, workspaces)
  root.render(<StrictMode><PopOverProvider service={bankWorkspaces}><App store={store} bank={bank} workspaces={workspaces} bankWorkspaces={bankWorkspaces} initialExams={exams} initialBankCollection={collection} persistentStorage={storageStatus} initialEditorId={editorId} initialError={error} /></PopOverProvider></StrictMode>)
}
void start().catch(error => {
  root.render(<main className="site-prose login-page"><h1>Could not open your workspace</h1><p role="alert">{error instanceof Error ? error.message : 'Please try again.'}</p><Button variant="plain" size="content" onClick={() => window.location.reload()}>Retry</Button><Button variant="plain" size="content" onClick={() => void supabase?.auth.signOut({ scope: 'local' }).then(() => window.location.reload())}>Sign out</Button></main>)
})
