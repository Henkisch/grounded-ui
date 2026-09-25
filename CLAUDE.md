# grund-ui

Native HTML components for existing CMS sites: one CSS link plus copied markup, no changes to the site's CSS.

## Source of truth

`components/<slug>/contract.yaml` is the single source. Tests, warning CSS, editor validation and the docs component pages are generated from it — edit the contract, then regenerate. Generated (gitignored): `docs/content/components/`, `docs/public/demo/`, `docs/public/grund/`, `dist/`.

Planning lives in Claude Docs (Swedish; read with the Claude Docs connector): build plan `65a6ee9b-694b-41e2-a69f-53067e55a59b`, strategy `74947edf-24ba-48e5-a8ef-fdbfdbc2e0da`, Spec: Text Field `ba612b1a-f3db-4314-92f1-3ea0f0b73b62`. The build plan's step order governs what gets built next.

## Conventions

- Everything in the repo is English: docs, contract prose, editor texts, warning messages, example markup (`lang="en"`).
- Size in `em` and `lh`. rem breaks on old themes that set `html { font-size: 62.5% }`.
- CSS layers: `@layer grund.core, grund.components, grund.warnings`; components use `grund.components.<slug>`; tokens are `--grund-*`.
- Component CSS uses donut scope, `@scope ([data-component="<slug>"]) to ([data-component])`, so it never styles a nested component (e.g. a text field inside a dialog).
- Slug is identical in folder name, `component:` and `data-component`.
- `pnpm check` enforces the code rules and budgets; run it before committing.

## Docs (Blume 2)

Blume is a local dependency of `docs/`; run its CLI as `pnpm --filter docs exec blume <command>` (`validate`, `audit`, `doctor`, …).

- Before changing anything in `docs/`, read `docs/node_modules/blume/skills/blume/SKILL.md`; full docs are bundled in `docs/node_modules/blume/docs/` and online at https://useblume.dev/docs.
- Use Blume's built-in components only (Tabs, Expandable, …). Custom docs code is limited to the contract generator `docs/scripts/sync-demos.mjs` and `docs/public/demo-frame.js` (fits demo iframes to content, mirrors Blume's theme and text colour into them).
- Demos are raw-HTML iframes with only grund CSS — this proves the component survives outside a framework. Blume's `<Component>` preview injects Tailwind preflight, so it stays unused.
- `dev`/`build` regenerate from contracts once at start; restart `dev` after editing a contract. Routes have no trailing slash (`/components/text-field`).
