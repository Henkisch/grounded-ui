// CSS performance: how much does Grounded UI's CSS cost a host page?
// Builds a heavy page (a site shell plus ~1,000 component instances cloned from contracts/*/markup/valid/) and
// measures it in Chromium, Firefox and WebKit, in three variants:
//   grounded  the markup with Grounded UI's CSS (core + base + styled for every component)
//   none      the same markup with no Grounded UI CSS: the floor
//   classes   the same look as plain class selectors (BEM-style, no @scope, no layers, no :where), generated
//             mechanically from the Grounded CSS and the markup, as the "ordinary CSS" comparison
// Metrics (median of RUNS): first render (insert the markup, force style + layout) and a full restyle (change an
// inherited custom property on <html>, force style + layout). A mutation test appends and removes 100 nodes, with
// and without the rules that use :has(). In Chromium, the DevTools SelectorStats trace lists the costliest selectors.
// Writes dist/perf.json. `node scripts/perf.mjs --check` fails when the overhead exceeds budgets.json → perf.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const root = new URL('..', import.meta.url).pathname;
const RUNS = Number(process.env.PERF_RUNS ?? 10);
const TARGET = 1000;
const ENGINES = { chromium, firefox, webkit };
const check = process.argv.includes('--check');

// --- the page ---------------------------------------------------------------------------------------------
const slugs = readdirSync(join(root, 'contracts')).filter((s) => existsSync(join(root, 'contracts', s, 'contract.yaml'))).sort();
const examples = slugs.flatMap((slug) => {
  const dir = join(root, 'contracts', slug, 'markup', 'valid');
  return readdirSync(dir).filter((f) => f.endsWith('.html')).map((f) => readFileSync(join(dir, f), 'utf8'));
});
const roots = (html) => (html.match(/data-gui="/g) ?? []).length;
const perExample = examples.map(roots);
const copies = Math.ceil(TARGET / perExample.reduce((a, b) => a + b, 0));
// Every id and every reference to one gets a per-copy suffix, so the page stays valid.
const clone = (html, n) => html
  .replace(/\b(id|for|aria-describedby|aria-labelledby|aria-controls|commandfor|popovertarget|list)="([^"]+)"/g, (m, attr, value) => `${attr}="${value.split(/\s+/).map((v) => `${v}-c${n}`).join(' ')}"`)
  .replace(/href="#([^"]+)"/g, (m, id) => `href="#${id}-c${n}"`)
  .replace(/\bname="([^"]+)"/g, (m, name) => `name="${name}-c${n}"`);
const shell = (content) => `<header class="site-header"><a href="/">Municipality</a><nav><ul>${Array.from({ length: 12 }, (_, i) => `<li><a href="/p${i}">Section ${i}</a></li>`).join('')}</ul></nav></header>
<main class="site-main">${content}</main>
<footer class="site-footer">${Array.from({ length: 4 }, (_, i) => `<section><h2>Column ${i}</h2><ul>${Array.from({ length: 6 }, (_, j) => `<li><a href="/f${i}${j}">Link ${j}</a></li>`).join('')}</ul></section>`).join('')}</footer>`;
const blocks = [];
for (let n = 0; n < copies; n++) for (const html of examples) blocks.push(`<section class="block"><h2>Block ${blocks.length}</h2><p>Some running text before the component, as a page would have it.</p>${clone(html, n)}</section>`);
const markup = shell(blocks.join('\n'));
const instances = roots(markup);

// --- the CSS ----------------------------------------------------------------------------------------------
const siteCss = `body { margin: 0; font: 16px/1.5 system-ui, sans-serif; } .site-header, .site-footer { display: flex; gap: 1rem; padding: 1rem; } .site-main { max-width: 48rem; margin: 0 auto; } .block { margin-block: 2rem; } button { font: inherit; }`;
const cssFiles = ['core/core.css', ...slugs.flatMap((s) => [`${s}/${s}.css`, `${s}/${s}.styled.css`])].map((f) => join(root, 'reference', f)).filter(existsSync);
const groundedCss = cssFiles.map((f) => readFileSync(f, 'utf8')).join('\n');

// A minimal CSS block parser: enough for Grounded UI's own files (comments, at-rules, nested rules).
function parse(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let i = 0;
  const block = () => {
    const nodes = [];
    while (i < css.length) {
      let prelude = '';
      while (i < css.length && !'{};'.includes(css[i])) prelude += css[i++];
      if (i >= css.length) break;
      const ch = css[i++];
      if (ch === '}') { if (prelude.trim()) nodes.push({ decl: prelude.trim() }); return nodes; }
      if (ch === ';') { if (prelude.trim()) nodes.push({ decl: prelude.trim() }); continue; }
      nodes.push({ prelude: prelude.trim(), children: block() });
    }
    return nodes;
  };
  return block();
}
const print = (nodes) => nodes.map((n) => (n.decl ? `${n.decl};` : `${n.prelude} {${print(n.children)}}`)).join('\n');

// Grounded CSS → classes: unwrap layers and scopes; :scope → .slug; part hooks → .slug__part; variants → .slug--v.
function toClasses(css) {
  const out = [];
  const selector = (sel, slug) => sel.split(/,(?![^(]*\))/).map((s) => {
    let t = s.trim();
    const scoped = t.includes(':scope');
    t = t.replace(/:scope/g, `.${slug}`)
      .replace(/:where\((\[data-gui-part="[a-z-]+"\])\)/g, '$1')
      .replace(/:where\(([a-z]+)(\[data-gui-part="[a-z-]+"\])\)/g, '$1$2')
      .replace(/\[data-gui-part="([a-z-]+)"\]/g, `.${slug}__$1`)
      .replace(/\[data-gui-part\]/g, `.${slug}__part`)
      .replace(/\[data-gui-variant="([a-z-]+)"\]/g, `.${slug}--$1`)
      .replace(/\[data-gui="([a-z-]+)"\]/g, '.$1')
      .replace(/\[data-gui\]/g, '[class]');
    return scoped || t.startsWith(`.${slug}__`) || t.startsWith(`.${slug}`) ? t : `.${slug} ${t}`;
  }).join(', ');
  const walk = (nodes, slug, inRule) => nodes.map((n) => {
    if (n.decl) return n;
    if (n.prelude.startsWith('@layer')) return { prelude: '@media all', children: walk(n.children, slug, false) };
    const scope = n.prelude.match(/^@scope \(\[data-gui="([a-z-]+)"\]\)/);
    if (scope) return { prelude: '@media all', children: walk(n.children, scope[1], false) };
    if (n.prelude.startsWith('@')) return { prelude: n.prelude, children: walk(n.children, slug, inRule) };
    if (inRule || !slug) return { prelude: n.prelude.replace(/\[data-gui="([a-z-]+)"\]/g, '.$1'), children: walk(n.children, slug, true) };
    return { prelude: selector(n.prelude, slug), children: walk(n.children, slug, true) };
  });
  for (const file of cssFiles) out.push(print(walk(parse(readFileSync(file, 'utf8')).filter((n) => n.prelude || !/^@layer [^{]+$/.test(n.decl)), null, false)));
  return out.join('\n').replace(/@layer [^;{]+;/g, '');
}
const classesCss = toClasses(groundedCss);
// The same Grounded CSS without any rule that uses :has(), to price :has() on its own.
const withoutHas = (css) => print((function strip(nodes) {
  return nodes.filter((n) => n.decl || !n.prelude.includes(':has(')).map((n) => (n.decl ? n : { prelude: n.prelude, children: strip(n.children) }));
})(parse(css)));

// Two informational variants that price the design choices we keep (not shipped):
//   withoutWhere  part hooks without the :where() wrapper (Chromium can't pre-filter rules inside :where())
//   withoutScope  no @scope: each rule prefixed with :where([data-gui="slug"]) instead (loses the donut boundary)
//   withoutDonut  @scope kept, but without the lower boundary `to ([data-gui])`
const withoutDonut = (css) => css.replace(/(@scope \(\[data-gui="[a-z-]+"\]\)) to \(\[data-gui\]\)/g, '$1');
const withoutWhere = (css) => css.replace(/:where\((\[data-gui-part="[a-z-]+"\])\)/g, '$1');
const withoutScope = (css) => print((function walk(nodes, slug) {
  return nodes.flatMap((n) => {
    if (n.decl) return [n];
    const scope = n.prelude.match(/^@scope \(\[data-gui="([a-z-]+)"\]\)/);
    if (scope) return walk(n.children, scope[1]);
    if (n.prelude.startsWith('@') || !slug) return [{ prelude: n.prelude, children: walk(n.children, n.prelude.startsWith('@') ? slug : null) }];
    const sel = n.prelude.split(/,(?![^(]*\))/).map((q) => (q.trim().includes(':scope') ? q.trim().replace(/:scope/g, `:where([data-gui="${slug}"])`) : `:where([data-gui="${slug}"]) ${q.trim()}`)).join(', ');
    return [{ prelude: sel, children: walk(n.children, null) }];
  });
})(parse(css), null));

// Markup for the class variant, converted in the browser (DOM-accurate): hooks become classes.
const toClassMarkup = () => {
  for (const el of document.querySelectorAll('[data-gui-part]')) {
    const owner = el.parentElement.closest('[data-gui]');
    const slug = owner?.dataset.gui;
    if (slug) el.classList.add(`${slug}__part`, `${slug}__${el.dataset.guiPart}`);
  }
  for (const el of document.querySelectorAll('[data-gui]')) {
    el.classList.add(el.dataset.gui);
    if (el.dataset.guiVariant) el.classList.add(`${el.dataset.gui}--${el.dataset.guiVariant}`);
  }
  for (const el of document.querySelectorAll('[data-gui], [data-gui-part], [data-gui-variant]')) {
    el.removeAttribute('data-gui'); el.removeAttribute('data-gui-part'); el.removeAttribute('data-gui-variant');
  }
  return document.body.innerHTML;
};

// --- measuring --------------------------------------------------------------------------------------------
const doc = (css) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${siteCss}</style><style>${css}</style></head><body></body></html>`;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

async function measure(browser, css, html) {
  const firsts = [], restyles = [], mutations = [];
  for (let r = 0; r < RUNS; r++) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.setContent(doc(css));
    const t = await page.evaluate(async (html) => {
      const force = () => document.body.getBoundingClientRect().height + document.body.offsetWidth;
      const t0 = performance.now();
      document.body.innerHTML = html;
      force();
      const first = performance.now() - t0;
      await new Promise(requestAnimationFrame);
      const t1 = performance.now();
      for (let i = 0; i < 5; i++) { document.documentElement.style.setProperty('--perf-tick', String(i)); force(); }
      const restyle = (performance.now() - t1) / 5;
      const main = document.querySelector('main');
      const sample = document.querySelector('main .block')?.cloneNode(true);
      const t2 = performance.now();
      for (let i = 0; i < 100; i++) { const node = sample.cloneNode(true); main.prepend(node); force(); node.remove(); force(); }
      const mutation = performance.now() - t2;
      return { first, restyle, mutation };
    }, html);
    firsts.push(t.first); restyles.push(t.restyle); mutations.push(t.mutation);
    await page.close();
  }
  return { first: median(firsts), restyle: median(restyles), mutation: median(mutations) };
}

async function selectorStats(browser, css, html) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.setContent(doc(css));
  const cdp = await page.context().newCDPSession(page);
  const events = [];
  cdp.on('Tracing.dataCollected', ({ value }) => events.push(...value));
  const done = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve));
  await cdp.send('Tracing.start', { traceConfig: { includedCategories: ['disabled-by-default-blink.debug', 'blink.debug', 'devtools.timeline'] } });
  await page.evaluate((html) => { document.body.innerHTML = html; document.body.getBoundingClientRect(); }, html);
  await cdp.send('Tracing.end');
  await done;
  await page.close();
  const totals = new Map();
  for (const e of events.filter((ev) => ev.name === 'SelectorStats')) {
    for (const s of e.args?.selector_stats?.selector_timings ?? []) {
      const t = totals.get(s.selector) ?? { selector: s.selector, elapsedUs: 0, attempts: 0, matches: 0 };
      t.elapsedUs += s['elapsed (us)'] ?? s.elapsed ?? 0; t.attempts += s.match_attempts ?? 0; t.matches += s.match_count ?? 0;
      totals.set(s.selector, t);
    }
  }
  return [...totals.values()].sort((a, b) => b.elapsedUs - a.elapsedUs);
}

const results = { instances, runs: RUNS, engines: {}, selectors: [] };
for (const [name, type] of Object.entries(ENGINES)) {
  const browser = await type.launch();
  const helper = await browser.newPage();
  await helper.setContent(`<!doctype html><html><body>${markup}</body></html>`);
  const classMarkup = await helper.evaluate(toClassMarkup);
  await helper.close();
  const r = {
    version: browser.version(),
    none: await measure(browser, '', markup),
    grounded: await measure(browser, groundedCss, markup),
    classes: await measure(browser, classesCss, classMarkup),
    groundedWithoutHas: await measure(browser, withoutHas(groundedCss), markup),
    groundedWithoutWhere: await measure(browser, withoutWhere(groundedCss), markup),
    groundedWithoutScope: await measure(browser, withoutScope(groundedCss), markup),
    groundedWithoutDonut: await measure(browser, withoutDonut(groundedCss), markup),
    groundedWithoutDonutOrWhere: await measure(browser, withoutWhere(withoutDonut(groundedCss)), markup),
  };
  results.engines[name] = r;
  if (name === 'chromium') results.selectors = (await selectorStats(browser, groundedCss, markup)).slice(0, 15);
  await browser.close();
}

// --- report -----------------------------------------------------------------------------------------------
const ms = (x) => `${x.toFixed(1)} ms`;
console.log(`\n${instances} component instances on one page, median of ${RUNS} runs\n`);
console.log('| Engine | Metric | No Grounded CSS | Grounded UI | Overhead | Plain classes | Without :has() | Without :where() | Without @scope |');
console.log('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const [name, r] of Object.entries(results.engines)) {
  for (const metric of ['first', 'restyle', 'mutation']) {
    const over = r.grounded[metric] - r.none[metric];
    console.log(`| ${name} ${r.version} | ${{ first: 'First render', restyle: 'Full restyle', mutation: '100 insert/remove' }[metric]} | ${ms(r.none[metric])} | ${ms(r.grounded[metric])} | ${ms(over)} (${((over / r.none[metric]) * 100).toFixed(0)}%) | ${ms(r.classes[metric])} | ${ms(r.groundedWithoutHas[metric])} | ${ms(r.groundedWithoutWhere[metric])} | ${ms(r.groundedWithoutScope[metric])} |`);
  }
}
if (results.selectors.length) {
  console.log('\nCostliest Grounded UI selectors in Chromium (first render):');
  for (const s of results.selectors.slice(0, 10)) console.log(`  ${(s.elapsedUs / 1000).toFixed(2)} ms  ${s.attempts} attempts  ${s.matches} matches  ${s.selector.slice(0, 110)}`);
} else console.log('\n(Chromium produced no SelectorStats events.)');

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'perf.json'), JSON.stringify(results, null, 2) + '\n');

if (check) {
  const budget = JSON.parse(readFileSync(join(root, 'budgets.json'), 'utf8')).perf;
  const worst = Math.max(...Object.values(results.engines).map((r) => (r.grounded.first - r.none.first) * (1000 / instances)));
  console.log(`\nWorst first-render overhead: ${ms(worst)} per 1,000 components (budget ${ms(budget.firstRenderOverheadMsPer1000)})`);
  if (worst > budget.firstRenderOverheadMsPer1000) process.exit(1);
}
