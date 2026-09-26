---
title: Details and summary
description: Style native disclosures and accordions, replace the marker, and animate the height where the browser supports it.
order: 12
features: [details, details-name, details-content, interpolate-size]
---

Turn `<details>` into a clean disclosure or FAQ accordion, with no script and no fake buttons.

{/* demo */}

## Recipe

```css
.faq details { border-block-end: 1px solid color-mix(in oklab, CanvasText 20%, Canvas); }

.faq summary {
  list-style: none;                 /* removes the default triangle */
  display: flex;
  justify-content: space-between;
  gap: 1em;
  min-block-size: 2.75em;           /* touch target */
  align-items: center;
  padding-block: 0.5em;
  font-weight: 600;
  cursor: pointer;
}
/* Your own marker: a chevron in currentColor that turns when open. */
.faq summary::after {
  content: "";
  inline-size: 0.5em;
  block-size: 0.5em;
  border-inline-end: 2px solid currentColor;
  border-block-end: 2px solid currentColor;
  rotate: 45deg;
  transition: rotate 150ms ease-out;
}
.faq details[open] > summary::after { rotate: -135deg; }
.faq summary:focus-visible { outline: 2px solid CanvasText; outline-offset: 2px; }

/* Height animation: only where the browser can interpolate to auto. */
@supports (interpolate-size: allow-keywords) and selector(::details-content) {
  .faq { interpolate-size: allow-keywords; }
  .faq details::details-content {
    block-size: 0;
    overflow: clip;
    transition: block-size 200ms ease-out, content-visibility 200ms allow-discrete;
  }
  .faq details[open]::details-content { block-size: auto; }
}
@media (prefers-reduced-motion: reduce) {
  .faq summary::after, .faq details::details-content { transition: none; }
}
```

Give every `details` in a group the same `name` to make it exclusive: opening one closes the others.

## Quirks

- **`list-style: none` removes the marker** because `summary` is a `display: list-item`. Checked in all three engines. If you change `display` (to flex, as above), the marker goes too, so `list-style` is belt and braces.
- **The old `::-webkit-details-marker` isn't needed any more.** Current WebKit uses the standard `::marker`. Checked in all three engines.
- **Closed content is hidden with `content-visibility: hidden`** on `::details-content`, so you animate `block-size` and let `content-visibility` flip with `allow-discrete`. Checked in all three engines.
- **Only Chromium animates to `auto` here.** `interpolate-size` is supported in Chromium, not in Firefox or WebKit; they open instantly, which is fine. Checked in all three engines.
- **Closed content is still in the page.** The HTML spec lets find-in-page and fragment links open a closed `details` to reveal a match, so don't use it to hide text.

## Accessibility traps

- **Nothing interactive inside `summary`.** A link or button inside it is nested interactive content: keyboard and screen reader users get two controls fighting over one click.
- **Don't remove the focus ring** from `summary` when you restyle it.
- **Headings go inside `summary`,** not around it: `<summary><h3>Question</h3></summary>` keeps the heading outline and the button together.
- **Keep the marker.** A disclosure with no visual sign that it opens looks like plain text.

## In Grounded UI

The [accordion component](/components/accordion) is this recipe with a contract: 9 rules on exclusive and independent accordions.
