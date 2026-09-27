import { saveImage } from '../local-images'
import { coverLogoSource, type ExamCover } from '../page-cover'
import type { CoverTemplateProps } from './template-types'

const FIELD_STYLES = `
.cover-edit-field::after { grid-area: 1 / 1; content: attr(data-value) " "; visibility: hidden; white-space: pre-wrap; overflow-wrap: break-word; font: inherit; }
.cover-edit-input { grid-area: 1 / 1; width: 0; min-width: 100%; resize: none; overflow: hidden; border: 0; border-radius: 0; padding: 0; margin: 0; color: inherit; background: transparent; font: inherit; line-height: inherit; outline: none; box-shadow: 0 1px 0 transparent; }
.cover-edit-input:hover:not(:disabled) { box-shadow: 0 1px 0 #d8cbbb; }
.cover-edit-input:focus { box-shadow: 0 1px 0 var(--paper-accent, #742b24); }
.cover-edit-input::placeholder { color: #b8a493; }
.cover-edit-input:disabled { color: inherit; -webkit-text-fill-color: currentColor; opacity: 1; }
@media print { .cover-edit-input { outline: none !important; } }
`

export function RoyalInstituteCover({
  cover,
  printedPageCount,
  disabled,
  onChange,
  variant = 'royal',
}: CoverTemplateProps & { variant?: 'royal' | 'compact' }) {
  const compact = variant === 'compact'
  const edit = (patch: Partial<ExamCover>) => onChange?.({ ...cover, ...patch })
  const field = (
    label: string,
    value: string,
    change: (value: string) => void,
    inputClassName = '',
    fieldClassName = '',
    inputStyle: React.CSSProperties = {},
  ) => (
    <span
      className={`cover-edit-field inline-grid max-w-full align-top after:[grid-area:1/1] after:invisible after:whitespace-pre-wrap after:wrap-break-word after:content-[attr(data-value)] ${fieldClassName}`}
      data-value={value || ' '}
    >
      <textarea
        aria-label={label}
        className={`cover-edit-input text-base leading-normal ${inputClassName}`}
        style={{ font: 'inherit', ...inputStyle }}
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
    <div className="contents">
      <style>{FIELD_STYLES}</style>
      <div className={`relative flex min-h-0 flex-1 flex-col text-[#171411] font-[Arial,sans-serif] text-base`}>
        <section className={`relative flex min-h-75 flex-[0_0_320px] flex-col items-center justify-start border-double text-center ${compact ? 'border-2 border-[#742b24] px-6 py-4.5' : 'border-1.25 border-[#171411] px-6.5 pt-3 pb-5'}`} aria-label="Exam cover details">
          <img className="h-auto max-h-18 w-auto max-w-30 object-contain" src={coverLogoSource(cover)} alt="School logo" />
          {onChange && (
            <label className="absolute right-1.25 top-1 cursor-pointer font-sans text-[11px] text-[#786b5e] print:hidden">
              {cover.logo ? 'Change logo' : 'Add school logo'}
              <input
                aria-label="Upload cover page school logo"
                className="sr-only"
                type="file"
                accept="image/*"
                disabled={disabled}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0]
                  if (!file) return
                  void saveImage(file).then((logo) => edit({ logo })).catch(() => undefined)
                  event.currentTarget.value = ''
                  
                }}
              />
            </label>
          )}
          {field('School name', cover.schoolName, (schoolName) => edit({ schoolName }), 'w-full text-center text-[#742b24] [-webkit-text-fill-color:#742b24] mt-1', 'w-full', { fontFamily: 'CooperBold, Georgia, serif', fontSize: '28px', fontWeight: 700, lineHeight: 1.05 })}
          {field('School subtitle', cover.schoolSubtitle, (schoolSubtitle) => edit({ schoolSubtitle }), 'w-full text-center text-[#742b24] [-webkit-text-fill-color:#742b24]', 'w-full', { fontFamily: 'CooperBold, Georgia, serif', fontSize: '18px', fontWeight: 700, lineHeight: 1.1 })}
          <div className={`flex flex-col items-center font-bold text-sm uppercase mt-3 w-full`}>
            {field('Assessment title', cover.assessment, (assessment) => edit({ assessment }), 'text-center font-bold uppercase')}
            {field('Grade', cover.grade, (grade) => edit({ grade }), 'text-center font-bold uppercase')}
            {field('Subject', cover.subject, (subject) => edit({ subject }), 'text-center font-bold uppercase')}
          </div>
          <div className="mt-auto grid w-full grid-cols-2 text-sm items-end gap-5 font-bold">
            <span className="flex items-end gap-2 whitespace-nowrap"><span className="shrink-0">Name:</span><i className="min-w-0 flex-1 border-b" aria-hidden="true" /></span>
            <span className="flex items-end gap-2 whitespace-nowrap"><span className="shrink-0">Class:</span><i className="min-w-0 flex-1 border-b" aria-hidden="true" /></span>
          </div>
          <div className="mt-4.5 grid w-full grid-cols-2 text-sm items-end gap-5 font-bold">
            <span className="flex items-end gap-2 whitespace-nowrap"><span className="shrink-0">Duration:</span>{field('Duration', cover.duration, (duration) => edit({ duration }), '', 'min-w-0 flex-1')}</span>
            <span className="flex items-end gap-2 whitespace-nowrap"><span className="shrink-0">Total Marks:</span>{field('Total marks', cover.totalMarks, (totalMarks) => edit({ totalMarks }), '', 'min-w-0 flex-1')}</span>
          </div>
        </section>
        <section className={`grid min-h-0 flex-1 grid-cols-2 items-start ${compact ? 'gap-4.5 p-3' : 'gap-7 p-5'}`}>
          <div className="flex flex-col gap-4 pt-5">
            <strong className="mb-1">Instructions to the candidates,</strong>
            {cover.instructions.map((line, index) => field(`Instruction ${index + 1}`, line, (value) => {
              const instructions = [...cover.instructions]
              instructions[index] = value
              edit({ instructions })
            }, 'w-full', 'w-full'))}
          </div>
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr><th className="border-none px-1.75 py-0.5" /><th className="border border-[#777] px-1.75 py-0.5" colSpan={2}>Marks</th></tr>
              <tr><th className="h-7.75 border border-[#777] px-1.75 py-0.5 text-center">Question</th><th className="h-7.75 border border-[#777] px-1.75 py-0.5 text-center">Allotted</th><th className="h-7.75 border border-[#777] px-1.75 py-0.5 text-center">Obtained</th></tr>
            </thead>
            <tbody>
              {cover.marks.map((row, index) => <tr key={index}>
                <td className="h-7.75 border border-[#777] px-1.75 py-0.5">{field(`Marks row ${index + 1} label`, row.label, (label) => {
                  const marks = [...cover.marks]; marks[index] = { ...row, label }; edit({ marks })
                }, 'w-full', 'w-full')}</td>
                <td className="h-7.75 border border-[#777] px-1.75 py-0.5">{field(`Marks row ${index + 1} allotted`, row.allotted, (allotted) => {
                  const marks = [...cover.marks]; marks[index] = { ...row, allotted }; edit({ marks })
                }, 'w-full', 'w-full')}</td>
                <td className="h-7.75 border border-[#777] px-1.75 py-0.5" />
              </tr>)}
              <tr><th className="border border-[#777] px-1.75 py-0.5 text-lg">Total</th><td className="border border-[#777] px-1.75 py-0.5">{cover.totalMarks}</td><td className="border border-[#777] px-1.75 py-0.5" /></tr>
            </tbody>
          </table>
        </section>
        <div className="-mx-2.5 -mb-2.5 mt-auto border-t border-[#333] text-center text-sm">This document consists of {String(printedPageCount).padStart(2, '0')} printed pages</div>
      </div>
    </div>
  )
}
