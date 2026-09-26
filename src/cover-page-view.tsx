import type { CSSProperties } from 'react'
import { saveImage } from './local-images'
import type { ExamCover } from './page-cover'

export function CoverPageView({
  cover,
  printedPageCount,
  disabled,
  onChange,
}: {
  cover: ExamCover
  printedPageCount: number
  disabled: boolean
  onChange?: (cover: ExamCover) => void
}) {
  const edit = (patch: Partial<ExamCover>) => onChange?.({ ...cover, ...patch })
  const field = (label: string, value: string, change: (value: string) => void, className?: string) => (
    <span className={`section-heading-field cover-editable-field ${className ? `${className}-field` : ''}`} data-value={value || ' '}>
      <textarea
        aria-label={label}
        className={`section-heading-input ${className ?? ''}`}
        rows={1}
        value={value}
        disabled={disabled || !onChange}
        spellCheck
        onChange={(event) => change(event.target.value.replace(/\s*\n\s*/g, ' '))}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === 'Escape') {
            event.preventDefault()
            event.currentTarget.blur()
          }
        }}
      />
    </span>
  )
  return (
    <div className="cover-sheet">
      <section className="cover-frame" aria-label="Exam cover details">
        {cover.logo && <img className="cover-logo" src={cover.logo} alt="School logo" />}
        {onChange && <label className="cover-logo-upload">{cover.logo ? 'Change logo' : 'Add school logo'}<input aria-label="Upload cover page school logo" type="file" accept="image/*" disabled={disabled} onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (!file) return
          void saveImage(file).then((logo) => edit({ logo })).catch(() => undefined)
          event.currentTarget.value = ''
        }} /></label>}
        {field('School name', cover.schoolName, (schoolName) => edit({ schoolName }), 'cover-school-name')}
        {field('School subtitle', cover.schoolSubtitle, (schoolSubtitle) => edit({ schoolSubtitle }), 'cover-school-subtitle')}
        <div className="cover-title-fields">
          {field('Assessment title', cover.assessment, (assessment) => edit({ assessment }))}
          {field('Grade', cover.grade, (grade) => edit({ grade }))}
          {field('Subject', cover.subject, (subject) => edit({ subject }))}
        </div>
        <div className="cover-meta-row">
          <span>Name: <i className="cover-blank cover-blank--short" aria-hidden="true" /></span>
          <span>Class: <i className="cover-blank cover-blank--short" aria-hidden="true" /></span>
        </div>
        <div className="cover-meta-row">
          <span>Duration: {field('Duration', cover.duration, (duration) => edit({ duration }))}</span>
          <span>Total Marks: {field('Total marks', cover.totalMarks, (totalMarks) => edit({ totalMarks }), 'cover-total-marks')}</span>
        </div>
      </section>
      <section className="cover-lower">
        <div className="cover-instructions">
          <strong>Instructions to the candidates,</strong>
          {cover.instructions.map((line, index) => field(`Instruction ${index + 1}`, line, (value) => {
            const instructions = [...cover.instructions]
            instructions[index] = value
            edit({ instructions })
          }))}
        </div>
        <table className="cover-marks-table">
          <thead><tr><th></th><th colSpan={2}>Marks</th></tr><tr><th>Question</th><th>Allotted</th><th>Obtained</th></tr></thead>
          <tbody>
            {cover.marks.map((row, index) => <tr key={index}>
              <td>{field(`Marks row ${index + 1} label`, row.label, (label) => {
                const marks = [...cover.marks]; marks[index] = { ...row, label }; edit({ marks })
              })}</td>
              <td>{field(`Marks row ${index + 1} allotted`, row.allotted, (allotted) => {
                const marks = [...cover.marks]; marks[index] = { ...row, allotted }; edit({ marks })
              })}</td>
              <td></td>
            </tr>)}
            <tr className="cover-marks-total"><th>Total</th><td>{cover.totalMarks}</td><td></td></tr>
          </tbody>
        </table>
      </section>
      <div className="cover-page-count">This document consists of {String(printedPageCount).padStart(2, '0')} printed pages</div>
    </div>
  )
}

export function CoverDesignPage({
  cover,
  onChange,
  onBack,
}: {
  cover: ExamCover
  onChange: (cover: ExamCover) => void
  onBack: () => void
}) {
  return (
    <div className="cover-design-route">
      <header className="cover-design-toolbar">
        <button type="button" onClick={onBack}>Back to paper</button>
        <div><h1>Cover page</h1><p>Edit the text and marks table directly on the page.</p></div>
        <span>Changes save with this exam</span>
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
