/** The editable front sheet that introduces a student paper. */
export type CoverMarkRow = { label: string; allotted: string }

export type ExamCover = {
  schoolName: string
  schoolSubtitle: string
  assessment: string
  grade: string
  subject: string
  duration: string
  totalMarks: string
  logo?: string
  instructions: string[]
  marks: CoverMarkRow[]
}

export const DEFAULT_EXAM_COVER: ExamCover = {
  schoolName: 'School Name',
  schoolSubtitle: '',
  assessment: 'Assessment',
  grade: 'Grade',
  subject: 'Subject',
  duration: '2 hours',
  totalMarks: '100',
  instructions: [
    'Read the questions carefully before answering the paper.',
    'Write your name and class in the spaces provided.',
    'Marks for each question are shown in brackets.',
  ],
  marks: [
    { label: 'MCQ', allotted: '' },
    ...Array.from({ length: 9 }, (_, index) => ({ label: String(index + 1), allotted: '' })),
  ],
}

export function isExamCover(value: unknown): value is ExamCover {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const cover = value as Record<string, unknown>
  return (
    typeof cover.schoolName === 'string'
    && typeof cover.schoolSubtitle === 'string'
    && typeof cover.assessment === 'string'
    && typeof cover.grade === 'string'
    && typeof cover.subject === 'string'
    && typeof cover.duration === 'string'
    && typeof cover.totalMarks === 'string'
    && (cover.logo === undefined || typeof cover.logo === 'string')
    && Array.isArray(cover.instructions) && cover.instructions.every((line) => typeof line === 'string')
    && Array.isArray(cover.marks) && cover.marks.every((row) =>
      typeof row === 'object' && row !== null
      && typeof row.label === 'string' && typeof row.allotted === 'string',
    )
  )
}

export function sameExamCover(left: ExamCover | undefined, right: ExamCover | undefined): boolean {
  if (left === right) return true
  if (!left || !right) return !left && !right
  return left.schoolName === right.schoolName
    && left.schoolSubtitle === right.schoolSubtitle
    && left.assessment === right.assessment
    && left.grade === right.grade
    && left.subject === right.subject
    && left.duration === right.duration
    && left.totalMarks === right.totalMarks
    && left.logo === right.logo
    && left.instructions.length === right.instructions.length
    && left.instructions.every((line, index) => line === right.instructions[index])
    && left.marks.length === right.marks.length
    && left.marks.every((row, index) => row.label === right.marks[index]?.label && row.allotted === right.marks[index]?.allotted)
}
