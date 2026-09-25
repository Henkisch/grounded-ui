# grund-ui

Nativa HTML-komponenter för befintliga CMS-sajter. En CSS-länk plus kopierad markup ska fungera i en HTML-ruta i vilket CMS som helst, utan en enda ändring i sajtens egen CSS.

## Struktur

| Sökväg | Innehåll |
| --- | --- |
| `components/<slug>/contract.yaml` | Kontraktet. Sanningen som allt annat härleds ur |
| `components/<slug>/markup/` | Kanonisk HTML per tillstånd. `broken/` bryter mot en regel var |
| `components/<slug>/styles/` | Referens-CSS |
| `components/<slug>/tests/` | Kontraktstester |
| `core/` | Tokens och kärn-CSS |
| `schema/` | JSON Schema för kontraktsfiler |
| `generator/` | Kontraktsfil in, mallfil ut |
| `docs/` | Blume-sajten |

## Kommandon

```sh
pnpm install
pnpm check               # validate + lint:css + check-deps + budget
pnpm --filter docs dev   # docs, genereras ur kontrakten
```

Innan första publicering: `npm view grund-ui` för att bekräfta att namnet är ledigt.

MIT © Henrik Larsson
