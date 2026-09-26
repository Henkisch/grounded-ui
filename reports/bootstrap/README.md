# Bootstrap 5 — reading the report

`text-field.md` and `dialog.md` are generated; this note is the human reading of them. Run again with `node reports/run.mjs bootstrap`. Examples are Bootstrap's live documentation pages (forms overview, form control, floating labels, input group, layout, validation, modal), rendered in Chromium. The custom-styles validation form is submitted empty to show its errors, and four modals are opened.

## Results (Bootstrap 5.3.8)

### Text field (101 fields on 7 pages)

- **axe reports nothing** on any field.
- **Validation errors never reach screen readers** (TF-20, normative, 5 fields). In the *custom styles* example (after submit) and the *browser defaults* textarea, the red `.invalid-feedback` text ("Please provide a valid city.") is shown but not referenced by `aria-describedby`. The field is exposed as invalid (native `:invalid`), so a screen reader says "invalid entry", but never why. Verified by hand: `aria-describedby` is absent or points only at the input-group prefix. Bootstrap's own *server-side* example does associate the message, and passes. This is the clearest real finding: fixable with one attribute, and axe is silent.
- **The placeholder is the only visible label** (TF-15, normative, 12 fields on the form control, input group and layout pages). Each input has an `aria-label` matching its placeholder, so it has a name (TF-17 passes), but sighted users lose the label as soon as they type. These are docs demonstrations of sizing and grids, but they are exactly the markup people copy. axe is silent.
- **A datalist input fails TF-21** (role `combobox`, not textbox). That was a contract false positive (an `<input list>` is correctly a combobox per HTML-AAM), fixed in text-field contract 0.3.1: TF-21 no longer checks controls with a suggestion list.

### Dialog (4 modals)

- **Every outcome rule passes.** Bootstrap's script adds `role="dialog"` and `aria-modal` on open; the name comes from `aria-labelledby` on the title; every modal has buttons.
- axe flags `scrollable-region-focusable` in the scrollable modal (the body scrolls but can't be reached by keyboard). No contract rule covers scroll regions.

## Technique differences (not failures)

- **No field wrapper class.** A field is whatever `div` holds the control (`.mb-3`, `.col-*`, `.form-floating`, a horizontal `.row`); the binding finds it structurally. Grid rows sometimes hold several controls (TF-02).
- **No `name` on demo inputs** (TF-08): docs demos, not a real finding.
- **Error id after the prefix id** in `aria-describedby` (TF-11) in the server-side input group.
- **`div.modal` with `tabindex="-1"`**, opened by script, instead of native `<dialog>` and invoker commands (DG-01, DG-07, DG-09, DG-12).
- **Feedback is always in the DOM**; the binding counts it as the error part only when Bootstrap shows it (`.is-invalid ~ .invalid-feedback`, `.was-validated :invalid ~ …`).

## What we learned about the contract

- **TF-21 allowed only textbox and searchbox.** Fixed in 0.3.1; a text field with suggestions is still a text field.
- **TF-15's rationale overstates the spec.** HTML says the placeholder attribute "should not be used as an alternative to a label", not "must not". The finding stands (3.3.2 needs a visible label), but the rationale should quote the spec accurately.
- **Invalid state from native constraint validation counts.** Bootstrap relies on `:invalid` instead of `aria-invalid`, and the contract still caught the missing association because it checks the shown error, not the attribute.
