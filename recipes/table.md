---
title: Table
description: A data table with a sticky header, readable rows and a scroll container that keyboard and screen reader users can use.
order: 35
features: [table, sticky-positioning, nth-child, focus-visible]
---

Wide tables shouldn't break the page layout, and long ones shouldn't lose their header. Both are CSS jobs, but each has an accessibility half.

{/* demo */}

## Recipe

```html
<section class="table-scroll" aria-labelledby="fees-caption" tabindex="0">
  <table>
    <caption id="fees-caption">Waste collection fees 2026</caption>
    <thead>
      <tr><th scope="col">Bin</th><th scope="col">Every week</th><th scope="col">Every other week</th></tr>
    </thead>
    <tbody>…</tbody>
  </table>
</section>
```

```css
.table-scroll {
  overflow: auto;
  max-block-size: 20em;           /* scroll vertically too, so the header can stick */
}
.table-scroll:focus-visible { outline: 2px solid CanvasText; outline-offset: 2px; }

table { border-collapse: collapse; inline-size: 100%; }
caption { text-align: start; font-weight: 600; padding-block-end: 0.5em; }
th, td { padding: 0.5em 0.75em; text-align: start; }
td { font-variant-numeric: tabular-nums; }

thead th {
  position: sticky;
  inset-block-start: 0;
  background: Canvas;             /* sticky cells need a background, or rows show through */
  box-shadow: inset 0 -1px color-mix(in oklab, CanvasText 40%, Canvas);
}

tbody tr:nth-child(even) { background: color-mix(in oklab, CanvasText 4%, Canvas); }
```

## Quirks

- **Sticky works on `th`, `thead` and `tr`.** Inside a scrolling container, a sticky `th`, a sticky `thead` and a sticky `tr` all stayed at the top after scrolling in all three engines. Put it on the `th` cells for the widest support in older browsers.
- **Only WebKit leaves the scroll container out of the tab order.** Chromium and Firefox made an `overflow: auto` container focusable by keyboard without a `tabindex`; WebKit skipped it. Add `tabindex="0"` so keyboard users can scroll it everywhere. Checked in all three engines.
- **Sticky needs the scrolling ancestor to be the container.** If the table scrolls inside a `div`, the header sticks to that `div`, not the page. Give the container a `max-block-size`, or let the page scroll and drop the container.
- **Sticky cells are transparent by default.** Without a background, scrolled rows show through the header.

## Accessibility traps

- A focusable scroll container needs a name: a `<section>` (or `role="region"`) with `aria-labelledby` pointing at the caption, or screen readers announce an unnamed group.
- Every data table needs a `caption` (or a heading referenced by `aria-labelledby`) and header cells with `scope`.
- Zebra rows are decoration. Don't use row colour to carry meaning.
- Never use a table for layout. Changing a table's `display` to make it responsive can drop its table semantics; the scroll container above keeps them.

## In Grounded UI

A data table is on the [component list](/components) in the content tier.
