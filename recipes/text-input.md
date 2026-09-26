---
title: Text inputs and textarea
description: Give text, email, number, search and textarea fields one consistent look, and tame placeholders, spin buttons, autofill and error states.
order: 20
features: [placeholder, user-pseudos, field-sizing, input-number, search-input-type, autofill]
---

Text-like fields look alike until you meet their defaults: every browser picks its own placeholder colour, spin buttons, clear button and autofill background.

{/* demo */}

## Recipe

- **Set `font: inherit` and `color: inherit`.** Form controls don't inherit the page font by default.
- **Set the placeholder colour yourself, with `opacity: 1`.** Older Firefox versions dimmed placeholders with `opacity`; current Firefox uses a translucent colour instead. Setting both gives the same result everywhere.
- **Hide spin buttons in two ways.** `appearance: textfield` hides them in Firefox only. Chromium and Safari need `::-webkit-inner-spin-button` and `::-webkit-outer-spin-button` with `appearance: none`.
- **Use `:user-invalid`, not `:invalid`.** `:invalid` matches a required field before anyone has typed, so the form starts out red.
- **Paint over autofill with an inset `box-shadow`.** The browser forces its own background colour on autofilled fields, but not a shadow.
- **Let the textarea grow** with `field-sizing: content`, and keep a `min-block-size` for browsers without it.

## Quirks

- **Default placeholder colours differ.** Measured: Chromium `#757575`, Firefox black at 54 % alpha, Safari (WebKit) `#a9a9a9`. Safari's is about 2.3:1 on white, below the 4.5:1 text contrast. Checked in all three engines.
- **Spin buttons:** Chromium shows them on hover, Safari always. `appearance: textfield` removes them in Firefox but not in Chromium or Safari; the `-webkit-` pseudo-elements remove them there. Checked in all three engines.
- **The search clear button** (`::-webkit-search-cancel-button`) exists in Chromium and Safari only. Firefox has no clear button to style. Checked in all three engines.
- **`field-sizing: content`** is supported in all three current engines; see the table for how new that is.
- **Autofill can't be triggered in automated tests,** so the `:autofill` rule above is from the browsers' behaviour, not measured here.

## Accessibility traps

- **A placeholder is not a label.** It disappears when the user types. Keep a visible `<label>`.
- **`type="number"` is for quantities.** For card numbers, postcodes or IDs, use `type="text"` with `inputmode="numeric"`: number fields drop leading zeros and change value on scroll.
- **Keep the border at least 3:1** against the background (WCAG 1.4.11), and change colour, not border width, between states so nothing shifts.
- **Don't remove the focus ring.** Style it with `:focus-visible` instead.

## In Grounded UI

The [text field](/components/text-field) component applies this recipe to Grounded UI's markup, with the label, description and error wired up for screen readers.
