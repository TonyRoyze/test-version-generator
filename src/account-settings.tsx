import { LockKeyhole } from 'lucide-react'
import { HeroArt, LandingHeader } from './landing-page'
import { Footer, Link } from './site-chrome'
import './login-page.css'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, initialAuthAction, authCallbackError } from './supabase'
import { CloudConflict, cloudStartupError, canImportBrowserWork, reloadCloudAccount, syncAccount, snapshotHasWork, type CloudHead } from './cloud-account'
import { accountBackupBlob, captureAccount } from './account-backup'
import { LOCAL_STORAGE_NAME } from './storage-schema'
import './account-menu.css'

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'The request failed. Please try again.'
}

export function AccountSettings({ passwordSetup = false, standalone = false }: { passwordSetup?: boolean; standalone?: boolean }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [mode, setMode] = useState<'login' | 'reset' | 'password'>(passwordSetup ? 'password' : 'login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(authCallbackError ?? cloudStartupError)
  const [notice, setNotice] = useState('')
  const [conflict, setConflict] = useState<CloudHead | null>(null)
  const [canImport, setCanImport] = useState(false)
  useEffect(() => {
    if (!supabase) return
    let alive = true
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return
      setUser(data.session?.user ?? null)
      if (error) setError(error.message)
      setLoading(false)
    }).catch(error => { if (alive) { setError(messageOf(error)); setLoading(false) } })
    void Promise.all([captureAccount(), captureAccount(new Date(), LOCAL_STORAGE_NAME)]).then(([own, local]) => {
      if (alive) setCanImport(canImportBrowserWork && !snapshotHasWork(own) && snapshotHasWork(local))
    }).catch(() => undefined)
    return () => { alive = false }
  }, [])
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('')
    try { await operation() } catch (error) {
      if (error instanceof CloudConflict) setConflict(error.head)
      else setError(messageOf(error))
    } finally { setBusy(false) }
  }
  const authenticate = () => run(async () => {
    if (!supabase) return
    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/settings` })
      if (error) throw error
      setNotice('If this email belongs to an account, a password-reset link will arrive shortly.')
    } else if (mode === 'password') {
      if (password !== confirmation) throw new Error('The passwords do not match.')
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      window.location.replace('/settings')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      window.location.replace('/settings')
    }
  })
  const sync = (overwrite?: CloudHead) => run(async () => {
    if (!supabase || !user) return
    const result = await syncAccount(supabase, user.id, overwrite)
    if (result === 'download') { reloadCloudAccount(user.id, 'download'); return }
    setConflict(null)
    setNotice(result === 'unchanged' ? 'Your cloud copy is up to date.' : 'Your work is saved to the cloud.')
  })
  const download = () => run(async () => {
    const url = URL.createObjectURL(await accountBackupBlob(await captureAccount()))
    const link = document.createElement('a')
    link.href = url; link.download = 'test-parrot-before-cloud-restore.zip'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice('Backup downloaded. You can now choose which copy to keep.')
  })
  return <section className={standalone ? "account-settings login-account" : "site-card account-settings"} aria-labelledby="settings-account">
    <h2 id="settings-account" className={standalone ? "login-visually-hidden" : undefined}>Account</h2>
    {!supabase ? <p className="account-note">Cloud login is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart the app. Your browser work remains available.</p>
      : loading ? <p role="status" className="account-note">Checking your session…</p>
      : user && mode !== 'password' ? <>
        <p>Signed in as <strong>{user.email}</strong></p>
        <p>Work is saved in this browser as you edit. Use Sync now before switching devices to save Exams, Question Banks, Working Copies, images, and Export History to your private cloud account.</p>
        <div className="account-actions">
          <button className="primary-button" disabled={busy} onClick={() => void sync()}>{busy ? 'Working…' : 'Sync now'}</button>
          <button className="secondary-button" disabled={busy} onClick={() => { setMode('password'); setPassword(''); setConfirmation('') }}>Change password</button>
          <button className="secondary-button" disabled={busy} onClick={() => void run(async () => {
            const { error } = await supabase!.auth.signOut({ scope: 'local' })
            if (error) throw error
            window.location.replace('/settings')
          })}>Sign out</button>
        </div>
        <p>Signing out keeps this account’s local work on this device. Sync first to make it available elsewhere.</p>
        {canImport && <div>
          <p>This browser has work from before login. Import it into this empty account, then sync to upload it. The original browser copy is retained.</p>
          <button className="secondary-button" disabled={busy} onClick={() => reloadCloudAccount(user.id, 'import-local')}>Import existing browser work</button>
        </div>}
        {conflict && <div role="alert" className="cloud-conflict">
          <h3>Another device has saved changes</h3>
          <p>Both copies are preserved. Download a backup before replacing either copy. Changes are not merged automatically.</p>
          <div className="account-actions">
            <button className="secondary-button" disabled={busy} onClick={() => void download()}>Download this device’s copy</button>
            <button className="secondary-button" disabled={busy} onClick={() => reloadCloudAccount(user.id, 'download')}>Replace this device with cloud copy</button>
            <button className="secondary-button" disabled={busy} onClick={() => void sync(conflict)}>Replace cloud with this device’s copy</button>
          </div>
        </div>}
      </> : <form className="account-login" onSubmit={event => { event.preventDefault(); void authenticate() }}>
        <p>{mode === 'password' ? 'Choose a password for your account.' : mode === 'reset' ? 'Enter your account email to request a password-reset link.' : 'Sign in with your invited account to access your private workspace.'}</p>
        {mode !== 'password' && <label>Email<input type="email" name="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></label>}
        {mode !== 'reset' && <label>{mode === 'password' ? 'New password' : 'Password'}<input type="password" name="password" autoComplete={mode === 'password' ? 'new-password' : 'current-password'} required minLength={mode === 'password' ? 8 : undefined} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></label>}
        {mode === 'password' && <label>Confirm password<input type="password" name="confirmation" autoComplete="new-password" required minLength={8} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} /></label>}
        <div className="account-actions">
          <button className="primary-button" disabled={busy}>{busy ? 'Working…' : mode === 'reset' ? 'Send reset link' : mode === 'password' ? 'Save password' : 'Sign in'}</button>
          {mode !== 'password' && <button type="button" className="secondary-button" disabled={busy} onClick={() => { setMode(mode === 'reset' ? 'login' : 'reset'); setError(''); setNotice('') }}>{mode === 'reset' ? 'Back to sign in' : 'Forgot password?'}</button>}
          {mode === 'password' && !passwordSetup && <button type="button" className="secondary-button" disabled={busy} onClick={() => setMode('login')}>Cancel</button>}
        </div>
      </form>}
    {notice && <p role="status" className="account-ok">{notice}</p>}
    {error && <p role="alert" className="account-warning">{error}</p>}
  </section>
}

/**
 * The way into the workspace. It is the one page between a visitor and their
 * work, so it is the front door's own page: the same header, the same hero grid
 * and the same hero art, only with the sign-in card where the front door puts
 * its way in. Its fields are the Exam section heading's own field, typed where
 * it prints, because signing in is writing on the same kind of page the product
 * makes.
 */
export function LoginPage() {
  const passwordSetup = initialAuthAction === 'recovery' || initialAuthAction === 'invite'
  return <div className="landing auth-page">
    <LandingHeader>
      <Link href="/about" className="site-link">
        About
      </Link>
      <Link href="/welcome" className="site-link">
        Back to Test Parrot
      </Link>
    </LandingHeader>

    <main className="auth-main">
      <section className="landing-hero">
        <HeroArt />
        <div className="landing-hero-copy">
          <h1>{passwordSetup ? 'Make yourself at home.' : 'Welcome back.'}</h1>

          <div className="auth-form-wrap">
            <AccountSettings passwordSetup={passwordSetup} standalone />
            <p className="auth-invite">
              <LockKeyhole size={15} aria-hidden="true" />
              Access is by invitation. Use the email you were invited with.
            </p>
          </div>

          <p className="landing-fineprint">
            Your workspace. Your questions. All in one place.
          </p>
        </div>
      </section>
    </main>

    <Footer />
  </div>
}
