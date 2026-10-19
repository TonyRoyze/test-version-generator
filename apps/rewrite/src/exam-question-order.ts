import { questionsInSection, sectionIdOf, sectionsOf, type Arrangement, type Exam } from './exam'
import { searchableText } from './stem-preview'

export type ExamQuestionSort = 'text-asc' | 'text-desc' | 'bank-asc' | 'bank-desc'

/** A lone question's order menu acts on its section; a multi-selection keeps
 * its exact positions. Empty or stale selections never expand to the exam. */
export function questionOrderScope(exam: Exam, arrangement: Arrangement, ids: readonly string[]): readonly string[] {
  if (ids.length !== 1) return ids
  const question = exam.questions.find(({ id }) => id === ids[0])
  return question ? questionsInSection(exam, arrangement, sectionIdOf(exam, question)).map(({ id }) => id) : []
}

/** Stable sorting within sections preserves unselected positions and section wording. */
export function sortExamQuestions(exam: Exam, arrangement: Arrangement, ids: readonly string[], sort: ExamQuestionSort, bankNames: Readonly<Record<string, string>>): Arrangement {
  const selected = new Set(ids)
  const direction = sort.endsWith('desc') ? -1 : 1
  const questionOrder = sectionsOf(exam).flatMap((section) => {
    const questions = questionsInSection(exam, arrangement, section.id)
    const sorted = questions.filter(({ id }) => selected.has(id)).sort((left, right) => {
      const a = sort.startsWith('bank') ? bankNames[left.id] : searchableText(left)
      const b = sort.startsWith('bank') ? bankNames[right.id] : searchableText(right)
      if (a === undefined) return b === undefined ? 0 : 1
      if (b === undefined) return -1
      return direction * a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    })
    let index = 0
    return questions.map(({ id }) => selected.has(id) ? sorted[index++]!.id : id)
  })
  return questionOrder.every((id, index) => id === arrangement.questionOrder[index])
    ? arrangement : { ...arrangement, questionOrder }
}
