---
title: Range sliders
description: Draw your own track and thumb for input type range in every engine, keep the focus ring and target size, and make a vertical slider without rotation hacks.
order: 23
features: [input-range, appearance, vertical-form-controls, accent-color]
---

A range slider is two pseudo-elements, a track and a thumb, and each engine names them differently. The work is writing each rule twice.

{/* demo */}

## Recipe

- **The quick way: `accent-color`.** It recolours the native slider in one line and keeps the browser's own drawing. Everything below is for when you need your own shapes.
- **Reset with `appearance: none`** on the input and on the WebKit thumb, then give the input a transparent background.
- **Write separate rules per engine.** `::-webkit-slider-runnable-track` and `::-webkit-slider-thumb` for Chromium and Safari; `::-moz-range-track`, `::-moz-range-thumb` and `::-moz-range-progress` for Firefox.
- **Centre the WebKit thumb with a negative margin:** `(track height − thumb height) / 2`. Firefox centres it on its own.
- **Set `font-size: inherit`** before sizing in `em`.
- **Vertical:** `writing-mode: vertical-lr` plus `direction: rtl`, so the minimum is at the bottom. Set the length with `inline-size`, which is the vertical axis once the writing mode turns.

## Quirks

- **An unknown pseudo-element drops the whole rule in Chromium and Safari.** A combined `::-webkit-slider-thumb, ::-moz-range-thumb` rule is thrown away there; Firefox keeps it. Checked in all three engines, which is why every rule is written twice.
- **Without the negative margin, the thumb hangs below the track** in Chromium and Safari. Checked in both.
- **Only Firefox can colour the filled part** (`::-moz-range-progress`). Chromium and Safari have no pseudo-element for it; a filled track there needs JavaScript to update a gradient, or `accent-color` on the native slider. Checked in all three engines.
- **Form controls default to about 13.3 px text,** so a `1.5em` thumb came out 20 px in Firefox until the input got `font-size: inherit`; then 24 px. Checked in Firefox.
- **Vertical works in all three engines with `writing-mode`:** a 128 × 24 px slider from `inline-size: 8em`. Watch specificity: a general `input[type="range"] { flex: 1 }` beat the vertical class and stretched it sideways. Checked in all three engines.

## Accessibility traps

- **Make the thumb at least 24 × 24 CSS px** (WCAG 2.5.8 Target Size). The input's `block-size` sets the clickable height; keep it at least as tall as the thumb.
- **Keep the focus ring on the input** (`:focus-visible`), not only on the thumb: it then wraps the whole control, in every engine.
- **Label it, and show the value in text** when the exact number matters. The slider alone doesn't tell sighted users "60 %". An `<output>` next to it needs JavaScript to update; without JavaScript, show the range ends as text instead.
- **Keep the track at least 3:1** against the background (WCAG 1.4.11): it tells users where the slider runs.

## In Grounded UI

There's no slider component yet. If one comes, it follows this recipe with Grounded UI's tokens.
