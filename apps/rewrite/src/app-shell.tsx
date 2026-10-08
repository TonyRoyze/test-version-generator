import { Modal } from '@/components/modal'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import {
  CircleQuestionMark,
  FileText,
  House,
  Import,
  Library,
  PanelsTopLeft,
  Settings,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Fragment, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AccountBadge, SETTINGS_PATH } from './account-menu'
import type { PersistentStorageStatus } from './durable-storage'
import { Footer, Link } from './site-chrome'
import { SUPPORT_EMAIL } from './support-email'
import { useRoute } from './use-route'

/**
 * The utility-app chrome every page outside the editor wears: a fixed left nav
 * naming the resource destinations, breadcrumbs across the top, and the page
 * itself in between. The editor keeps its own full-width document bar and is
 * reached by opening or creating an Exam rather than by a separate nav entry.
 */

export type Crumb = { label: string; href?: string }

const NAV = [
  { href: '/', label: 'Home', Icon: House },
  { href: '/exams', label: 'Exams', Icon: FileText },
  { href: '/question-banks', label: 'Question Banks', Icon: Library },
  { href: '/cover-templates', label: 'Cover Page Templates', Icon: PanelsTopLeft },
  { href: '/imports', label: 'Imports', Icon: Import },
] as const


/**
 * The one way to reach a person. It lives at the foot of the nav, out of the
 * way of the work but on every page, and says a single thing when opened.
 */
function HelpDialog({ onClose }: { onClose: () => void }) {
  const titleId = useId()
  const dialog = useRef<HTMLDivElement>(null)

  return createPortal(
    <>
      <Modal title={"Need a hand?"} onClose={onClose}
        ref={dialog}
        className="help-dialog"


        aria-labelledby={titleId}
      >
        <header className="resource-picker-header">
          <h2 id={titleId}>Need a hand?</h2>
          <Button variant="ghost" size="icon-sm" type="button" className="question-bank-action" aria-label="Close help" onClick={onClose}><X /></Button>
        </header>
        <p>
          If you’re running into trouble or have suggestions, email us at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}?subject=Test%20Parrot`}>{SUPPORT_EMAIL}</a>.
        </p>
      </Modal>
    </>,
    document.body,
  )
}

function HelpButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="plain" size="content"
        type="button"
        className="help-button"
        aria-label="Help"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <CircleQuestionMark aria-hidden="true" />
      </Button>
      {open && <HelpDialog onClose={() => setOpen(false)} />}
    </>
  )
}

export function AppShell({
  crumbs,
  persistentStorage,
  actions,
  children,
}: {
  crumbs: readonly Crumb[]
  persistentStorage: PersistentStorageStatus
  /** Page-level actions, shown in the top bar beside the storage badge. */
  actions?: ReactNode
  children: ReactNode
}) {
  const route = useRoute()
  return (
    <div className="app-shell">
      <aside className="app-nav">
        <Link href="/" className="site-wordmark app-nav-brand">
          <img className="app-logo" src="/logo.png" alt="" width={36} height={36} />
          Test Parrot
        </Link>
        <nav aria-label="Sections">
          <ul className="app-nav-list">
            {NAV.map(({ href, label, Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="app-nav-link"
                  {...(route === href || (href === '/imports' && route === '/import') ? { 'aria-current': 'page' } : {})}
                >
                  <Icon aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="app-nav-foot">
          <HelpButton />
          <Link
            href={SETTINGS_PATH}
            className="app-nav-link"
            {...(route === SETTINGS_PATH ? { 'aria-current': 'page' } : {})}
          >
            <Settings aria-hidden="true" />
            Settings
          </Link>
        </div>
      </aside>
      <div className="app-frame">
        <header className="app-topbar">
          <Breadcrumb aria-label="Breadcrumb">
            <BreadcrumbList className="breadcrumbs">
              {crumbs.map((crumb, index) => <Fragment key={crumb.label}>
                {index > 0 && <BreadcrumbSeparator>/</BreadcrumbSeparator>}
                <BreadcrumbItem>
                  {crumb.href && index !== crumbs.length - 1
                    ? <BreadcrumbLink asChild><Link href={crumb.href}>{crumb.label}</Link></BreadcrumbLink>
                    : <BreadcrumbPage>{crumb.label}</BreadcrumbPage>}
                </BreadcrumbItem>
              </Fragment>)}
            </BreadcrumbList>
          </Breadcrumb>
          <div className="app-topbar-actions">
            {actions}
            <AccountBadge status={persistentStorage} />
          </div>
        </header>
        <main className="app-main">{children}</main>
        <Footer />
      </div>
    </div>
  )
}
