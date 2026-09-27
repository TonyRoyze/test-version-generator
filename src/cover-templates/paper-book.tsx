import type { ReactNode } from 'react'
import katex from 'katex'
import type { ExamCover } from '../page-cover'
import type { CoverTemplateProps } from './template-types'
import { paperBookAnswerText, paperBookReasonParts, type PaperBookAnswer } from './paper-book-answers'

function PaperBookReason({ reason }: { reason: string }) {
  return <p className="paper-book-answer-reason">{paperBookReasonParts(reason).map((part, index) =>
    part.type === 'text'
      ? (part.marks ?? []).reduce<ReactNode>((content, mark) => {
          switch (mark) {
            case 'strong': return <strong>{content}</strong>
            case 'emphasis': return <em>{content}</em>
            case 'inlineCode': return <code>{content}</code>
            case 'strike_through': return <s>{content}</s>
            case 'subscript': return <sub>{content}</sub>
            case 'superscript': return <sup>{content}</sup>
            default: return mark.startsWith('link:')
              ? <a href={mark.slice(5)}>{content}</a>
              : content
          }
        }, <span key={index}>{part.value}</span>)
      : <span
          key={index}
          className="doc-math"
          dangerouslySetInnerHTML={{ __html: katex.renderToString(part.value, { throwOnError: false }) }}
        />,
  )}</p>
}

function PaperBookField({ label, value, disabled, onChange, className = '' }: {
  label: string
  value: string
  disabled: boolean
  onChange?: (value: string) => void
  className?: string
}) {
  return <span className={`paper-book-field ${className}`} data-value={value || ' '}>
    <textarea
      aria-label={label}
      rows={1}
      value={value}
      disabled={disabled || !onChange}
      spellCheck
      onChange={(event) => onChange?.(event.target.value.replace(/\s*\n\s*/g, ' '))}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault()
          event.currentTarget.blur()
        }
      }}
    />
  </span>
}

export function PaperBookCover({ cover, disabled, onChange, children, pageNumber = 1, answers }: CoverTemplateProps & {
  children?: ReactNode
  pageNumber?: number
  answers?: readonly PaperBookAnswer[]
}) {
  const firstPage = pageNumber === 1
  const edit = (patch: Partial<ExamCover>) => onChange?.({ ...cover, ...patch })
  const field = (label: string, value: string, change: (value: string) => void) =>
    <PaperBookField label={label} value={value} disabled={disabled} onChange={onChange ? change : undefined} />

  return (
    <div className="contents">
      <div className="flex min-h-0 flex-1 flex-col text-[#151515]" style={{ fontFamily: 'Georgia, Times New Roman, serif' }}>
        <header className="flex h-7 shrink-0 items-start justify-between gap-4 text-[11px] italic">
          <span>{cover.subject}</span>
          <span className="shrink-0">{cover.schoolName} ➭ page {pageNumber}</span>
        </header>

        {firstPage && <div className="h-12 shrink-0 text-center">
          <div className="text-[19px] italic leading-tight">
            {field('Unit number', cover.schoolName, (schoolName) => edit({ schoolName }))}
            <span> - </span>
            {field('Unit title', cover.subject, (subject) => edit({ subject }))}
          </div>
          <div className="mx-auto mt-1 h-px w-52 bg-[#222]" />
        </div>}

        {firstPage && children === undefined && <h2 className="mb-3 text-left text-[19px] font-bold tracking-[.32em]">{cover.assessment}</h2>}
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_170px] gap-[18px]">
          <main className="min-w-0">
            {children === undefined ? <div className="space-y-5 text-[14px]">
              <div className="font-sans text-[13px] font-semibold">
                {field('Question group', cover.grade, (grade) => edit({ grade }))}
              </div>
              <p>1. Write your first question in the exam editor.</p>
              <p>2. Questions and choices will appear in this column.</p>
            </div> : children}
          </main>

          <aside aria-label="Answers" className="flex min-h-0 flex-col">
            <div className="border-b border-[#777] pb-1 text-[13px] italic">Answers</div>
            <div className="paper-book-answer-shade">
              {answers?.map((entry) => <div className="paper-book-answer" key={entry.number}>
                <div>{paperBookAnswerText(entry)}</div>
                {entry.reason && <PaperBookReason reason={entry.reason} />}
              </div>)}
            </div>
          </aside>
        </div>
        <div className="h-5 shrink-0" />
      </div>
    </div>
  )
}

/** Page furniture for the real, editable questions rendered by ExamPage. */
export function PaperBookFurniture({ cover, pageNumber, answers = [], disabled = true, onChange }: {
  cover: ExamCover
  pageNumber: number
  answers?: readonly PaperBookAnswer[]
  disabled?: boolean
  onChange?: (cover: ExamCover) => void
}) {
  return (
    <div className="paper-book-furniture">
      <div className="paper-book-running-head">
        <span>{cover.subject}</span>
        <span>{cover.schoolName} ➭ page {pageNumber}</span>
      </div>
      {pageNumber === 1 && <div className="paper-book-opening-title">
        <div>
          <PaperBookField label="Unit number" value={cover.schoolName} disabled={disabled} onChange={onChange ? (schoolName) => onChange({ ...cover, schoolName }) : undefined} />
          <span> - </span>
          <PaperBookField label="Unit title" value={cover.subject} disabled={disabled} onChange={onChange ? (subject) => onChange({ ...cover, subject }) : undefined} />
        </div>
      </div>}
      <aside className="paper-book-answer-column">
        <div>Answers</div>
        <div className="paper-book-answer-shade">
          {answers.map((entry) => <div className="paper-book-answer" key={entry.number}>
            <div>{paperBookAnswerText(entry)}</div>
            {entry.reason && <PaperBookReason reason={entry.reason} />}
          </div>)}
        </div>
      </aside>
    </div>
  )
}
