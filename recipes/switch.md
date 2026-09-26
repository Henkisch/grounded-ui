---
title: Switch
description: An on/off control built on a checkbox, using Safari's native switch where it exists and a styled checkbox everywhere else.
order: 31
features: [switch-control, input-checkbox, appearance, forced-colors]
---

A switch is a checkbox that takes effect immediately. Build it on `<input type="checkbox">` so the state, keyboard and form value keep working.

{/* demo */}

## Recipe

```html
<label class="switch">
  <input type="checkbox" role="switch" switch>
  Dark mode
</label>
```

- `switch` asks for the native switch where it exists (Safari). Other browsers ignore it. The styles below replace both looks with the same one.
- `role="switch"` makes assistive technology say "switch, on/off" everywhere. ARIA in HTML allows it on a checkbox.

Style the checkbox into a track and thumb. `appearance: none` gives every browser, Safari included, the same switch:

```css
.switch input {
  appearance: none;
  font: inherit;
  inline-size: 2.5em;
  block-size: 1.5em;
  margin: 0;
  border: 2px solid color-mix(in oklab, CanvasText 60%, Canvas); /* ≥ 3:1 */
  border-radius: 1em;
  background: Canvas;
  display: inline-grid;
  align-items: center;
  padding: 0.125em;
}
.switch input::before {          /* the thumb */
  content: "";
  inline-size: 1em;
  block-size: 1em;
  border-radius: 50%;
  background: color-mix(in oklab, CanvasText 60%, Canvas);
  transition: translate 150ms cubic-bezier(0.2, 0, 0, 1);
}
.switch input:checked { background: CanvasText; border-color: CanvasText; }
.switch input:checked::before { background: Canvas; translate: 1em 0; }
.switch input:focus-visible { outline: 2px solid CanvasText; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .switch input::before { transition: none; } }
```

## Quirks

- **Only WebKit knows the attribute.** `'switch' in HTMLInputElement.prototype` is true in WebKit and false in Chromium and Firefox, which render a plain checkbox. Checked in all three engines. The attribute is not in the HTML standard yet.
- **There is no clean CSS test for the native switch.** `CSS.supports('selector(::thumb)')` is false even in WebKit, so the recipe styles every browser the same way instead of trying to keep Safari's native look. Checked in all three engines.
- **`translate` on the thumb reads left to right.** In right-to-left pages, flip the direction with `:dir(rtl)`.

## Accessibility traps

- A switch acts immediately. If the change only applies after a Save button, use a checkbox, not a switch.
- The label names what is switched, never the state: "Dark mode", not "On".
- Don't show "On/Off" text only by colour. The thumb position plus the announced state carry it; add text if the meaning isn't obvious.
- Forced colours replace the track and thumb colours. Test in Windows High Contrast, or at least with Chromium's forced-colours emulation.

## In Grounded UI

A switch is on the [component list](/components) in the forms tier.
