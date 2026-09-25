// One contract page per component. Order follows the mission: the receipts and the demo first,
// then the rules and how to test them, then the contract's details, then the reference implementation.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { features } from 'web-features';
import { cell, code, frontmatter, table, typeTable } from './mdx.mjs';
import { previewTabs, writeDemo } from './demos.mjs';
import { scorecardTable } from './scorecard.mjs';

// Every var(--grund-*, fallback) in a stylesheet, with its fallback (balanced parens).
function cssDefaults(css) {
  const found = {};
  for (const m of css.matchAll(/var\((--grund-[a-z0-9-]+)\s*,\s*/g)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    for (; i < css.length && depth; i++) depth += css[i] === '(' ? 1 : css[i] === ')' ? -1 : 0;
    found[m[1]] ??= css.slice(start, i - 1).trim();
  }
  return found;
}
const cssType = (v) => (/\d(ms|s)$/.test(v) ? '<time>' : /\d(em|rem|lh|px|%)?$/.test(v) || /\d(em|lh)\b/.test(v) ? '<length>' : '<color>');

// Canonical examples first, the rest alphabetically.
const FIRST = ['minimal', 'basic'];
const byImportance = (a, b) => (FIRST.indexOf(b) - FIRST.indexOf(a)) || a.localeCompare(b);

export function componentPage({ repo, pub, slug, contract: c, order, card }) {
  const referenceDir = join(repo, 'reference');
  const validDir = join(repo, 'contracts', slug, 'fixtures', 'valid');
  const names = readdirSync(validDir).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, '')).sort(byImportance);

  const demos = names.map((name) => {
    const markup = readFileSync(join(validDir, `${name}.html`), 'utf8');
    writeDemo(referenceDir, join(pub, 'demo', slug, `${name}.html`), `${c.title}: ${name}`, markup);
    return [`### ${code(name)}`, '', ...previewTabs(referenceDir, { src: `/demo/${slug}/${name}.html`, title: `${c.title}: ${name}`, markup })].join('\n');
  });

  const editorLevel = { refuse: 'Refuse to render', warn: 'Warn' };
  const ruleRows = c.rules.map((r) => [
    `**${r.id}**`,
    `${cell(r.description)}<br/>*${cell(r.rationale)}*`,
    `[${r.level}](${r.source})`,
    r.css ? (r.css.coverage === 'partial' ? 'Partial' : 'Yes') : '—',
    r.editor ? editorLevel[r.editor.level] : '—',
  ]);

  const referenceCss = [`${slug}.css`, `${slug}.styled.css`].map((f) => readFileSync(join(referenceDir, slug, f), 'utf8')).join('\n');
  const defaults = cssDefaults(referenceCss);

  const section = (title, body) => (body ? [`## ${title}`, '', ...[body].flat(), ''] : []);

  return [
    ...frontmatter({ title: c.title, description: c.summary ?? '', sidebar: { order: order + 1 } }),
    `{/* Generated from contracts/${slug}/contract.yaml by docs/scripts/generate.mjs. Edit the contract, not this file. */}`,
    '',
    scorecardTable(card),
    '',
    `Contract ${code(slug)} version **${c.contractVersion}**: ${c.rules.length} rules, ${card.normative} of them normative. Every number above is generated in the build.`,
    '',
    ...section('Examples', [
      'The reference implementation. Each example is a standalone page with only grund CSS and the markup shown — not a framework component.',
      '',
      demos.join('\n\n'),
    ]),
    ...section('Contract rules', [
      'Each rule is **normative** (a standard requires it; the link says which) or **recommended** (our judgement, open to review; the link is the reasoning it builds on).',
      '',
      table(['Id', 'Rule and why', 'Level', 'CSS warning', 'Editor'], ruleRows),
    ]),
    ...section('Test your implementation', [
      `The contract tests rendered HTML, so it works on any implementation. grund's own markup is tested as is; for other markup, a binding maps the contract's parts to your selectors.`,
      '',
      '```sh',
      `npx grund-conformance https://example.com/contact --component ${slug}`,
      `npx grund-conformance page.html --binding my-${slug}.binding.yaml`,
      '```',
      '',
      '```yaml',
      `# my-${slug}.binding.yaml`,
      `component: ${slug}`,
      'implementation: My theme',
      `root: .my-${slug}`,
      'parts:',
      ...Object.keys(c.anatomy).filter((k) => k !== 'root' && !c.anatomy[k].outside).map((k) => `  ${k}: .my-${slug}__${k}`),
      '```',
    ]),
    ...section('Anatomy', [
      table(['Part', 'Element', 'Required'], Object.entries(c.anatomy).map(([key, p]) => [
        `${cell(p.label)} ${key === 'root' ? '' : code(key)}`,
        p.element.map(code).join(' or ') + (p.outside ? ' (outside the root)' : ''),
        p.required ? 'Yes' : p.requiredWhen ? `When ${code(p.requiredWhen)}` : 'No',
      ])),
      '',
      c.domOrder ? `DOM order: ${c.domOrder.map(code).join(' → ')}. In grund's markup the root carries ${code(`data-component="${slug}"`)} and each part ${code('data-part')}.` : '',
    ]),
    ...section('States', c.states?.length && table(['State', 'In the DOM', 'CSS hook'], c.states.map((s) => [cell(s.label ?? s.name), s.dom ? code(s.dom) : '—', code(s.hook)]))),
    ...section('Keyboard', c.keyboard?.length && table(['Key', 'Behavior'], c.keyboard.map((k) => [cell(k.key), cell(k.behavior)]))),
    ...section('Attributes', c.attributes?.length && Object.keys(c.anatomy)
      .filter((part) => c.attributes.some((a) => a.on === part))
      .flatMap((part) => [
        `### ${cell(c.anatomy[part].label)}`,
        '',
        typeTable(Object.fromEntries(c.attributes.filter((a) => a.on === part).map((a) => [a.name, { type: a.type, description: a.description, ...(a.required && { required: true }), ...(a.default && { default: a.default }) }]))),
        '',
      ])),
    ...section('WCAG', c.wcag?.length && table(['Criterion', 'Level', 'How'], c.wcag.map((w) => [`${w.criterion} ${cell(w.name)}`, w.level, cell(w.how)]))),
    ...section('What the site must handle', c.siteResponsibilities?.map((s) => `- **${cell(s.title)}${s.criterion ? ` (${s.criterion})` : ''}.** ${cell(s.text)}`)),
    ...section('Use the reference implementation', [
      'Link the core once per page, then the component. No JavaScript.',
      '',
      '```html',
      '<link rel="stylesheet" href="grund-ui/reference/core/core.css">',
      `<link rel="stylesheet" href="grund-ui/reference/${slug}/${slug}.css">`,
      '<!-- Optional: the finished look -->',
      `<link rel="stylesheet" href="grund-ui/reference/${slug}/${slug}.styled.css">`,
      '```',
      '',
      `${code(`${slug}.css`)} is the base: everything the contract needs, nothing more. ${code(`${slug}.styled.css`)} adds the look in the **Styled** tab.`,
      '',
      '### Custom properties',
      '',
      "Set these from the site's own CSS, on the component or any ancestor. No `!important` needed.",
      '',
      typeTable(Object.fromEntries(Object.entries(c.customProperties ?? {}).map(([name, description]) => [name, { type: cssType(defaults[name] ?? ''), description, ...(defaults[name] && { default: defaults[name] }) }]))),
      '',
      '### Browser support',
      '',
      'From the [web-features](https://web-platform-dx.github.io/web-features/) data, updated with every release.',
      '',
      table(['Feature', 'Baseline', 'Chrome', 'Firefox', 'Safari', 'Without it'], (c.requires ?? []).map((r) => {
        const f = features[r.feature];
        const { baseline, baseline_low_date: since, support } = f.status;
        const status = baseline === 'high' ? 'Widely available' : baseline === 'low' ? `Newly available (${since})` : 'Limited';
        return [`[${cell(f.name)}](https://web-platform-dx.github.io/web-features-explorer/features/${r.feature}/)${r.optional ? ' (optional)' : ''}`, status, support.chrome ?? '—', support.firefox ?? '—', support.safari ?? '—', cell(r.fallback ?? '—')];
      })),
    ]),
    '<script src="/demo-frame.js" type="module"></script>',
    '',
  ].join('\n');
}
