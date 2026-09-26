# Elementor Pro — reading the report

`text-field.md` and `dialog.md` are generated; this note is the human reading of them. Run again with `node reports/run.mjs elementor`. Examples are Elementor's own kit-library preview sites (library.elementor.com): the Form widget on three kits' contact pages, and Popups on two kits. Those sites run **Elementor Pro 3.21.2** (per their asset URLs), not the latest release; elementor.com itself runs 4.2 but shows no form or popup to test.

## Results (Elementor Pro 3.21.2)

### Text field (Form widget)

- **Duplicate ids across forms on the same page (TF-13, normative), axe silent.** The contact pages carry two forms, the contact form and a newsletter form, and both generate the same field ids (`form-field-name`, `form-field-email`). Measured in Chromium on the Italian cuisine kit:
  - The contact form's first field is announced as **"First Name Email"**: both forms' `<label for="form-field-name">` attach to the first element with that id.
  - The newsletter's email field has **no label at all** (`labels.length` 0); its only name is the placeholder "Email", which disappears on input.
  - axe doesn't report it: WCAG 2.2 dropped 4.1.1 Parsing, and axe's label rules accept a placeholder as a name. A real, fixable bug: ids should be unique per form instance.
- **Labels are visually hidden by default.** Every label has `elementor-screen-only`, and the visible "label" is the placeholder ("First Name*"). The contract passes it (the label exists and names the field), and so does axe. See below.
- No description or per-field error parts: validation is the browser's native bubbles, or one form-level message after a server round trip.

### Dialog (Popups)

- **No accessible name (DG-05) and role `document` instead of `dialog` (DG-14)**, both normative, in both popups (a booking form and a navigation menu). The popup is `<div role="document" aria-modal="true" tabindex="0">`, so a screen reader doesn't announce a dialog when it opens. axe reports the same element (`aria-allowed-attr`: aria-modal isn't allowed on role document), so these aren't axe-silent, but axe names the attribute, not the missing dialog role and name.
- **Keyboard works:** focus moves to the close button and stays inside the popup (Tab cycles), Esc closes it. The page behind is not inert.
- **Technique differences:** a scripted div instead of `<dialog>` (DG-01, DG-07, DG-09), `tabindex` on the root (DG-12), and the menu popup has no heading (DG-03, DG-06).

## What this means for the contract

- **A gap: visible labels.** WCAG 3.3.2 wants labels or instructions users can see; a placeholder vanishes as soon as someone types. The contract only checks that a label exists (TF-06) and names the control (TF-17, TF-18), so a visually hidden label passes. Proposed outcome rule: *the label is visible* (not clipped, zero-size or off-screen), recommended level, since 3.3.2 can be met in other ways. It would flag every Elementor form with default settings, and axe can't know it.
- TF-13 earns its place: it is the only rule, here or in axe, that catches the duplicate-id bug, and the harm shows up in the computed names.
