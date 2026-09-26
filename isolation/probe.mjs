import { chromium } from '@playwright/test';
const urls = process.argv.slice(2);
const b = await chromium.launch();
const ctx = await b.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36', locale: 'sv-SE' });
for (const u of urls) {
  const p = await ctx.newPage();
  try {
    const r = await p.goto(u, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await p.waitForTimeout(1500);
    const info = await p.evaluate(() => {
      const gen = document.querySelector('meta[name=generator]')?.content ?? '';
      const assets = [...document.querySelectorAll('link[rel=stylesheet],script[src]')].map((e) => e.href || e.src).join(' ');
      const hints = ['elementor', 'divi', 'et-core', 'astra', 'generatepress', 'bootstrap', 'sitevision', 'olivero', 'twentytwenty', 'wp-content', 'drupal', 'episerver', 'optimizely'].filter((h) => assets.toLowerCase().includes(h) || document.documentElement.outerHTML.slice(0, 20000).toLowerCase().includes(h));
      return { title: document.title.slice(0, 60), gen, hints, main: !!document.querySelector('main'), challenge: /just a moment|attention required|verify you are human|captcha/i.test(document.body.innerText.slice(0, 500)) };
    });
    console.log(r?.status(), u, JSON.stringify(info));
  } catch (e) { console.log('ERR', u, e.message.split('\n')[0]); }
  await p.close();
}
await b.close();
