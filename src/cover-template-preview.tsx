import type { CoverPageTemplate } from './cover-templates/templates'

export function PrebuiltCover({ template }: { template: CoverPageTemplate }) {
  const Component = template.component
  const cover = { ...template.cover, templateId: template.id }
  return <Component cover={cover} printedPageCount={6} disabled />
}
