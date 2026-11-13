import { choicesOf, partsOf, type Question } from './exam'
import type { QuestionBankRecordQuestion } from './question-bank-export'

/** Stable authoring ids beside the record's position-based ids. Parts and
 * their answers must survive sync just like whole Questions and answers. */
export function bankIdentities(questions: readonly Question[], recorded: readonly QuestionBankRecordQuestion[]): Map<string, string> {
  const ids = new Map<string, string>()
  questions.forEach((question, index) => {
    const record = recorded[index]
    if (!record) return
    ids.set(record.id, question.id)
    const answers = record.choices ?? record.wordBank ?? []
    choicesOf(question).forEach((choice, at) => {
      if (answers[at]) ids.set(answers[at].id, choice.id)
    })
    partsOf(question).forEach((part, at) => {
      const recordedPart = record.parts?.[at]
      if (!recordedPart) return
      ids.set(recordedPart.id, part.id)
      part.choices.forEach((choice, answerAt) => {
        const answer = recordedPart.choices?.[answerAt]
        if (answer) ids.set(answer.id, choice.id)
      })
    })
  })
  return ids
}
