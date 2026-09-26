---
title: Fieldset and legend
description: Group related fields with a real group name, and tame the legend's unusual rendering.
order: 33
features: [fieldset, grid, flexbox]
---

A `fieldset` with a `legend` gives a group of fields its name: "Delivery method, radio group". It is the only native way to name a group without ARIA.

{/* demo */}

## Recipe

```css
fieldset {
  margin: 0;
  padding: 0;
  border: 0;
  min-inline-size: 0;   /* the default is min-content: wide content overflows */
  display: grid;        /* grid and flex work on fieldset */
  gap: 0.5em;
}

legend {
  padding: 0;
  font-weight: 600;
  margin-block-end: 0.25em;
}

/* A legend that behaves like a normal heading line inside a bordered group */
.boxed {
  border: 1px solid color-mix(in oklab, CanvasText 40%, Canvas);
  border-radius: 0.5em;
  padding: 1em;
}
.boxed > legend {
  float: left;          /* takes the legend out of the border */
  inline-size: 100%;
  margin-block-end: 0.5em;
}
.boxed > legend + * { clear: both; }
```

## Quirks

- **The legend sits on the border.** By default the legend is drawn over the fieldset's top border, cutting a gap into it. Checked in all three engines.
- **`float` on the legend moves it inside.** A floated legend no longer interrupts the border and lays out like normal content; clear the next element. Checked in all three engines.
- **The legend isn't a grid or flex item.** With `display: grid` or `display: flex` on the fieldset, the other children lay out as items (gap works), but the legend stays outside the grid. Checked in all three engines.
- **`min-inline-size: min-content` is the default.** A fieldset holding a 2000px-wide child grew to 2028px instead of shrinking, in all three engines. Set `min-inline-size: 0` so tables and long content scroll instead.

## Accessibility traps

- The legend must be the fieldset's first child, or it doesn't name the group.
- Keep legends short: screen readers repeat the legend when focus enters the group, and some repeat it for every field.
- Don't use a fieldset just to draw a box. Group only fields that answer one question (an address, a date, a radio group).
- A visually hidden legend still names the group. Hiding it with `display: none` removes the name.

## In Grounded UI

Fieldset, checkbox and radio groups are in the forms tier of the [component list](/components). The [text field](/components/text-field) is the single-field version of the same label, description and error model.
