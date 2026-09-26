# WPForms — reading the report

`text-field.md` is generated; this note is the human reading of it. Run again with `node reports/run.mjs wpforms`. Examples are the live template previews on wpforms.com, rendered by the WPForms plugin itself (2.0.3, per the `ver=` of its assets): six templates as shown, and the contact form with an invalid email.

## Results (WPForms 2.0.3, text-field contract 0.3.1)

- **Every outcome rule passes** in all 7 examples. axe reports nothing either.
- **The error state is well built.** On blur, an invalid email gets `aria-invalid="true"`, an `<em role="alert">` error message, and `aria-describedby` pointing at it (plus `aria-errormessage` from the start). Measured: the field's accessible description is "Please enter a valid email address."
- **Name fields are a `fieldset` with a `legend`** ("Name") and two sub-fields labelled "First" and "Last". Each sub-field was tested as its own text field and passes.
- **One technique difference: TF-16**, in the 3 templates with a phone field. The smart phone field (intl-tel-input) sets `aria-label="Phone"` next to a `<label>Phone</label>`. The texts match, so it is harmless today; it only drifts if an editor renames the label.

## Test notes

- **Anti-spam honeypot fields are excluded from the binding.** WPForms adds hidden text inputs (`aria-hidden="true"`, `tabindex="-1"`, `visibility: hidden`) that no user sees. They are not text fields in any meaningful sense.
- **The error state is reached by blur, not submit.** On submit, wpforms.com opens its own marketing `<dialog>` ("Congrats, You Completed the First Step!") as a modal, which makes the whole form inert: every field then correctly has no accessible name. That is the demo site, not the plugin, so the example validates on blur instead, which triggers the same client-side validation.
- The intl-tel-input country search box inside the phone field's dropdown is excluded from the control part (`.iti__search-input`); it belongs to the country picker, not the text field.

## What this means

WPForms, the most-installed form plugin in the list, passes every outcome rule in its own templates. The one gap the contract can't see yet is the country picker itself: a `role="dialog"` popup inside a text field is a combobox/listbox problem for a future contract.
