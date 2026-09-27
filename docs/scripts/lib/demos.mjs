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
  body { display: grid; justify-items: start; padding-block: 0.5rem; }
  /* Fields and groups take the full width; buttons and inline toggletips keep their own size. */
  body > :not(button, span) { justify-self: stretch; }${opens(markup) ? `
  /* Room to open: the example sits centred in the tall box; a dialog demo is only its trigger until opened. */
  body { align-content: center; min-block-size: calc(100dvb - 2rem); }` : ''}${markup.includes('<dialog') ? `
  body { place-items: center; }` : ''}
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

// Components that open something (a modal, a popover, a picker, a disclosure) get a tall box with room to open
// in; the rest fit their content. /demo-frame.js fits every frame to its content, never below the minimum.
const opens = (markup) => /<dialog|\spopover[\s>=]|<select|<details|<datalist/.test(markup);
export const demoHeight = (markup) => (opens(markup) ? { height: 380, minHeight: 380 } : { height: 120, minHeight: 0 });

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
