# Försäkringskassan FKUI — reading the report

`text-field.md` is generated; this note is the human reading of it. Run it again with `node reports/run.mjs fkui`. Examples are FKUI's live documentation pages, rendered by Vue in Chromium, plus one email field put into its error state.

## Result (FKUI 6.59.0, text-field contract 0.2.0)

- **axe reports nothing** on any example.
- **One pattern worth raising with FKUI:** the textarea has a second, empty `<label for>` with `aria-live`, used for the character counter. Once the user types, the counter text becomes part of the field's accessible name, so the name changes on every keystroke. axe doesn't flag it; TF-04 and TF-06 do. Whether it's a WCAG failure is debatable; that it's an unusual use of `<label>` isn't.
- **TF-08 (no `name`)** fails on all examples. These are Vue demos, where values are bound in script, so it's not a real finding.

## What we learned about the contract

FKUI does several things differently from grounded's reference markup, and they're **valid**:

- **Description inside the label** (`.label__description`), so it becomes part of the accessible name. TF-09 expects `aria-describedby` and fails.
- **Error message inside the label** (`.label__message--error`), which meets WCAG 3.3.1. TF-11 expects `aria-describedby` and fails.
- **TF-04 claims "exactly one label" as normative.** WCAG requires a label, not exactly one. Only "at least one" is normative; "exactly one" is our recommendation.

So several rules test *a technique* (how grounded does it) instead of *an outcome* (what users get). For a contract meant for any implementation, rules should check outcomes: does the control's computed accessible name contain the label text, is the error exposed in its name or description. Technique rules can stay as recommendations for grounded's own markup.
