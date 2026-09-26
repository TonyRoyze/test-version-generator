import type { ComponentType } from 'react'
import { DEFAULT_EXAM_COVER } from '../page-cover'
import type { ExamCover } from '../page-cover'
import { RoyalInstituteCover } from './royal-institute-cover'
import type { CoverTemplateProps } from './template-types'

export type CoverPageTemplate = {
  id: string
  name: string
  description: string
  cover: ExamCover
  component: ComponentType<CoverTemplateProps>
}

export const COVER_PAGE_TEMPLATES: readonly CoverPageTemplate[] = [
  {
    id: 'royal-intitute-template',
    name: 'Royal Institute',
    description: 'A complete cover with candidate instructions and a marks table.',
    cover: DEFAULT_EXAM_COVER,
    component: RoyalInstituteCover,
  },
  {
    id: 'paper-book',
    name: 'Paper Book',
    description: 'A simple cover with a page number and no candidate instructions.',
    cover: DEFAULT_EXAM_COVER,
    component: RoyalInstituteCover,
  },
]

export const COVER_PAGE_TEMPLATE_BY_ID = Object.fromEntries(
  COVER_PAGE_TEMPLATES.map((template) => [template.id, template]),
) as Record<string, CoverPageTemplate>

export const DEFAULT_COVER_PAGE_TEMPLATE = COVER_PAGE_TEMPLATES[0]!
