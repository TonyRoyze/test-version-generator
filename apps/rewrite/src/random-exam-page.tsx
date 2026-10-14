import { useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, Check, Dices } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { AppShell } from './app-shell'
import type { PersistentStorageStatus } from './durable-storage'
import type { QuestionBankWorkspaceService, QuestionBankSummary } from './question-bank-workspaces'
import type { BankDraw } from './random-exam'
import { Link } from './site-chrome'

const PAGE_SIZE = 12
const STEPS = ['Exam details', 'Choose banks', 'Review exam']

export function RandomExamPage({ bankWorkspaces, persistentStorage, onBlank, onGenerate }: {
  bankWorkspaces: QuestionBankWorkspaceService
  persistentStorage: PersistentStorageStatus
  onBlank: () => Promise<void>
  onGenerate: (draws: BankDraw[], total: number, title: string) => Promise<void>
}) {
  const id = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const [banks, setBanks] = useState<QuestionBankSummary[] | null>(null)
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [total, setTotal] = useState('10')
  const [title, setTitle] = useState('Untitled Exam')
  const [step, setStep] = useState(0)
  const [query, setQuery] = useState('')
  const [selectedOnly, setSelectedOnly] = useState(false)
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let current = true
    void bankWorkspaces.recent().then((items) => {
      if (current) setBanks(items)
    }).catch(() => { if (current) setError('Could not load your Question Banks. Reload this page to try again.') })
    return () => { current = false }
  }, [bankWorkspaces])
  const selected = (banks ?? []).filter((bank) => Number(counts[bank.id] ?? 0) > 0)
  const allocated = Object.values(counts).reduce((sum, count) => sum + Number(count), 0)
  const filtered = (banks ?? []).filter((bank) =>
    (!selectedOnly || Number(counts[bank.id] ?? 0) > 0)
    && `${bank.name} ${bank.topics.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const goToStep = (next: number) => {
    setStep(next)
    setError(null)
    window.scrollTo({ top: 0 })
    requestAnimationFrame(() => heading.current?.focus())
  }
  const validate = () => {
    if (!Number.isSafeInteger(Number(total)) || Number(total) < 1) throw new Error('Enter a whole number of at least 1 for the total.')
    for (const bank of banks ?? []) {
      const count = Number(counts[bank.id] ?? 0)
      if (!Number.isSafeInteger(count) || count < 0 || count > bank.questionCount) {
        throw new Error(`Choose between 0 and ${bank.questionCount} questions from ${bank.name}.`)
      }
    }
    if (allocated !== Number(total)) throw new Error('The counts from your Question Banks must add up to the total.')
  }
  const submit = async () => {
    setError(null)
    try {
      if (step === 0) {
        if (!Number.isSafeInteger(Number(total)) || Number(total) < 1) throw new Error('Enter a whole number of at least 1 for the total.')
        goToStep(1)
        return
      }
      validate()
      if (step === 1) { goToStep(2); return }
      setBusy(true)
      await onGenerate(selected.map((bank) => ({ bankId: bank.id, count: Number(counts[bank.id]) })), Number(total), title.trim() || 'Untitled Exam')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the exam. Try again.')
      setBusy(false)
    }
  }
  const startBlank = async () => {
    setBusy(true)
    try { await onBlank() } catch {
      setError('Could not create a blank exam. Try again.')
      setBusy(false)
    }
  }
  const errorNotice = error && <p className="home-error" role="alert">{error}</p>
  return <AppShell crumbs={[{ label: 'Home', href: '/' }, { label: 'Exams', href: '/exams' }, { label: 'Generate exam' }]} persistentStorage={persistentStorage}>
    <div className="exam-builder">
      <Link href="/exams" className="exam-builder-return"><ArrowLeft aria-hidden="true" />Back to Exams</Link>
      <h1>Generate exam</h1>
      <p className="exam-builder-intro">Build a paper from your Question Banks, then edit it in the usual editor.</p>
      <ol className="exam-builder-steps" aria-label="Exam setup progress">
        {STEPS.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} data-complete={index < step || undefined}>
          <span aria-hidden="true">{index < step ? <Check /> : index + 1}</span>{label}
        </li>)}
      </ol>
      <form onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <h2 ref={heading} tabIndex={-1}>{STEPS[step]}</h2>
        {step === 0 && <section className="exam-builder-details" aria-label="Exam details">
          <FieldGroup>
            <Field><FieldLabel htmlFor={`${id}-title`}>Exam name</FieldLabel><Input id={`${id}-title`} value={title} disabled={busy} onChange={(event) => setTitle(event.target.value)} /></Field>
            <Field><FieldLabel htmlFor={`${id}-total`}>Total questions</FieldLabel><Input id={`${id}-total`} type="number" min={1} step={1} required value={total} disabled={busy} onChange={(event) => setTotal(event.target.value)} /><FieldDescription>Matching sets and multipart questions each count as one question.</FieldDescription></Field>
          </FieldGroup>
          {banks === null && !error && <p role="status">Loading Question Banks…</p>}
          {banks?.length === 0 && <p>Add or import a Question Bank first, or start with a blank exam.</p>}
          {errorNotice}
          <div className="exam-builder-actions"><Button variant="outline" disabled={busy} onClick={() => { void startBlank() }}>Start blank</Button><Button type="submit" disabled={busy || !banks?.some((bank) => bank.questionCount > 0)}>Choose banks</Button></div>
        </section>}
        {step === 1 && <div className="exam-builder-layout">
          <section className="exam-builder-banks" aria-label="Question Bank counts">
            <div className="exam-builder-filters">
              <Field><FieldLabel htmlFor={`${id}-search`}>Search Question Banks</FieldLabel><Input id={`${id}-search`} type="search" placeholder="Search by name or topic" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0) }} /></Field>
              <Field orientation="horizontal"><Checkbox id={`${id}-selected`} checked={selectedOnly} onCheckedChange={(checked) => { setSelectedOnly(checked === true); setPage(0) }} /><FieldLabel htmlFor={`${id}-selected`}>Selected banks only</FieldLabel></Field>
            </div>
            <p className="exam-builder-result-count" role="status">{filtered.length} {filtered.length === 1 ? 'bank' : 'banks'}{query.trim() ? ' found' : ''}</p>
            <FieldGroup className="exam-builder-bank-list">
              {visible.map((bank) => <Field orientation="horizontal" className="exam-builder-bank-row" key={bank.id} data-selected={Number(counts[bank.id] ?? 0) > 0 || undefined}>
                <div className="exam-builder-bank-label"><FieldLabel htmlFor={`${id}-${bank.id}`}>{bank.name}</FieldLabel><FieldDescription>{bank.questionCount} available</FieldDescription></div>
                <Input id={`${id}-${bank.id}`} aria-label={`Questions from ${bank.name}`} type="number" min={0} max={bank.questionCount} step={1} required value={counts[bank.id] ?? '0'} disabled={bank.questionCount === 0} onChange={(event) => setCounts((current) => ({ ...current, [bank.id]: event.target.value }))} />
              </Field>)}
            </FieldGroup>
            {filtered.length === 0 && <p>No Question Banks match. Try another search or turn off “Selected banks only”.</p>}
            {pageCount > 1 && <nav className="exam-builder-pagination" aria-label="Question Bank pages">
              <Button variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button><span>Page {currentPage + 1} of {pageCount}</span><Button variant="outline" disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)}>Next</Button>
            </nav>}
          </section>
          <aside className="exam-builder-summary" aria-label="Question allocation">
            <h3>{title.trim() || 'Untitled Exam'}</h3>
            <p className="exam-builder-total" role="status">{Number.isFinite(allocated) ? allocated : 0} of {total} questions</p>
            <p>{allocated === Number(total) ? 'All questions allocated.' : allocated > Number(total) ? `Remove ${allocated - Number(total)} questions to match your total.` : `Choose ${Number(total) - allocated} more questions.`}</p>
            <p>{selected.length} {selected.length === 1 ? 'bank selected' : 'banks selected'}</p>
            <p className="exam-builder-note">Set a count beside a bank to include it. Questions will be picked without repeats.</p>
            {errorNotice}
            <div className="exam-builder-actions"><Button variant="outline" onClick={() => goToStep(0)}>Back</Button><Button type="submit">Review exam</Button></div>
          </aside>
        </div>}
        {step === 2 && <section className="exam-builder-review" aria-label="Selected Question Banks">
          <h3>{title.trim() || 'Untitled Exam'}</h3>
          <p>{total} questions from {selected.length} {selected.length === 1 ? 'bank' : 'banks'}</p>
          <ul>{selected.map((bank) => <li key={bank.id}><span>{bank.name}</span><strong>{counts[bank.id]} {Number(counts[bank.id]) === 1 ? 'question' : 'questions'}</strong></li>)}</ul>
          <p className="exam-builder-note">We’ll pick questions at random and open your paper in the editor. Use the dice on a question to try another.</p>
          {errorNotice}
          <div className="exam-builder-actions"><Button variant="outline" disabled={busy} onClick={() => goToStep(1)}>Back</Button><Button type="submit" disabled={busy}><Dices />{busy ? 'Creating…' : 'Generate exam'}</Button></div>
        </section>}
      </form>
    </div>
  </AppShell>
}
