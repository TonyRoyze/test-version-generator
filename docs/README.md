# Documentation

## Working on the monorepo

- [Upstream imports and feature ports](monorepo.md): review and import updates into legacy, then track deliberate ports into the rewrite.
- [Editing the UI](ui-rewrite.md): shadcn components, theme tokens and screen layouts.
- [Browser assertions](browser-assertions.md): user-visible checks for Playwright coverage.
- [Export testing](export-testing.md): print/DOCX contracts and the optional comparison tools.
- [Supabase setup](supabase-setup.md): cloud account configuration.

## Domain and architecture

- [Domain glossary](../CONTEXT.md): the application's vocabulary.
- [Architecture decisions](adr/): accepted decisions and explicitly superseded history. Older decisions explain why the current model changed.

## Current portable formats

- [Question Bank Record 0.9.0](question-bank-record-0.9.0.md)
- [Exam Record 0.4.0](exam-record-0.4.0.md)
- [Test Parrot Package 0.1.0](test-parrot-package-0.1.0.md)

The current guides describe compatibility with older supported versions. Exact
versioned schemas, examples and counterexamples remain in
[`apps/rewrite/public/formats`](../apps/rewrite/public/formats/).

Superseded prose specifications, editor handoffs, redesign drafts, ticket drafts
and prototype notes have been removed from the active docs. Git history retains
them. The upstream copy in `apps/legacy` stays intact for reproducible imports.
