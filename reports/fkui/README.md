# Försäkringskassan FKUI — reading the report

`text-field.md` and `dialog.md` are generated; this note is the human reading of them. Run again with `node reports/run.mjs fkui`. Examples are FKUI's live documentation pages, rendered by Vue in Chromium: text fields as shown, one email field put into its error state, and the two modals opened.

## Results (FKUI 6.59.0)

### Text field

- **axe reports nothing** on any example.
- **The textarea's character counter is a second, empty `<label>`** with `aria-live`. Measured in Chromium: the field's accessible name is "Berätta om dig själv En inte allt för utförlig berättelse (max 100 tecken)", and near the limit it grows to "… Antal tecken kvar: 5". So the name changes while the user types, and every name also carries the description and format hint. axe doesn't flag it; TF-04 and TF-06 do. Not a clear WCAG failure, but an unusual use of `<label>` worth raising with FKUI.
- **No `name` on the controls** (TF-08): these are Vue demos bound in script, so not a real finding.

### Dialog (FModal, FConfirmModal)

- **No accessible name** (DG-05, normative). The dialog is `div role="dialog" aria-modal="true"` with no `aria-labelledby` or `aria-label`, although it has a visible title. axe agrees (`aria-dialog-name`). A screen reader announces an unnamed dialog. This is the clearest real finding, and a one-attribute fix.
- **Keyboard works:** Tab stays inside the dialog (a script focus trap), Esc closes it, focus returns to the opener.
- **The page behind isn't inert:** only `aria-modal` marks it, and script focus can still reach links behind the dialog. How screen readers treat that varies.
- **The confirm modal uses `role="dialog"`**; the ARIA Authoring Practices suggest `alertdialog` for confirmations.

## What we learned about the contract

FKUI builds things differently from Grounded UI's reference markup, and much of it is **valid**:

- **Description and error message inside the label**, so they become part of the accessible name. TF-09 and TF-11 expect `aria-describedby` and fail.
- **A scripted `div role="dialog"`** instead of native `<dialog>`: DG-01, DG-02, DG-07, DG-09 and DG-12 fail because they describe Grounded UI's technique, not an accessibility requirement.
- **Two rules overclaimed.** TF-04 marks "exactly one label" normative; WCAG requires a label, not exactly one. DG-11 flagged `role="dialog"` on a div as an override; fixed in dialog contract 0.2.1 to apply only to native `<dialog>`.

So the contract mixes two kinds of rule: *outcomes* (the dialog has a name, the error is announced) and *techniques* (native dialog, `aria-describedby`). For testing other implementations, rules should check outcomes, using the browser's computed accessible name and description. Technique rules stay useful as recommendations for Grounded UI's own markup.
