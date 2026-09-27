// Demo pages: each fixture or example becomes a bare HTML page with only Grounded UI CSS, shown in an iframe.
// Iframes on purpose: rendering through Astro would prove the component works in Astro, not on any site.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { esc } from './mdx.mjs';

export const usedComponents = (markup) => [...new Set([...markup.matchAll(/data-gui="([a-z0-9-]+)"/g)].map((m) => m[1]))];

const cssFiles = (referenceDir, markup, styled) =>
  usedComponents(markup).flatMap((slug) =>
    [`${slug}.css`, styled && `${slug}.styled.css`].filter((f) => f && existsSync(join(referenceDir, slug, f))).map((file) => ({ slug, file })),
  );

const shell = (referenceDir, title, markup, styled) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="/grounded/core/core.css">
${cssFiles(referenceDir, markup, styled).map(({ slug, file }) => `<link rel="stylesheet" href="/grounded/${slug}/${file}">`).join('\n')}
<meta name="color-scheme" content="light dark">
<!-- The host site's own CSS. Nothing else is loaded. The component inherits the colour scheme. -->
<style>
  :root { color-scheme: light dark; color: CanvasText; }
  body { margin: 0.5rem; font: 1rem/1.5 system-ui, sans-serif; }
  body { display: grid; gap: 1.25rem; align-content: start; justify-items: start; padding: 0.75rem 0.5rem; }
  /* Fields and groups take the full width; buttons and inline toggletips keep their own size. */
  body > :not(button, span) { justify-self: stretch; }${markup.includes('<dialog') ? `
  /* A dialog demo is only its trigger until opened: centre it in the room kept for the modal. */
  body { place-content: center; place-items: center; min-block-size: calc(100dvb - 2.5rem); }` : ''}
</style>
</head>
<body>
${markup.trim()}
</body>
</html>
`;

/** Writes <path> (styled) and <path>.base.html (base only). */
export function writeDemo(referenceDir, path, title, markup) {
  writeFileSync(path, shell(referenceDir, title, markup, true));
  writeFileSync(path.replace(/\.html$/, '.base.html'), shell(referenceDir, `${title} (base)`, markup, false));
}

// Three box sizes, so switching examples inside one component doesn't jump and things that open have room:
//   tall   (380px) a modal, a picker or a disclosure; only a dialog demo is centred (it's just its trigger)
//   medium (260px) a popover that opens below its trigger
//   compact (200px) everything else
// Content always starts at the top; /demo-frame.js grows a frame whose content is taller.
const size = (markup) => (/<dialog|<select|<details|<datalist/.test(markup) ? 380 : /\spopover[\s>=]/.test(markup) ? 260 : 200);
export const demoHeight = (markup) => ({ height: size(markup), minHeight: size(markup) });

/** Styled · Base · HTML · CSS in one box (Blume's built-in Tabs), independent of other examples. */
export function previewTabs(referenceDir, { src, title, markup }) {
  const { height, minHeight } = demoHeight(markup);
  const frame = (url) =>
    `<iframe data-demo${minHeight ? ` data-min-height="${minHeight}"` : ''} src="${url}" title="${esc(title)}" loading="lazy" height="${height}" style={{ inlineSize: '100%', border: 0 }}></iframe>`;
  return [
    '<Tabs sync={false} hash={false}>',
    '<Tab title="Styled">', '', frame(src), '', '</Tab>',
    '<Tab title="Base">', '', frame(src.replace(/\.html$/, '.base.html')), '', '</Tab>',
    '<Tab title="HTML">', '', '```html', markup.trim(), '```', '', '</Tab>',
    '<Tab title="CSS">', '',
    ...cssFiles(referenceDir, markup, true).flatMap(({ slug, file }) => [
      '```css title="' + file + '"', readFileSync(join(referenceDir, slug, file), 'utf8').trim(), '```', '',
    ]),
    '</Tab>',
    '</Tabs>',
  ];
}
