// Builds docs content from the contracts, so the docs never drift from them.
//   docs/public/grund/…              copies of the shipped CSS
//   docs/public/demo/<slug>/<n>.html bare HTML pages: markup verbatim + grund CSS, nothing else
//   docs/content/components/<slug>.mdx  generated page (anatomy, states, demos, rules, WCAG)
// Demos are iframes on purpose: rendering them through Astro would prove the wrong thing.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const repo = new URL('../..', import.meta.url).pathname;
const docs = join(repo, 'docs');
const pub = join(docs, 'public');
const outContent = join(docs, 'content', 'components');

for (const dir of [join(pub, 'grund'), join(pub, 'demo'), outContent]) rmSync(dir, { recursive: true, force: true });
mkdirSync(outContent, { recursive: true });

cpSync(join(repo, 'core'), join(pub, 'grund', 'core'), { recursive: true });

// MDX-safe inline text: escape JSX/expression characters, keep code spans literal.
const esc = (s) => String(s).replace(/[{}<>]/g, (c) => ({ '{': '&#123;', '}': '&#125;', '<': '&lt;', '>': '&gt;' })[c]);
const code = (s) => '`' + String(s).replace(/`/g, '\\`') + '`';
const cell = (s) => esc(s).replace(/\|/g, '\\|');
const table = (head, rows) =>
  [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

// Every component the markup uses gets its stylesheet, as a real page would link them.
const usedComponents = (markup) => [...new Set([...markup.matchAll(/data-component="([a-z0-9-]+)"/g)].map((m) => m[1]))];

const shell = (title, markup) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="/grund/core/tokens.css">
<link rel="stylesheet" href="/grund/core/core.css">
${usedComponents(markup).map((s) => `<link rel="stylesheet" href="/grund/components/${s}/styles/${s}.css">`).join('\n')}
<meta name="color-scheme" content="light dark">
<!-- The host site's own CSS. Nothing else is loaded. The component inherits the colour scheme. -->
<style>
  :root { color-scheme: light dark; color: CanvasText; }
  body { margin: 0.5rem; font: 1rem/1.5 system-ui, sans-serif; }
</style>
</head>
<body>
${markup.trim()}
</body>
</html>
`;

// Every var(--grund-*, fallback) in a stylesheet, with its fallback (balanced parens).
const cssDefaults = (css) => {
  const found = {};
  for (const m of css.matchAll(/var\((--grund-[a-z0-9-]+)\s*,\s*/g)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    for (; i < css.length && depth; i++) depth += css[i] === '(' ? 1 : css[i] === ')' ? -1 : 0;
    found[m[1]] ??= css.slice(start, i - 1).trim();
  }
  return found;
};
const cssType = (value) => (/\d(ms|s)$/.test(value) ? '<time>' : /\d(em|rem|lh|px|%)?$/.test(value) || /\d(em|lh)\b/.test(value) ? '<length>' : '<color>');
const typeTable = (rows) => `<TypeTable type={${JSON.stringify(rows)}} />`;

const componentsDir = join(repo, 'components');
const slugs = readdirSync(componentsDir).filter((s) => existsSync(join(componentsDir, s, 'contract.yaml')));

for (const [order, slug] of slugs.entries()) {
  const dir = join(componentsDir, slug);
  const c = parse(readFileSync(join(dir, 'contract.yaml'), 'utf8'));

  cpSync(join(dir, 'styles'), join(pub, 'grund', 'components', slug, 'styles'), { recursive: true });
  mkdirSync(join(pub, 'demo', slug), { recursive: true });

  const demos = c.markup.map((name) => {
    const markup = readFileSync(join(dir, 'markup', `${name}.html`), 'utf8');
    writeFileSync(join(pub, 'demo', slug, `${name}.html`), shell(`${c.title}: ${name}`, markup));
    // Fallback height from the parts present (px at 16px base); /demo-frame.js fits it exactly.
    const has = (part) => markup.includes(`data-part="${part}"`);
    const parts = [
      has('label') && 24,
      has('description') && 21,
      has('control') && (markup.includes('<textarea') ? 112 : 44),
      has('error') && 21,
    ].filter(Boolean);
    const minHeight = c.demo?.minHeight ?? 0;
    const height = Math.max(minHeight, 16 + parts.reduce((a, b) => a + b, 0) + (parts.length - 1) * 6);
    // One box per example: Preview and HTML tabs (Blume's built-in Tabs). No syncing or URL hash,
    // so switching one example leaves the others alone.
    return [
      `### ${code(name)}`,
      '',
      '<Tabs sync={false} hash={false}>',
      '<Tab title="Preview">',
      '',
      `<iframe data-demo${minHeight ? ` data-min-height="${minHeight}"` : ''} src="/demo/${slug}/${name}.html" title="${c.title}: ${name}" loading="lazy" height="${height}" style={{ inlineSize: '100%', border: 0 }}></iframe>`,
      '',
      '</Tab>',
      '<Tab title="HTML">',
      '',
      '```html',
      markup.trim(),
      '```',
      '',
      '</Tab>',
      '<Tab title="CSS">',
      '',
      ...usedComponents(markup).flatMap((used) => [
        '```css title="' + `${used}.css` + '"',
        readFileSync(join(componentsDir, used, 'styles', `${used}.css`), 'utf8').trim(),
        '```',
        '',
      ]),
      '</Tab>',
      '</Tabs>',
    ].join('\n');
  });

  const partRows = Object.entries(c.anatomy).map(([key, p]) => [
    cell(p.label),
    p.part ? code(p.part) : key === 'root' ? '—' : code(key),
    p.element.map(code).join(' or ') + (p.outside ? ' (outside the root)' : ''),
    p.required ? 'Yes' : p.requiredWhen ? `When ${code(p.requiredWhen)}` : 'No',
  ]);

  const stateRows = (c.states ?? []).map((s) => [cell(s.label ?? s.name), s.dom ? code(s.dom) : '—', code(s.hook)]);

  const level = { refuse: 'Refuse to render', warn: 'Warn' };
  const ruleRows = c.rules.map((r) => [
    `**${r.id}**`,
    cell(r.description),
    code(r.test.kind),
    r.css ? (r.css.coverage === 'partial' ? 'Partial' : 'Yes') : '—',
    r.editor ? level[r.editor.level] : '—',
    r.since,
  ]);

  const page = [
    '---',
    `title: ${JSON.stringify(c.title)}`,
    `description: ${JSON.stringify(c.summary ?? '')}`,
    'sidebar:',
    `  order: ${order + 1}`,
    '---',
    '',
    `{/* Generated from components/${slug}/contract.yaml by docs/scripts/sync-demos.mjs. Edit the contract, not this file. */}`,
    '',
    `Contract version **${c.contractVersion}** · ${code(`data-component="${slug}"`)}`,
    '',
    '## Installation',
    '',
    'Link the core once per page, then one stylesheet per component. No JavaScript.',
    '',
    '```html',
    '<link rel="stylesheet" href="grund-ui/core/tokens.css">',
    '<link rel="stylesheet" href="grund-ui/core/core.css">',
    `<link rel="stylesheet" href="grund-ui/components/${slug}/styles/${slug}.css">`,
    '```',
    '',
    '## Anatomy',
    '',
    table(['Part', 'data-part', 'Element', 'Required'], partRows),
    '',
    c.domOrder ? `DOM order: ${c.domOrder.map(code).join(' → ')}.` : '',
    '',
    '## Examples',
    '',
    'Each example is a standalone page with only grund CSS and the markup below — not a framework component.',
    '',
    demos.join('\n\n'),
    '',
    '## States',
    '',
    table(['State', 'In the DOM', 'CSS hook'], stateRows),
    '',
    ...(c.keyboard?.length
      ? ['## Keyboard', '', table(['Key', 'Behavior'], c.keyboard.map((k) => [cell(k.key), cell(k.behavior)])), '']
      : []),
    ...(c.requires?.length
      ? ['## Browser support', '', table(['Feature', 'Supported from', 'Without it'], c.requires.map((r) => [cell(r.feature), cell(r.support), cell(r.fallback ?? '—')])), '']
      : []),
    ...(c.attributes?.length
      ? [
          '## Attributes',
          '',
          ...Object.keys(c.anatomy)
            .filter((part) => c.attributes.some((a) => a.on === part))
            .flatMap((part) => [
              `### ${cell(c.anatomy[part].label)}`,
              '',
              typeTable(
                Object.fromEntries(
                  c.attributes
                    .filter((a) => a.on === part)
                    .map((a) => [a.name, { type: a.type, description: a.description, ...(a.required && { required: true }), ...(a.default && { default: a.default }) }]),
                ),
              ),
              '',
            ]),
        ]
      : []),
    ...(c.customProperties
      ? (() => {
          const defaults = cssDefaults(readFileSync(join(dir, 'styles', `${slug}.css`), 'utf8'));
          return [
            '## Custom properties',
            '',
            'Set these from the site\'s own CSS to theme the component. No `!important` needed.',
            '',
            typeTable(
              Object.fromEntries(
                Object.entries(c.customProperties).map(([name, description]) => [
                  name,
                  { type: cssType(defaults[name] ?? ''), description, ...(defaults[name] && { default: defaults[name] }) },
                ]),
              ),
            ),
            '',
          ];
        })()
      : []),
    '## Contract rules',
    '',
    table(['Id', 'Rule', 'Test', 'CSS warning', 'Editor', 'Since'], ruleRows),
    '',
    ...(c.wcag?.length
      ? ['## WCAG', '', table(['Criterion', 'Level', 'How'], c.wcag.map((w) => [`${w.criterion} ${cell(w.name)}`, w.level, cell(w.how)])), '']
      : []),
    ...(c.siteResponsibilities?.length
      ? ['## What the site must handle', '', ...c.siteResponsibilities.map((s) => `- **${cell(s.title)}${s.criterion ? ` (${s.criterion})` : ''}.** ${cell(s.text)}`), '']
      : []),
    '<script src="/demo-frame.js" type="module"></script>',
    '',
  ].join('\n');

  writeFileSync(join(outContent, `${slug}.mdx`), page);
  console.log(`docs: ${slug} (${c.markup.length} demos, ${c.rules.length} rules)`);
}

writeFileSync(
  join(outContent, 'meta.ts'),
  `import { defineMeta } from "blume";\n\nexport default defineMeta({ title: "Components", order: 2 });\n`,
);
