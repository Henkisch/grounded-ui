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

const shell = (slug, title, markup) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="/grund/core/tokens.css">
<link rel="stylesheet" href="/grund/core/core.css">
<link rel="stylesheet" href="/grund/components/${slug}/styles/${slug}.css">
<!-- The host site's own CSS. Nothing else is loaded. -->
<style>body { margin: 1rem; font: 1rem/1.5 system-ui, sans-serif; }</style>
</head>
<body>
${markup.trim()}
</body>
</html>
`;

const componentsDir = join(repo, 'components');
const slugs = readdirSync(componentsDir).filter((s) => existsSync(join(componentsDir, s, 'contract.yaml')));

for (const [order, slug] of slugs.entries()) {
  const dir = join(componentsDir, slug);
  const c = parse(readFileSync(join(dir, 'contract.yaml'), 'utf8'));

  cpSync(join(dir, 'styles'), join(pub, 'grund', 'components', slug, 'styles'), { recursive: true });
  mkdirSync(join(pub, 'demo', slug), { recursive: true });

  const demos = c.markup.map((name) => {
    const markup = readFileSync(join(dir, 'markup', `${name}.html`), 'utf8');
    writeFileSync(join(pub, 'demo', slug, `${name}.html`), shell(slug, `${c.title}: ${name}`, markup));
    // Height from the parts present (px at 16px base): body margin, then each part plus grid gap.
    const has = (part) => markup.includes(`data-part="${part}"`);
    const parts = [
      has('label') && 24,
      has('description') && 21,
      has('control') && (markup.includes('<textarea') ? 112 : 44),
      has('error') && 21,
    ].filter(Boolean);
    const height = 32 + parts.reduce((a, b) => a + b, 0) + (parts.length - 1) * 6 + 16;
    // One box per example: Preview and HTML tabs (Blume's built-in Tabs). No syncing or URL hash,
    // so switching one example leaves the others alone.
    return [
      `### ${code(name)}`,
      '',
      '<Tabs sync={false} hash={false}>',
      '<Tab title="Preview">',
      '',
      `<iframe src="/demo/${slug}/${name}.html" title="${c.title}: ${name}" loading="lazy" height="${height}" style={{ inlineSize: '100%', border: 0 }}></iframe>`,
      '',
      '</Tab>',
      '<Tab title="HTML">',
      '',
      '```html',
      markup.trim(),
      '```',
      '',
      '</Tab>',
      '</Tabs>',
    ].join('\n');
  });

  const partRows = Object.entries(c.anatomy).map(([key, p]) => [
    cell(p.label),
    code(p.part ?? key),
    p.element.map(code).join(' or '),
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
  ].join('\n');

  writeFileSync(join(outContent, `${slug}.mdx`), page);
  console.log(`docs: ${slug} (${c.markup.length} demos, ${c.rules.length} rules)`);
}

writeFileSync(
  join(outContent, 'meta.ts'),
  `import { defineMeta } from "blume";\n\nexport default defineMeta({ title: "Components", order: 2 });\n`,
);
