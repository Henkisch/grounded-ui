#!/usr/bin/env node
// Grounded UI MCP server (stdio): lets an AI agent build a component from its contract and then prove it.
//   list_components  what exists, with receipts
//   get_component    everything needed to build one: parts, rules, reference markup, CSS, tokens, site duties
//   check_html       run the contracts (and axe) on HTML the agent wrote
//   check_url        the same on a live page
// Outcome rules are the verdict; technique rules are reported as recommendations, never as failures.
// Usage: claude mcp add grounded-ui -- node /path/to/grounded-ui/conformance/src/mcp.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { chromium } from '@playwright/test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { checkPage, loadContracts, withReferenceCss } from './index.mjs';

const repo = new URL('../..', import.meta.url).pathname;
const contracts = loadContracts();
const slugs = Object.keys(contracts);
const read = (...path) => readFileSync(join(repo, ...path), 'utf8');
const examplesOf = (slug) => readdirSync(join(repo, 'contracts', slug, 'markup', 'valid')).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, '')).sort();
const cssOf = (slug) => [`${slug}.css`, `${slug}.styled.css`].filter((f) => existsSync(join(repo, 'reference', slug, f)));
const text = (value) => ({ content: [{ type: 'text', text: value }] });

let browser;
const newPage = async () => {
  browser ??= await chromium.launch();
  return (await browser.newContext()).newPage();
};

function report(roots) {
  if (!roots.length) {
    return 'NO COMPONENTS FOUND. Grounded UI markup needs data-gui="<component>" on the root and data-gui-part on each part; other markup needs a binding (YAML mapping the parts to your selectors).';
  }
  const lines = [];
  let failing = 0;
  for (const root of roots) {
    const contract = contracts[root.component];
    const rule = (id) => contract.rules.find((r) => r.id === id);
    const outcome = root.results.filter((r) => r.type === 'outcome');
    const failed = outcome.filter((r) => !r.pass);
    const differs = root.results.filter((r) => r.type === 'technique' && !r.pass);
    failing += failed.length;
    lines.push(`## ${root.component} ${root.element}`, `${outcome.length - failed.length}/${outcome.length} outcome rules pass; axe: ${root.axeViolations?.length ?? 0} violation(s)`);
    for (const r of failed) {
      const full = rule(r.id);
      lines.push(`- FAIL ${r.id} (${r.level}) ${r.description}`, `  Found: ${r.detail}`, `  Why: ${full.rationale}`, `  Source: ${full.source}`);
    }
    for (const v of root.axeViolations ?? []) lines.push(`- AXE ${v.id} (${v.impact}): ${v.help}`);
    if (differs.length) lines.push(`Technique differences (recommendations, not failures): ${differs.map((r) => `${r.id} ${r.description}`).join(' | ')}`);
    lines.push('');
  }
  const axe = roots.reduce((n, r) => n + (r.axeViolations?.length ?? 0), 0);
  lines.unshift(failing || axe ? `VERDICT: NOT YET. ${failing} outcome rule failure(s), ${axe} axe violation(s). Fix them and check again.` : `VERDICT: PASS. Every outcome rule passes and axe reports nothing, on ${roots.length} component(s).`, '');
  return lines.join('\n');
}

async function check(load, { component, binding }) {
  const page = await newPage();
  try {
    await load(page);
    const only = component ? { [component]: contracts[component] } : contracts;
    const bindings = binding ? { [component]: parse(binding) } : {};
    return text(report(await checkPage(page, { contracts: only, bindings })));
  } finally {
    await page.context().close();
  }
}

const server = new McpServer(
  { name: 'grounded-ui', version: '0.1.0' },
  { instructions: 'Grounded UI: accessible native HTML components with executable contracts. To build one: get_component, write the markup, then check_html until the verdict is PASS. Never call a component accessible without a PASS.' },
);

server.registerTool('list_components', {
  title: 'List components',
  description: 'The components that have a Grounded UI contract, with their rule counts and example names.',
}, async () => text(slugs.map((s) => {
  const c = contracts[s];
  return `- ${s}: ${c.title}. ${c.summary} (${c.rules.filter((r) => r.type === 'outcome').length} outcome rules; examples: ${examplesOf(s).join(', ')})`;
}).join('\n')));

server.registerTool('get_component', {
  title: 'Get a component',
  description: 'Everything needed to build a component: parts, the outcome rules it must meet, reference markup for one example, the CSS, theming tokens and what the site must handle.',
  inputSchema: {
    component: z.enum(slugs).describe('Component slug, from list_components'),
    example: z.string().optional().describe('Example name; defaults to the simplest one'),
  },
}, async ({ component, example }) => {
  const c = contracts[component];
  const examples = examplesOf(component);
  const pick = examples.includes(example) ? example : examples.includes('minimal') ? 'minimal' : examples.includes('basic') ? 'basic' : examples[0];
  const rules = (type) => c.rules.filter((r) => r.type === type).map((r) => `- ${r.id} (${r.level}) ${r.description} — ${r.source}`);
  return text([
    `# ${c.title} (contract ${c.contractVersion})`, c.summary, '',
    '## Parts', ...Object.entries(c.anatomy).map(([k, p]) => `- ${k}: ${p.element.join(' or ')}${p.required ? ' (required)' : p.requiredWhen ? ` (required when ${p.requiredWhen})` : ''}${p.outside ? ' (outside the root)' : ''}`),
    'Root carries data-gui="' + component + '"; each part carries data-gui-part="<part>". Give ids that are unique on the page.', '',
    '## Outcome rules (the verdict)', ...rules('outcome'), '',
    '## Technique rules (Grounded UI recommendations)', ...rules('technique'), '',
    ...(c.keyboard?.length ? ['## Keyboard', ...c.keyboard.map((k) => `- ${k.key}: ${k.behavior}`), ''] : []),
    `## Reference markup: ${pick} (other examples: ${examples.filter((e) => e !== pick).join(', ') || 'none'})`, '```html', read('contracts', component, 'markup', 'valid', `${pick}.html`).trim(), '```', '',
    '## CSS (link core once per page, then base; styled is the optional look)',
    ...['core/core.css', ...cssOf(component).map((f) => `${component}/${f}`)].flatMap((f) => [`### ${f}`, '```css', read('reference', f).trim(), '```']), '',
    '## Theming', 'Roles theme every component: --gui-border, --gui-focus, --gui-danger, --gui-radius. Component tokens:', ...Object.entries(c.customProperties ?? {}).map(([k, v]) => `- ${k}: ${v}`), '',
    ...(c.siteResponsibilities?.length ? ['## What the site must handle', ...c.siteResponsibilities.map((s) => `- ${s.title}: ${s.text}`), ''] : []),
    'When the markup is written, run check_html on it. Zero JavaScript: do not add scripts.',
  ].join('\n'));
});

const bindingDescription = 'Optional binding YAML for non-Grounded markup: `root: <selector>` and `parts: { <part>: <selector> }`. Requires `component`.';

server.registerTool('check_html', {
  title: 'Check HTML against the contracts',
  description: 'Runs the Grounded UI contracts and axe on HTML (a fragment or a whole page). Returns a verdict, each failing outcome rule with what was found, why it matters and its source, plus technique differences.',
  inputSchema: {
    html: z.string().describe('The HTML to check'),
    component: z.enum(slugs).optional().describe('Limit to one component'),
    binding: z.string().optional().describe(bindingDescription),
  },
}, async ({ html, component, binding }) => check((page) => page.setContent(withReferenceCss(html)), { component, binding }));

server.registerTool('check_url', {
  title: 'Check a live page against the contracts',
  description: 'Loads a URL in Chromium and runs the Grounded UI contracts and axe on every matching component.',
  inputSchema: {
    url: z.string().url().describe('The page to check'),
    component: z.enum(slugs).optional().describe('Limit to one component'),
    binding: z.string().optional().describe(bindingDescription),
  },
}, async ({ url, component, binding }) => check((page) => page.goto(url, { waitUntil: 'load' }), { component, binding }));

await server.connect(new StdioServerTransport());
const close = async () => { await browser?.close(); process.exit(0); };
process.on('SIGINT', close);
process.on('SIGTERM', close);
process.stdin.on('close', close);
