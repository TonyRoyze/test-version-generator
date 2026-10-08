# Upstream imports and feature ports

`upstream.json` records the source repository, branch and imported commit.
`apps/legacy` is an exact upstream snapshot, managed as a squashed Git subtree.
`apps/rewrite` owns the shadcn UI and local features. Each app has a separate
lockfile and dependency installation; do not extract shared production modules
until there is an intentional contract between the apps.

The initial legacy snapshot is EdTech-a-thon commit
`f846119e5a8a7d4aaae7315ab41b5beba9a67c2e`. The rewrite was made from
TonyRoyze's `9c26a18`, which already contains that upstream commit plus local
changes. There is no incoming upstream backlog at initialization. This records
ancestry, not a claim that the two applications are identical.

## Review first

1. Commit or stash local changes and create a branch for the upstream import.
2. Run `bun run upstream:check`. Inspect its commit list, file list and complete
   patch in `.upstream-reviews/<sha>.md`.
3. Run `bun run upstream:update <full-sha>` using the SHA from that report.
   The command imports the pinned revision into `apps/legacy`, records the new
   source SHA and commits a porting checklist under `docs/upstream/`.
4. Run `bun run install:legacy`, then the relevant legacy checks. These checks
   establish whether upstream itself works in this environment.
5. For each checklist entry, record **port**, **already present**, or **skip**
   with a reason. For a port, identify the matching rewrite module and its
   user-visible behavior; upstream file paths may have changed.
6. Port one coherent feature at a time. For domain changes, compare both
   implementations and adapt their integration. For UI changes, use the
   rewrite's shadcn components. Avoid copying whole files over the rewrite.
7. Run the feature's focused unit and browser checks, then the rewrite's
   `bun run test`, `bun run build` and `bun run lint`. Export-affecting changes
   also follow [export testing](export-testing.md).
8. Record the rewrite commit and validation beside the checklist entry. Mark
   the entry checked only when its decision is complete. Commit the feature
   and its checklist together.

Keeping the implementations separate prevents an upstream import from directly
changing the rewrite. Behavioral compatibility still depends on review and
validation of each port.

## Guards and recovery

The tooling refuses a dirty checkout, modifications to the recorded legacy
snapshot, a stale review, an unreviewed revision, and upstream history that
moves backwards or diverges. It verifies that the rewrite Git tree is unchanged
by the subtree merge. A reviewed SHA stays pinned even if upstream `main` moves
between checking and importing.

The updater creates a subtree merge commit and a separate tracking commit.
If a Git hook or commit fails after the subtree merge, inspect `git status` and
`git log` first. Finish the pending tracking commit containing `upstream.json`
and its checklist; do not rerun the import or reset working changes blindly.
For an unexpected merge conflict, use the normal Git merge resolution or abort
workflow before doing more imports.

To inspect the exact upstream change again:

```sh
git diff <previous-upstream-sha> <imported-upstream-sha> -- src/path/to/file.ts
```

To compare today's implementations directly:

```sh
git diff --no-index apps/legacy/src/path/to/file.ts apps/rewrite/src/path/to/file.ts
```

A difference exits with status 1, which is normal for `git diff --no-index`.
Avoid `git pull origin main` as an upstream-import command: that merges at the
repository root. Use the pinned subtree workflow for updates to the old app.

The Git remote `origin` still refers to your existing fork; this setup does not
push or create a new GitHub repository. Before publishing the monorepo, choose
whether it belongs on a separate branch of that fork or in a new repository.

Reference: [Git subtree documentation](https://github.com/git/git/blob/master/contrib/subtree/git-subtree.adoc)
and [Bun lockfile documentation](https://bun.sh/docs/pm/lockfile).
