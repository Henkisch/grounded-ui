# grounded-ui

**Back to the basics.** Accessible, fast and compatible UI components that still look and feel great — with the receipts to prove it.

- **Contracts**: an open, machine-readable rulebook per component. Every rule cites the standard or reasoning behind it.
- **Conformance runner**: tests rendered HTML from any library, theme or CMS against the contracts, next to axe.
- **Reference implementation**: native HTML and a few hundred bytes of CSS per component, zero JavaScript, passing its own contracts.

## Structure

| Path | Contents |
| --- | --- |
| `contracts/<slug>/contract.yaml` | The contract: anatomy, rules (with level, source, rationale), states, WCAG, editor texts |
| `contracts/<slug>/fixtures/valid/` | HTML that must pass every rule. Also the copyable markup in the docs |
| `contracts/<slug>/fixtures/broken/` | One file per rule, failing exactly that rule |
| `conformance/` | The runner: Node API, CLI (`grounded-conformance`) and its self-tests |
| `reference/` | The reference CSS: `core/`, then `<slug>.css` (base) and `<slug>.styled.css` (look) |
| `spec/` | JSON Schema for the contract format |
| `reports/<impl>/` | Contracts run against outside implementations: binding, generated results, human reading |
| `examples/` | Composed page fragments using the reference components |
| `docs/` | The Blume docs site, generated from all of the above |

## Commands

```sh
pnpm install
pnpm check                          # contracts, lint, dependencies, budgets
pnpm conformance                    # fixtures × runner in Chromium, Firefox and WebKit
pnpm exec grounded-conformance <url>   # test any page
pnpm report govuk-frontend          # rerun an outside-implementation report
pnpm --filter docs dev              # docs, generated from the contracts
```

The previous component-library version is tagged `v0-baseline`.

MIT © Henrik Larsson
