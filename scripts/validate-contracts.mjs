// Validates every contracts/*/contract.yaml against spec/contract.schema.json, plus what JSON Schema
// can't express: cross-file consistency, part tokens, fixtures, and the standards data.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';
import { features } from 'web-features';
import elements from '@webref/elements';
import ariaQuery from 'aria-query';

const root = new URL('..', import.meta.url).pathname;
const schema = JSON.parse(readFileSync(join(root, 'spec/contract.schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

// Standards data, so contracts can't drift from the platform: HTML elements (W3C webref), ARIA (aria-query).
const htmlElements = new Set(Object.values(await elements.listAll()).flatMap((spec) => spec.elements.map((e) => e.name)));
const { aria, roles } = ariaQuery;
const LAYER_ORDER = '@layer gui.core, gui.components, gui.styled, gui.warnings;';
const IDREF_ATTRS = ['for', 'commandfor', 'aria-labelledby', 'aria-describedby', 'aria-controls'];

let errors = 0;
const fail = (file, msg) => (errors++, console.error(`FAIL ${file}: ${msg}`));

const htmlFiles = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.html')).sort() : []);

// Every selector string in a rule's test, for part-token checks.
const testSelectors = (test) =>
  [test.selector, test.where, test.to, test.includes, test.text, test.control, test.error, test.a?.selector, test.b?.selector, test.from?.selector].filter(Boolean);

// oneOf reports every branch it tried; for rule tests keep only the branch matching test.kind.
const reportSchemaErrors = (file, contract) => {
  const seen = new Set();
  for (const e of validate.errors) {
    const testError = e.instancePath.match(/^\/rules\/(\d+)\/test(\/|$)/);
    if (testError) {
      if (e.keyword === 'oneOf') continue;
      const kind = contract.rules[testError[1]]?.test?.kind;
      const branch = schema.$defs.test.oneOf[Number(e.schemaPath.match(/oneOf\/(\d+)/)?.[1])];
      const kinds = branch ? [branch.properties.kind.const ?? branch.properties.kind.enum].flat() : [];
      if (!kinds.includes(kind)) {
        if (e.instancePath.endsWith('/kind') && !schema.$defs.test.properties.kind.enum.includes(kind)) {
          const msg = `${e.instancePath} "${kind}" is not a test kind`;
          if (!seen.has(msg)) seen.add(msg), fail(file, msg);
        }
        continue;
      }
    }
    const msg = `${e.instancePath || '/'} ${e.message}${e.params?.additionalProperty ? ` "${e.params.additionalProperty}"` : ''}`;
    if (!seen.has(msg)) seen.add(msg), fail(file, msg);
  }
};

const contractsDir = join(root, 'contracts');
const slugs = readdirSync(contractsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

for (const slug of slugs) {
  const file = `contracts/${slug}/contract.yaml`;
  const errorsBefore = errors;
  let contract;
  try {
    contract = parse(readFileSync(join(root, file), 'utf8'));
  } catch (e) {
    fail(file, existsSync(join(root, file)) ? `YAML: ${e.message}` : 'missing');
    continue;
  }

  if (!validate(contract)) {
    reportSchemaErrors(file, contract);
    continue;
  }

  if (contract.component !== slug) fail(file, `component "${contract.component}" must equal folder name "${slug}"`);

  const parts = new Set(Object.keys(contract.anatomy));
  const ids = new Set();
  for (const rule of contract.rules) {
    if (ids.has(rule.id)) fail(file, `duplicate rule id ${rule.id}`);
    ids.add(rule.id);
    const [x, y] = [rule.since, contract.contractVersion].map((v) => v.split('.').map(Number));
    if (x[0] > y[0] || (x[0] === y[0] && (x[1] > y[1] || (x[1] === y[1] && x[2] > y[2])))) {
      fail(file, `${rule.id} since ${rule.since} is newer than contractVersion ${contract.contractVersion}`);
    }
    for (const selector of testSelectors(rule.test)) {
      for (const [, token] of selector.matchAll(/\{([a-z-]+)\}/g)) {
        if (token !== 'id' && !parts.has(token)) fail(file, `${rule.id}: {${token}} is not a part in anatomy`);
      }
    }
    for (const role of rule.test.oneOf ?? []) if (!roles.has(role)) fail(file, `${rule.id}: role "${role}" is not an ARIA role`);
    if (rule.css && !rule.css.violation.startsWith(`[data-gui="${slug}"]`)) {
      fail(file, `${rule.id} css.violation must start with [data-gui="${slug}"]`);
    }
    if (!existsSync(join(contractsDir, slug, 'markup', 'broken', `${rule.id}.html`))) {
      fail(file, `${rule.id} has no markup/broken/${rule.id}.html`);
    }
  }
  for (const broken of htmlFiles(join(contractsDir, slug, 'markup', 'broken'))) {
    if (!ids.has(broken.replace(/\.html$/, ''))) fail(file, `markup/broken/${broken} matches no rule`);
  }

  for (const part of contract.domOrder ?? []) if (!parts.has(part)) fail(file, `domOrder "${part}" is not in anatomy`);
  for (const attr of contract.attributes ?? []) {
    if (!parts.has(attr.on)) fail(file, `attribute ${attr.name} is on "${attr.on}", which is not in anatomy`);
    if (attr.name.startsWith('aria-') && !aria.has(attr.name)) fail(file, `attribute ${attr.name} is not an ARIA attribute`);
    if (attr.name === 'role') {
      for (const [, role] of attr.type.matchAll(/"([^"]+)"/g)) if (!roles.has(role)) fail(file, `role "${role}" is not an ARIA role`);
    }
  }
  for (const [key, part] of Object.entries(contract.anatomy)) {
    for (const el of part.element) if (!htmlElements.has(el)) fail(file, `anatomy.${key}: <${el}> is not an HTML element`);
  }
  for (const req of contract.requires ?? []) {
    if (!features[req.feature]) fail(file, `requires "${req.feature}" is not a web-features id`);
  }

  // Reference CSS: layer order in every file; documented component tokens (--gui-<slug>-*) equal the ones used,
  // both ways. Shared roles (--gui-border, --gui-focus, --gui-danger, --gui-radius) are documented once, in Theming.
  const cssFiles = [`${slug}.css`, `${slug}.styled.css`].map((f) => join(root, 'reference', slug, f)).filter(existsSync);
  if (!cssFiles.length) fail(file, `reference/${slug}/${slug}.css missing`);
  for (const cssFile of cssFiles) {
    if (!readFileSync(cssFile, 'utf8').includes(LAYER_ORDER)) fail(file, `${cssFile.split('/').pop()} must repeat ${LAYER_ORDER}`);
  }
  const used = new Set(cssFiles.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(new RegExp(`var\\((--gui-${slug}-[a-z0-9-]+)`, 'g'))].map((m) => m[1])));
  const documented = new Set(Object.keys(contract.customProperties ?? {}));
  for (const prop of used) if (!documented.has(prop)) fail(file, `${prop} is used in the ${slug} CSS but not in customProperties`);
  for (const prop of documented) if (!used.has(prop)) fail(file, `${prop} is in customProperties but not used in the ${slug} CSS`);

  // Valid fixtures: at least one, and what html-validate can't see (unknown ARIA, dangling id references).
  const validDir = join(contractsDir, slug, 'markup', 'valid');
  const valid = htmlFiles(validDir);
  if (!valid.length) fail(file, 'markup/valid/ has no .html files');
  for (const name of valid) {
    const html = readFileSync(join(validDir, name), 'utf8');
    const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    for (const [, attr] of html.matchAll(/\s(aria-[a-z]+)=/g)) if (!aria.has(attr)) fail(file, `markup/valid/${name}: ${attr} is not an ARIA attribute`);
    for (const [, role] of html.matchAll(/\srole="([^"]+)"/g)) if (!roles.has(role)) fail(file, `markup/valid/${name}: role "${role}" is not an ARIA role`);
    for (const [, attr, value] of html.matchAll(new RegExp(`\\s(${IDREF_ATTRS.join('|')})="([^"]+)"`, 'g'))) {
      for (const ref of value.split(/\s+/)) if (!htmlIds.has(ref)) fail(file, `markup/valid/${name}: ${attr}="${ref}" points at no id`);
    }
  }

  if (errors === errorsBefore) console.log(`ok   ${file}: ${contract.rules.length} rules, ${valid.length} valid examples, contract ${contract.contractVersion}`);
}

if (errors) {
  console.error(`\n${errors} error(s)`);
  process.exit(1);
}
