import './cover-templates-page.css'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { AppShell } from './app-shell'
import type { PersistentStorageStatus } from './durable-storage'
import type { RecentExam } from './exam-workspaces'
import type { CoverPageTemplate } from './cover-templates/templates'
import { COVER_PAGE_TEMPLATES } from './cover-templates/templates'
import { PrebuiltCover } from './cover-template-preview'
import { PrebuiltExamPaper } from './prebuilt-exam-paper'

export { COVER_PAGE_TEMPLATES } from './cover-templates/templates'
export type { CoverPageTemplate } from './cover-templates/templates'

export function CoverTemplatesPage({
  exams,
  error,
  persistentStorage,
  onApply,
}: {
  exams: readonly RecentExam[]
  error: string | null
  persistentStorage: PersistentStorageStatus
  onApply: (examId: string | null, template: CoverPageTemplate) => void
}) {
  const [templateToApply, setTemplateToApply] = useState<CoverPageTemplate | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<CoverPageTemplate | null>(null)

  return (
    <AppShell crumbs={[{ label: 'Home', href: '/' }, { label: 'Cover Page Templates' }]} persistentStorage={persistentStorage}>
      {error && <p className="home-error" role="alert">{error}</p>}
      <section className="home-shelf cover-template-shelf" aria-labelledby="cover-templates-heading">
        <div className="shelf-bar"><h1 id="cover-templates-heading" className="shelf-label">Cover Page Templates</h1></div>
        <div className="cover-template-list" role="list">
          {COVER_PAGE_TEMPLATES.map((template) => (
            <article className="cover-template-row" role="listitem" key={template.id}>
              <div className="cover-template-preview" aria-label={`${template.name} cover and exam paper preview`}>
                <div className="cover-template-preview-page" aria-hidden="true">
                  <div className="exam-page cover-template-paper" style={{ '--page-width': '816px', '--page-height': '1056px', '--page-margin': '72px' } as CSSProperties}>
                    <PrebuiltCover template={template} />
                  </div>
                </div>
                <div className="cover-template-preview-page" aria-hidden="true">
                  <div className="exam-page cover-template-paper" style={{ '--page-width': '816px', '--page-height': '1056px', '--page-margin': '72px' } as CSSProperties}>
                    <PrebuiltExamPaper template={template} />
                  </div>
                </div>
              </div>
              <div className="cover-template-preview-labels" aria-hidden="true"><span>Cover</span><span>Exam paper</span></div>
              <div className="cover-template-details">
                <h2>{template.name}</h2>
                <p>{template.description}</p>
              </div>
              <div className="cover-template-actions">
                <button type="button" className="secondary-button" onClick={() => setPreviewTemplate(template)}>Preview design</button>
                <button type="button" className="secondary-button" onClick={() => setTemplateToApply(template)}>Use template</button>
              </div>
            </article>
          ))}
        </div>
      </section>
      {previewTemplate && (
        <div className="cover-template-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewTemplate(null) }}>
          <section className="cover-template-design-dialog" role="dialog" aria-modal="true" aria-labelledby="cover-template-preview-heading">
            <div className="cover-template-design-heading">
              <h2 id="cover-template-preview-heading">{previewTemplate.name} design</h2>
              <button type="button" className="secondary-button" onClick={() => setPreviewTemplate(null)}>Close preview</button>
            </div>
            <div className="cover-template-design-pages">
              <div><h3>Cover</h3><div className="cover-template-design-page"><article className="exam-page" style={{ '--page-width': '816px', '--page-height': '1056px', '--page-margin': '72px' } as CSSProperties}><PrebuiltCover template={previewTemplate} /></article></div></div>
              <div><h3>Exam paper</h3><div className="cover-template-design-page"><article className="exam-page" style={{ '--page-width': '816px', '--page-height': '1056px', '--page-margin': '72px' } as CSSProperties}><PrebuiltExamPaper template={previewTemplate} /></article></div></div>
            </div>
          </section>
        </div>
      )}
      {templateToApply && (
        <div className="cover-template-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setTemplateToApply(null) }}>
          <section className="cover-template-dialog" role="dialog" aria-modal="true" aria-labelledby="apply-cover-template-heading">
            <button type="button" className="cover-template-dialog-close" aria-label="Close" onClick={() => setTemplateToApply(null)}>×</button>
            <h2 id="apply-cover-template-heading">Use {templateToApply.name}</h2>
            <p>Choose an exam to update, or create a new exam with this cover.</p>
            {exams.length > 0 && <div className="cover-template-exam-list">{exams.map((exam) => <button type="button" key={exam.id} onClick={() => onApply(exam.id, templateToApply)}>{exam.title}</button>)}</div>}
            <button type="button" className="primary-button" onClick={() => onApply(null, templateToApply)}>New Exam with this template</button>
          </section>
        </div>
      )}
    </AppShell>
  )
}
