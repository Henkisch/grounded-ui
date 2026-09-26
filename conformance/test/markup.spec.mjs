// Proves the contracts and the runner agree:
//   every markup/valid/*.html passes every rule, with no axe violations;
//   every markup/broken/<RULE>.html fails that rule, and only the rules it declares with "also:".
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { checkPage, loadContracts } from '../src/index.mjs';

const contractsDir = new URL('../../contracts', import.meta.url).pathname;
const contracts = loadContracts(contractsDir);
const html = (slug, kind) => {
  const dir = join(contractsDir, slug, 'markup', kind);
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.html')).sort().map((f) => [f, readFileSync(join(dir, f), 'utf8')]) : [];
};

for (const slug of Object.keys(contracts)) {
  const only = { [slug]: contracts[slug] };

  test.describe(`${slug}: valid markup`, () => {
    for (const [file, source] of html(slug, 'valid')) {
      test(file, async ({ page }) => {
        await page.setContent(source);
        const report = await checkPage(page, { contracts: only });
        expect(report.length, 'component found on the page').toBeGreaterThan(0);
        for (const root of report) {
          expect(root.results.filter((r) => !r.pass), `${root.element}`).toEqual([]);
          expect(root.axeViolations, `axe on ${root.element}`).toEqual([]);
        }
      });
    }
  });

  test.describe(`${slug}: broken markup`, () => {
    for (const [file, source] of html(slug, 'broken')) {
      const rule = file.replace(/\.html$/, '');
      const also = source.match(/also:\s*([A-Z0-9-,\s]+?)\s*-->/)?.[1].split(/[\s,]+/).filter(Boolean) ?? [];
      test(`${rule} fails${also.length ? ` (also ${also.join(', ')})` : ''}`, async ({ page }) => {
        await page.setContent(source);
        const report = await checkPage(page, { contracts: only, axe: false });
        const failed = [...new Set(report.flatMap((root) => root.results.filter((r) => !r.pass).map((r) => r.id)))].sort();
        expect(failed).toEqual([rule, ...also].sort());
      });
    }
  });
}
