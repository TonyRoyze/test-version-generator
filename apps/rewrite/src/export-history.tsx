import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useRef } from 'react'
import type { ExportRecord } from './export-preparation'
import { exportTime } from './export-time'

// A few names, then how many more, so a long batch keeps its card short.
function versionsLabel(versions: readonly string[]): string {
  const shown = versions.slice(0, 2).join(', ')
  return versions.length > 2 ? `${shown} +${versions.length - 2}` : shown
}

function selectionLabel(record: ExportRecord): string {
  if (record.selection.test && record.selection.answerKey) {
    return 'Student Test + Answer Key'
  }
  return record.selection.test ? 'Student Test' : 'Answer Key'
}

export function ExportHistoryDrawer({
  records,
  selectedRecordId,
  open,
  onOpenChange,
  onSelect,
}: {
  records: readonly ExportRecord[]
  selectedRecordId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (record: ExportRecord, number: number) => void
}) {
  const drawer = useRef<HTMLDivElement>(null)
  return <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
    <SheetContent layout="authored" showCloseButton={false} showOverlay={false}
      className="export-history-drawer" id="export-history" role="complementary" aria-label="Export History"
      aria-describedby={undefined} ref={drawer}
      onOpenAutoFocus={event => { event.preventDefault(); drawer.current?.querySelector<HTMLElement>('.export-history-item, button')?.focus() }}
      onInteractOutside={event => {
        const target = event.target as HTMLElement
        if (selectedRecordId || target.closest('[aria-controls="export-history"]')) event.preventDefault()
      }}
      onCloseAutoFocus={event => event.preventDefault()}
    >
      <SheetTitle asChild><span className="sr-only">Export History</span></SheetTitle>
      <header className="export-history-header">
        <div>
          <h2>Export History</h2>
          <p>Everything exported from this Exam, kept in this browser.</p>
        </div>
        <Button variant="ghost" size="icon-sm"
          type="button"
          className="toolbar-icon-button"
          aria-label="Close Export History"
          onClick={() => onOpenChange(false)}
        >
          ×
        </Button>
      </header>
      {records.length === 0 ? (
        <p className="export-history-empty">Export this Exam to keep a record here.</p>
      ) : (
        <ol className="export-history-list">
          {records.map((record, index) => ({ record, number: index + 1 })).reverse().map(({ record, number }) => (
            <li key={record.id}>
              <Button variant="plain" size="content"
                type="button"
                className="export-history-item export-history-item"
                aria-current={selectedRecordId === record.id ? 'page' : undefined}
                onClick={() => onSelect(record, number)}
              >
                <strong>{record.capturedName}</strong>
                <span>Export #{number}</span>
                <time dateTime={record.createdAt}>{exportTime(record.createdAt)}</time>
                <span>{record.format.toUpperCase()} · {selectionLabel(record)}</span>
                {record.versions && (
                  <span className="export-history-versions">
                    {record.versions.length === 1 ? 'Version' : `${record.versions.length} Versions`}: {versionsLabel(record.versions)}
                  </span>
                )}
                <span>
                  {record.questionCount} {record.questionCount === 1 ? 'question' : 'questions'}
                </span>
              </Button>
            </li>
          ))}
        </ol>
      )}
    </SheetContent>
  </Sheet>
}
