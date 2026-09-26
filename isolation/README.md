# Isolation demo

Do Grounded UI's text field and dialog work unchanged when pasted into real, heavily themed sites? Phase 0's criterion: they work unchanged on at least 7 of 10.

**Verdict: met, exactly at the threshold.** 7 sites work, 1 is degraded, 2 are broken. Counting "works, but looks off" as working, it's 8 of 10. Both failures come from site code that overrides every page element, not from anything specific to Grounded UI, and base CSS can defend against one of the two (see below). Run on 2026-09-26 with contracts 0.3.2 and the house style.

## Method

`node isolation/run.mjs [site-id …]` (Playwright, Chromium, 1280×900) does this for each site in `sites.yaml`:

1. Loads the page and accepts a consent banner if one is shown.
2. Adds Grounded UI's CSS with a `<style>` tag: core, plus base and styled for text field and dialog. The site's own CSS is left untouched. The context bypasses the page's CSP, because a site adding its own stylesheet isn't subject to it.
3. Pastes the markup of `text-field/…/invalid.html`, `with-description.html` and `dialog/…/basic.html`. They go into `main` (else `article`), after its first block, where an editor would add content and clear of a fixed header.
4. Records:
   - `checkPage` results (outcome and technique rules) plus axe, on the pasted roots only.
   - How the dialog behaves when opened by clicking the trigger: it must be `:modal`, focus must be inside, Esc must close it and focus must return to the trigger. Where a fixed header covers the trigger, it's opened with Enter.
   - The computed styles of every part, compared with the same markup on a blank page. Lengths are in em of the element's own font size, so a different site font size isn't counted as a leak.
   - Whether focus is visible on the field.
   - Whether the invalid field still looks different from a valid one.
5. The site rules behind each difference come from Chrome DevTools Protocol matched styles, excluding the `grounded.*` layers. Screenshots are in `screenshots/`.

**Verdicts.**
- **Broken:** an outcome rule fails, the dialog stops behaving as a modal, or the field has no visible focus indicator.
- **Degraded:** it works but looks broken. That means a weak focus indicator, an invalid field that looks valid, a field below the 2.75em touch target, or a dialog that isn't centred or loses its surface.
- **Works:** everything else. Inherited type, colour, spacing and a site's own input styling are intended: the component takes on the site's look.

## Results

| Site | CMS / theme | Verdict | What changed | Site rule behind it |
| --- | --- | --- | --- | --- |
| elementor.com | WordPress + Elementor | **Broken** | Esc doesn't close the dialog, and focus stays inside until the Close button is used. Styling is intact. | A jQuery `keydown` handler on `window` calls `preventDefault()` on Escape, which also cancels the dialog's close request. |
| Divi demo | WordPress + Divi 4.27.9 | **Broken** | The field has no focus indicator at all. Padding is 2px. | `:focus { outline: 0 }`, and `input[type="text"], input[type="email"], … { padding: 2px }` |
| wpastra.com | WordPress + Astra + Elementor | **Degraded** | The error border is gone, so the invalid field looks valid (the message is still there). Focus shows only as a thin dotted border. Larger gaps. | `input[type="email"], … { border: 1px solid var(--ast-border-color) }`, `:focus { outline: none !important }`, `p { margin-bottom: 1.75em }` |
| generatepress.com | WordPress + GeneratePress | Works | Square corners, grey border, 1.5em gaps | `input[type="email"], … { border-radius: 0 }`, `p { margin-bottom: 1.5em }` |
| Bootstrap 3.4 example | Bootstrap 3 | Works | 10px gaps, 30px dialog title | `p { margin: 0 0 10px }`, `label { margin-bottom: 5px }`, `h2 { font-size: 30px }` |
| wp-themes.com | WordPress, Twenty Twenty-Five | Works | Theme heading style on the dialog title | `h2 { font-size: var(--wp--preset--font-size--x-large) }` |
| Olivero (local) | Drupal 11.4.7, Olivero | Works | Olivero's own input box (no vertical padding, taller, auto width), heading margins | `[type="email"], … { min-height: var(--sp3); padding: 0 var(--sp) }`, `h2 { margin-block: var(--sp2) }` |
| lund.se | Sitevision + Bootstrap | Works | Only type and colour | — |
| uppsala.se | EPiServer + Bootstrap | Works | Paragraph spacing, heading style, a thicker site focus ring | `p { margin: .78em 0 }`, `h2 { font-size: 1.75rem }` |
| krisinformation.se | Custom (.NET) | Works | Site fonts, heavy heading | `h2 { font-family: "FuturaPTWebHeavy" }` |

- **Contracts:** every outcome and technique rule passes on every site, and axe reports nothing on the pasted components.
- **Dialog:** it opens as a modal everywhere, including when opened with Enter on elementor.com and generatepress.com, where a sticky header covers the trigger.
- **Screenshots:** `screenshots/<site>.png` shows the pasted area and `<site>-dialog.png` the open dialog. `divi-focus.png` and `astra-focus.png` show the field with keyboard focus.

## What leaked, and who owns it

**Decision (2026-09-26): no `!important` in Grounded UI's CSS.** Site CSS always wins, by design. A layered `!important` would protect the focus ring and the error cue, but it would take that control away from the site. So these leaks are site responsibilities, listed in the contracts, and the conformance runner is how a site finds them:

1. **The focus ring.** Site rules seen: `:focus { outline: 0 }` (Divi) and `:focus { outline: none !important }` (Astra). A site that removes outlines globally removes Grounded UI's too.
2. **The error cue.** Site rules like `input[type="email"] { border: 1px solid … }` (Astra) override the invalid border. The error message and `aria-invalid` still carry the error.
3. **The touch target.** Every site kept 2.75em or more; a theme that sets `height` on inputs would override it.

**Leave to the site** (intended, or not defensible in CSS):
- Spacing from `p { margin }`, `label { margin-bottom }` and `h2 { margin }`.
- Heading styles on the dialog title.
- The site's own input padding, radius and border colour.

**Can't be fixed in CSS:** elementor.com's Esc handler. A site script that cancels every Escape keydown breaks every native dialog on that page, including its own. Document it as a site responsibility. The Close button still works, so there's no keyboard trap (WCAG 2.1.2).

## Limits

- One page per site, one browser (Chromium), desktop width.
- Olivero runs on a local Drupal install, since no public Olivero site was found.
- The pasted markup is the reference markup, in English, with the default styled look. A site that sets `--grounded-*` tokens would look closer to itself.

`probe.mjs` checks candidate sites (CMS hints, bot walls). `check-focus.mjs` takes the focus screenshots.
