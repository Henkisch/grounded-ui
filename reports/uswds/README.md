# USWDS — reading the report

`text-field.md` and `dialog.md` are generated; this note is the human reading of them. Run again with `node reports/run.mjs uswds`.

- **Text fields** come from the example templates USWDS ships in `@uswds/uswds` (`packages/*/src`), the same templates its docs render. `build-fixtures.mjs` renders them into `fixtures.json`: Twig tags stripped (the default, enabled state), and each label + control without a `.usa-form-group` wrapped in a neutral `div.report-field`, because USWDS only wraps fields in the error state and the contract needs one element per field. The wrapper adds no semantics.
- **Modals** are the three live examples on designsystem.digital.gov, opened in Chromium.

## Results (USWDS 3.14.0)

### Text field (16 fields in 5 templates: input showcase, character count, prefix, suffix, memorable date)

- **Every outcome rule passes**, and axe reports nothing. Names come from `<label for>`, hints and error messages are referenced by `aria-describedby`, and the error message comes first.
- **The error state in the prefix example is visual only.** "Credit card number (Error)" has a red `.usa-input-group--error` border and the word "(Error)" in its label, but no message and no `aria-invalid`. The contract doesn't flag it, because it recognises the invalid state only through `aria-invalid` or a shown error part (see below).

### Dialog (3 modals: default, large, forced action)

- **Every outcome rule passes**, and axe reports nothing. USWDS's script moves the modal into a `.usa-modal-wrapper` with `role="dialog"`, `aria-modal`, `aria-labelledby` and `aria-describedby`.

## Technique differences (not failures)

- **No `name` on the prefix and suffix inputs** (TF-08): templates, not a real finding.
- **Scripted `div role="dialog"`** opened by links with `role="button"`, instead of native `<dialog>` and invoker commands (DG-01, DG-07, DG-09).

## What we learned about the contract

- **Like GOV.UK, USWDS passes everything.** Well-tested government design systems are the wrong place to look for issues axe misses.
- **The contract can't see an invalid state that is only visual.** A field styled as an error, with no message and no `aria-invalid`, passes every rule. That is a real 1.4.1 / 3.3.1 failure on sites; catching it needs a rule keyed to the implementation's error styling (a binding part such as `invalid-state`), not to ARIA.
- **Fields without a wrapper are common.** USWDS (and many CMS forms) put label, hint and input as siblings. The binding format needs a way to group siblings into a field without editing the markup.
