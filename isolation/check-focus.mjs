// Screenshots of the pasted control with keyboard focus, to confirm the focus-indicator finding by eye.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const css = ['reference/core/core.css', 'reference/text-field/text-field.css', 'reference/text-field/text-field.styled.css'].map(read).join('\n');
const b = await chromium.launch();
for (const [id, url] of [['divi', 'https://www.elegantthemes.com/preview/Divi/'], ['astra', 'https://wpastra.com/']]) {
  const ctx = await b.newContext({ bypassCSP: true, viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  await p.addStyleTag({ content: css });
  await p.evaluate((h) => { const s = document.createElement('section'); s.id = 'gi'; s.style.padding = '2em'; s.innerHTML = h; (document.querySelector('main, article') ?? document.body).prepend(s); s.scrollIntoView({ block: 'center' }); }, read('contracts/text-field/fixtures/valid/with-description.html'));
  await p.locator('#gi input').focus();
  await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab'); // keyboard focus → :focus-visible
  await p.waitForTimeout(300);
  const info = await p.evaluate(() => { const c = document.querySelector('#gi input'); const f = getComputedStyle(c); return { active: document.activeElement === c, outline: `${f.outlineStyle} ${f.outlineWidth} ${f.outlineColor}`, shadow: f.boxShadow, border: f.borderTopColor }; });
  console.log(id, JSON.stringify(info));
  await p.locator('#gi').screenshot({ path: new URL(`screenshots/${id}-focus.png`, import.meta.url).pathname });
  await ctx.close();
}
await b.close();
