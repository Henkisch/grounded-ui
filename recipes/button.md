---
title: Button
description: Reset the browser's button styles so a button looks like your design, without losing what makes it a button.
order: 32
features: [button, focus-visible, forced-colors]
---

A real `<button>` is focusable, fires on Enter and Space, and announces itself. Reset its look, never its element.

{/* demo */}

## Recipe

```css
button {
  font: inherit;          /* buttons don't inherit font family or size */
  line-height: 1.2;
  min-block-size: 2.75em; /* 44px touch target at 16px text */
  padding: 0.5em 1em;
  border: 1px solid transparent; /* keeps a border in forced colours */
  border-radius: 0.375em;
  background: CanvasText;
  color: Canvas;
  cursor: pointer;
}

button:hover { background: color-mix(in oklab, CanvasText 85%, Canvas); }
button:active { translate: 0 1px; }
button:focus-visible { outline: 2px solid CanvasText; outline-offset: 2px; }

/* Disabled: not focusable, not announced as available */
button:disabled { opacity: 0.5; cursor: not-allowed; }

/* aria-disabled: still focusable, so it can explain why */
button[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; }
```

## Quirks

- **Buttons don't inherit the page font.** With the page set to 16px Georgia, an unstyled button used Arial at 13.33px in Chromium, `-apple-system` at 13.33px in Firefox and `system-ui` at 11px in WebKit. `font: inherit` fixes all three. Checked in all three engines.
- **`disabled` removes the button from the tab order; `aria-disabled="true"` doesn't.** Calling `focus()` on a disabled button does nothing, on an `aria-disabled` one it works. Checked in all three engines. An `aria-disabled` button still fires clicks, so the handler (or the form) must ignore them.
- **Safari doesn't Tab to buttons by default.** In WebKit, Tab skips buttons unless the user turns on "Press Tab to highlight each item" (or uses Option + Tab). That is Safari's behaviour on every site, not your bug.
- **A mouse click doesn't trigger `:focus-visible`.** In all three engines, clicking a button gave no `:focus-visible` match, so a focus ring on `:focus-visible` shows for keyboard users only. Checked in all three engines.
- **A transparent border matters.** In forced-colours mode backgrounds are replaced; a `1px solid transparent` border becomes visible and keeps the button's edge.

## Accessibility traps

- A `div` or `a` styled as a button needs a role, a tab stop and key handling to catch up. Use `<button>`.
- Inside a form, a button without `type` submits. Set `type="button"` for anything that isn't the submit action.
- Prefer `aria-disabled` plus an explanation over a silent `disabled` when users need to know why they can't continue.
- Icon-only buttons need an accessible name: visible text, `aria-label`, or visually hidden text.

## In Grounded UI

Grounded UI doesn't style buttons yet; the [dialog](/components/dialog) and [toggletip](/components/toggletip) use the site's own. A button contract is on the [component list](/components).
