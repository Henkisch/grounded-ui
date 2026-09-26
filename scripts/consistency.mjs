// Cross-engine consistency: does each component look and behave the same in Chromium, Firefox and WebKit?
// Renders every valid fixture with Grounded UI's CSS (core + base + styled) in all three engines, opens dialogs
// and popovers, measures each part's box and type, checks that keyboard focus shows a ring, and compares.
// Writes dist/consistency.json and a screenshot per component and engine to dist/consistency/.
// A difference within TOLERANCE_PX is rendering noise, not a difference.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';
import { parse } from 'yaml';

const root = new URL('..', import.meta.url).pathname;
const TOLERANCE_PX = 1;
const ENGINES = { chromium, firefox, webkit };
// Box and type properties that decide how a part looks. Font family is left out: it's the site's (system-ui here).
const PROPS = ['block-size', 'font-size', 'line-height', 'font-weight', 'padding-block-start', 'padding-inline-start',
  'border-block-start-width', 'border-block-start-style', 'border-start-start-radius', 'min-block-size'];

// Grounded UI CSS for every component in the markup (a dialog may hold a text field).
const used = (markup) => [...new Set([...markup.matchAll(/data-gui="([a-z0-9-]+)"/g)].map((m) => m[1]))];
const css = (markup) => ['core/core.css', ...used(markup).flatMap((c) => [`${c}/${c}.css`, `${c}/${c}.styled.css`])]
  .map((f) => join(root, 'reference', f)).filter(existsSync).map((f) => readFileSync(f, 'utf8')).join('\n');
// The host site's CSS: a font, and buttons that use it (sites style their own buttons; browsers' defaults differ).
const page = (markup) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light">
<style>${css(markup)}</style><style>body { margin: 1em; font: 16px/1.5 system-ui, sans-serif; } button { font: inherit; }</style></head>
<body>${markup}</body></html>`;

// Runs in the page: every part (and the root) with its measured properties; open overlays first.
function measure(props) {
  const out = {};
  document.querySelectorAll('[data-gui]').forEach((root, r) => {
    [root, ...root.querySelectorAll('[data-gui-part]')].forEach((el, i) => {
      const s = getComputedStyle(el);
      const key = `${root.dataset.gui}#${r} ${el === root ? 'root' : el.dataset.guiPart}${i ? `:${i}` : ''}`;
      // An inline box's height is the font's content area, which differs per engine without changing the line.
      const inline = s.display === 'inline';
      out[key] = Object.fromEntries(props.filter((p) => !(inline && p === 'block-size')).map((p) => [p, p === 'block-size' ? `${Math.round(el.getBoundingClientRect().height)}px` : s.getPropertyValue(p)]));
    });
  });
  return out;
}

const browsers = Object.fromEntries(await Promise.all(Object.entries(ENGINES).map(async ([name, type]) => [name, await type.launch()])));

async function render(engine, slug, markup) {
  const context = await browsers[engine].newContext({ viewport: { width: 640, height: 720 } });
  const tab = await context.newPage();
  await tab.setContent(page(markup));
  const trigger = tab.locator('[command="show-modal"], [command="toggle-popover"], [popovertarget]').first();
  if (await trigger.count()) {
    await trigger.click();
    await tab.waitForTimeout(400); // past the open transition
  }
  const boxes = await tab.evaluate(measure, PROPS);
  // Focus: each focusable part, focused after a key press (so :focus-visible applies), must draw a ring of 2px+.
  // Parts are tested directly: Tab order itself differs (WebKit skips buttons by default).
  await tab.keyboard.press('Shift');
  const focus = await tab.evaluate(() => [...document.querySelectorAll('[data-gui-part], [data-gui]')]
    .filter((el) => el.matches('input, select, textarea, button, summary, a[href], [tabindex]') && !el.disabled && el.checkVisibility())
    .map((el) => {
      document.activeElement?.blur(); // a mouse-focused element keeps its no-ring state in Firefox
      el.focus({ focusVisible: true }); // as after Tab, in every engine
      const s = getComputedStyle(el);
      return { element: el.dataset.guiPart ?? el.dataset.gui, ring: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2 };
    }));
  const shot = await tab.screenshot({ animations: 'disabled' });
  await context.close();
  return { boxes, focus, shot };
}

const same = (values) => {
  const px = values.map((v) => (/^-?[\d.]+px$/.test(v) ? parseFloat(v) : null));
  if (px.every((n) => n !== null)) return Math.max(...px) - Math.min(...px) <= TOLERANCE_PX;
  return new Set(values).size === 1;
};

const contractsDir = join(root, 'contracts');
const outDir = join(root, 'dist', 'consistency');
mkdirSync(outDir, { recursive: true });
const report = {};

for (const slug of readdirSync(contractsDir).filter((s) => existsSync(join(contractsDir, s, 'contract.yaml'))).sort()) {
  const contract = parse(readFileSync(join(contractsDir, slug, 'contract.yaml'), 'utf8'));
  const known = contract.knownDifferences ?? [];
  const validDir = join(contractsDir, slug, 'markup', 'valid');
  const fixtures = readdirSync(validDir).filter((f) => f.endsWith('.html')).sort();
  let checks = 0;
  const differences = [];
  for (const [n, file] of fixtures.entries()) {
    const markup = readFileSync(join(validDir, file), 'utf8');
    const results = {};
    for (const engine of Object.keys(ENGINES)) results[engine] = await render(engine, slug, markup);
    if (n === 0) for (const [engine, r] of Object.entries(results)) writeFileSync(join(outDir, `${slug}-${engine}.png`), r.shot);
    for (const part of Object.keys(results.chromium.boxes)) {
      for (const prop of PROPS) {
        const values = Object.values(results).map((r) => r.boxes[part]?.[prop] ?? 'missing');
        checks++;
        if (same(values)) continue;
        const partName = part.split(' ')[1].split(':')[0];
        const reason = known.find((k) => k.part === partName && (!k.property || k.property === prop))?.reason;
        differences.push({ fixture: file, part, property: prop, values: Object.fromEntries(Object.keys(ENGINES).map((e, i) => [e, values[i]])), ...(reason && { known: reason }) });
      }
    }
    for (const [i, f] of results.chromium.focus.entries()) {
      checks++;
      const rings = Object.values(results).map((r) => r.focus[i]?.ring ?? null);
      if (!rings.every(Boolean)) differences.push({ fixture: file, part: f.element, property: 'focus ring', values: Object.fromEntries(Object.keys(ENGINES).map((e, j) => [e, String(rings[j])])) });
    }
  }
  const unexplained = differences.filter((d) => !d.known).length;
  report[slug] = { checks, passed: checks - differences.length, unexplained, differences };
  console.log(`${unexplained ? 'diff' : 'ok  '} ${slug.padEnd(12)} ${checks - differences.length}/${checks} the same in 3 engines${differences.length - unexplained ? ` (${differences.length - unexplained} known)` : ''}`);
  for (const d of differences.filter((x) => !x.known)) console.log(`       ${d.fixture} ${d.part} ${d.property}: ${Object.entries(d.values).map(([e, v]) => `${e} ${v}`).join(' · ')}`);
}

writeFileSync(join(root, 'dist', 'consistency.json'), JSON.stringify(report, null, 2) + '\n');
await Promise.all(Object.values(browsers).map((b) => b.close()));
