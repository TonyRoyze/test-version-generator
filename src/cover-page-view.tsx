import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CSSProperties } from 'react'
import {
  COVER_PAGE_TEMPLATE_BY_ID,
  DEFAULT_COVER_PAGE_TEMPLATE,
} from './cover-templates/templates'
import type { ExamCover } from './page-cover'

export function CoverPageView({ cover, printedPageCount, disabled, onChange }: {
  cover: ExamCover
  printedPageCount: number
  disabled: boolean
  onChange?: (cover: ExamCover) => void
}) {
  const template = (cover.templateId && COVER_PAGE_TEMPLATE_BY_ID[cover.templateId]) || DEFAULT_COVER_PAGE_TEMPLATE
  const Component = template.component
  return <Component cover={cover} printedPageCount={printedPageCount} disabled={disabled} onChange={onChange} />
}

export function CoverDesignPage({
  cover,
  onChange,
  onBack,
  examTitle,
}: {
  cover: ExamCover
  onChange: (cover: ExamCover) => void
  onBack: () => void
  examTitle: string
}) {
  return (
    <div className="cover-design-route">
      <header className="document-bar">
        <div className="document-identity">
          <Button variant="plain" size="content" type="button" className="editor-home-mark" aria-label="Test Parrot home" title="Home" onClick={() => { window.location.assign('/') }}>
            <img className="app-logo" src="/logo.png" alt="" width={36} height={36} />
          </Button>
          <div className="document-title-stack">
            <Input aria-label="Exam name" className="document-title" value={examTitle} readOnly />
            <nav className="document-menus" aria-label="Exam menus">
              <span className="document-menu-button">File</span>
              <span className="document-menu-button">Edit</span>
              <span className="document-menu-button" aria-current="page">Format</span>
            </nav>
          </div>
        </div>
        <div className="header-actions">
          <span className="cover-document-context">Cover page</span>
          <Button variant="outline" type="button" className="secondary-button" onClick={onBack}>Back to paper</Button>
        </div>
      </header>
      <main className="exam-workspace" style={{ '--page-width': '816px', '--page-height': '1056px', '--page-margin': '72px' } as CSSProperties}>
        <article className="exam-page exam-page--cover-designer">
          <CoverPageView
            cover={cover}
            printedPageCount={1}
            disabled={false}
            onChange={onChange}
          />
        </article>
      </main>
    </div>
  )
}
