// Builds fixtures.json from the example templates USWDS ships in its npm package (packages/*/src).
// USWDS's docs render these same templates; the package has no pre-rendered HTML, so this script:
//   1. strips the Twig tags (the default render: no `utilities` classes, not disabled),
//   2. wraps each label + control that has no .usa-form-group in a neutral <div class="report-field">, because
//      USWDS only adds a field wrapper in the error state and the contract needs one element per field.
//      The div adds no semantics; names, roles and descriptions are unchanged.
// Usage: node reports/uswds/build-fixtures.mjs  (downloads @uswds/uswds with npm pack into a temp dir)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const VERSION = '3.14.0';
const tmp = mkdtempSync(join(tmpdir(), 'uswds-'));
execFileSync('npm', ['pack', `@uswds/uswds@${VERSION}`, '--silent'], { cwd: tmp });
execFileSync('tar', ['xzf', `uswds-uswds-${VERSION}.tgz`], { cwd: tmp });
const pkg = (p) => readFileSync(join(tmp, 'package', 'packages', p), 'utf8');

const TEMPLATES = [
  ['input showcase', 'usa-input/src/usa-input--showcase.twig'],
  ['character count', 'usa-character-count/src/usa-character-count.twig'],
  ['input prefix', 'usa-input-prefix-suffix/src/usa-input-prefix.twig'],
  ['input suffix', 'usa-input-prefix-suffix/src/usa-input-suffix.twig'],
  ['memorable date', 'usa-memorable-date/src/test/template.html'],
];

const untwig = (s) => s
  .replace(/\{#[\s\S]*?#\}/g, '')
  .replace(/\{%-?\s*if\s+(disabled_state|utilities)\b[\s\S]*?\{%-?\s*endif\s*-?%\}/g, '')
  .replace(/\{%[\s\S]*?%\}/g, '')
  .replace(/\{\{[\s\S]*?\}\}/g, '');

const browser = await chromium.launch();
const page = await browser.newPage();
const fixtures = [];
for (const [name, path] of TEMPLATES) {
  await page.setContent(`<!doctype html><html lang="en"><body>${untwig(pkg(path))}</body></html>`);
  const html = await page.evaluate(() => {
    for (const control of document.querySelectorAll('.usa-input, .usa-textarea')) {
      if (control.closest('.usa-form-group')) continue;
      const label = document.querySelector(`label[for="${control.id}"]`);
      if (!label) continue;
      let end = control;
      while (end.parentElement && end.parentElement !== label.parentElement) end = end.parentElement;
      const wrap = document.createElement('div');
      wrap.className = 'report-field';
      label.before(wrap);
      let node = label;
      while (node) { const next = node.nextSibling; wrap.append(node); if (node === end) break; node = next; }
    }
    return document.body.innerHTML.trim();
  });
  fixtures.push({ name, source: `@uswds/uswds@${VERSION} packages/${path}`, html });
}
await browser.close();
writeFileSync(new URL('fixtures.json', import.meta.url), JSON.stringify({ version: VERSION, fixtures }, null, 2) + '\n');
console.log(`wrote ${fixtures.length} fixtures`);
