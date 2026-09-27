---
title: Dialog
description: Style a native modal dialog and its backdrop, lock the page behind it, and animate it in and out without JavaScript.
order: 13
features: [dialog, backdrop, invoker-commands, starting-style, transition-behavior, dialog-closedby]
---

Give the native `<dialog>` a finished look: a surface, a dimmed page, and a short open and close animation.

{/* demo */}

## Recipe

```css
dialog {
  inline-size: min(100% - 2em, 32em);
  padding: 1.5em;
  color: CanvasText;
  background: Canvas;
  border: 1px solid color-mix(in oklab, CanvasText 14%, Canvas);
  border-radius: 0.75em;
  box-shadow: 0 1.5em 3em -1em oklch(0% 0 0 / 0.25);

  /* Closed state, and where the exit animation ends. */
  opacity: 0;
  scale: 0.98;
  transition: opacity 120ms ease-in, scale 120ms ease-in,
              overlay 120ms allow-discrete, display 120ms allow-discrete;
}
dialog[open] {
  opacity: 1;
  scale: 1;
  transition-duration: 180ms;
  transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
  @starting-style { opacity: 0; scale: 0.98; }   /* where the entry animation starts */
}

/* A fixed translucent black, not a system colour: it must darken in dark mode too. */
dialog::backdrop {
  background: oklch(0% 0 0 / 0.5);
  opacity: 0;
  transition: opacity 180ms, overlay 180ms allow-discrete, display 180ms allow-discrete;
}
dialog[open]::backdrop { opacity: 1; @starting-style { opacity: 0; } }

/* Stop the page behind from scrolling while a modal is open. */
html:has(dialog:modal) { overflow: hidden; scrollbar-gutter: stable; }

@media (prefers-reduced-motion: reduce) {
  dialog, dialog::backdrop { transition-duration: 0s; }
}
```

Open and close it with invoker commands: `<button commandfor="d" command="show-modal">` and `command="close"`.

## Quirks

- **The page keeps scrolling behind a modal.** Opening one doesn't change the page's `overflow` in any engine, so add the `html:has(dialog:modal)` rule yourself. Checked in all three engines. `scrollbar-gutter: stable` stops the page from jumping sideways when the scrollbar disappears.
- **`::backdrop` inherits custom properties from its dialog,** so you can theme the backdrop with a token set on the dialog. Checked in all three engines.
- **Don't build the backdrop or shadow from `CanvasText`.** In dark mode that is white, and the "shadow" becomes a glow. Use a fixed translucent black.
- **The default size cap is `calc(100% - 2em - 6px)`** in both directions. Checked in all three engines. Set your own `inline-size` and `max-block-size` if the dialog holds a long form.
- **The exit animation needs `overlay` and `display` in the transition** with `allow-discrete`; without them the dialog leaves the top layer instantly and nothing animates.
- **Never set `display` on `dialog` itself** (for example `display: flex` for layout). It overrides the closed state and shows a closed dialog. Checked in all three engines. Put the layout on an inner wrapper.

## Accessibility traps

- **Open it with `show-modal`, not the `open` attribute.** A dialog rendered with `open` is not modal: the page behind stays reachable and focus doesn't move in.
- **Name it:** `aria-labelledby` pointing at its heading.
- **Keep a visible close button.** Esc isn't discoverable, and a site script that swallows Escape breaks it.
- **Don't add a JavaScript focus loop.** Tab reaching the browser's address bar is the spec's behaviour and is not a keyboard trap.

## In Grounded UI

The [dialog component](/components/dialog) uses this recipe, with 16 rules on name, role and a way out.
