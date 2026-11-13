# Google Drive feature port — 2026-11-08

Source: https://github.com/teacherdotdev/test-parrot
Pinned target: `4ce61ce5295ee172c11225b6023a1a35c39e0b79`.
Reviewed range: `6d0f06017f3f367ed04e92c6f00efeb56dc118d7..4ce61ce`.

This is a direct port into `apps/rewrite`. The checkout already contained
uncommitted Question source / record 0.12.0 work, so the clean-checkout guard
prevented a legacy subtree import. No legacy import or change of `upstream.json`
was performed. Existing local work was retained. The port is uncommitted for
review alongside that work; no rewrite commit has been recorded yet.

## Decisions

- Port `2974ffb5f209d3241ed8623b3c1577af86c13b96`: explicit Drive sync, PDFs with
  attached packages and stable identities, backup/restore, and a stale-sync dot.
- Port `e4d2ec7acb4b8afa07a744fd293620da69a81b74`: Google Picker, sharing,
  conflict choices, and ownership-aware deletion warnings.
- Port `afca9487b53c0026562b0d3fd9bb7c2078fb4084` and
  `ea69e6f27a9975de7d61e7b4b30b4286bec89b1b`: connection controls, shared-file
  opening, and link previews.
- Port `8581df5df8a7a2b208e5f68d6fa163577be3057c`: fontkit runtime dependency
  and View in Google Drive on collection cards.
- Port `f1022d0d371f9004ae1d9f4ad532c68a3828cb1b`: Open in Google Drive on
  the Question Bank page.
- Port `c97b201e47ef0cbdc5642f847f675fee988ae546`: bank page More menu for
  Pop-over, Import, Drive link and Export. Skip the Move action: this rewrite
  has flat resource collections, with no folder UI to move into. Drive folder
  paths received from another browser are preserved in adapter bookkeeping.

## Adaptation

The rewrite keeps its account controls and existing account sync. Drive is an
additional explicit service. Drive mappings and folder metadata are scoped by the selected account storage
name and excluded from portable account backups. Exam content revisions live
in the account registry and travel in backups, so restoring does not invent a
new local edit. Exam change detection hashes authoring content;
opening a paper alone is not an edit. Known locally deleted resources become
sync tombstones because this rewrite uses permanent deletion rather than Trash.

`src/drive/resource-library.ts` and `src/drive/browser-library.ts` adapt the
upstream engine to the rewrite services. `src/portable-question-identities.ts`
also preserves Multipart Part and answer identities, which the upstream map
omitted. Incoming banks use the current record importer, including local source
metadata support. Incoming Exams retain existing Export History.

## Configuration and validation

Set `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_API_KEY` in the rewrite environment
for actual Google use. OAuth uses the `drive.file` scope; the API key is used by
Picker. Empty client configuration hides Drive controls. No Google credentials
were provisioned and no real Drive files were modified during this port.

`bun run --cwd apps/rewrite test:drive` runs the browser acceptance suite against
stubbed Google services, independently of actual credentials.

Validation completed:

- `bun run test`: 1,443 rewrite unit tests passed, plus 5 upstream-tooling tests.
- After the final content-revision adaptation: 45 focused Drive, workspace and
  Exam-package tests passed.
- `bun run --cwd apps/rewrite test:drive --retries=0`: 3 browser tests passed,
  covering banks across browsers, backup restore/disconnect, shared links,
  conflict resolution, menu export, and Exam-to-bank identity after sync.
- `bunx playwright test scripts/question-bank-export.e2e.ts --retries=0` in the
  rewrite: 3 browser tests passed, covering full-bank export despite filtering,
  PDF download, unchanged persistence, focus restoration, cancellation and
  blocked export during editing / empty-bank export.
- `bun run build`: passed. Vite reports its existing large-chunk advisory.
- `bun run lint`: passed with the existing `inspect` hook dependency warning
  in `question-bank-import-dialog.tsx`.
- `git diff --check`: passed. `apps/legacy` has no changes.
- `bun run test:exports`: attempted; unavailable because LibreOffice (`soffice`)
  is not installed. No heavyweight print/DOCX comparison is claimed.

The browser suite uses stubbed Google services. Actual OAuth consent, Workspace
admin policy and live Drive access require deployment configuration and were
not exercised. Implementation and validation are complete locally; the rewrite
commit remains pending so unrelated existing user edits are not committed.
