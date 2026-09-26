---
title: Progress and meter
description: Style progress bars and meters with each engine's pseudo-elements, give the indeterminate state a visible animation, and colour meter states without relying on colour alone.
order: 24
features: [progress, meter, indeterminate, appearance]
---

`<progress>` shows how far a task has come; `<meter>` shows a measurement in a known range, such as storage used. Both are native and announced correctly, but each engine draws the bar with its own pseudo-elements.

{/* demo */}

## Recipe

- **Reset both with `appearance: none`,** then give the element a size, a radius, `overflow: hidden` and a background for the empty track.
- **progress:** `::-webkit-progress-bar` (track) and `::-webkit-progress-value` (fill) for Chromium and Safari; `::-moz-progress-bar` (fill) for Firefox, where the element's own background is the track.
- **meter:** `::-webkit-meter-bar` plus one pseudo-element per state (`-optimum-value`, `-suboptimum-value`, `-even-less-good-value`) for Chromium and Safari. Firefox has one `::-moz-meter-bar`, and the state is a pseudo-class on the meter: `:-moz-meter-sub-optimum`, `:-moz-meter-sub-sub-optimum`.
- **Draw the indeterminate state yourself** with `:indeterminate`: a moving band on the element, and the engines' own bars made transparent.
- **Write separate rules per engine,** as with range sliders: an unknown pseudo-element drops a whole selector list in Chromium and Safari.

## Quirks

- **After `appearance: none`, the indeterminate state disappears differently:** Chromium and Safari show an empty track, Firefox a full bar. Neither says "busy". Checked in all three engines, hence the explicit `:indeterminate` rule.
- **`:indeterminate` matches a `<progress>` with no `value`** in all three engines, and `progress.position` is −1. Checked in all three engines.
- **The meter's state comes from `low`, `high` and `optimum`,** not from CSS. With `optimum` near the minimum, a value between `low` and `high` is "suboptimum" and above `high` is "even less good". Both engine families picked the same state for the demo's values. Checked in all three engines.
- **`::-webkit-meter-bar` doesn't exist in Firefox;** Firefox styles the meter's own box as the track. Checked in all three engines.

## Accessibility traps

- **Give both a label.** Wrap them in a `<label>` or point `aria-labelledby` at the heading; "progress bar, 64 %" alone doesn't say what is loading.
- **Don't use `<meter>` for task progress** or `<progress>` for measurements: screen readers announce them differently.
- **Colour alone isn't enough** (WCAG 1.4.1). Put the value in text next to a meter ("3.1 of 5 GB"), as in the demo.
- **Respect reduced motion.** The indeterminate animation stops under `prefers-reduced-motion: reduce` and shows a still band instead.
- **Keep the fill at least 3:1** against the track and the page (WCAG 1.4.11).

## In Grounded UI

Progress bar and meter are on the component list. When they come, they follow this recipe with Grounded UI's tokens.
