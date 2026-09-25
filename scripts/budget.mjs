// Size budgets for everything grund-ui ships.
// Each file: lightningcss minify, brotli, compare against budgets.json
// (per-component overrides from contract.yaml `budget:`). Writes dist/sizes.json.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';
import { transform } from 'lightningcss';
import { parse } from 'yaml';

const root = new URL('..', import.meta.url).pathname;
const budgets = JSON.parse(readFileSync(join(root, 'budgets.json'), 'utf8'));

const brotli = (buf) =>
  brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;

const minifyCss = (files) => {
  const source = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  const { code } = transform({ filename: 'bundle.css', code: Buffer.from(source), minify: true });
  return code;
};

const entries = [];

// Core = tokens + core, shipped as one link.
const coreFiles = ['core/tokens.css', 'core/core.css'].map((f) => join(root, f));
entries.push({ name: 'core', kind: 'css', bytes: brotli(minifyCss(coreFiles)), limit: budgets.core.css });

const componentsDir = join(root, 'components');
for (const slug of readdirSync(componentsDir).sort()) {
  const dir = join(componentsDir, slug);
  const contractPath = join(dir, 'contract.yaml');
  const override = existsSync(contractPath) ? parse(readFileSync(contractPath, 'utf8'))?.budget ?? {} : {};

  // Base and styled are linked separately, so each is measured alone; the budget covers both together.
  const cssLimit = override.css ?? budgets.component.css;
  const basePath = join(dir, 'styles', `${slug}.css`);
  const styledPath = join(dir, 'styles', `${slug}.styled.css`);
  const base = existsSync(basePath) ? brotli(minifyCss([basePath])) : 0;
  const styled = existsSync(styledPath) ? brotli(minifyCss([styledPath])) : 0;
  entries.push({ name: slug, kind: 'css base', bytes: base, limit: cssLimit });
  entries.push({ name: slug, kind: 'css styled', bytes: styled, limit: cssLimit });
  entries.push({ name: slug, kind: 'css total', bytes: base + styled, limit: cssLimit });

  // JS is optional; absent file = 0 bytes. Shipped as-is, no minifier in the chain.
  const jsPath = join(dir, 'scripts', `${slug}.js`);
  const jsBytes = existsSync(jsPath) ? brotli(readFileSync(jsPath)) : 0;
  entries.push({ name: slug, kind: 'js', bytes: jsBytes, limit: override.js ?? budgets.component.js });
}

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'sizes.json'), JSON.stringify(entries, null, 2) + '\n');

let failed = false;
for (const e of entries) {
  const ok = e.bytes <= e.limit;
  if (!ok) failed = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${`${e.name} ${e.kind}`.padEnd(24)} ${String(e.bytes).padStart(6)} B / ${e.limit} B`);
}
if (failed) {
  console.error('\nBudget exceeded.');
  process.exit(1);
}
