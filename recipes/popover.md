---
title: Popover
description: Style native popovers, place them next to their button with anchor positioning, and fall back gracefully where that isn't supported.
order: 14
features: [popover, invoker-commands, anchor-positioning, starting-style, transition-behavior]
---

Show a small panel next to a button, with light dismiss and Esc for free, and no positioning script.

{/* demo */}

## Recipe

```css
.tip {
  /* Fallback: the browser centres a popover in the viewport (fixed, inset 0, margin auto). */
  max-inline-size: min(100vw - 2em, 20em);
  padding: 0.75em 1em;
  color: CanvasText;
  background: Canvas;
  border: 1px solid color-mix(in oklab, CanvasText 14%, Canvas);
  border-radius: 0.5em;
  box-shadow: 0 0.75em 1.5em -0.5em oklch(0% 0 0 / 0.25);

  opacity: 0;
  translate: 0 -0.25em;
  transition: opacity 150ms, translate 150ms, overlay 150ms allow-discrete, display 150ms allow-discrete;
}
.tip:popover-open {
  opacity: 1;
  translate: 0 0;
  @starting-style { opacity: 0; translate: 0 -0.25em; }
}

/* Next to the button, where anchor positioning is supported. A popover opened by a
   button is implicitly anchored to it, so no anchor-name is needed. */
@supports (position-anchor: auto) {
  .tip {
    inset: auto;
    margin: 0.5em 0 0;
    position-area: block-end span-inline-end;
    position-try-fallbacks: flip-block, flip-inline;   /* stay inside the viewport */
  }
}

@media (prefers-reduced-motion: reduce) { .tip { transition-duration: 0s; } }
```

```html
<button type="button" commandfor="tip-1" command="toggle-popover" aria-label="About the organisation number">i</button>
<div id="tip-1" popover class="tip">Ten digits, found on the registration certificate.</div>
```

## Quirks

- **Without anchor positioning a popover is centred in the viewport:** the browser gives it `position: fixed`, `inset: 0` and `margin: auto`. Checked in all three engines. That fallback is readable on phones, so keep it rather than faking a position.
- **Reset `inset` and `margin`** before positioning it yourself, or the defaults fight your placement.
- **Never set `display` on a popover.** It overrides the hidden state and shows a closed popover. Checked in all three engines.
- **The exit animation needs `overlay` and `display`** in the transition with `allow-discrete`, like a dialog.
- **Web-features lists anchor positioning as not yet Baseline,** so the fallback above is what many users see. Check the table below.

## Accessibility traps

- **The trigger must be a real button** with a name that says what it reveals. "i" or "Info" alone tells a screen reader user nothing.
- **Popovers aren't modal.** Don't put a form that must be completed in one; use a [dialog](/recipes/dialog).
- **Keep essential information outside it.** A popover hides by default and closes on any outside click.
- **Put the popover right after its button in the DOM,** so keyboard and screen reader order follows the visual order.

## In Grounded UI

The [toggletip component](/components/toggletip) is this recipe with a contract: 11 rules, including a name that isn't just "i".
