---
title: File inputs
description: Style the file input's button with ::file-selector-button and turn the input's own box into a visible drop zone, with no JavaScript and no hidden inputs.
order: 22
features: [file-selector-button]
---

The file input used to be the classic "hide it and fake it" control. Today the button part has its own pseudo-element, so the real input can stay in place.

{/* demo */}

## Recipe

- **Style the button with `::file-selector-button`.** Font, padding, colours, border and radius all work, in every current browser.
- **Style the input's box as the drop zone.** Padding, a dashed border and a tinted background make the whole box a clear target. Browsers accept files dropped onto the input itself; this recipe just makes that box big and visible.
- **Set `box-sizing: border-box`** before giving it `inline-size: 100%` and generous padding, or it overflows its container.
- **Link the hint with `aria-describedby`,** so accepted types and size limits are read with the field.

## Quirks

- **The button and status texts are the browser's and can't be changed with CSS.** Observed: Chromium "Choose File" / "No file chosen", Firefox "Browse…" / "No file selected.", Safari (WebKit) "Choose File" / "no file selected". They also follow the browser's language, not the page's. Checked in all three engines.
- **`::file-selector-button` works in all three engines;** the older `::-webkit-file-upload-button` exists in Chromium and Safari only, so you no longer need it. Checked in all three engines.
- **The input's width differs** by browser (about 333 px in Chromium and Safari, 310 px in Firefox at 16 px text), because the status text differs. Set an explicit width. Checked in all three engines.
- **There's no CSS selector for "a file is being dragged over".** Highlighting the zone during a drag needs JavaScript drag events, so make the resting style clearly droppable.
- **Dropping files onto the box** can't be exercised in automated tests; the behaviour above is the browsers' default, not measured here.

## Accessibility traps

- **Never hide the input with `display: none` or `visibility: hidden`** and click it from a styled label: keyboard users lose it, and some screen readers announce nothing useful. With `::file-selector-button` there's no reason to.
- **Keep a visible `<label>`.** The button text ("Choose File") says nothing about what to upload.
- **State limits before the upload,** not only in an error afterwards (WCAG 3.3.2).
- **Keep the focus ring** on the input; it wraps the whole drop zone.

## In Grounded UI

There's no file upload component yet; it's on the component list. The field model will match the [text field](/components/text-field): label, description, control and error.
