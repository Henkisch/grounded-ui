// The receipts: generated per component, never typed.
//   rules passed on the reference fixtures (conformance runner, Chromium), axe violations,
//   CSS bytes (from dist/sizes.json, written by scripts/budget.mjs), JS bytes, Baseline status, WCAG criteria.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { features } from 'web-features';
import { checkPage } from '../../../conformance/src/index.mjs';
import { table } from './mdx.mjs';

const RANK = { false: 0, low: 1, high: 2 };

function baseline(contract) {
  const required = (contract.requires ?? []).filter((r) => !r.optional).map((r) => features[r.feature].status);
  if (!required.length) return { label: 'Widely available', rank: 2 };
  const weakest = required.reduce((a, b) => (RANK[b.baseline] < RANK[a.baseline] ? b : a));
  const rank = RANK[weakest.baseline];
  const since = required.filter((s) => s.baseline === 'low').map((s) => s.baseline_low_date).sort().at(-1);
  return { rank, label: rank === 2 ? 'Widely available' : rank === 1 ? `Newly available (${since})` : 'Limited availability' };
}

export async function scorecards(repo, contracts) {
  const sizesPath = join(repo, 'dist', 'sizes.json');
  if (!existsSync(sizesPath)) throw new Error('dist/sizes.json missing: run `node scripts/budget.mjs` first');
  const sizes = JSON.parse(readFileSync(sizesPath, 'utf8'));
  const size = (slug, kind) => sizes.find((e) => e.name === slug && e.kind === kind)?.bytes ?? 0;

  // Cross-engine consistency, from scripts/consistency.mjs (optional: absent means not measured).
  const consistencyPath = join(repo, 'dist', 'consistency.json');
  const consistency = existsSync(consistencyPath) ? JSON.parse(readFileSync(consistencyPath, 'utf8')) : {};

  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  const cards = {};
  for (const [slug, contract] of Object.entries(contracts)) {
    const dir = join(repo, 'contracts', slug, 'fixtures', 'valid');
    let checks = 0, passed = 0, axe = 0;
    const fixtures = readdirSync(dir).filter((f) => f.endsWith('.html'));
    for (const file of fixtures) {
      await page.setContent(readFileSync(join(dir, file), 'utf8'));
      for (const root of await checkPage(page, { contracts: { [slug]: contract } })) {
        if (root.component !== slug) continue;
        checks += root.results.length;
        passed += root.results.filter((r) => r.pass).length;
        axe += root.axeViolations.length;
      }
    }
    cards[slug] = {
      title: contract.title,
      rules: contract.rules.length,
      normative: contract.rules.filter((r) => r.level === 'normative').length,
      outcome: contract.rules.filter((r) => r.type === 'outcome').length,
      fixtures: fixtures.length,
      allPass: checks > 0 && passed === checks,
      axe,
      cssBase: size(slug, 'css base'),
      cssStyled: size(slug, 'css styled'),
      js: size(slug, 'js'),
      baseline: baseline(contract),
      wcag: (contract.wcag ?? []).length,
      consistency: consistency[slug] ?? null,
    };
  }
  await browser.close();
  return cards;
}

const kb = (bytes) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`);

/** One component's receipts as a single-row table. */
export function scorecardTable(card) {
  return table(
    ['Contract', 'axe', 'CSS (brotli)', 'JavaScript', 'Browsers', 'WCAG'],
    [[
      `${card.allPass ? '✓' : '✗'} ${card.rules} rules on ${card.fixtures} examples`,
      card.axe === 0 ? '✓ 0 violations' : `✗ ${card.axe}`,
      `${kb(card.cssBase)} base + ${kb(card.cssStyled)} styled`,
      card.js === 0 ? '0 B' : kb(card.js),
      `Baseline: ${card.baseline.label}`,
      `${card.wcag} criteria`,
    ]],
  );
}

/** All components, one row each, for the front page. */
export function scorecardOverview(cards) {
  return table(
    ['Component', 'Contract', 'axe', 'CSS (brotli)', 'JavaScript', 'Browsers'],
    Object.entries(cards).map(([slug, card]) => [
      `[${card.title}](/components/${slug})`,
      `${card.allPass ? '✓' : '✗'} ${card.rules} rules`,
      card.axe === 0 ? '✓ 0' : `✗ ${card.axe}`,
      `${kb(card.cssBase)} + ${kb(card.cssStyled)}`,
      card.js === 0 ? '0 B' : kb(card.js),
      card.baseline.label,
    ]),
  );
}

/** One component's receipts as a row of badges, for the top of its page. */
export function scorecardBadges(card) {
  const badge = (ok, text, tooltip) => `<Badge variant="${ok ? 'success' : 'danger'}" tooltip="${tooltip}">${text}</Badge>`;
  return [
    badge(card.allPass, `${card.allPass ? '✓' : '✗'} ${card.rules} contract rules`, `Run on all ${card.fixtures} examples in the build`),
    badge(card.axe === 0, card.axe === 0 ? '✓ axe: 0 violations' : `✗ axe: ${card.axe}`, 'axe-core on every example'),
    `<Badge tooltip="Brotli-compressed; base is required, styled optional">${kb(card.cssBase)} + ${kb(card.cssStyled)} CSS</Badge>`,
    `<Badge tooltip="JavaScript shipped">${card.js === 0 ? '0 B' : kb(card.js)} JS</Badge>`,
    `<Badge tooltip="From the web-features data">Baseline: ${card.baseline.label}</Badge>`,
    ...(card.consistency ? [badge(card.consistency.unexplained === 0, `${card.consistency.unexplained === 0 ? '✓' : '✗'} Same in 3 engines`, `${card.consistency.passed} of ${card.consistency.checks} measurements match in Chromium, Firefox and WebKit${card.consistency.checks - card.consistency.passed ? `; ${card.consistency.checks - card.consistency.passed} known difference(s)` : ''}`)] : []),
  ].join(' ');
}
