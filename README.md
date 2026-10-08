# Test Parrot monorepo

Two independent applications live in this repository:

| App            | Purpose                                                    | Development URL       |
| -------------- | ---------------------------------------------------------- | --------------------- |
| `apps/legacy`  | Unmodified snapshot of EdTech-a-thon's original app        | http://localhost:8000 |
| `apps/rewrite` | React, shadcn/ui and Tailwind version with the paper theme | http://localhost:8010 |

```sh
bun run install:apps
bun run dev:rewrite
# In another terminal:
bun run dev:legacy
```

Each app retains its own package manifest, lockfile, configuration and installed
dependencies. There is deliberately no shared runtime package or workspace
hoisting yet: upstream changes must not change the rewrite's dependencies.

The rewrite keeps the existing Git history. The original app is imported using
Git subtree; a normal clone contains both apps without a submodule checkout.

## Import and port upstream changes

```sh
bun run upstream:check
```

This fetches EdTech-a-thon's `main`, lists incoming commits and changed files,
and writes a patch review under `.upstream-reviews/`. It changes neither app.
Read that report, then import its exact SHA:

```sh
bun run upstream:update <full-reviewed-commit-sha>
```

The import updates **only `apps/legacy`**, creates local Git commits, and adds
an unchecked porting checklist in `docs/upstream/`. It never ports changes into
the rewrite or pushes to a remote. See [the full workflow](docs/monorepo.md)
for review, feature mapping, validation and recovery.

## Checks

```sh
bun run test             # Sync-tooling tests and rewrite unit tests
bun run build            # Rewrite production build
bun run lint             # Rewrite lint
bun run test:e2e          # Rewrite browser tests
bun run test:legacy       # Original app unit tests
bun run build:legacy     # Original app production build
```

Run browser suites one at a time: their upstream configs currently share a test
port. The separate print/DOCX comparison remains `bun run test:exports` and
requires LibreOffice and Poppler.

For Vercel, set the project Root Directory to `apps/rewrite`; its existing
Vite and routing configuration moved there with the app. Preview/deploying the
legacy app uses `apps/legacy` as its separate Root Directory.

[Documentation index](docs/README.md) · [UI editing guide](docs/ui-rewrite.md) · [Domain glossary](CONTEXT.md)
