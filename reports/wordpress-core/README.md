# WordPress core — reading the report

`text-field.md` and `dialog.md` are generated; this note is the human reading of them. Run again with `node reports/wordpress-core/capture.mjs` (re-captures the Playground markup), then `node reports/run.mjs wordpress-core`.

WordPress core has no general form block, so the report tests what core itself renders for visitors: the comment form (`comment_form()`), the Search block (visible label, hidden label, no button), the post password form and the log-in screen, including its server-rendered error. The wordpress.org theme previews close comments, so these were captured from a real WordPress 7.1.2 running in [WordPress Playground](https://playground.wordpress.net/), logged out, with the Twenty Twenty-Five theme (`capture.mjs` → `fixtures.json`). Two live previews on wp-themes.com (WordPress 7.2-alpha) add the Search block and Twenty Twenty's search form.

Dialogs: the core Navigation block's overlay menu (opened at 390px), and the search and menu modals of Twenty Twenty, a default theme bundled with core until 2023.

## Results (WordPress 7.1.2)

### Text field

- **Every rule passes, outcome and technique**, across 7 examples; axe reports nothing. Core uses `label for`, unique ids, `autocomplete`, and `aria-describedby="email-notes"` for the email hint. The log-in inputs point `aria-describedby` at the error box after a failed log-in.
- **Errors are server-side.** Submitting an empty comment ends on a separate `wp_die()` page ("Error: Please type your comment text"), not an inline field error, so the comment form's error state can't be tested in place. The log-in error is a form-level box (`#login_error`), referenced by both inputs, not a field error.

### Dialog

- **Twenty Twenty's menu modal has no dialog role or name** (DG-14, normative). When open it covers the page, moves focus in, keeps Tab inside and closes on Esc, so it behaves as a modal dialog. But it is a plain `div`: no `role="dialog"`, no `aria-modal`, no name. Measured in Chromium's accessibility tree: no dialog node. A screen reader user isn't told they're in a dialog. **axe reports nothing.** The same theme's search modal gets it right (`role="dialog" aria-modal="true" aria-label="Search"`), so the fix is to copy those three attributes. Real and fixable, in a theme that still ships with many WordPress sites.
- **The Navigation block overlay passes every outcome rule**: `role="dialog"`, `aria-modal`, name "Menu", a close button. axe flags one unrelated issue inside it (a Page List `ul` nested directly in the navigation `ul`).
- Technique rules DG-01, DG-02, DG-03, DG-07 and DG-09 differ as expected: scripted `div role="dialog"`s without a visible title or invoker commands.

## What we learned about the contract

- **Core's form markup is the textbook technique.** The one real finding is in a dialog built by a theme, not in core's forms.
- **Server-rendered error states need a submit step.** `reports/run.mjs` can fill and click, but a full page navigation after submit, as on wp-login.php, needed the capture script.
