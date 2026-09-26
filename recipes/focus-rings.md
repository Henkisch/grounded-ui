---
title: Focus rings
description: A focus indicator that keyboard users can always see, that survives forced colours, and that mouse users don't trip over.
order: 34
features: [focus-visible, outline, box-shadow, forced-colors]
---

Every interactive element needs a visible focus indicator (WCAG 2.4.7). Style it; never remove it.

{/* demo */}

## Recipe

```css
/* One ring for everything, shown only when the browser decides focus should be visible */
:focus-visible {
  outline: 2px solid var(--focus-color, CanvasText);
  outline-offset: 2px;
}

/* A soft ring with box-shadow, plus a transparent outline for forced colours */
.soft:focus-visible {
  outline: 2px solid transparent;
  box-shadow: 0 0 0 2px Canvas, 0 0 0 4px var(--focus-color, CanvasText);
}
```

- `:focus-visible`, not `:focus`: it matches for keyboard focus and for text fields, not for a mouse click on a button.
- `outline` doesn't change layout and follows `border-radius`, so it is the safest default.
- A `box-shadow` ring needs the transparent outline beside it: forced colours remove shadows but turn the transparent outline into a visible one.

## Quirks

- **Mouse clicks don't match `:focus-visible` on buttons.** In all three engines, clicking a button gave no `:focus-visible` match, while keyboard focus did. Checked in all three engines.
- **Forced colours remove `box-shadow`.** In Chromium's forced-colours emulation, a `box-shadow` ring computed to `none`, and `outline: 2px solid transparent` computed to a solid black outline. A shadow-only ring disappears for Windows High Contrast users.
- **Safari skips buttons and links on Tab by default.** A missing ring in Safari is often no focus at all: users need Option + Tab or the "Press Tab to highlight each item" setting.
- **Rings get clipped.** An ancestor with `overflow: hidden` cuts off an outline with an offset. Leave room with padding, or use a negative `outline-offset` inside clipped containers.

## Accessibility traps

- **Themes remove outlines globally.** Rules like `:focus { outline: 0 }` or `*:focus { outline: none !important }` remove every focus indicator on the site, including those of components pasted in later.
- The ring needs 3:1 contrast against the background next to it (WCAG 1.4.11). A two-colour ring (Canvas + CanvasText, as above) works on any background.
- Don't animate the ring in: focus has to show the moment it moves.

## In Grounded UI

Every Grounded UI control has a 2px `:focus-visible` outline in base CSS, themeable with `--grounded-focus-color`. In the [isolation demo](https://github.com/Henkisch/grounded-ui/tree/mission/isolation), Divi (`:focus { outline: 0 }`) and Astra (`:focus { outline: none !important }`) removed it. Grounded UI never uses `!important`, so site CSS always wins; removing outlines is listed as the site's responsibility in the [text field](/components/text-field) contract.
