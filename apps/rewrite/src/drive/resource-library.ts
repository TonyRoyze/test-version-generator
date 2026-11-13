// Adapt Drive's resource view to the rewrite's flat Exam and Question Bank
// collections. Folder paths received from Drive remain in sync bookkeeping;
// the collections continue to list the resources themselves.
import type { ExamWorkspaceService, RecentExam } from '../exam-workspaces'
import type { QuestionBankSummary, QuestionBankWorkspaceService } from '../question-bank-workspaces'
import { STORAGE_NAME } from '../storage-schema'
import { browserSyncStateStore } from './sync-state'
import type { LocalRef } from './sync-engine'

type Base = { id: string; name: string; parentId: string | null; lastModifiedAt: string; trashedAt?: string }
type Entry = Base & ({ kind: 'exam'; exam: Pick<RecentExam, 'questionCount'> } | { kind: 'bank'; bank: Pick<QuestionBankSummary, 'questionCount'> } | { kind: 'folder' })
type Metadata = { folders: Entry[]; parents: Record<string, string | null> }

export function resetDriveResourceMetadata() {
  localStorage.removeItem(`drive-resources:${STORAGE_NAME}`)
}

export function createDriveResourceLibrary(workspaces: ExamWorkspaceService, banks: QuestionBankWorkspaceService) {
  const key = `drive-resources:${STORAGE_NAME}`
  function read(): Metadata {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as Metadata : { folders: [], parents: {} }
  }
  const write = (value: Metadata) => localStorage.setItem(key, JSON.stringify(value))
  async function modifiedAt(id: string): Promise<string> {
    const backend = workspaces.backendFor(id)
    let state
    try { state = await backend.read() } finally { await backend.close() }
    const bytes = new TextEncoder().encode(JSON.stringify(state && { questionBank: state.questionBank, workingCopy: state.workingCopy }))
    const hash = await crypto.subtle.digest('SHA-256', bytes)
    const digest = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
    return workspaces.contentModifiedAt(id, digest)
  }
  return {
    modifiedAt,
    async snapshot(): Promise<{ entries: Entry[] }> {
      const [exams, questionBanks] = await Promise.all([workspaces.recent(), banks.recent()])
      const meta = read()
      const entries: Entry[] = [
        ...meta.folders,
        ...await Promise.all(exams.map(async exam => ({ kind: 'exam' as const, id: exam.id, name: exam.title, parentId: meta.parents[`exam:${exam.id}`] ?? null, lastModifiedAt: await modifiedAt(exam.id), exam }))),
        ...questionBanks.map(bank => ({ kind: 'bank' as const, id: bank.id, name: bank.name, parentId: meta.parents[`bank:${bank.id}`] ?? null, lastModifiedAt: bank.lastUpdatedAt, bank })),
      ]
      // The rewrite deletes resources directly. Keep tombstones for known Drive
      // copies so the next explicit sync can mirror that deletion.
      for (const [key, file] of Object.entries(browserSyncStateStore.read().files)) {
        const id = key.slice(key.indexOf(':') + 1)
        if (entries.some(entry => entry.kind === file.kind && entry.id === id)) continue
        entries.push({ kind: file.kind, id, name: 'Deleted resource', parentId: null, lastModifiedAt: file.localModifiedAt, trashedAt: file.localModifiedAt, ...(file.kind === 'bank' ? { bank: { questionCount: 0 } } : { exam: { questionCount: 0 } }) } as Entry)
      }
      return { entries }
    },
    async createFolder(name: string, parentId: string | null) {
      const id = crypto.randomUUID()
      const meta = read()
      meta.folders.push({ kind: 'folder', id, name, parentId, lastModifiedAt: new Date().toISOString() })
      write(meta)
      return id
    },
    async place(ref: LocalRef, parentId: string | null) {
      const meta = read(); meta.parents[`${ref.kind}:${ref.id}`] = parentId; write(meta)
    },
    async placeOf(ref: LocalRef) { return read().parents[`${ref.kind}:${ref.id}`] ?? null },
    async trash(refs: readonly LocalRef[]) {
      for (const ref of refs) {
        if (ref.kind === 'exam') await workspaces.delete(ref.id)
        else await banks.permanentlyDeleteBank(ref.id, ids => workspaces.forceDeleteQuestions(ids))
      }
    },
    async rename(ref: LocalRef, name: string) {
      if (ref.kind === 'bank') await banks.commit(ref.id, { kind: 'rename', name })
      else {
        const backend = workspaces.backendFor(ref.id)
        try {
          const state = await backend.read()
          if (state) await backend.write({ ...state, workingCopy: { ...state.workingCopy, title: name }, dirty: true })
        } finally { await backend.close() }
      }
    },
  }
}
export type DriveResourceLibrary = ReturnType<typeof createDriveResourceLibrary>
