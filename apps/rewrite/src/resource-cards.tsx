import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  FolderOpen,
  PictureInPicture2,
  Plus,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { TopicBadge } from './badges'
import { ContextMenu, type MenuItem, type MenuPoint } from './context-menu'
import type { RecentExam } from './exam-workspaces'
import { usePopOver } from './pop-over-context'
import type { QuestionBankCollectionItem } from './resource-collections'

/** How many Topics a Question Bank card shows before it counts the rest. */
const SHOWN_TOPICS = 3

/**
 * The one thing an empty shelf says. The whole box is the button — a dotted
 * outline over the page's own ground rather than a card, so it reads as the
 * space a card will occupy rather than as a card that is already there.
 */
export function CreateFirstCard({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <Button variant="plain" size="content" type="button" className="create-first" onClick={onClick}>
      <span>{label}</span>
      <Plus aria-hidden="true" />
    </Button>
  )
}

/**
 * The space where the next card goes, drawn at a card's own size in the shelf
 * or grid it belongs to. Creating a resource happens where the resource will
 * appear, and an empty shelf is simply this card on its own — so there is no
 * separate empty state to design or explain.
 */
export function NewResourceCard({
  label,
  shape,
  onClick,
}: {
  label: string
  /** A `sheet` is the shape of an Exam's first page; a `card` a bank tile. */
  shape: 'sheet' | 'card'
  onClick: () => void
}) {
  return (
    <Button variant="plain" size="content"
      type="button"
      className={`new-resource-card new-resource-card--${shape}`}
      onClick={onClick}
    >
      <Plus aria-hidden="true" />
      <span>{label}</span>
    </Button>
  )
}

/**
 * A horizontally scrolling shelf of resource cards. The arrows sit in the
 * shelf's own heading row rather than over the cards, so nothing is ever
 * covered by a control, and each is present only while that direction has
 * something left to show.
 */
export function ResourceCarousel({
  label,
  heading,
  actions,
  children,
}: {
  label: string
  heading: ReactNode
  /** What the shelf offers, at the end of its bar. */
  actions?: ReactNode
  children: ReactNode
}) {
  const track = useRef<HTMLDivElement>(null)
  const [reach, setReach] = useState({ start: false, end: false })
  const measure = useCallback(() => {
    const element = track.current
    if (!element) return
    const furthest = element.scrollWidth - element.clientWidth
    setReach({
      start: element.scrollLeft > 2,
      end: element.scrollLeft < furthest - 2,
    })
  }, [])
  useEffect(() => {
    measure()
    const element = track.current
    if (!element) return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    for (const child of element.children) observer.observe(child)
    return () => observer.disconnect()
  }, [measure, children])
  const step = (direction: 1 | -1) => {
    const element = track.current
    if (!element) return
    element.scrollBy({
      left: direction * Math.max(180, element.clientWidth * 0.8),
      behavior: 'smooth',
    })
  }
  const scrollable = reach.start || reach.end
  return (
    <div className="resource-carousel">
      <div className="shelf-bar">
        {heading}
        <div className="shelf-actions">
          {scrollable && (
            <div className="carousel-arrows">
              <Button variant="plain" size="content"
                type="button"
                className="carousel-arrow"
                aria-label={`Scroll ${label} backward`}
                disabled={!reach.start}
                onClick={() => step(-1)}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button variant="plain" size="content"
                type="button"
                className="carousel-arrow"
                aria-label={`Scroll ${label} forward`}
                disabled={!reach.end}
                onClick={() => step(1)}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          )}
          {actions}
        </div>
      </div>
      <div
        className="resource-row"
        ref={track}
        role="list"
        aria-label={label}
        onScroll={measure}
      >
        {children}
      </div>
    </div>
  )
}

function relativeTime(prefix: string, iso: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 60_000),
  )
  if (minutes === 0) return `${prefix} just now`
  if (minutes < 60)
    return `${prefix} ${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${prefix} ${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${prefix} ${days} day${days === 1 ? '' : 's'} ago`
}

export function ExamCard({
  exam,
  onOpen,
  onDelete,
}: {
  exam: RecentExam
  onOpen: (id: string) => void
  onDelete?: (exam: RecentExam) => void
}) {
  const [menu, setMenu] = useState<MenuPoint | null>(null)
  const menuItems: MenuItem[] = [
    { kind: 'action', label: 'Open', icon: <FolderOpen />, onSelect: () => onOpen(exam.id) },
    ...(onDelete ? [
      { kind: 'separator' } as const,
      { kind: 'action' as const, label: 'Delete', icon: <Trash2 />, destructive: true, onSelect: () => onDelete(exam) },
    ] : []),
  ]
  return (
    <Card asChild className="gap-0 py-0"><article className="resource-card exam-card">
      <Button variant="plain" size="content" type="button" className="resource-card-main" onClick={() => onOpen(exam.id)}>
        <span className="sr-only">Open {exam.title}. </span>
        <h2 aria-hidden="true">{exam.title}</h2>
        <p className="bank-card-count">
          {exam.questionCount}{' '}
          {exam.questionCount === 1 ? 'Question' : 'Questions'}
          {exam.unsaved && (
            <span className="unsaved-mark" title="Unsaved changes">
              <TriangleAlert aria-hidden="true" />
              <span className="sr-only">Unsaved changes</span>
            </span>
          )}
        </p>
        <time dateTime={exam.lastOpenedAt}>{relativeTime('Updated', exam.lastOpenedAt)}</time>
      </Button>
      {onDelete && <Button variant="plain" size="content"
        type="button"
        className="bank-card-menu exam-card-menu"
        aria-label={`Actions for ${exam.title}`}
        aria-haspopup="menu"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          setMenu({ x: rect.right, y: rect.bottom + 4 })
        }}
      ><EllipsisVertical aria-hidden="true" /></Button>}
      {menu && <ContextMenu point={menu} side="left" items={menuItems} ariaLabel={`${exam.title} actions`} onClose={() => setMenu(null)} />}
    </article></Card>
  )
}

export function QuestionBankCard({
  bank,
  onOpen,
  onExport,
  onDelete,
}: {
  bank: QuestionBankCollectionItem
  onOpen: (id: string) => void
  onExport?: (bank: QuestionBankCollectionItem) => void
  onDelete?: (bank: QuestionBankCollectionItem) => void
}) {
  // Acting on the bank lives behind one mark rather than being bolted to the
  // tile — the card's own job is to be the way in, and a full-width red bar on
  // every tile in a grid says "delete" far louder than a grid should.
  const [menu, setMenu] = useState<MenuPoint | null>(null)
  const popOver = usePopOver()
  const items: MenuItem[] = [
    { kind: 'action', label: 'Open', icon: <FolderOpen />, onSelect: () => onOpen(bank.id) },
    ...(popOver.supported
      ? [{ kind: 'action' as const, label: 'Pop-over', icon: <PictureInPicture2 />, onSelect: () => popOver.open(bank.id) }]
      : []),
    // Sharing a bank starts here as well as inside it: teachers looking for a
    // way to share a bank look at the bank, not in it.
    ...(onExport
      ? [{
          kind: 'action' as const,
          label: 'Export',
          icon: <Upload />,
          disabled: bank.questionCount === 0,
          onSelect: () => onExport(bank),
        }]
      : []),
    ...(onDelete
      ? [
          { kind: 'separator' } as const,
          {
            kind: 'action' as const,
            label: 'Delete',
            icon: <Trash2 />,
            destructive: true,
            onSelect: () => onDelete(bank),
          },
        ]
      : []),
  ]
  return (
    <Card asChild className="gap-0 py-0"><article className="resource-card question-bank-card">
      <Button variant="plain" size="content"
        type="button"
        className="resource-card-main"
        onClick={() => onOpen(bank.id)}
      >
        <span className="sr-only">Open {bank.name}. </span>
        <h2 aria-hidden="true">{bank.name}</h2>
        <p className="bank-card-count">
          {bank.questionCount}{' '}
          {bank.questionCount === 1 ? 'Question' : 'Questions'}
        </p>
        {/* Topics wear the same tints here as in the bank pane and the question
            dialog, so one Topic is one colour everywhere it is shown. */}
        <div className="bank-card-topics">
          {bank.topics.slice(0, SHOWN_TOPICS).map((topic) => (
            <TopicBadge key={topic} topic={topic} />
          ))}
          {bank.topics.length > SHOWN_TOPICS && (
            <span className="badge">+{bank.topics.length - SHOWN_TOPICS}</span>
          )}
        </div>
        {/* How load-bearing this bank is, stated as the one fact worth having
            while scanning a grid. Which Exams they are is a question you ask
            while changing or deleting the bank, and it is answered there. */}
        <p className="bank-card-usage">
          {bank.usage.length === 0
            ? 'Not used in any Exams'
            : `Used in ${bank.usage.length} ${bank.usage.length === 1 ? 'Exam' : 'Exams'}`}
        </p>
        <time dateTime={bank.lastUpdatedAt}>
          {relativeTime('Updated', bank.lastUpdatedAt)}
        </time>
      </Button>
      <Button variant="plain" size="content"
        type="button"
        className="bank-card-menu"
        aria-label={`${bank.name} actions`}
        aria-haspopup="menu"
        onClick={(event) => {
          // Hangs leftwards from the mark's own right edge, so it never covers
          // the card it acts on.
          const bounds = event.currentTarget.getBoundingClientRect()
          setMenu({ x: bounds.right, y: bounds.bottom + 4 })
        }}
      >
        <EllipsisVertical aria-hidden="true" />
      </Button>
      {menu && (
        <ContextMenu
          point={menu}
          side="left"
          ariaLabel={`${bank.name} actions`}
          items={items}
          onClose={() => setMenu(null)}
        />
      )}
    </article></Card>
  )
}
