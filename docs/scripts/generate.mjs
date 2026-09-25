// Generates the docs content that must never drift from the repo:
//   docs/public/grounded/…                   copies of the reference CSS
//   docs/public/demo/…                    bare demo pages (fixture or example + Grounded UI CSS, nothing else)
//   docs/content/components/<slug>.mdx    one contract page per component
//   docs/content/examples/<name>.mdx      one page per examples/<name>.html
//   docs/content/_generated/scorecard.mdx the front page's receipts
//   docs/content/reports/<impl>.mdx        conformance reports from reports/<impl>/ (README + generated tables)
// Run after `node scripts/budget.mjs` (the scorecard reads dist/sizes.json).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadContracts } from '../../conformance/src/index.mjs';
import { componentPage } from './lib/component-page.mjs';
import { previewTabs, usedComponents, writeDemo } from './lib/demos.mjs';
import { frontmatter } from './lib/mdx.mjs';
import { scorecards, scorecardOverview } from './lib/scorecard.mjs';

const repo = new URL('../..', import.meta.url).pathname;
const docs = join(repo, 'docs');
const pub = join(docs, 'public');
const out = { components: join(docs, 'content', 'components'), examples: join(docs, 'content', 'examples'), generated: join(docs, 'content', '_generated'), reports: join(docs, 'content', 'reports') };

for (const dir of [join(pub, 'grounded'), join(pub, 'demo'), ...Object.values(out)]) rmSync(dir, { recursive: true, force: true });
for (const dir of [join(pub, 'demo', 'examples'), ...Object.values(out)]) mkdirSync(dir, { recursive: true });
cpSync(join(repo, 'reference'), join(pub, 'grounded'), { recursive: true });

const contracts = loadContracts(join(repo, 'contracts'));
const cards = await scorecards(repo, contracts);

for (const [order, [slug, contract]] of Object.entries(contracts).entries()) {
  mkdirSync(join(pub, 'demo', slug), { recursive: true });
  writeFileSync(join(out.components, `${slug}.mdx`), componentPage({ repo, pub, slug, contract, order, card: cards[slug] }));
  console.log(`docs: ${slug} (${cards[slug].fixtures} examples, ${contract.rules.length} rules, all pass: ${cards[slug].allPass})`);
}
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
    .map((f) => read(f).replace(/^# (.+)$/m, '## $1').replace(/^## (TF|DG)-/gm, '### $1-'));
  const body = readme.replace(/^# .+\n/, '').replace(/`([a-z-]+)\.md` is generated;/, 'The tables below are generated;');
  writeFileSync(join(out.reports, `${impl}.mdx`), [
    ...frontmatter({ title, description: `Grounded UI contracts run against ${title}'s published examples.`, sidebar: { order: order + 1 } }),
    `{/* Generated from reports/${impl}/ by docs/scripts/generate.mjs. */}`, '', body.trim(), '', ...tables, '',
  ].join('\n'));
  console.log(`docs: report ${impl}`);
}
writeFileSync(join(out.reports, 'meta.ts'), `import { defineMeta } from "blume";\n\nexport default defineMeta({ title: "Conformance reports", order: 4 });\n`);
