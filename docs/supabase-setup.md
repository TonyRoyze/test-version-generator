# Supabase setup

Settings now supports email/password sign-in, sign-out, invited-user password
setup, password changes, and password-reset links. When Supabase is configured,
the application requires a session before opening authoring data. Without the
two environment variables it remains a local-only application.

## Hosted project

The linked project has both migrations applied, public sign-ups disabled, and a
private `account-snapshots` Storage bucket. Authentication currently uses
`http://localhost:8000/settings` as its Site URL, with that URL and
`http://127.0.0.1:8000/settings` allowed as redirects. The app is not yet deployed.

For a new project:

1. Create the project in the [Supabase dashboard](https://supabase.com/dashboard).
2. Copy `.env.example` to `.env.local`. Fill in the project URL and publishable
   key from Project Settings → API Keys. Never use a secret or service-role key
   in a `VITE_` variable; these variables are bundled into the browser app.
3. Link the Supabase CLI to the project and apply `supabase/migrations/` with
   `supabase db push`. Both migrations are required on a new project.
4. Keep Email authentication enabled and public sign-ups disabled. Invite each
   intended user from Authentication → Users → Add user. Invitation links open
   Settings and let the user choose a password. No invitation emails are sent
   by project setup itself.
5. Configure Authentication → URL Configuration with the app's URL followed
   by `/settings`, both as Site URL and as an allowed redirect. For local
   development use the two localhost URLs above.
6. Run `pnpm dev` and open Settings. Sign in with an invited account.

When deploying, set both `VITE_` variables in the build environment, change Site
URL to `https://YOUR-DEPLOYMENT/settings`, and add that exact redirect URL.
Keep local redirects only if you still need local testing. Configure your host
with an SPA fallback so direct `/settings` links load `index.html`.

Supabase's default email delivery has restrictions and rate limits. Configure
custom SMTP before relying on invitations and password resets for other people;
see [SMTP configuration](https://supabase.com/docs/guides/auth/auth-smtp).

## Using cloud sync

- Editing saves to IndexedDB immediately, within the signed-in user's own
  database namespace. Each account retains its separate local work after
  sign-out. Temporary import documents are also account-scoped.
- In Settings, use **Sync now** before moving to another device. This uploads a
  complete account snapshot: Exams, Question Banks, canonical Questions,
  Working Copies, Export History, and image bytes. Sync is explicit, not an
  automatic background upload or live collaboration service.
- A new device downloads the cloud copy after login. On later loads, cloud
  changes are downloaded automatically only if the local copy still matches
  its last synced content. Existing unsynced work is retained.
- If both devices changed, Settings offers a backup download and explicit
  choices to replace the device's copy or replace the cloud copy. A revision
  comparison also catches a save arriving during upload. There is no automatic
  record merge.
- In an empty account with no cloud copy, **Import existing browser work** copies
  the old local-only account into the signed-in account. The original remains
  intact. Use **Sync now** afterward. For an account with existing work, use the
  normal backup download/restore flow instead; restoration replaces its work.
- One editable tab per account is allowed, preventing another tab from changing
  databases during restoration. Close the other tab and reload when prompted.
- When the cloud is unreachable, an existing local workspace can still open;
  Settings reports the connection problem. Changes remain local until synced.
  A new device needs a connection to download its account.

## Storage and consistency

`account_heads` holds one owner-scoped revision pointer per account. Each save
uploads an immutable ZIP to `account-snapshots/<user-id>/<revision>.zip`, then
publishes its pointer only if the previous revision still matches. Uploading
before publishing keeps partially uploaded accounts out of view. RLS denies
anonymous access and restricts both the pointer and Storage objects to their
owner. ZIPs are limited to 50 MB each.

This implementation deliberately uses the existing complete backup format.
The earlier `user_resources` JSONB table is retained but is not the active sync
format: it alone cannot preserve Working Copies, cross-resource Questions,
media, and immutable Export History atomically. A per-resource sync model would
need a separate merge protocol.

Images are restored into the user's local Media Store. The image service worker
resolves `/local-images/<hash>` against the requesting tab's account. Browser PDF
and DOCX generation therefore continue to consume owned local media; no public
bucket or expiring URL is written into documents.

Old snapshot objects are retained so publication never races a download and an
older revision remains recoverable by an administrator. Failed/conflicting
uploads may also leave unreferenced objects. Monitor Storage usage; there is no
automatic retention job yet. Do not remove the object referenced by an account
head, or an object currently being downloaded. Local backups remain available.

Signing out gates the app; it does not encrypt or erase that user's cached data
from the device. Use a trusted OS/browser profile for private authoring work.

## Verification

- `pnpm build`
- `bun test src/cloud-account.test.ts src/account-backup.test.ts src/exam-workspaces.test.ts src/question-bank-workspaces.test.ts src/import-history.test.ts`
- `pnpm test:auth` — mocked Auth/Data/Storage endpoints, including the cloud
  round-trip to a fresh browser with image bytes. Sends no emails.
- `pnpm test:e2e scripts/account-backup.e2e.ts` — local-only backup compatibility.
- `supabase db query --linked --file supabase/tests/account-security.sql` —
  transactional owner isolation, storage ownership, anonymous denial, and stale
  revision checks. Rolls back its test users and records.
- `supabase db advisors --linked --type security`

The general Playwright suite deliberately clears Supabase environment variables;
the separate auth suite supplies fake credentials. Neither suite uses real users.
