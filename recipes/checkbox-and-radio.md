---
title: Checkbox and radio
description: Tint the native controls with one line, or draw your own box without losing keyboard, state or forced-colours support.
order: 30
features: [input-checkbox, input-radio, accent-color, appearance, indeterminate, forced-colors]
---

Keep the native `input`: it brings the role, the checked and mixed states, Space to toggle and arrow keys between radios, for free.

{/* demo */}

## Recipe

Start with `accent-color`. It tints the native control, keeps its size and states, and adapts to the platform:

```css
input:is([type="checkbox"], [type="radio"]) {
  accent-color: var(--brand, CanvasText);
  inline-size: 1.25em;
  block-size: 1.25em;
  font: inherit; /* form controls don't inherit font-size, so 1em would be ~13px */
}
```

Draw your own only when the design needs it. `appearance: none` removes the native look but keeps the element, so every state still works:

```css
.custom {
  appearance: none;
  font: inherit;
  inline-size: 1.25em;
  block-size: 1.25em;
  margin: 0;
  display: inline-grid;
  place-content: center;
  border: 2px solid color-mix(in oklab, CanvasText 60%, Canvas); /* ≥ 3:1 */
  border-radius: 0.25em;
  background: Canvas;
}
.custom[type="radio"] { border-radius: 50%; }

/* The mark: a pseudo-element on the input itself */
.custom::before {
  content: "";
  inline-size: 0.625em;
  block-size: 0.625em;
  scale: 0;
  background: CanvasText;
  clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%); /* tick */
}
.custom[type="radio"]::before { clip-path: circle(50%); }
.custom:checked::before { scale: 1; }
.custom:indeterminate::before { scale: 1; clip-path: inset(40% 0); } /* a bar */

.custom:focus-visible { outline: 2px solid CanvasText; outline-offset: 2px; }
.custom:disabled { opacity: 0.5; cursor: not-allowed; }

/* Forced colours replace backgrounds: draw the mark with a system colour */
@media (forced-colors: active) {
  .custom::before { background: CanvasText; }
  .custom:checked { border-color: Highlight; }
}
```

## Quirks

- **Form controls don't inherit font size.** An unstyled checkbox computes its own font size (13.33px in Chromium and Firefox, 11px in WebKit), so `1em` on it is not your text size. Set `font: inherit` first. Checked in all three engines.
- **`::before` works on an `appearance: none` checkbox** in all three engines, so no extra `span` is needed. It does not work on a checkbox that still has its native appearance.
- **`indeterminate` is a property, not an attribute.** It can only be set from script (`input.indeterminate = true`) and shows as `:indeterminate`. Checked in all three engines.
- **Forced colours overwrite backgrounds.** In Chromium's forced-colours emulation, a green custom box became white with a black border. A mark drawn only with `background` can disappear; use a system colour inside the forced-colours query.

## Accessibility traps

- Hiding the input (`display: none`, `opacity: 0` on a label trick) and drawing a fake box on a `span` breaks keyboard focus, state announcements or both. Style the input itself.
- A radio group needs a `fieldset` and `legend`, or the group has no name. See [Fieldset and legend](/recipes/fieldset-and-legend).
- The box border must reach 3:1 against the background (WCAG 1.4.11). Light grey hairlines usually don't.
- Keep the whole label clickable: wrap the input in the `label` or use `for`.

## In Grounded UI

Checkbox and radio groups are next on the [component list](/components). Until then, the [text field](/components/text-field) shows the same label, description and error model the groups will use.
