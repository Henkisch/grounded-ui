// Isolation demo: do Grounded UI's text field and dialog work unchanged inside real, heavily themed pages?
// Usage: node isolation/run.mjs [site-id …]   Writes isolation/results.json and isolation/screenshots/.
// For each site: add Grounded UI's CSS (as a site would link it; site CSS untouched), paste the reference markup
// into the main content area, then check the contracts + axe, the dialog's keyboard behaviour, and CSS leakage
// against the same markup on a blank page.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { chromium } from '@playwright/test';
import { checkPage, defaultBinding, loadContracts } from '../conformance/src/index.mjs';

const repo = new URL('..', import.meta.url).pathname;
const here = join(repo, 'isolation');
const read = (p) => readFileSync(join(repo, p), 'utf8');
const css = ['reference/core/core.css', 'reference/text-field/text-field.css', 'reference/text-field/text-field.styled.css', 'reference/dialog/dialog.css', 'reference/dialog/dialog.styled.css'].map(read).join('\n');
const markup = ['contracts/text-field/markup/valid/invalid.html', 'contracts/text-field/markup/valid/with-description.html', 'contracts/dialog/markup/valid/basic.html'].map(read).join('\n');
const contracts = loadContracts();
const { sites } = parse(readFileSync(join(here, 'sites.yaml'), 'utf8'));
const only = process.argv.slice(2);
// Only our pasted roots: some sites use data-gui themselves.
const bindings = Object.fromEntries(['text-field', 'dialog'].map((slug) => [slug, { ...defaultBinding(contracts[slug]), root: `#grounded-isolation [data-gui="${slug}"]` }]));

// Parts whose computed style we compare, and the properties that make up the component's geometry.
const PARTS = {
  'text-field root': '#grounded-isolation [data-gui="text-field"]',
  label: '#grounded-isolation [data-gui-part="label"]',
  description: '#grounded-isolation [data-gui-part="description"]',
  control: '#grounded-isolation [data-gui-part="control"]',
  error: '#grounded-isolation [data-gui-part="error"]',
  'dialog root': '#grounded-isolation [data-gui="dialog"]',
  title: '#grounded-isolation [data-gui-part="title"]',
  body: '#grounded-isolation [data-gui-part="body"]',
  actions: '#grounded-isolation [data-gui-part="actions"]',
};
const LENGTHS = ['margin-top', 'margin-bottom', 'margin-left', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right', 'border-top-width', 'border-left-width', 'min-height', 'height', 'line-height', 'border-radius', 'letter-spacing'];
const KEYWORDS = ['box-sizing', 'border-top-style', 'display', 'text-transform', 'appearance', 'width-fill'];
const COLOURS = ['color', 'background-color', 'border-top-color'];

// Runs in the page: computed style of each part, lengths in em of the element's own font size.
function measure({ parts, lengths, keywords, colours, open }) {
  const out = {};
  const dialog = document.querySelector('#grounded-isolation [data-gui="dialog"]');
  if (open && dialog && !dialog.open) dialog.showModal();
  for (const [name, selector] of Object.entries(parts)) {
    const el = document.querySelector(selector);
    if (!el) continue;
    if (!open && el.closest('dialog')) continue;
    if (open && !el.closest('dialog')) continue;
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    const context = parseFloat(getComputedStyle(el.closest('[data-gui]').parentElement).fontSize);
    const row = { 'font-size (em of context)': +(fs / context).toFixed(3) };
    for (const p of lengths) {
      const v = p === 'height' ? el.getBoundingClientRect().height : parseFloat(cs.getPropertyValue(p));
      row[p] = Number.isFinite(v) ? +(v / fs).toFixed(3) : cs.getPropertyValue(p);
    }
    if (name === 'dialog root') row['width'] = +(el.getBoundingClientRect().width / fs).toFixed(3);
    for (const p of keywords.filter((k) => !(k === 'width-fill' && name === 'dialog root'))) row[p] = p === 'width-fill' ? (el.getBoundingClientRect().width >= el.parentElement.getBoundingClientRect().width - 2 ? 'fills' : 'narrower') : cs.getPropertyValue(p);
    for (const p of colours) row[p] = cs.getPropertyValue(p);
    if (name === 'control') {
      const rest = { shadow: cs.boxShadow, border: cs.borderTopColor, bg: cs.backgroundColor, bw: cs.borderTopWidth, bs: cs.borderTopStyle };
      el.focus();
      const f = getComputedStyle(el);
      const outline = f.outlineStyle !== 'none' && parseFloat(f.outlineWidth) >= 2;
      const other = f.boxShadow !== rest.shadow || f.borderTopColor !== rest.border || f.backgroundColor !== rest.bg || f.borderTopWidth !== rest.bw || f.borderTopStyle !== rest.bs;
      const strongOther = f.boxShadow !== 'none' && f.boxShadow !== rest.shadow || parseFloat(f.borderTopWidth) >= 2 && f.borderTopWidth !== rest.bw || f.backgroundColor !== rest.bg;
      row['focus indicator'] = outline ? 'outline ≥ 2px' : strongOther ? 'other (shadow, thick border or background)' : other ? 'weak (thin border change only)' : 'none';
      el.blur();
      // The error state must look different from a valid field (the fixture's first control is invalid, the second valid).
      const valid = document.querySelectorAll('#grounded-isolation [data-gui-part="control"]')[1];
      const v = getComputedStyle(valid);
      const differs = cs.borderTopColor !== v.borderTopColor || cs.borderTopWidth !== v.borderTopWidth || cs.boxShadow !== v.boxShadow || cs.outlineStyle !== v.outlineStyle;
      row['error cue'] = differs ? 'visible' : 'lost (looks like a valid field)';
    }
    out[name] = row;
  }
  if (open && dialog?.open) {
    const bd = getComputedStyle(dialog, '::backdrop');
    out['dialog root']['backdrop'] = `${bd.backdropFilter} ${bd.backgroundColor}`;
    out['dialog root']['position'] = getComputedStyle(dialog).position;
    out['dialog root']['centred'] = Math.abs((dialog.getBoundingClientRect().left + dialog.getBoundingClientRect().right) / 2 - innerWidth / 2) < 4 ? 'yes' : 'no';
    dialog.close();
  }
  return out;
}

async function inject(page) {
  await page.addStyleTag({ content: css });
  await page.evaluate((html) => {
    // The main content area; pages without main/article get it before their first content container,
    // so a fixed header doesn't cover it.
    const host = document.querySelector('main, [role="main"]') ?? document.querySelector('article');
    const section = document.createElement('section');
    section.id = 'grounded-isolation';
    section.setAttribute('aria-label', 'Grounded UI isolation test');
    section.innerHTML = html;
    // After the host's first block (usually the hero), where an editor would add content, and clear of a
    // fixed header that covers the top of the page.
    if (host) host.firstElementChild && host.firstElementChild.nextElementSibling ? host.firstElementChild.after(section) : host.prepend(section);
    else {
      const first = document.querySelector('#content, .content, .jumbotron, body > .container, body > section, body > div:not([class*="nav"])');
      first ? first.before(section) : document.body.prepend(section);
    }
    section.scrollIntoView({ block: 'start' });
  }, markup);
}

async function measureAll(page) {
  const args = { parts: PARTS, lengths: LENGTHS, keywords: KEYWORDS, colours: COLOURS };
  const closed = await page.evaluate(measure, { ...args, open: false });
  const opened = await page.evaluate(measure, { ...args, open: true });
  return { ...closed, ...opened };
}

// The dialog, driven like a user: click the trigger, check it is modal with focus inside, Esc, focus back.
async function dialogBehaviour(page) {
  const trigger = page.locator('#grounded-isolation button[command="show-modal"]');
  const result = {};
  try {
    await trigger.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    try {
      await trigger.click({ timeout: 4000 });
    } catch (error) {
      // Something of the site's covers the trigger (a sticky header, a chat or cookie widget). Record what,
      // then open it the way a keyboard user would.
      result.clickBlockedBy = error.message.replace(/\u001b\[[0-9;]*m/g, '').match(/<[^>]+> (?:from <[^>]+> subtree )?intercepts pointer events/)?.[0] ?? error.message.split('\n')[0];
      await trigger.focus();
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(400);
    Object.assign(result, await page.evaluate(() => {
      const d = document.querySelector('#grounded-isolation dialog');
      return { modal: d.matches(':modal'), focusInside: d.contains(document.activeElement) };
    }));
    result.screenshot = true;
    // Record whether a site script cancels the Escape keydown (that also cancels the dialog's close request).
    await page.evaluate(() => { window.__groundedEsc = null; addEventListener('keydown', (e) => { if (e.key === 'Escape') window.__groundedEsc = e.defaultPrevented; }, { once: true }); });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    Object.assign(result, await page.evaluate(() => {
      const d = document.querySelector('#grounded-isolation dialog');
      return { escapePreventedBySite: window.__groundedEsc === true, closedByEsc: !d.open, focusReturned: document.activeElement === document.querySelector('#grounded-isolation button[command="show-modal"]') };
    }));
  } catch (error) {
    result.error = error.message.split('\n')[0];
  }
  return result;
}

// Site rules that set a leaked property on a part: matched CSS rules outside the grounded layers (CDP).
async function causes(page, cdp, selector, props) {
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  if (!nodeId) return [];
  const { matchedCSSRules = [] } = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
  const found = [];
  for (const { rule } of matchedCSSRules) {
    if (rule.origin !== 'regular') continue;
    if ((rule.layers ?? []).some((l) => l.text?.startsWith('grounded'))) continue;
    const set = rule.style.cssProperties.filter((p) => !p.disabled && props.some((q) => p.name === q || q.startsWith(p.name) || p.name.startsWith(q.split('-')[0])));
    if (set.length) found.push(`${rule.selectorList.text} { ${set.map((p) => `${p.name}: ${p.value}`).join('; ')} }`);
  }
  return [...new Set(found)].slice(-10);
}

const GEOMETRY_TOLERANCE = 0.15; // em
// Inherited typography and colour are intended: the component takes on the site's type and palette.
const TYPOGRAPHY = ['line-height', 'letter-spacing', 'text-transform'];
function diff(base, site) {
  const out = [];
  for (const [part, row] of Object.entries(base)) {
    const s = site[part];
    if (!s) { out.push({ part, prop: '(part)', base: 'present', site: 'missing', kind: 'geometry' }); continue; }
    for (const [prop, v] of Object.entries(row)) {
      const w = s[prop];
      if (prop === 'height' && part !== 'control') continue; // follows from type and spacing
      if (part === 'dialog root' && prop.startsWith('margin')) continue; // auto margins centre it; see `centred`
      const kind = COLOURS.includes(prop) ? 'colour' : prop.startsWith('font-size') || TYPOGRAPHY.includes(prop) ? 'typography' : prop.startsWith('margin') ? 'spacing' : 'geometry';
      if (typeof v === 'number' && typeof w === 'number') {
        const tol = kind === 'typography' ? 0.1 : GEOMETRY_TOLERANCE;
        if (Math.abs(v - w) > tol) out.push({ part, prop, base: v, site: w, kind });
      } else if (v !== w) {
        out.push({ part, prop, base: v, site: w, kind });
      }
    }
  }
  return out;
}

// works: contract passes, dialog behaves, only type, colour or small spacing differs (intended: it inherits the site).
// degraded: works, but the site's CSS changes the component's shape (control box, focus ring, dialog surface) or
// adds large gaps between parts. broken: an outcome rule fails, or the dialog stops working.
function verdict(entry) {
  const outcome = entry.contract?.flatMap((c) => c.failed.filter((f) => f.type === 'outcome')) ?? [];
  const d = entry.dialog ?? {};
  const why = [];
  if (entry.error) return { verdict: 'broken', why: [entry.error] };
  if (outcome.length) why.push(`outcome rules fail: ${[...new Set(outcome.map((f) => f.id))].join(', ')}`);
  if (!(d.modal && d.focusInside && d.closedByEsc && d.focusReturned)) why.push(`dialog: ${JSON.stringify(d)}`);
  if (entry.leaks.some((l) => l.prop === '(part)')) why.push('a part is missing');
  if (why.length) return { verdict: 'broken', why };
  // Focus: any visible indicator is fine (a site's own ring included); none at all is an accessibility failure.
  const leak = (part, prop) => entry.leaks.find((l) => l.part === part && l.prop === prop);
  if (leak('control', 'focus indicator')?.site === 'none') return { verdict: 'broken', why: ['control has no visible focus indicator (site CSS removes the outline)'] };
  // Degraded = looks broken, not "looks like the site": inherited type, colour, spacing and the site's own input
  // styling are intended.
  const bad = [];
  if (leak('control', 'focus indicator')?.site?.startsWith('weak')) bad.push('focus indicator only a thin border change');
  if (leak('control', 'error cue')) bad.push('invalid field looks like a valid one (error border overridden)');
  const h = leak('control', 'height');
  if (h && h.site < 2.75) bad.push(`control below the 2.75em touch target (${h.site}em)`);
  const dialog = entry.leaks.filter((l) => l.part === 'dialog root' && /^(centred|position|backdrop|padding|width)/.test(l.prop) && !(l.prop === 'width' && l.site > 10) && !(l.prop.startsWith('padding') && l.site > 0.5));
  bad.push(...dialog.map((l) => `dialog ${l.prop}: ${l.base} → ${l.site}`));
  return bad.length ? { verdict: 'degraded', why: bad } : { verdict: 'works', why: [] };
}

const browser = await chromium.launch();
const newContext = () => browser.newContext({
  bypassCSP: true, // a site adding its own stylesheet isn't subject to its CSP; injecting through the page is
  viewport: { width: 1280, height: 900 },
  locale: 'sv-SE',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
});

// Baseline: the same markup on a blank page with only Grounded UI CSS.
const baseCtx = await newContext();
const basePage = await baseCtx.newPage();
await basePage.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body><main></main></body></html>');
await inject(basePage);
const baseline = await measureAll(basePage);
await baseCtx.close();

const results = [];
for (const site of sites) {
  if (only.length && !only.includes(site.id)) continue;
  const ctx = await newContext();
  const page = await ctx.newPage();
  const entry = { id: site.id, url: site.url, cms: site.cms };
  try {
    await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    // A consent banner as a modal <dialog> would make the page (and our components) inert: accept it first.
    const consent = page.getByRole('button', { name: /^(acceptera|godkänn|tillåt|accept|allow|ok|jag förstår)/i }).first();
    if (await consent.isVisible().catch(() => false)) { await consent.click().catch(() => {}); await page.waitForTimeout(800); entry.consentDismissed = true; }
    await inject(page);
    await page.waitForTimeout(500);
    const report = await checkPage(page, { contracts, bindings, components: ['text-field', 'dialog'] });
    entry.contract = report.map((r) => ({ component: r.component, element: r.element, failed: r.results.filter((x) => !x.pass).map((x) => ({ id: x.id, type: x.type, detail: x.detail })), axe: r.axeViolations.map((v) => v.id) }));
    const area = page.locator('#grounded-isolation');
    // Fixed and sticky headers would cover the area in an element screenshot: hide them for the shot only.
    await page.evaluate(() => { for (const el of document.querySelectorAll('body *')) { const p = getComputedStyle(el).position; if ((p === 'fixed' || p === 'sticky') && !el.closest('#grounded-isolation')) { el.dataset.isoHidden = el.style.visibility; el.style.visibility = 'hidden'; } } });
    await area.screenshot({ path: join(here, 'screenshots', `${site.id}.png`) }).catch((e) => (entry.screenshotError = e.message.split('\n')[0]));
    await page.evaluate(() => { for (const el of document.querySelectorAll('[data-iso-hidden]')) { el.style.visibility = el.dataset.isoHidden; delete el.dataset.isoHidden; } });
    entry.dialog = await dialogBehaviour(page);
    if (entry.dialog.screenshot) {
      await page.locator('#grounded-isolation button[command="show-modal"]').focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(here, 'screenshots', `${site.id}-dialog.png`) });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    const measured = await measureAll(page);
    entry.leaks = diff(baseline, measured);
    Object.assign(entry, verdict(entry));
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    entry.causes = {};
    for (const part of [...new Set(entry.leaks.filter((l) => l.kind !== 'colour').map((l) => l.part))]) {
      const props = entry.leaks.filter((l) => l.part === part && l.kind !== 'colour').map((l) => l.prop.replace(/ .*/, '').replace('width-fill', 'width').replace('focus', 'outline').replace('error', 'border'));
      if (part.startsWith('dialog') || ['title', 'body', 'actions'].includes(part)) await page.evaluate(() => document.querySelector('#grounded-isolation dialog').showModal());
      if (part === 'control') await page.focus(PARTS.control); // so :focus rules that remove the ring match
      entry.causes[part] = await causes(page, cdp, PARTS[part], props);
      await page.evaluate(() => document.querySelector('#grounded-isolation dialog')?.close());
    }
  } catch (error) {
    entry.error = error.message.split('\n')[0];
  }
  results.push(entry);
  if (entry.error) Object.assign(entry, verdict(entry));
  console.log(`${site.id}: ${entry.verdict} — ${entry.why?.join('; ').slice(0, 300)}`);
  await ctx.close();
}
await browser.close();
// A run on some sites updates only their entries.
let all = results;
if (only.length) {
  try {
    const previous = JSON.parse(readFileSync(join(here, 'results.json'), 'utf8')).results;
    all = sites.map((site) => results.find((r) => r.id === site.id) ?? previous.find((r) => r.id === site.id)).filter(Boolean);
  } catch {}
}
writeFileSync(join(here, 'results.json'), JSON.stringify({ date: new Date().toISOString().slice(0, 10), baseline, results: all }, null, 2) + '\n');
