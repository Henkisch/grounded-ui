# Contact Form 7 — reading the report

`text-field.md` is generated; this note is the human reading of it. Re-capture with `node reports/wordpress-core/capture.mjs`, then run `node reports/run.mjs contact-form-7`.

Contact Form 7's own site (contactform7.com) sits behind a Cloudflare bot challenge, so its live forms couldn't be tested. Instead, CF7 6.1.7 was installed in a real WordPress 7.1.2 in [WordPress Playground](https://playground.wordpress.net/), and its default "Contact form 1" was captured three ways: untouched, submitted empty, and submitted with an invalid email. Validation ran through CF7's own REST endpoint and script.

## Results (Contact Form 7 6.1.7)

- **Every outcome rule passes**, and axe reports nothing. Measured in Chromium's accessibility tree after a failed submit: the name field is named "Your name", described by "Please fill out this field.", with `aria-invalid="true"`.
- **How CF7 announces errors:** the visible tip beside each field is `aria-hidden`. The same text is repeated in a visually hidden list (`.screen-reader-response`) above the form, and `aria-describedby` points at it, plus a polite live region with the summary. It works, but screen reader and sighted users read two different copies of the error.
- **Technique differences:** the label wraps the control, with no `for`/`id` (TF-07). The error id isn't first in `aria-describedby` because the visible tip has no id at all (TF-11). Neither is an accessibility failure.

## What we learned about the contract

CF7 exposed two bugs in how the runner measures names, and they cancel each other out here:

- **The engine counts `aria-hidden` text in the accessible name.** It computes names with `includeHidden: true` (needed for closed dialogs), which also pulls in `aria-hidden` subtrees. The engine gets "Your name Please fill out this field."; Chromium gets "Your name". Outcome rules can therefore pass markup whose real name is wrong.
- **TF-18 reads the label's `textContent`**, which includes the `aria-hidden` error tip CF7 puts inside the label. Fix the engine alone and TF-18 would fail CF7 as a false positive, since "Your name" doesn't contain "Your name Please fill out this field."

Both are fixed in the engine: hidden content counts only for elements that aren't rendered and for hidden idref targets, and TF-18 compares against the label's visible text (without `aria-hidden` descendants or nested controls). A regression test in `conformance/test/engine.spec.mjs` uses this CF7 markup. The results above are from the fixed engine.
