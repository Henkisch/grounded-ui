# Drupal core — reading the report

`text-field.md` and `dialog.md` are generated; this note is the human reading of them. Run again with `node reports/run.mjs drupal` once the three sandboxes below are serving.

## What was tested

Drupal core **11.4.7**, installed locally from the drupal.org tarball (standard profile, SQLite, `php -S` with `.ht.router.php`). No contrib modules, no custom theme: the markup is exactly what core renders. Three sandboxes with the same content:

| Port | Setup |
| --- | --- |
| 8899 | Core defaults: Olivero front end, Claro admin, **no** Inline Form Errors |
| 8898 | Inline Form Errors enabled, Claro admin |
| 8897 | Inline Form Errors enabled, Olivero as the admin theme (to see Olivero's error markup) |

`sandbox/` holds the setup scripts (enable contact and search, add a feedback form, turn on Inline Form Errors). The admin pages are opened to anonymous users **in the sandbox only**, because the runner can't log in.

Examples: the Olivero contact, login and register forms (with the header search), Claro's site information and account settings pages, server-side error states on a front page path that passes HTML5 validation but fails Drupal's check, and three Claro dialogs (Place block, and two Views UI dialogs). Password fields are left out of the text-field binding: they have no ARIA role, so the contract's role rule (TF-21) doesn't apply to them.

## Results

### Text field — 2 outcome rules fail, axe silent on both

- **Error messages never reach the field (TF-20, normative), even with Inline Form Errors.** With the module on, the message is printed under the field (`.form-item__error-message` in Claro, `.form-item--error-message` in Olivero), but it has no `id` and the input's `aria-describedby` still points only at the description. Measured in Chromium: the invalid field's accessible description is "Specify a relative URL to display as the front page." A screen reader announces "invalid entry" and the hint, never the error. axe reports nothing. The fix is small: give the message an id and put it first in `aria-describedby` (TF-11).
- **Without Inline Form Errors, an invalid field has no error message at all (TF-10, normative).** Core's default sets `aria-invalid="true"` on the input and a red label, but the text ("Either the path '/nonexistent-page' is invalid…") only appears in the page-top message list. That list is `role="alert"` and names the problem, so WCAG 3.3.1 is arguably met, but nothing ties the message to the field: a user who tabs to it hears "invalid entry" with no reason. Inline Form Errors is not enabled by the standard profile, so this is what most Drupal sites ship.
- **Everything else passes** in 10 examples, 63 fields: every field is named from its `<label>`, descriptions reach the accessible description through `aria-describedby`, roles are textbox or searchbox. Core's form markup is solid until something goes wrong.

Technique differences, not failures: Claro's Place block filter has a visually hidden `<label>` without `for` and an input without `id` or `name` (TF-07, TF-08). Its name comes from the `title` attribute; axe flags it (`label-title-only`).

Also noticed, no rule covers it: Claro's required marker is a CSS `::after` "*", so the computed name is "Default front page \*" and screen readers read "star".

### Dialog — every outcome rule passes

- Drupal's Dialog API is a jQuery UI `div role="dialog" aria-modal="true"`, named by `aria-labelledby` pointing at the title. Name, role and a close button: all pass.
- **The whole dialog content is its description.** `aria-describedby` points at `.ui-dialog-content`, so opening Place block announces "Filter Enter a part of the block name to filter by. Block Category Operations Announcements Feed…" — the entire table. No contract rule catches this yet.
- Technique differences (DG-01, 02, 07, 09, 12): a scripted div, not a native `<dialog>`, opened by a link.

## What we learned about the contract

- **TF-20 finds the headline issue and axe doesn't.** This is exactly the kind of component-level finding the contracts exist for: it affects every Drupal form with a server-side error, with or without Inline Form Errors.
- **Candidate new dialog rule:** the accessible description, when set, should be short (the body text), not the whole content. Worth a recommended outcome rule after review.
- **Candidate text-field note:** a required marker that ends up in the accessible name. Label-in-name (TF-18) still passes because it compares words, so it's not a failure, just noise for screen reader users.
