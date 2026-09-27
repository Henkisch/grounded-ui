// Captures WordPress core and Contact Form 7 markup as rendered by a real WordPress (WordPress Playground,
// PHP in the browser), then saves it as fixtures for reports/run.mjs. Playground sites only live inside the
// booting browser, so pages can't be listed in report.yaml as URLs; this script visits them and snapshots
// document.body (scripts removed) after each interaction.
// Usage: node reports/wordpress-core/capture.mjs
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const blueprint = {
  landingPage: '/',
  login: false,
  preferredVersions: { php: '8.3', wp: 'latest' },
  steps: [
    { step: 'installPlugin', pluginData: { resource: 'wordpress.org/plugins', slug: 'contact-form-7' } },
    {
      step: 'runPHP',
      code: `<?php require '/wordpress/wp-load.php';
$forms = get_posts(['post_type' => 'wpcf7_contact_form', 'numberposts' => 1]);
if ($forms) { $id = $forms[0]->ID; } else { $cf = WPCF7_ContactForm::get_template(['title' => 'Contact form 1']); $cf->save(); $id = $cf->id(); }
wp_insert_post(['post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Contact', 'post_name' => 'contact', 'post_content' => '[contact-form-7 id="' . $id . '" title="Contact form 1"]']);
wp_insert_post(['post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Search block', 'post_name' => 'search-block', 'post_content' =>
  '<!-- wp:search {"label":"Search","buttonText":"Search"} /-->' .
  '<!-- wp:search {"label":"Search","showLabel":false,"placeholder":"Search the site","buttonText":"Search","buttonPosition":"button-inside"} /-->' .
  '<!-- wp:search {"label":"Search","showLabel":false,"buttonText":"Search","buttonPosition":"no-button"} /-->']);
wp_insert_post(['post_type' => 'post', 'post_status' => 'publish', 'post_title' => 'Members only', 'post_name' => 'members-only', 'post_password' => 'secret', 'post_content' => 'Protected text.']);
`,
    },
  ],
};

const browser = await chromium.launch();
const context = await browser.newContext();
const boot = await context.newPage();
await boot.goto('https://playground.wordpress.net/?login=no#' + JSON.stringify(blueprint), { waitUntil: 'load', timeout: 120000 });
let base;
for (let i = 0; i < 90 && !base; i++) {
  await boot.waitForTimeout(2000);
  base = boot.frames().map((f) => f.url()).find((u) => /\/scope:[^/]+\//.test(u))?.match(/^(.*\/scope:[^/]+)\//)?.[1];
}
if (!base) throw new Error('Playground did not boot');
await boot.waitForTimeout(3000);

const page = await context.newPage();
const snapshot = () => page.evaluate(() => {
  const body = document.body.cloneNode(true);
  body.querySelectorAll('script, noscript, link, iframe').forEach((el) => el.remove());
  return body.innerHTML;
});
const version = async () => page.evaluate(() => document.querySelector('meta[name=generator]')?.content ?? '');
const wp = [];
const cf7 = [];
const go = async (path) => { await page.goto(base + path, { waitUntil: 'networkidle' }); };

await go('/?p=1');
const wpVersion = await version();
wp.push({ name: 'Comment form (Twenty Twenty-Five, logged out)', html: await snapshot() });

await go('/search-block/');
wp.push({ name: 'Search block: visible label, hidden label, no button', html: await snapshot() });

await go('/members-only/');
wp.push({ name: 'Post password form', html: await snapshot() });

await go('/wp-login.php');
wp.push({ name: 'Log in (wp-login.php)', html: await snapshot() });
await page.fill('#user_login', 'nobody');
await page.fill('#user_pass', 'wrong');
await Promise.all([page.waitForLoadState('networkidle'), page.click('#wp-submit')]);
await page.waitForTimeout(1000);
wp.push({ name: 'Log in, wrong password (server-rendered error)', html: await snapshot() });

// Core Navigation block overlay: a dialog, shown below 600px.
await page.setViewportSize({ width: 390, height: 844 });
await go('/?p=1');
const opener = page.locator('.wp-block-navigation__responsive-container-open').first();
if (await opener.count()) {
  await opener.click();
  await page.waitForTimeout(600);
  wp.push({ name: 'Navigation block overlay menu, opened (390px wide)', html: await snapshot() });
}
await page.setViewportSize({ width: 1280, height: 720 });

await go('/contact/');
const cf7Version = await page.evaluate(() => [...document.querySelectorAll('script[src*="contact-form-7"], link[href*="contact-form-7"]')]
  .map((el) => (el.src || el.href).match(/ver=([\d.]+)/)?.[1]).find(Boolean) ?? '');
cf7.push({ name: 'Default contact form', html: await snapshot() });
const submit = page.locator('.wpcf7-form .wpcf7-submit');
await submit.click();
await page.waitForSelector('.wpcf7-not-valid-tip', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(800);
cf7.push({ name: 'Submitted empty (every required field invalid)', html: await snapshot() });
await go('/contact/');
await page.fill('.wpcf7-form input[name="your-name"]', 'Anna Berg');
await page.fill('.wpcf7-form input[name="your-email"]', 'anna.berg@');
await page.fill('.wpcf7-form input[name="your-subject"]', 'Opening hours');
await submit.click();
await page.waitForSelector('.wpcf7-not-valid-tip', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(800);
cf7.push({ name: 'Invalid email', html: await snapshot() });

const here = new URL('.', import.meta.url).pathname;
writeFileSync(here + 'fixtures.json', JSON.stringify({ captured: new Date().toISOString(), source: 'WordPress Playground', version: wpVersion, fixtures: wp }, null, 2) + '\n');
writeFileSync(here + '../contact-form-7/fixtures.json', JSON.stringify({ captured: new Date().toISOString(), source: 'WordPress Playground', wordpress: wpVersion, version: cf7Version, fixtures: cf7 }, null, 2) + '\n');
console.log({ wpVersion, cf7Version, wp: wp.map((f) => f.name), cf7: cf7.map((f) => f.name) });
await browser.close();
