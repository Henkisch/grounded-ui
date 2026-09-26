// One contract page per component, ordered by what the reader needs first:
//   1. the receipts and the canonical demo (is it any good?)
//   2. pick an example, then add it to your project (the copy path, with a prompt for coding agents)
//   3. what it guarantees: outcome rules up front, technique rules collapsed
//   4. test your own implementation
//   5. reference details, collapsed into one accordion
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { features } from 'web-features';
import { cell, code, esc, frontmatter, table, typeTable } from './mdx.mjs';
import { previewTabs, writeDemo } from './demos.mjs';
import { scorecardBadges } from './scorecard.mjs';

// Every var(--grounded-*, fallback) in a stylesheet, with its fallback (balanced parens).
function cssDefaults(css) {
  const found = {};
  for (const m of css.matchAll(/var\((--grounded-[a-z0-9-]+)\s*,\s*/g)) {
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
const label = (name) => name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');

const levelBadge = (r) => `<Badge variant="${r.level === 'normative' ? 'accent' : 'default'}" tooltip="${r.level === 'normative' ? 'A standard requires it' : 'Our judgement, open to review'}">${r.level}</Badge>`;

export function componentPage({ repo, pub, slug, contract: c, order, card }) {
  const referenceDir = join(repo, 'reference');
  const validDir = join(repo, 'contracts', slug, 'fixtures', 'valid');
  const names = readdirSync(validDir).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, '')).sort(byImportance);

  const examples = names.map((name) => {
    const markup = readFileSync(join(validDir, `${name}.html`), 'utf8');
    writeDemo(referenceDir, join(pub, 'demo', slug, `${name}.html`), `${c.title}: ${name}`, markup);
    return { name, markup, tabs: previewTabs(referenceDir, { src: `/demo/${slug}/${name}.html`, title: `${c.title}: ${name}`, markup }) };
  });
  const [primary] = examples;

  const css = {
    core: readFileSync(join(referenceDir, 'core', 'core.css'), 'utf8').trim(),
    base: readFileSync(join(referenceDir, slug, `${slug}.css`), 'utf8').trim(),
    styled: readFileSync(join(referenceDir, slug, `${slug}.styled.css`), 'utf8').trim(),
  };
  const defaults = cssDefaults(`${css.base}\n${css.styled}`);
  const outcome = c.rules.filter((r) => r.type === 'outcome');
  const technique = c.rules.filter((r) => r.type === 'technique');
  // Attributes holding or pointing at an id: what must change when the markup is pasted twice on a page.
  const idAttrs = [...new Set((c.attributes ?? []).filter((a) => a.name === 'id' || a.type === 'id').map((a) => a.name))];

  const editorLevel = { refuse: 'Refuse to render', warn: 'Warn' };
  const ruleTable = (rules) => table(['Id', 'Rule and why', 'Level', 'CSS warning', 'Editor'], rules.map((r) => [
    `**${r.id}**`,
    `${cell(r.description)}<br/>*${cell(r.rationale)}*`,
    `[${r.level}](${r.source})`,
    r.css ? (r.css.coverage === 'partial' ? 'Partial' : 'Yes') : '—',
    r.editor ? editorLevel[r.editor.level] : '—',
  ]));

  const section = (title, body) => (body ? [`## ${title}`, '', ...[body].flat(), ''] : []);
  const item = (title, body, extra = '') => (body ? [`<AccordionItem title="${title}"${extra}>`, '', ...[body].flat(), '', '</AccordionItem>'] : []);

  // Everything a coding agent needs to add the component, self-contained: CSS, markup, and the rules it must keep.
  const agentPrompt = [
    `Add the Grounded UI ${c.title.toLowerCase()} component to this project. It is plain HTML and CSS: add no JavaScript and no framework wrapper.`,
    '',
    `1. Add the core CSS once per page, if the project doesn't have it yet (\`core.css\`), then the component's base CSS (\`${slug}.css\`) and, for the finished look, the styled CSS (\`${slug}.styled.css\`). Put them where the project keeps its stylesheets; order doesn't matter.`,
    `2. Use this markup. Keep every \`data-component\` and \`data-part\` attribute.${idAttrs.length ? ` Give each copy on a page unique ids, and update the attributes that point at them (${idAttrs.map((a) => `\`${a}\``).join(', ')}).` : ''}`,
    '',
    '```html',
    primary.markup.trim(),
    '```',
    '',
    `3. The result must keep these outcome rules (contract ${c.contractVersion}):`,
    '',
    ...outcome.map((r) => `   - ${r.id}: ${r.description.replace(/<[^>]+>/g, (tag) => `\`${tag}\``)}`),
    '',
    '4. Theme it only with the `--grounded-*` custom properties, set on the component or an ancestor, never by editing the files.',
    '',
    ...['core.css', `${slug}.css`, `${slug}.styled.css`].flatMap((file, i) => ['```css title="' + file + '"', [css.core, css.base, css.styled][i], '```', '']),
  ];

  return [
    ...frontmatter({ title: c.title, description: c.summary ?? '', sidebar: { order: order + 1 } }),
    `{/* Generated from contracts/${slug}/contract.yaml by docs/scripts/generate.mjs. Edit the contract, not this file. */}`,
    '',
    scorecardBadges(card),
    '',
    ...section('Pick an example', [
      `Pick the one closest to what you need; its **HTML** tab is what you paste. Each is a standalone page with only Grounded UI CSS and the markup shown.`,
      '',
      `<Tabs inline param="example">`,
      ...examples.flatMap((e) => [`<Tab title="${esc(label(e.name))}">`, '', ...e.tabs, '', '</Tab>']),
      '</Tabs>',
    ]),
    ...section('Add it to your project', [
      '<Steps>',
      '<Step title="Add the CSS">',
      '',
      `Link the core once per page, then the component. Or copy the files into your theme: [core.css](/grounded/core/core.css), [${slug}.css](/grounded/${slug}/${slug}.css) (base, required) and [${slug}.styled.css](/grounded/${slug}/${slug}.styled.css) (the look, optional).`,
      '',
      '<CodeGroup>',
      '',
      '```html Link',
      '<link rel="stylesheet" href="/grounded/core/core.css">',
      `<link rel="stylesheet" href="/grounded/${slug}/${slug}.css">`,
      `<link rel="stylesheet" href="/grounded/${slug}/${slug}.styled.css">`,
      '```',
      '',
      '```css @import',
      '/* In your theme stylesheet, e.g. a WordPress style.css */',
      '@import url("grounded/core/core.css");',
      `@import url("grounded/${slug}/${slug}.css");`,
      `@import url("grounded/${slug}/${slug}.styled.css");`,
      '```',
      '',
      '</CodeGroup>',
      '',
      'Every file declares the same cascade layers, so a CMS that bundles or reorders stylesheets can\'t break it.',
      '',
      '</Step>',
      '<Step title="Paste the markup">',
      '',
      `Copy the **HTML** tab of the example you picked. Keep the ${code('data-component')} and ${code('data-part')} attributes${idAttrs.length ? `, and make the ids unique per page (${idAttrs.map(code).join(', ')})` : ''}.`,
      '',
      '</Step>',
      '<Step title="Theme it">',
      '',
      `Set the [custom properties](#reference) from your own CSS, on the component or any ancestor. No ${code('!important')}, no edits to the files.`,
      '',
      '</Step>',
      '<Step title="Check it">',
      '',
      '```sh',
      `npx grounded-conformance https://example.com/page --component ${slug}`,
      '```',
      '',
      '</Step>',
      '</Steps>',
      '',
      `<Prompt description="**Using a coding agent?** Copy a prompt with the CSS, the markup and the rules it must keep." actions={["copy"]}>`,
      '',
      ...agentPrompt,
      '',
      '</Prompt>',
      '',
      ...(c.siteResponsibilities?.length ? [
        ':::warning[Your part]',
        ...c.siteResponsibilities.map((s) => `- **${cell(s.title)}${s.criterion ? ` (${s.criterion})` : ''}.** ${cell(s.text).replace(/--grounded-[a-z0-9-]+/g, code)}`),
        ':::',
      ] : []),
    ]),
    ...section('What it guarantees', [
      `${outcome.length} **outcome rules**: what any implementation must achieve, judged on the rendered result (the accessible name, role and description the browser computes). Outside implementations are judged on these.`,
      '',
      ...outcome.map((r) => `- ${levelBadge(r)} **${r.id}** [${cell(r.description)}](${r.source})`),
      '',
      c.wcag?.length ? `<Expandable title="WCAG criteria (${c.wcag.length})">\n\n${table(['Criterion', 'Level', 'How'], c.wcag.map((w) => [`${w.criterion} ${cell(w.name)}`, w.level, cell(w.how)]))}\n\n</Expandable>` : '',
      '',
      `<Expandable title="How the reference does it: ${technique.length} technique rules">`,
      '',
      "Grounded UI's recommended markup. Always *recommended*: other markup can differ and still pass every outcome rule.",
      '',
      ruleTable(technique),
      '',
      '</Expandable>',
      '',
      `<Expandable title="All rules with rationale, CSS warnings and editor checks">`,
      '',
      ruleTable(outcome),
      '',
      '</Expandable>',
    ]),
    ...section('Test your implementation', [
      `The contract tests rendered HTML, so it works on any implementation. Grounded UI's own markup is tested as is; for other markup, a binding maps the contract's parts to your selectors. [How to read the result](/getting-started/test-your-components).`,
      '',
      '<CodeGroup>',
      '',
      '```sh Command',
      `npx grounded-conformance https://example.com/contact --component ${slug}`,
      `npx grounded-conformance page.html --binding my-${slug}.binding.yaml`,
      '```',
      '',
      `\`\`\`yaml my-${slug}.binding.yaml`,
      `component: ${slug}`,
      'implementation: My theme',
      `root: .my-${slug}`,
      'parts:',
      ...Object.keys(c.anatomy).filter((k) => k !== 'root' && !c.anatomy[k].outside).map((k) => `  ${k}: .my-${slug}__${k}`),
      '```',
      '',
      '</CodeGroup>',
    ]),
    ...section('Reference', [
      '<Accordion>',
      ...item('Anatomy', [
        table(['Part', 'Element', 'Required'], Object.entries(c.anatomy).map(([key, p]) => [
          `${cell(p.label)} ${key === 'root' ? '' : code(key)}`,
          p.element.map(code).join(' or ') + (p.outside ? ' (outside the root)' : ''),
          p.required ? 'Yes' : p.requiredWhen ? `When ${code(p.requiredWhen)}` : 'No',
        ])),
        '',
        c.domOrder ? `DOM order: ${c.domOrder.map(code).join(' → ')}. In Grounded UI's markup the root carries ${code(`data-component="${slug}"`)} and each part ${code('data-part')}.` : '',
      ]),
      ...item('Attributes', c.attributes?.length && Object.keys(c.anatomy)
        .filter((part) => c.attributes.some((a) => a.on === part))
        .flatMap((part) => [
          `**${cell(c.anatomy[part].label)}**`,
          '',
          typeTable(Object.fromEntries(c.attributes.filter((a) => a.on === part).map((a) => [a.name, { type: a.type, description: a.description, ...(a.required && { required: true }), ...(a.default && { default: a.default }) }]))),
          '',
        ])),
      ...item('Keyboard', c.keyboard?.length && table(['Key', 'Behavior'], c.keyboard.map((k) => [cell(k.key), cell(k.behavior)]))),
      ...item('States', c.states?.length && table(['State', 'In the DOM', 'CSS hook'], c.states.map((s) => [cell(s.label ?? s.name), s.dom ? code(s.dom) : '—', code(s.hook)]))),
      ...item('Custom properties', [
        "Set these from the site's own CSS, on the component or any ancestor. No `!important` needed.",
        '',
        typeTable(Object.fromEntries(Object.entries(c.customProperties ?? {}).map(([name, description]) => [name, { type: cssType(defaults[name] ?? ''), description, ...(defaults[name] && { default: defaults[name] }) }]))),
      ]),
      ...item('Browser support', [
        'From the [web-features](https://web-platform-dx.github.io/web-features/) data, updated with every release.',
        '',
        table(['Feature', 'Baseline', 'Chrome', 'Firefox', 'Safari', 'Without it'], (c.requires ?? []).map((r) => {
          const f = features[r.feature];
          const { baseline, baseline_low_date: since, support } = f.status;
          const status = baseline === 'high' ? 'Widely available' : baseline === 'low' ? `Newly available (${since})` : 'Limited';
          return [`[${cell(f.name)}](https://web-platform-dx.github.io/web-features-explorer/features/${r.feature}/)${r.optional ? ' (optional)' : ''}`, status, support.chrome ?? '—', support.firefox ?? '—', support.safari ?? '—', cell(r.fallback ?? '—')];
        })),
      ]),
      '</Accordion>',
    ]),
    '<script src="/demo-frame.js" type="module"></script>',
    '',
  ].join('\n');
}
