---
title: Select
description: Style a native select so it matches your text fields, then opt in to a fully styled picker where the browser allows it.
order: 10
features: [select, appearance, customizable-select]
---

Make a `<select>` look like the rest of your form without replacing it with a script-driven fake.

{/* demo */}

## Recipe

Two layers. The first works in every browser: reset the native look with `appearance: none` and draw your own arrow. The second opts in to customizable select, where the open list itself can be styled.

```css
/* Layer 1: every browser. The closed control only. */
.field select {
  appearance: none;
  inline-size: 100%;
  min-block-size: 2.75em;          /* touch target */
  padding-block: 0.5em;
  padding-inline: 0.75em 2.5em;    /* room for the arrow */
  font: inherit;
  color: inherit;
  background-color: Canvas;
  border: 1px solid color-mix(in oklab, CanvasText 40%, Canvas);  /* ≥ 3:1 */
  border-radius: 0.375em;
  /* The arrow: two gradients in currentColor, so it follows light and dark. */
  background-image:
    linear-gradient(45deg, transparent 50%, currentColor 50%),
    linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-position: right 1.25em top 55%, right 0.9em top 55%;
  background-size: 0.35em 0.35em;
  background-repeat: no-repeat;
}

/* Layer 2: customizable select, only where supported. */
@supports (appearance: base-select) and selector(::picker(select)) {
  .field select,
  .field select::picker(select) {
    appearance: base-select;
  }
  .field select { background-image: none; }       /* the browser draws ::picker-icon */
  .field select::picker(select) {
    padding: 0.25em;
    border: 1px solid color-mix(in oklab, CanvasText 20%, Canvas);
    border-radius: 0.5em;
    box-shadow: 0 0.75em 1.5em -0.5em oklch(0% 0 0 / 0.25);
  }
  .field option { padding: 0.5em 0.75em; border-radius: 0.25em; }
  .field option:checked { font-weight: 600; }
}
```

## Quirks

- **Styles on `optgroup` are inherited by its options.** Give the group label a colour or weight and every option in the group gets it too. Style the options explicitly to undo it. Checked in all three engines.
- **Firefox has no customizable select yet.** `appearance: base-select` is supported in Chromium and WebKit here, not in Firefox, so layer 1 must stand on its own.
- **Guard the pseudo-elements, not only the property.** Put `::picker(select)`, `::picker-icon` and `::checkmark` inside `@supports selector(::picker(select))`. A browser that doesn't know the pseudo-element drops the whole selector list it appears in, so never group it with selectors that must always apply.
- **`appearance: none` removes the arrow.** Draw one yourself (layer 1), or users lose the only visual cue that this is a list.

## Accessibility traps

- **Don't replace the select with a div-based dropdown** to get styling. The native element keeps its role, keyboard support and the mobile picker for free.
- **Keep the border at 3:1** against the background (WCAG 1.4.11). Light grey hairlines are the most common failure.
- **A select still needs a visible label.** The first option ("Choose…") is not a label.

## In Grounded UI

The [select component](/components/select) is this recipe with a contract: 20 rules, tested on every example.
