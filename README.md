# grund-ui

Native HTML components for existing CMS sites. One CSS link plus copied markup should work in an HTML block in any CMS, without a single change to the site's own CSS.

## Structure

| Path | Contents |
| --- | --- |
| `components/<slug>/contract.yaml` | The contract. The source everything else is derived from |
| `components/<slug>/markup/` | Canonical HTML per state. `broken/` holds one rule violation per file |
| `components/<slug>/styles/` | Reference CSS |
| `components/<slug>/tests/` | Contract tests |
| `core/` | Tokens and core CSS |
| `schema/` | JSON Schema for contract files |
| `generator/` | Contract in, template file out |
| `docs/` | The Blume docs site |

## Commands

```sh
pnpm install
pnpm check               # validate + lint:css + check-deps + budget
pnpm --filter docs dev   # docs, generated from the contracts
```

Before the first publish: run `npm view grund-ui` to confirm the name is free.

MIT © Henrik Larsson
