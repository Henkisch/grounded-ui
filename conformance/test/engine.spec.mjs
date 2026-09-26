// Regression cases for the engine's accessible-name handling, taken from real outside markup.
import { test, expect } from '@playwright/test';
import { checkPage, loadContracts } from '../src/index.mjs';

const contracts = loadContracts(new URL('../../contracts', import.meta.url).pathname);
const outcomes = async (page, html, binding) => {
  await page.setContent(html);
  const [root] = await checkPage(page, { contracts: { 'text-field': contracts['text-field'] }, bindings: { 'text-field': binding }, axe: false });
  return Object.fromEntries(root.results.filter((r) => r.type === 'outcome').map((r) => [r.id, r.pass]));
};

// Contact Form 7: the visible error tip sits inside the label, aria-hidden; a visually hidden copy is the description.
test('an aria-hidden error tip inside the label is not part of the name or the label text', async ({ page }) => {
  const result = await outcomes(page, `
    <p class="row"><label>Your name<br>
      <span class="wrap"><input type="text" name="your-name" aria-invalid="true" aria-describedby="tip">
      <span class="tip" aria-hidden="true">Please fill out this field.</span></span></label></p>
    <ul hidden><li id="tip">Please fill out this field.</li></ul>`,
  { component: 'text-field', root: '.row', parts: { label: 'label', control: 'input', description: ':not(*)', error: '.tip', 'required-indicator': ':not(*)' } });
  expect(result).toMatchObject({ 'TF-17': true, 'TF-18': true, 'TF-20': true });
});
