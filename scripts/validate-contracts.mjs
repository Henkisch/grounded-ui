// Validates every components/*/contract.yaml against schema/contract.schema.json,
// plus the cross-file rules JSON Schema can't express.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse } from 'yaml';
import { features } from 'web-features';
import elements from '@webref/elements';
import ariaQuery from 'aria-query';

const root = new URL('..', import.meta.url).pathname;
const schema = JSON.parse(readFileSync(join(root, 'schema/contract.schema.json'), 'utf8'));
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

// Broken markup per rule becomes mandatory in build step 3; until then it only warns.
const STRICT_BROKEN = process.env.GRUND_STRICT_BROKEN === '1';

const semver = (v) => v.split('.').map(Number);
const lte = (a, b) => {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i];
  return true;
};

// Standards data, so contracts can't drift from the platform: HTML elements (W3C webref), ARIA (aria-query).
const htmlElements = new Set(Object.values(await elements.listAll()).flatMap((spec) => spec.elements.map((e) => e.name)));
const { aria, roles } = ariaQuery;
const IDREF_ATTRS = ['for', 'commandfor', 'aria-labelledby', 'aria-describedby', 'aria-controls'];

let errors = 0;
let warnings = 0;
const fail = (file, msg) => (errors++, console.error(`FAIL ${file}: ${msg}`));
const warn = (file, msg) => (warnings++, console.warn(`warn ${file}: ${msg}`));

const componentsDir = join(root, 'components');
const slugs = readdirSync(componentsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

for (const slug of slugs) {
  const file = `components/${slug}/contract.yaml`;
  const path = join(root, file);
  if (!existsSync(path)) {
    fail(file, 'missing');
    continue;
  }

  let contract;
  try {
    contract = parse(readFileSync(path, 'utf8'));
  } catch (e) {
    fail(file, `YAML: ${e.message}`);
    continue;
  }

  if (!validate(contract)) {
    // oneOf reports every branch it tried; for rule tests keep only the branch matching test.kind.
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
    continue;
  }

  if (contract.component !== slug) fail(file, `component "${contract.component}" must equal folder name "${slug}"`);

  const ids = new Set();
  for (const rule of contract.rules) {
    if (ids.has(rule.id)) fail(file, `duplicate rule id ${rule.id}`);
    ids.add(rule.id);
    if (!lte(rule.since, contract.contractVersion)) {
      fail(file, `${rule.id} since ${rule.since} is newer than contractVersion ${contract.contractVersion}`);
    }
    const root = `[data-component="${slug}"]`;
    if (rule.css && !rule.css.violation.startsWith(root)) {
      fail(file, `${rule.id} css.violation must start with ${root}`);
    }
    if (!existsSync(join(componentsDir, slug, 'markup', 'broken', `${rule.id}.html`))) {
      (STRICT_BROKEN ? fail : warn)(file, `${rule.id} has no markup/broken/${rule.id}.html`);
    }
  }

  for (const part of contract.domOrder ?? []) {
    if (!contract.anatomy[part]) fail(file, `domOrder "${part}" is not in anatomy`);
  }

  for (const attr of contract.attributes ?? []) {
    if (!contract.anatomy[attr.on]) fail(file, `attribute ${attr.name} is on "${attr.on}", which is not in anatomy`);
  }

  // Documented custom properties must equal the ones the CSS actually reads, in both directions.
  const cssPath = join(componentsDir, slug, 'styles', `${slug}.css`);
  if (existsSync(cssPath)) {
    if (!readFileSync(cssPath, 'utf8').includes('@layer grund.core, grund.components, grund.warnings;')) {
      fail(file, `${slug}.css must repeat the layer order statement (@layer grund.core, grund.components, grund.warnings;)`);
    }
    const used = new Set([...readFileSync(cssPath, 'utf8').matchAll(/var\((--grund-[a-z0-9-]+)/g)].map((m) => m[1]));
    const documented = new Set(Object.keys(contract.customProperties ?? {}));
    for (const prop of used) if (!documented.has(prop)) fail(file, `${prop} is used in ${slug}.css but not in customProperties`);
    for (const prop of documented) if (!used.has(prop)) fail(file, `${prop} is in customProperties but not used in ${slug}.css`);
  }

  for (const req of contract.requires ?? []) {
    if (!features[req.feature]) fail(file, `requires "${req.feature}" is not a web-features id`);
  }

  for (const [key, part] of Object.entries(contract.anatomy)) {
    for (const el of part.element) if (!htmlElements.has(el)) fail(file, `anatomy.${key}: <${el}> is not an HTML element`);
  }

  for (const attr of contract.attributes ?? []) {
    if (attr.name.startsWith('aria-') && !aria.has(attr.name)) fail(file, `attribute ${attr.name} is not an ARIA attribute`);
    if (attr.name === 'role') {
      for (const [, role] of attr.type.matchAll(/"([^"]+)"/g)) if (!roles.has(role)) fail(file, `role "${role}" is not an ARIA role`);
    }
  }

  for (const name of contract.markup) {
    const markupPath = join(componentsDir, slug, 'markup', `${name}.html`);
    if (!existsSync(markupPath)) {
      fail(file, `markup/${name}.html missing`);
      continue;
    }
    // What html-validate can't see: unknown aria-* attributes and id references that point nowhere.
    const html = readFileSync(markupPath, 'utf8');
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    for (const [, attr] of html.matchAll(/\s(aria-[a-z]+)=/g)) {
      if (!aria.has(attr)) fail(file, `markup/${name}.html: ${attr} is not an ARIA attribute`);
    }
    for (const [, role] of html.matchAll(/\srole="([^"]+)"/g)) {
      if (!roles.has(role)) fail(file, `markup/${name}.html: role "${role}" is not an ARIA role`);
    }
    for (const [, attr, value] of html.matchAll(new RegExp(`\\s(${IDREF_ATTRS.join('|')})="([^"]+)"`, 'g'))) {
      for (const ref of value.split(/\s+/)) if (!ids.has(ref)) fail(file, `markup/${name}.html: ${attr}="${ref}" points at no id`);
    }
  }

  if (!errors) console.log(`ok   ${file}: ${contract.rules.length} rules, contract ${contract.contractVersion}`);
}

if (warnings) console.warn(`\n${warnings} warning(s)`);
if (errors) {
  console.error(`\n${errors} error(s)`);
  process.exit(1);
}
