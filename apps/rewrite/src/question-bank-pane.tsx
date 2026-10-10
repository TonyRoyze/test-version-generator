import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
// The Question Bank, beside the Working Copy.
//
// A compact, readable list of the canonical questions a teacher has written,
// newest first, with everything needed to find one and put it on the exam: a
// stem search, Question Type, Difficulty and Topic filters, and a row that
// opens, adds and removes its own question. Where on the exam a question lands
// is said by dragging it there, rather than by a row action reaching for
// whatever happens to be selected on the sheet.
//
// Each Question uses the Pop-over's preview card. Its add/remove control sits
// beside the answer layout control; double-click opens the Question editor.
//
// Nothing here can Delete Question Content, and nothing here assembles an
// authoring action out of smaller ones: every action calls exactly one of the
// store's operations, so it is one undo step however it was reached. Search,
// Filter values and row selection are handed in rather than stored here. The
// workspace may persist filters, but neither state enters authoring history.

import { Check, ChevronDown, CircleMinus, Pencil, Plus, Search, SlidersHorizontal, Upload } from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { MenuPoint } from './context-menu'
import {
  type Question,
  type QuestionType,
} from './exam'
import type { QuestionBank } from './question-bank'
import type { CopyFormat } from './question-copy'
import {
  DIFFICULTY_OPTIONS,
  SORT_OPTIONS,
  TYPE_OPTIONS,
  type FilterOption,
} from './question-bank-filter-options'
import { QuestionBankOutline } from './question-bank-outline'
import {
  NO_FILTER,
  browseQuestionBank,
  isFilterActive,
  topicOptions,
  type QuestionBankFilter,
  type QuestionBankSort,
} from './question-bank-view'
import { CopyQuestionButton } from './question-copy-feedback'
import { QuestionReading } from './question-reading'
import { readingOfQuestion } from './question-reading-content'
import { PopOverQuestionPreview } from './pop-over-card'
import { stemPreview } from './stem-preview'
import { useQuestionCopy } from './use-question-copy'
import { selectAllPaneProps, useSelectAll } from './use-select-all'
import type { WorkspaceDrag } from './use-workspace-drag'

/** What a row with nothing written into it is called. A question saves whether
 *  or not it says anything, so this is a real state rather than a placeholder. */
const UNTITLED = 'Untitled question'


/**
 * One filter category: a button that opens a list of the values in it.
 *
 * Every category permits several values, so these are checkboxes rather than a
 * choice — the view combines what is ticked with OR, and combines the
 * categories with AND.
 */
function FilterDropdown<T extends string>({
  label,
  options,
  selected,
  emptyMessage,
  onChange,
  single = false,
}: {
  label: string
  options: readonly FilterOption<T>[]
  selected: readonly T[]
  emptyMessage: string
  onChange: (values: T[]) => void
  single?: boolean
}) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const summary = options.filter((option) => selected.includes(option.value)).map(({ label: name }) => name)
  return <div className="bank-filter pop-over-chip" ref={container}>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="plain" size="content" className="bank-filter-button pop-over-chip-trigger" aria-label={label}
          aria-expanded={open}
          data-active={selected.length > 0 ? 'true' : undefined}>
          {label}
          {summary.length > 0 && <>: <strong>{summary.length <= 2 ? summary.join(', ') : `${summary.length} selected`}</strong></>}
          <ChevronDown aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="bank-filter-list" align="start" role={single ? 'radiogroup' : 'group'} aria-label={label}
        collisionPadding={8} collisionBoundary={container.current?.closest('.question-bank') ?? undefined}
        onEscapeKeyDown={event => event.stopPropagation()}>
        {options.length === 0 ? <p className="bank-filter-empty">{emptyMessage}</p> : options.map(option => single ? (
          <button className="pop-over-chip-option" type="button" role="radio" aria-checked={selected.includes(option.value)}
            key={option.value} onClick={() => { onChange([option.value]); setOpen(false) }}>
            <Check aria-hidden="true" />{option.label}
          </button>
        ) : (
          <label className="pop-over-chip-option" key={option.value}>
            <Checkbox checked={selected.includes(option.value)} onCheckedChange={checked => onChange(checked === true
              ? [...selected, option.value] : selected.filter(value => value !== option.value))} />
            {option.label}
          </label>
        ))}
      </PopoverContent>
    </Popover>
  </div>
}

export function QuestionBankPane({
  bank,
  layout = 'rows',
  heading,
  extraActions,
  workingCopyIds,
  filter,
  onFilterChange,
  selectedQuestionIds,
  onSelect,
  onClearSelection,
  onSelectAll,
  onCreate,
  onExport,
  exportBlocked = false,
  onEdit,
  onAddToWorkingCopy,
  onAddManyToWorkingCopy,
  onRemoveFromWorkingCopy,
  formatForQuestion,
  onFormatQuestion,
  drag,
}: {
  bank: QuestionBank
  /** `rows` is the compact table beside the Working Copy. `page` is the
   *  Question Bank page, where the bank is the whole screen: each Question is
   *  read in full, as the import dialog previews a bank, and a click opens
   *  it in the Question editor. */
  layout?: 'rows' | 'page'
  /** What names the bank above the filters. The Exam editor's pane says which
   *  pane this is; the Question Bank page hands in its own editable name,
   *  which is already the page's title and leaves no room for a second one. */
  heading?: ReactNode
  /** Actions belonging to the surface the pane is mounted on rather than to
   *  the bank, laid out ahead of the bank's own. */
  extraActions?: ReactNode
  /** Which bank records the Working Copy currently references. */
  workingCopyIds: ReadonlySet<string>
  filter: QuestionBankFilter
  onFilterChange: (filter: QuestionBankFilter) => void
  /** The rows a teacher has clicked. Transient: selecting is not an authoring
   *  action. */
  selectedQuestionIds: ReadonlySet<string>
  onSelect: (
    questionId: string,
    orderedIds: readonly string[],
    modifiers: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean },
  ) => void
  onClearSelection: () => void
  /** Cmd/Ctrl-A: every Question the search and filters currently show. */
  onSelectAll: (orderedIds: readonly string[]) => void
  onCreate?: (point: MenuPoint) => void
  /** Exports this complete active bank, never the filtered row projection. */
  onExport?: () => void
  /** An open Question editor must be resolved before export can begin. */
  exportBlocked?: boolean
  onEdit: (questionId: string) => void
  onAddToWorkingCopy?: (questionId: string) => void
  /** Adds every supplied, currently visible bank record as one composition. */
  onAddManyToWorkingCopy?: (questionIds: readonly string[]) => void
  /** Takes the question back off the Working Copy, leaving its bank record be. */
  onRemoveFromWorkingCopy?: (questionId: string) => void
  formatForQuestion?: (question: Question) => CopyFormat
  onFormatQuestion?: (question: Question, format: CopyFormat) => void
  /** The gesture in flight. A row that is not already on the Working Copy is a
   *  drag source for it; a row that is offers no gesture at all, because a
   *  reference occurs at most once and refusing a drop after the fact would be
   *  a worse way to say so. */
  drag: WorkspaceDrag
}) {
  const [scrolled, setScrolled] = useState(false)
  const copying = useQuestionCopy()
  const questions = browseQuestionBank(bank, filter)
  const orderedIds = questions.map(({ id }) => id)
  const root = useRef<HTMLElement>(null)
  useSelectAll('question-bank', root, orderedIds, onSelectAll)
  const addableQuestions = questions.filter(({ id }) => !workingCopyIds.has(id))
  const filtered = isFilterActive(filter)
  const filtersApplied = filtered || (filter.sort ?? 'newest') !== 'newest'
  const [filtersOpen, setFiltersOpen] = useState(filtersApplied)
  const activeFilterCount = filter.types.length + filter.difficulties.length + filter.topics.length
  useEffect(() => {
    if (filtersApplied) setFiltersOpen(true)
  }, [filtersApplied])
  // A gesture that has not yet moved far enough to be a drag. One pointer
  // drags at a time, so this is the pane's rather than each row's — and until
  // it passes the threshold a press is still on its way to being a click.
  const gesture = useRef<{
    id: number
    questionId: string
    type: QuestionType
    startX: number
    startY: number
    dragging: boolean
  } | null>(null)
  // The row whose next click is the tail of a drag rather than a selection.
  // Kept as an id rather than a flag, and given up on its own, so a click that
  // never arrives — a row remounted under the pointer, a capture lost on a path
  // nobody has thought of — cannot leave the whole bank unclickable.
  const suppressClickFor = useRef<string | null>(null)

  const forgetSuppressedClick = () => {
    setTimeout(() => {
      suppressClickFor.current = null
    }, 0)
  }

  const releasePointer = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  /** The pointer handlers a row that is not on the Working Copy carries. A row
   *  that is carries none: it has nowhere to be dropped. */
  const dragHandlers = (question: Question) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      const target = event.target as HTMLElement
      if (target.closest('button, input, textarea, select, a')) return
      gesture.current = {
        id: event.pointerId,
        questionId: question.id,
        type: question.type,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
      }
      suppressClickFor.current = null
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const held = gesture.current
      if (!held || held.id !== event.pointerId) return
      if (!held.dragging) {
        const distance = Math.hypot(
          event.clientX - held.startX,
          event.clientY - held.startY,
        )
        if (distance < 5) return
        held.dragging = true
        suppressClickFor.current = held.questionId
        const questionIds = selectedQuestionIds.has(held.questionId)
          ? questions
              .filter((candidate) =>
                selectedQuestionIds.has(candidate.id)
                && !workingCopyIds.has(candidate.id),
              )
              .map(({ id }) => id)
          : [held.questionId]
        if (!selectedQuestionIds.has(held.questionId)) {
          onSelect(held.questionId, orderedIds, {
            shiftKey: false,
            metaKey: false,
            ctrlKey: false,
          })
        }
        const elements = Array.from(
          event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
            '.question-bank-row[data-question-id]',
          ) ?? [],
        ).filter((candidate) => questionIds.includes(candidate.dataset.questionId ?? ''))
        drag.begin(
          { pane: 'question-bank', questionIds, type: held.type },
          {
            elements,
            bounds: event.currentTarget.getBoundingClientRect(),
            point: { x: held.startX, y: held.startY },
          },
        )
      }
      event.preventDefault()
      drag.move({ x: event.clientX, y: event.clientY })
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
      const held = gesture.current
      if (!held || held.id !== event.pointerId) return
      gesture.current = null
      releasePointer(event)
      if (!held.dragging) return
      event.preventDefault()
      drag.drop()
      // The click this press is about to raise is the one to swallow. A timer
      // rather than a flag left standing: click is dispatched before timers, so
      // this runs after the click that is coming and nothing survives it.
      forgetSuppressedClick()
    },
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => {
      const held = gesture.current
      if (!held || held.id !== event.pointerId) return
      gesture.current = null
      releasePointer(event)
      if (held.dragging) {
        suppressClickFor.current = null
        drag.cancel()
      }
    },
    onLostPointerCapture: (event: ReactPointerEvent<HTMLElement>) => {
      const held = gesture.current
      if (!held || held.id !== event.pointerId) return
      gesture.current = null
      if (held.dragging) {
        suppressClickFor.current = null
        drag.cancel()
      }
    },
  })

  const filterBar = (
      <div className="question-bank-filter-shell">
        <div className={layout === 'rows' ? 'question-bank-filter-controls' : 'question-bank-filters'}>
        <div className="bank-search">
          <Search aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search question stems"
            placeholder="Search questions"
            value={filter.search}
            onChange={(event) => onFilterChange({ ...filter, search: event.target.value })}
          />
        </div>
        {layout === 'rows' && <Button variant="plain" size="content"
          type="button"
          className="pop-over-filters-button"
          aria-expanded={filtersOpen}
          data-active={activeFilterCount > 0 ? 'true' : undefined}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <SlidersHorizontal aria-hidden="true" />
          Filters
          {activeFilterCount > 0 && <span className="bank-filter-count">{activeFilterCount}</span>}
        </Button>}
        {layout === 'rows' && onAddManyToWorkingCopy && (
          <Button variant="plain" size="content"
            type="button"
            className="bank-add-all"
            title={filtered ? 'Add all matching questions to the exam' : 'Add all questions to the exam'}
            disabled={addableQuestions.length === 0}
            onClick={() => onAddManyToWorkingCopy(addableQuestions.map(({ id }) => id))}
          >
            <Plus aria-hidden="true" />
            Add all
          </Button>
        )}
        </div>
        {(layout === 'page' || filtersOpen) && <div className="question-bank-filters">
        {/* The page's outline chooses a type and a topic; only the pane beside
            the Working Copy, which has no outline, needs them as lists. */}
        {layout === 'rows' && <FilterDropdown
          label="Question Type"
          options={TYPE_OPTIONS}
          selected={filter.types}
          emptyMessage="No Question Types"
          onChange={(types) => onFilterChange({ ...filter, types })}
        />}
        <FilterDropdown
          label="Difficulty"
          options={DIFFICULTY_OPTIONS}
          selected={filter.difficulties}
          emptyMessage="No Difficulties"
          onChange={(difficulties) => onFilterChange({ ...filter, difficulties })}
        />
        {/* The Topics actually in the bank, exactly as they were typed. There is
            no vocabulary to offer beyond what the teacher has already used. */}
        {layout === 'rows' && <FilterDropdown
          label="Topic"
          options={topicOptions(bank).map((topic) => ({ value: topic, label: topic }))}
          selected={filter.topics}
          emptyMessage="No Topics yet"
          onChange={(topics) => onFilterChange({ ...filter, topics })}
        />}
        <FilterDropdown
          label="Sort"
          options={SORT_OPTIONS}
          selected={[filter.sort ?? 'newest']}
          emptyMessage="No sort options"
          single
          onChange={([sort]) => sort && onFilterChange({ ...filter, sort })}
        />
        {layout === 'page' && onAddManyToWorkingCopy && (
          <Button variant="plain" size="content"
            type="button"
            className="bank-add-all"
            title={filtered ? 'Add all matching questions to the exam' : 'Add all questions to the exam'}
            disabled={addableQuestions.length === 0}
            onClick={() => onAddManyToWorkingCopy(addableQuestions.map(({ id }) => id))}
          >
            <Plus aria-hidden="true" />
            Add all
          </Button>
        )}
        {filtered && (
          <Button variant="plain" size="content"
            type="button"
            className="bank-filter-clear"
            onClick={() => onFilterChange({ ...NO_FILTER, sort: filter.sort ?? 'newest' })}
          >
            Clear filters
          </Button>
        )}
        </div>}
      </div>
  )

  const list = (
      questions.length === 0 ? (
        // Two different nothings: a bank nobody has written into yet, and a
        // bank whose questions are all behind the current search.
        filtered ? (
          <p className="question-bank-empty" data-empty="no-matches">
            No questions match this search and these filters. Clear filters shows
            the whole Question Bank again.
          </p>
        ) : (
          <p className="question-bank-empty" data-empty="no-questions">
            {layout === 'page'
              ? 'No questions yet. New question writes the first one into this bank.'
              : 'No questions yet. Add Question writes one into the bank without putting it on the Exam.'}
          </p>
        )
      ) : layout === 'page' ? (
        <div
          className="question-bank-reading-lane"
          onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 0)}
        >
          <ul className="question-bank-reading" aria-label="Questions">
            {questions.map((question) => {
              const name = stemPreview(question).text || UNTITLED
              return (
                <li
                  className="question-reading question-bank-reading-item"
                  key={question.id}
                  data-question-id={question.id}
                  tabIndex={0}
                  // The whole Question is the target: reading it and opening
                  // it to change it are the only two things done here.
                  onClick={() => onEdit(question.id)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' || event.target !== event.currentTarget) return
                    event.preventDefault()
                    onEdit(question.id)
                  }}
                >
                  <QuestionReading
                    content={readingOfQuestion(question)}
                    aside={<span className="question-bank-reading-actions">
                      <CopyQuestionButton
                        question={question}
                        name={name}
                        state={copying.state(question.id)}
                        onCopy={copying.copy}
                        className="toolbar-icon-button question-bank-reading-copy"
                      />
                      <Button variant="ghost" size="icon-sm"
                        type="button"
                        className="toolbar-icon-button question-bank-reading-edit"
                        aria-label={`Edit ${name}`}
                        title="Edit"
                        onClick={(event) => {
                          event.stopPropagation()
                          onEdit(question.id)
                        }}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                    </span>}
                  />
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <ul
          className="question-bank-list question-bank-list--preview"
          onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 0)}
        >
          {questions.map((question) => {
            const inExamWorkingCopy = workingCopyIds.has(question.id)
            const draggable = !inExamWorkingCopy && onAddToWorkingCopy !== undefined
            const preview = stemPreview(question)
            const name = preview.text || UNTITLED
            const hasExplanation = Boolean(question.answerReason?.trim())
            return (
              <li
                className="question-bank-row question-bank-row--preview"
                key={question.id}
                data-question-id={question.id}
                data-in-exam={inExamWorkingCopy ? 'true' : undefined}
                aria-label={name}
                // An unused row is a drag source; a row already on the Exam
                // Draft is not one, and says so before the gesture starts.
                data-draggable={draggable ? 'true' : undefined}
                data-dragging={drag.draggedQuestionIds.has(question.id) ? 'true' : undefined}
                aria-current={selectedQuestionIds.has(question.id) ? 'true' : undefined}
                tabIndex={0}
                {...(draggable ? dragHandlers(question) : {})}
                onClick={(event: ReactMouseEvent<HTMLElement>) => {
                  // The press that has just finished dragging is not a click —
                  // that press, on that row, and no other click anywhere.
                  if (suppressClickFor.current === question.id) {
                    suppressClickFor.current = null
                    return
                  }
                  onSelect(question.id, orderedIds, {
                    shiftKey: event.shiftKey,
                    metaKey: event.metaKey,
                    ctrlKey: event.ctrlKey,
                  })
                }}
                // Single-click selects, so opening the whole question needs a
                // second click, the Enter key, or the Edit action.
                onDoubleClick={() => onEdit(question.id)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' || event.target !== event.currentTarget) return
                  event.preventDefault()
                  onEdit(question.id)
                }}
              >
                <PopOverQuestionPreview
                  question={question}
                  format={inExamWorkingCopy ? formatForQuestion?.(question) ?? {} : {}}
                  onFormat={(format) => onFormatQuestion?.(question, format)}
                  showFormatControls={inExamWorkingCopy && !!onFormatQuestion}
                  actions={<div
                  className="question-bank-preview-actions"
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                >
                  {/* A question already on the Working Copy offers no way onto it
                      a second time — a reference occurs at most once — so the
                      plus becomes a tick: the same slot answers "can I add
                      this?" and "is it already on?". Reaching for it is the
                      one thing a teacher could still want from that slot, so
                      under the cursor the tick becomes the minus that takes
                      the question back off the exam. */}
                  {inExamWorkingCopy && onRemoveFromWorkingCopy ? (
                    <Button variant="ghost" size="icon-sm"
                      type="button"
                      className="question-bank-action question-bank-included"
                      aria-label={`Remove ${name} from the exam. ${hasExplanation ? 'Explanation present' : 'No explanation'}.`}
                      title="Remove from the exam"
                      onClick={() => onRemoveFromWorkingCopy(question.id)}
                    >
                      <Check className="question-bank-included-resting" />
                      <CircleMinus className="question-bank-included-hover" />
                    </Button>
                  ) : onAddToWorkingCopy ? (
                    <Button variant="ghost" size="icon-sm"
                      type="button"
                      className="question-bank-action"
                      aria-label={`Add ${name} to the exam. ${hasExplanation ? 'Explanation present' : 'No explanation'}.`}
                      title="Add to the exam"
                      onClick={() => onAddToWorkingCopy(question.id)}
                    >
                      <Plus />
                    </Button>
                  ) : null}
                </div>}
                />
                <span
                  className="question-bank-explanation-dot"
                  data-has-explanation={hasExplanation ? 'true' : 'false'}
                  role="img"
                  aria-label={hasExplanation ? 'Explanation present' : 'No explanation'}
                  title={hasExplanation ? 'Explanation present' : 'No explanation'}
                />
              </li>
            )
          })}
        </ul>
      )
  )

  return (
    <section
      ref={root}
      className="question-bank"
      aria-label="Question Bank"
      {...selectAllPaneProps('question-bank')}
      // The rule under the toolbar is drawn only while there is something
      // above it to have scrolled past.
      data-scrolled={scrolled ? 'true' : undefined}
      onClick={(event) => {
        const target = event.target as HTMLElement
        if (!target.closest('.question-bank-row, button, input, select, a')) {
          onClearSelection()
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClearSelection()
      }}
    >
      {/* What the bank is, what you can do to it, and what is currently hidden
          are all answers to questions you ask while looking at the list, so
          they stay outside the scroll area rather than sticking to the top of
          it: the list of questions is the only thing that scrolls, and the
          scrollbar is as tall as the list rather than as tall as the pane. */}
      <div className="question-bank-toolbar">
        <header className="question-bank-header">
          {heading ?? <h2>Question Bank</h2>}
          <div className="question-bank-header-actions">
            {extraActions}
            {onExport && <Button variant={layout === 'page' ? 'default' : 'plain'} size="content"
              type="button"
              className={layout === 'page' ? 'primary-button' : 'toolbar-icon-button'}
              aria-label="Export Question Bank"
              title="Export Question Bank"
              aria-haspopup="dialog"
              aria-describedby={bank.questions.length === 0 ? 'empty-bank-export-help' : exportBlocked ? 'editing-bank-export-help' : undefined}
              disabled={bank.questions.length === 0 || exportBlocked}
              onClick={onExport}
            >
              <Upload aria-hidden="true" />
              {layout === 'page' && 'Export'}
            </Button>}
            {onCreate && <Button variant={layout === 'page' ? 'outline' : 'plain'} size="content"
              type="button"
              className={layout === 'page' ? 'secondary-button' : 'toolbar-icon-button'}
              aria-label={layout === 'page' ? undefined : 'Add Question'}
              title={layout === 'page' ? undefined : 'Add Question'}
              aria-haspopup="menu"
              onClick={(event) => {
                // Below the button and aligned with it, so the list of types
                // reads as belonging to the control that asked for it.
                const bounds = event.currentTarget.getBoundingClientRect()
                onCreate({ x: bounds.left, y: bounds.bottom + 4 })
              }}
            >
              <Plus aria-hidden="true" />
              {layout === 'page' && 'New question'}
            </Button>}
            {onExport && bank.questions.length === 0 && <span id="empty-bank-export-help" className="sr-only">At least one Question is required.</span>}
            {onExport && exportBlocked && <span id="editing-bank-export-help" className="sr-only">Save or cancel the open Question edit before exporting.</span>}
          </div>
        </header>
        {layout === 'rows' && filterBar}
      </div>

      {layout === 'page' ? (
        <div className="bank-page-body">
          <QuestionBankOutline
            questions={browseQuestionBank(bank, { ...NO_FILTER, sort: filter.sort })}
            filter={filter}
            onFilterChange={onFilterChange}
          />
          <div className="bank-page-column">
            {filterBar}
            {list}
          </div>
        </div>
      ) : list}
    </section>
  )
}
