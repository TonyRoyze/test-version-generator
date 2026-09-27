// The browser database is shared by normalized authoring records and immutable
// Media Assets. Keep its schema names in one small module so the two adapters
// can evolve together without depending on one another's implementation.
// Independent Exams begin a fresh browser-storage generation; the preceding
// single-workspace generation is deliberately not interpreted as an Exam.
export const LOCAL_STORAGE_NAME = 'test-parrot-exams-v1'
export let STORAGE_NAME = LOCAL_STORAGE_NAME

/** Set once, before opening any workspace. Each login owns separate local data. */
export function selectAccountStorage(userId: string | null) {
  if (userId !== null && !/^[a-f0-9-]{36}$/i.test(userId)) throw new Error('Invalid account ID.')
  STORAGE_NAME = userId ? `${LOCAL_STORAGE_NAME}-user-${userId}` : LOCAL_STORAGE_NAME
}
export const MEDIA_ASSET_STORE = 'media-assets'
export const EXPORT_RECORD_STORE = 'export-records'
export const STORAGE_VERSION = 8
export const EXAM_STORE = 'exams'
export const EXAM_WORKSPACE_STORE = 'exam-workspace'
export const QUESTION_BANK_REGISTRY_STORE = 'question-banks'
export const CANONICAL_QUESTION_STORE = 'canonical-questions'
export const QUESTION_BANK_WORKSPACE_STORE = 'question-bank-workspace'
export const EDITOR_WORKSPACE_STORE = 'editor-workspace'
