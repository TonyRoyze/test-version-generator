import { Modal } from '@/components/modal'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { AppShell } from './app-shell'
import './cover-templates-page.css'
import type { CoverPageTemplate } from './cover-templates/templates'
import { COVER_PAGE_TEMPLATES } from './cover-templates/templates'
import type { PersistentStorageStatus } from './durable-storage'
import type { RecentExam } from './exam-workspaces'

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

  return (
    <AppShell crumbs={[{ label: 'Home', href: '/' }, { label: 'Cover Page Templates' }]} persistentStorage={persistentStorage}>
      {error && <p className="home-error" role="alert">{error}</p>}
      <section className="home-shelf cover-template-shelf" aria-labelledby="cover-templates-heading">
        <div className="shelf-bar"><h1 id="cover-templates-heading" className="shelf-label">Cover Page Templates</h1></div>
        <div className="cover-template-list" role="list">
          {COVER_PAGE_TEMPLATES.map((template) => (
            <article className="cover-template-row" role="listitem" key={template.id}>
              <div className="cover-template-details">
                <h2>{template.name}</h2>
                <p>{template.description}</p>
              </div>
              <div className="cover-template-actions">
                <Button variant="outline" type="button" className="secondary-button" onClick={() => setTemplateToApply(template)}>Use template</Button>
              </div>
            </article>
          ))}
        </div>
      </section>
      {templateToApply && (
        <Modal title={`Use ${templateToApply.name}`} onClose={() => setTemplateToApply(null)} className="cover-template-dialog" aria-labelledby="apply-cover-template-heading">
            <Button variant="plain" size="content" type="button" className="cover-template-dialog-close" aria-label="Close" onClick={() => setTemplateToApply(null)}>×</Button>
            <h2 id="apply-cover-template-heading">Use {templateToApply.name}</h2>
            <p>Choose an exam to update, or create a new exam with this cover.</p>
            {exams.length > 0 && <div className="cover-template-exam-list">{exams.map((exam) => <Button variant="plain" size="content" type="button" key={exam.id} onClick={() => onApply(exam.id, templateToApply)}>{exam.title}</Button>)}</div>}
            <Button variant="default" type="button" className="primary-button" onClick={() => onApply(null, templateToApply)}>New Exam with this template</Button>
          </Modal>
      )}
    </AppShell>
  )
}
