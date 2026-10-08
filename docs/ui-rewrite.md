# Editing the UI

The React + shadcn/ui rewrite lives in `apps/rewrite` on `rewrite/react-shadcn-ui`.
The source paths below are relative to that app directory. The layouts,
warm paper palette, data model, and authoring/export workflows are retained.

## Where to make changes

- `src/components/ui/`: editable shadcn primitives, including Button, Select,
  Dialog, Sheet, Popover, Command, Checkbox, RadioGroup, Card, and Breadcrumb.
  Change a primitive here to update its callers throughout the app.
- `src/components/modal.tsx`: the shared dialog wrapper, including dismissal
  guards during imports and focus restoration.
- `src/components/front-matter-select.tsx`: searchable Difficulty and Topics
  fields, including creating new Topics.
- `src/context-menu.tsx`: the existing point-based menu API composed from
  shadcn DropdownMenu; Radix handles keyboard navigation and submenus.
- `src/styles.css`: the paper palette and semantic Tailwind theme tokens,
  followed by the existing screen layouts and printable document styles.
- Individual screen files such as `src/question-bank-pane.tsx` compose the
  primitives with the application's domain actions.

The rich-text editor, printable question content, page layout, drag handles,
and margin scrubbers remain specialized domain components. File inputs keep
the browser's file picker. Tailwind Preflight is omitted to avoid changing
editor and printed document typography.

## Local development

```sh
bun run install:rewrite
bun run dev:rewrite
```

`components.json` configures shadcn with the `@/` alias and Tailwind v4. Add
components from `apps/rewrite` with `bunx --bun shadcn@latest add <component>`. Review overwrite
prompts: some primitives have application-specific variants or portal support.
Buttons default to `type="button"`; forms use an explicit submit type.

## Verification

```sh
bun run lint
bun run build
bun test
bun run test:e2e
```

Read `docs/browser-assertions.md` before changing browser coverage and
`docs/export-testing.md` before touching printable content. The optional
`bun run test:exports` comparison requires LibreOffice and Poppler.
