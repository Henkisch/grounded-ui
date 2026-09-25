#!/usr/bin/env node
// grounded-conformance <url-or-file>… [--component <slug>] [--binding <file.yaml>]… [--json] [--no-axe]
// Tests every instance of each component on the page against its contract. Exit 1 on any failure.
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { checkPage, loadBinding, loadContracts, failures } from './index.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    component: { type: 'string', multiple: true },
    binding: { type: 'string', multiple: true },
    json: { type: 'boolean', default: false },
    'no-axe': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help || !positionals.length) {
  console.log('Usage: grounded-conformance <url-or-file>… [--component <slug>] [--binding <file.yaml>] [--json] [--no-axe]');
  process.exit(values.help ? 0 : 2);
}

const bindings = Object.fromEntries((values.binding ?? []).map((file) => {
  const binding = loadBinding(file);
  return [binding.component, binding];
}));
const contracts = loadContracts();
const components = values.component ?? (Object.keys(bindings).length ? Object.keys(bindings) : undefined);

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const all = [];
for (const target of positionals) {
  const url = existsSync(target) ? pathToFileURL(resolve(target)).href : target;
  await page.goto(url, { waitUntil: 'load' });
  const report = await checkPage(page, { contracts, bindings, components, axe: !values['no-axe'] });
  all.push({ url, report });
}
await browser.close();

if (values.json) {
  console.log(JSON.stringify(all, null, 2));
} else {
  for (const { url, report } of all) {
    console.log(`\n${url}`);
    if (!report.length) console.log('  no components found');
    for (const root of report) {
      const failed = root.results.filter((r) => !r.pass);
      const axeNote = root.axeViolations ? `, axe: ${root.axeViolations.length} violation(s)` : '';
      console.log(`  ${root.component} ${root.element} — ${root.results.length - failed.length}/${root.results.length} rules pass${axeNote}`);
      for (const r of failed) console.log(`    FAIL ${r.id} (${r.level}) ${r.description}\n         ${r.detail}`);
    }
  }
  const failed = all.flatMap(({ report }) => failures(report));
  const missed = failed.filter((f) => f.axeFoundIssues === false).length;
  console.log(`\n${failed.length} failure(s)${failed.length ? `, ${missed} in components where axe reported nothing` : ''}`);
}

process.exit(all.some(({ report }) => failures(report).length) ? 1 : 0);
