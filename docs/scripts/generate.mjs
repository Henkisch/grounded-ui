// Generates the docs content that must never drift from the repo:
//   docs/public/grounded/…                   copies of the reference CSS
//   docs/public/demo/…                    bare demo pages (fixture or example + Grounded UI CSS, nothing else)
//   docs/content/components/<slug>.mdx    one contract page per component
//   docs/content/examples/<name>.mdx      one page per examples/<name>.html
//   docs/content/_generated/scorecard.mdx the front page's receipts
//   docs/content/reports/<impl>.mdx        conformance reports from reports/<impl>/ (README + generated tables)
//   docs/content/recipes/<slug>.mdx       CSS recipes from recipes/<slug>.md (+ optional <slug>.html demo)
// Run after `node scripts/budget.mjs` (the scorecard reads dist/sizes.json).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadContracts } from '../../conformance/src/index.mjs';
import { componentPage } from './lib/component-page.mjs';
import { previewTabs, usedComponents, writeDemo } from './lib/demos.mjs';
import { cell, esc, frontmatter } from './lib/mdx.mjs';
import { parse } from 'yaml';
import { features } from 'web-features';
import { scorecards, scorecardOverview } from './lib/scorecard.mjs';

const repo = new URL('../..', import.meta.url).pathname;
const docs = join(repo, 'docs');
const pub = join(docs, 'public');
const out = { components: join(docs, 'content', 'components'), examples: join(docs, 'content', 'examples'), generated: join(docs, 'content', '_generated'), reports: join(docs, 'content', 'reports'), recipes: join(docs, 'content', 'recipes') };

for (const dir of [join(pub, 'grounded'), join(pub, 'demo'), ...Object.values(out)]) rmSync(dir, { recursive: true, force: true });
for (const dir of [join(pub, 'demo', 'examples'), join(pub, 'demo', 'recipes'), ...Object.values(out)]) mkdirSync(dir, { recursive: true });
cpSync(join(repo, 'reference'), join(pub, 'grounded'), { recursive: true });

const contracts = loadContracts(join(repo, 'contracts'));
const cards = await scorecards(repo, contracts);

for (const [order, [slug, contract]] of Object.entries(contracts).entries()) {
  mkdirSync(join(pub, 'demo', slug), { recursive: true });
  writeFileSync(join(out.components, `${slug}.mdx`), componentPage({ repo, pub, slug, contract, order, card: cards[slug] }));
  console.log(`docs: ${slug} (${cards[slug].fixtures} examples, ${contract.rules.length} rules, all pass: ${cards[slug].allPass})`);
}
// Choosing a component: one card per contract, with its receipts, so the list itself answers "is it any good?".
const kb = (bytes) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`);
writeFileSync(join(out.components, 'index.mdx'), [
  ...frontmatter({ title: 'Components', description: 'Pick a component. Each one is native HTML plus a few hundred bytes of CSS, and passes its own contract.', sidebar: { order: 0, label: 'Overview' } }),
  '<CardGroup cols={2}>',
  ...Object.entries(contracts).map(([slug, c]) => {
    const card = cards[slug];
    return `  <Card title="${c.title}" href="/components/${slug}" cta="${card.allPass ? '✓' : '✗'} ${card.rules} rules · ${kb(card.cssBase + card.cssStyled)} CSS · ${card.js === 0 ? '0' : kb(card.js)} JS" arrow>\n    ${c.summary}\n  </Card>`;
  }),
  '</CardGroup>',
  '',
].join('\n'));
writeFileSync(join(out.components, 'meta.ts'), `import { defineMeta } from "blume";\n\nexport default defineMeta({ title: "Components", order: 3 });\n`);
writeFileSync(join(out.generated, 'scorecard.mdx'), scorecardOverview(cards) + '\n');

// Examples: composed page fragments from examples/*.html; title and description from its two leading comments.
const examplesDir = join(repo, 'examples');
const exampleFiles = existsSync(examplesDir) ? readdirSync(examplesDir).filter((f) => f.endsWith('.html')).sort() : [];
for (const [order, fileName] of exampleFiles.entries()) {
  const source = readFileSync(join(examplesDir, fileName), 'utf8');
  const meta = (key) => source.match(new RegExp(`<!--\\s*${key}:\\s*(.+?)\\s*-->`))?.[1] ?? '';
  const markup = source.replace(/^(\s*<!--.*?-->\s*)+/s, '');
  writeDemo(join(repo, 'reference'), join(pub, 'demo', 'examples', fileName), meta('title'), markup);
  const page = [
    ...frontmatter({ title: meta('title'), description: meta('description'), sidebar: { order: order + 1 } }),
    `{/* Generated from examples/${fileName} by docs/scripts/generate.mjs. */}`,
    '',
    `Uses: ${usedComponents(markup).map((u) => `[${u}](/components/${u})`).join(', ')}.`,
    '',
    ...previewTabs(join(repo, 'reference'), { src: `/demo/examples/${fileName}`, title: meta('title'), markup }),
    '',
    '<script src="/demo-frame.js" type="module"></script>',
    '',
  ].join('\n');
  writeFileSync(join(out.examples, fileName.replace(/\.html$/, '.mdx')), page);
  console.log(`docs: example ${fileName}`);
}
writeFileSync(join(out.examples, 'meta.ts'), `import { defineMeta } from "blume";\n\nexport default defineMeta({ title: "Examples", order: 5 });\n`);

// Conformance reports: the human reading (README.md) plus the generated tables from `pnpm report <impl>`.
const reportsDir = join(repo, 'reports');
const impls = readdirSync(reportsDir).filter((d) => existsSync(join(reportsDir, d, 'report.yaml'))).sort();
for (const [order, impl] of impls.entries()) {
  const read = (f) => (existsSync(join(reportsDir, impl, f)) ? readFileSync(join(reportsDir, impl, f), 'utf8') : '');
  const readme = read('README.md');
  const title = readme.match(/^# (.+?)(?: —.*)?$/m)?.[1] ?? impl;
  const tables = readdirSync(join(reportsDir, impl)).filter((f) => f.endsWith('.md') && f !== 'README.md').sort()
    .map((f) => read(f).replace(/^# (.+)$/m, '## $1').replace(/^## (TF|DG)-/gm, '### $1-')
      // Table cells quote markup (<div class=…>, <dialog>): escape it so MDX reads text, not JSX.
      .replace(/^\|.*$/gm, (row) => row.replace(/[{}<>]/g, (c) => ({ '{': '&#123;', '}': '&#125;', '<': '&lt;', '>': '&gt;' })[c])));
  const body = readme.replace(/^# .+\n/, '').replace(/`([a-z-]+)\.md` is generated;/, 'The tables below are generated;');
  writeFileSync(join(out.reports, `${impl}.mdx`), [
    ...frontmatter({ title, description: `Grounded UI contracts run against ${title}'s published examples.`, sidebar: { order: order + 1 } }),
    `{/* Generated from reports/${impl}/ by docs/scripts/generate.mjs. */}`, '', body.trim(), '', ...tables, '',
  ].join('\n'));
  console.log(`docs: report ${impl}`);
}
writeFileSync(join(out.reports, 'meta.ts'), `import { defineMeta } from "blume";\n\nexport default defineMeta({ title: "Conformance reports", order: 4 });\n`);

// CSS recipes: recipes/<slug>.md (frontmatter: title, description, order, features = web-features ids) plus an
// optional recipes/<slug>.html demo: a standalone fragment with its own <style>, no Grounded UI CSS. The demo
// lands where the body says {/* demo */} (else after the intro); browser support is read from web-features.
const recipesDir = join(repo, 'recipes');
const recipeFiles = existsSync(recipesDir) ? readdirSync(recipesDir).filter((f) => f.endsWith('.md')).sort() : [];
for (const fileName of recipeFiles) {
  const slug = fileName.replace(/\.md$/, '');
  const source = readFileSync(join(recipesDir, fileName), 'utf8');
  const [, head, body] = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
  if (!head) throw new Error(`recipes/${fileName}: missing frontmatter`);
  const meta = parse(head);
  const demoPath = join(recipesDir, `${slug}.html`);
  let demo = '';
  if (existsSync(demoPath)) {
    const markup = readFileSync(demoPath, 'utf8').trim();
    writeFileSync(join(pub, 'demo', 'recipes', `${slug}.html`), recipeShell(meta.title, markup));
    const lines = markup.split('\n').length;
    demo = [
      '<Tabs sync={false} hash={false}>',
      '<Tab title="Result">', '',
      `<iframe data-demo src="/demo/recipes/${slug}.html" title="${esc(meta.title)} recipe" loading="lazy" height="${Math.min(640, 80 + lines * 6)}" style={{ inlineSize: '100%', border: 0 }}></iframe>`,
      '', '</Tab>',
      '<Tab title="Code">', '', '```html', markup, '```', '', '</Tab>',
      '</Tabs>',
    ].join('\n');
  }
  const support = (meta.features ?? []).map((id) => {
    const f = features[id];
    if (!f) throw new Error(`recipes/${fileName}: unknown web-features id "${id}"`);
    const { baseline, baseline_low_date: since, support: s } = f.status;
    const status = baseline === 'high' ? 'Widely available' : baseline === 'low' ? `Newly available (${since})` : 'Limited';
    return `| [${cell(f.name)}](https://web-platform-dx.github.io/web-features-explorer/features/${id}/) | ${status} | ${s.chrome ?? '—'} | ${s.firefox ?? '—'} | ${s.safari ?? '—'} |`;
  });
  const text = body.includes('{/* demo */}') ? body.replace('{/* demo */}', demo) : body.replace(/\n\n/, `\n\n${demo}\n\n`);
  writeFileSync(join(out.recipes, `${slug}.mdx`), [
    ...frontmatter({ title: meta.title, description: meta.description ?? '', sidebar: { order: meta.order ?? 99 } }),
    `{/* Generated from recipes/${fileName} by docs/scripts/generate.mjs. */}`, '',
    text.trim(), '',
    ...(support.length ? ['## Browser support', '', 'From the [web-features](https://web-platform-dx.github.io/web-features/) data.', '', '| Feature | Baseline | Chrome | Firefox | Safari |', '| --- | --- | --- | --- | --- |', ...support, ''] : []),
    demo ? '<script src="/demo-frame.js" type="module"></script>\n' : '',
  ].join('\n'));
  console.log(`docs: recipe ${slug}`);
}
if (recipeFiles.length) writeFileSync(join(out.recipes, 'meta.ts'), `import { defineMeta } from "blume";\n\nexport default defineMeta({ title: "CSS recipes", order: 2.5 });\n`);

function recipeShell(title, markup) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="color-scheme" content="light dark">
<style>
  :root { color-scheme: light dark; color: CanvasText; }
  body { margin: 0.5rem; font: 1rem/1.5 system-ui, sans-serif; }
</style>
</head>
<body>
${markup}
</body>
</html>
`;
}
