# Gravity Forms — reading the report

`text-field.md` is generated; this note is the human reading of it. Run again with `node reports/run.mjs gravity-forms`. Examples are the live form-template previews on gravityforms.com, rendered by Gravity Forms 3.1.2 (per the `ver=` of its assets) with its default Gravity theme.

## Results (Gravity Forms 3.1.2, text-field contract 0.3.1)

- **Every outcome rule and every technique rule passes** in all 6 examples. Labels use `for`, descriptions are referenced by `aria-describedby`, controls are native inputs.
- **axe reports 3 colour-contrast violations** (the site's theme, not the form markup).
- **The error state, checked by hand, is exemplary.** After submitting the contact form empty (server-side validation), measured in Chromium:
  - Each invalid control has `aria-invalid="true"`, and its accessible description starts with the error, for example "This field is required. Please let us know what's on your mind." (error first, then the hint).
  - Compound fields (Name: First / Last; Email / Confirm Email) put one error on the `fieldset`, and both sub-inputs reference it with `aria-describedby`.
  - A summary at the top lists each error as a link to its field.

## Test notes

- **The error state is in the generated tables** ("contact-form, submitted empty"). `run.mjs` now takes a `wait:` selector, so the check runs after Gravity Forms' AJAX re-render. Every outcome and technique rule passes.
- **It exposed one contract false positive: TF-10** on the sub-inputs of compound fields (First, Last). Gravity Forms places the error on the parent `fieldset`, outside each sub-input, although the error reaches each input's description. Fixed in text-field contract 0.3.2 (below).
- The honeypot field (`.gfield--type-honeypot`, hidden with `display: none`) is excluded from the binding.

## What this means for the contract

TF-10 was an outcome rule written as a structure check: an error part had to exist inside the root. Since contract 0.3.2 it also accepts an error part the invalid control references through `aria-describedby` or `aria-errormessage`, so a group-level error passes and a field that is only flagged still fails. Longer term, compound fields belong to a fieldset/group contract.
