import type {
  ExamWorkspaceService,
  RecentExam,
  QuestionUsage,
} from './exam-workspaces'
import type {
  QuestionBankSummary,
  QuestionBankWorkspaceService,
} from './question-bank-workspaces'

export const HOME_PREVIEW_LIMIT = 6

export type QuestionBankCollectionItem = QuestionBankSummary & {
  usage: QuestionUsage[]
}

export async function questionBankCollection(
  banks: readonly QuestionBankSummary[],
  bankWorkspaces: QuestionBankWorkspaceService,
  workspaces: ExamWorkspaceService,
): Promise<QuestionBankCollectionItem[]> {
  return Promise.all(
    banks.map(async (bank) => ({
      ...bank,
      usage: await workspaces.resourceUsage(
        (await bankWorkspaces.read(bank.id))?.questions.map(({ id }) => id) ??
          [],
      ),
    })),
  )
}

const normalized = (value: string) => value.trim().toLocaleLowerCase()

export function filterExamCollection(
  exams: readonly RecentExam[],
  query: string,
): RecentExam[] {
  const needle = normalized(query)
  if (!needle) return [...exams]
  return exams.filter((exam) => normalized(exam.title).includes(needle))
}

export function filterQuestionBankCollection(
  banks: readonly QuestionBankCollectionItem[],
  query: string,
): QuestionBankCollectionItem[] {
  const needle = normalized(query)
  if (!needle) return [...banks]
  return banks.filter(
    (bank) =>
      normalized(bank.name).includes(needle) ||
      bank.topics.some((topic) => normalized(topic).includes(needle)),
  )
}

export function homePreview<T>(resources: readonly T[]): T[] {
  return resources.slice(0, HOME_PREVIEW_LIMIT)
}

export type CollectionSort = 'recent' | 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'most-questions' | 'fewest-questions'

export function sortResources<T extends { createdAt: string; questionCount: number }>(
  resources: readonly T[],
  sort: CollectionSort,
  name: (resource: T) => string,
  recent: (resource: T) => string,
): T[] {
  return [...resources].sort((left, right) => {
    switch (sort) {
      case 'recent': return recent(right).localeCompare(recent(left))
      case 'newest': return right.createdAt.localeCompare(left.createdAt)
      case 'oldest': return left.createdAt.localeCompare(right.createdAt)
      case 'name-asc': return name(left).localeCompare(name(right), undefined, { numeric: true, sensitivity: 'base' })
      case 'name-desc': return name(right).localeCompare(name(left), undefined, { numeric: true, sensitivity: 'base' })
      case 'most-questions': return right.questionCount - left.questionCount
      case 'fewest-questions': return left.questionCount - right.questionCount
    }
  })
}

export const sortExams = (exams: readonly RecentExam[], sort: CollectionSort) =>
  sortResources(exams, sort, (exam) => exam.title || 'Untitled Exam', (exam) => exam.lastOpenedAt)

export const sortBanks = (banks: readonly QuestionBankCollectionItem[], sort: CollectionSort) =>
  sortResources(banks, sort, (bank) => bank.name || 'Untitled Question Bank', (bank) => bank.lastUpdatedAt)
