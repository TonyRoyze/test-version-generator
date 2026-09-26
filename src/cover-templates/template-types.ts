import type { ExamCover } from '../page-cover'

export type CoverTemplateProps = {
  cover: ExamCover
  printedPageCount: number
  disabled: boolean
  onChange?: (cover: ExamCover) => void
}
