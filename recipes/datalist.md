---
title: Datalist
description: Offer typing suggestions on a text field with a native datalist, and know what you can and can't style.
order: 11
features: [datalist]
---

Give a text field a list of suggestions while the user can still type anything.

{/* demo */}

## Recipe

Style the input like any text field. The suggestion list itself is drawn by the browser and can't be styled.

```css
.field input[list] {
  inline-size: 100%;
  min-block-size: 2.75em;
  padding: 0.5em 0.75em;
  font: inherit;
  color: inherit;
  background: Canvas;
  border: 1px solid color-mix(in oklab, CanvasText 40%, Canvas);
  border-radius: 0.375em;
}
/* Chromium draws a dropdown indicator inside the field (this pseudo-element is Chromium-only). */
.field input[list]::-webkit-calendar-picker-indicator { opacity: 0.6; }
```

## Quirks

- **An input with `list` is a combobox, not a textbox.** Its accessibility role changes. Checked in all three engines. Tests or scripts that look for role textbox won't find it.
- **Only Chromium draws an indicator** inside the field; `::-webkit-calendar-picker-indicator` exists only there. Checked in all three engines.
- **The popup can't be styled.** There's no pseudo-element for the suggestion list; it follows the browser and the operating system.
- **Web-features lists datalist as not yet Baseline,** because support has gaps. Treat suggestions as a convenience: the field must work without them.

## Accessibility traps

- **Suggestions are not validation.** The user can submit any value, so validate on the server like any text field.
- **Don't use datalist as a select replacement** when only the listed values are allowed. Use a [select](/recipes/select) instead.
- **Keep a visible label and a description** that says suggestions appear; the popup alone doesn't explain itself.

## In Grounded UI

The [text field](/components/text-field) accepts a `list` attribute; its role rule (TF-21) skips fields with suggestions, since they are correctly comboboxes.
