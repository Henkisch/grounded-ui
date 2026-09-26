---
title: Date and time inputs
description: Style native date, time and datetime-local inputs so they line up with text fields, and know which parts you can't reach.
order: 21
features: [input-date-time]
---

Native date and time inputs come with a keyboard-friendly picker for free. Styling them mostly means evening out size differences between browsers.

{/* demo */}

## Recipe

- **Set an explicit `block-size` and `inline-size`.** With the same padding and font as a text field, date inputs come out taller in Chromium and Safari, and every browser picks a different width.
- **Style the box, not the parts.** Padding, border, background and font work everywhere. The date segments and the picker itself are the browser's.
- **Set `color-scheme`** on the input (or the page). Chromium's calendar icon and the picker popup follow it; without it, the icon stays black on a dark background.
- **For an empty state, use `:required:invalid`.** An empty date input doesn't match `:placeholder-shown`.

## Quirks

- **Heights differ.** With 8 px padding, 16 px text and a 1 px border: text field 42 px in all three; date input 44 px in Chromium, 46 px in Safari (WebKit), 42 px in Firefox. An explicit `block-size` evens them out. Checked in all three engines.
- **Intrinsic widths differ.** A date input is about 161 px wide in Chromium, 155 px in Firefox and 115 px in Safari. Checked in all three engines.
- **The calendar icon pseudo-element** (`::-webkit-calendar-picker-indicator`) exists in Chromium only; Firefox draws its own icon, and Safari has no such pseudo-element. Checked in all three engines.
- **In dark mode without `color-scheme`,** Chromium's icon is black on the dark field: almost invisible. With `color-scheme: light dark` it turns light. Checked in Chromium.
- **The segments** (`::-webkit-datetime-edit` and its children) exist in Chromium and Safari, not Firefox. Zeroing their padding closes the height gap in Chromium but not fully in Safari, so the explicit height is the reliable fix. Checked in all three engines.
- **`:placeholder-shown` never matches** an empty date, time or datetime-local input, in any of the three engines. `:invalid` does match an empty required one.
- **The format shown** (`yyyy-mm-dd`, `mm/dd/yyyy`, …) is up to the browser; the HTML spec leaves the presentation to it, and CSS can't change it.

## Accessibility traps

- **Don't hide the picker icon** without another way in: some users rely on it. Typing into the segments always works.
- **Label the format in words** for users who type, in a description: "For example 2026-10-05". The native format varies by locale.
- **Don't build a custom calendar** to get a look. The native control is keyboard-accessible and announced correctly; most custom date pickers aren't.

## In Grounded UI

Date fields use the [text field](/components/text-field) component with `type="date"`: the label, description and error rules are the same.
