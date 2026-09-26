// Grounded UI conformance: test rendered HTML against Grounded UI contracts.
// Works on any implementation. A binding maps the contract's parts to that implementation's markup;
// without one, Grounded UI's own hooks (data-component / data-part) are used.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { parse } from 'yaml';
import { AxeBuilder } from '@axe-core/playwright';
import { evaluateComponent } from './engine.js';

const repo = new URL('../..', import.meta.url).pathname;
const MARKER = 'data-grounded-conformance-root';
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

/** All contracts in contracts/, keyed by slug. */
export function loadContracts(dir = join(repo, 'contracts')) {
  return Object.fromEntries(
    readdirSync(dir)
      .filter((slug) => existsSync(join(dir, slug, 'contract.yaml')))
      .map((slug) => [slug, parse(readFileSync(join(dir, slug, 'contract.yaml'), 'utf8'))]),
  );
}

/** Grounded UI's own markup: the root carries data-component, parts carry data-part. */
export function defaultBinding(contract) {
  const parts = Object.keys(contract.anatomy).filter((key) => key !== 'root');
  return {
    component: contract.component,
    implementation: 'grounded hooks (data-component / data-part)',
    root: `[data-component="${contract.component}"]`,
    boundary: '[data-component]',
    parts: Object.fromEntries(parts.map((part) => [part, `[data-part="${part}"]`])),
  };
}

/** A binding file (YAML) mapping parts to another implementation's selectors. */
export function loadBinding(path) {
  return parse(readFileSync(path, 'utf8'));
}

// Replace {part} tokens with the binding's selector, wrapped in :is() so selector lists compose.
function expandTokens(value, parts, component) {
  if (typeof value === 'string') {
    return value.replace(/\{([a-z-]+)\}/g, (token, name) => {
      if (name === 'id') return token; // expanded per root, in the page
      if (!parts[name]) throw new Error(`${component}: binding has no selector for part "${name}"`);
      return `:is(${parts[name]})`;
    });
  }
  if (Array.isArray(value)) return value.map((v) => expandTokens(v, parts, component));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, expandTokens(v, parts, component)]));
  }
  return value;
}

/**
 * Check one Playwright page against contracts.
 * @param page Playwright page, already navigated.
 * @param options.contracts  from loadContracts(); defaults to all
 * @param options.bindings   { [slug]: binding } overrides; missing slugs use defaultBinding
 * @param options.components limit to these slugs
 * @param options.axe        run axe per root (default true)
 * @returns one entry per root found: { component, implementation, element, results, axeViolations }
 */
export async function checkPage(page, { contracts = loadContracts(), bindings = {}, components, axe = true } = {}) {
  const report = [];
  // The engine computes accessible names and roles with axe-core's accessibility code.
  if (!(await page.evaluate(() => Boolean(window.axe?.commons)))) await page.evaluate(axeSource); // like AxeBuilder: not blocked by a page CSP
  for (const [slug, contract] of Object.entries(contracts)) {
    if (components && !components.includes(slug)) continue;
    const binding = bindings[slug] ?? defaultBinding(contract);
    const rules = contract.rules.map((rule) => ({ ...rule, raw: rule.test, test: expandTokens(rule.test, binding.parts, slug) }));
    const roots = await page.evaluate(evaluateComponent, {
      rootSelector: binding.root,
      boundary: binding.boundary ?? null,
      rules,
      markerAttr: MARKER,
    });
    for (const root of roots) {
      let axeViolations = null;
      if (axe) {
        const { violations } = await new AxeBuilder({ page }).include(root.marker).analyze();
        axeViolations = violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help }));
      }
      report.push({ component: slug, contractVersion: contract.contractVersion, implementation: binding.implementation, element: root.element, results: root.results, axeViolations });
    }
  }
  return report;
}

/**
 * Failures in a report, each marked with whether axe reported anything for that root.
 * @param options.type 'outcome' for the verdict on any implementation; 'technique' for where markup differs
 *                     from Grounded UI's recommended technique; omit for both.
 */
export function failures(report, { type } = {}) {
  return report.flatMap((root) =>
    root.results
      .filter((r) => !r.pass && (!type || r.type === type))
      .map((r) => ({ component: root.component, element: root.element, ...r, axeFoundIssues: root.axeViolations?.length > 0 })),
  );
}
