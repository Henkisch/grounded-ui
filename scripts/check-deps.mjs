// What grund-ui ships has zero dependencies: no runtime deps, no external @import.
import { readFileSync, globSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const errors = [];

for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies', 'bundleDependencies']) {
  const deps = Object.keys(pkg[field] ?? {});
  if (deps.length) errors.push(`package.json ${field}: ${deps.join(', ')}`);
}

const shipped = globSync(['core/*.css', 'components/*/styles/*.css', 'components/*/scripts/*.js'], { cwd: root });
for (const file of shipped) {
  const src = readFileSync(join(root, file), 'utf8');
  if (/@import\s/.test(src)) errors.push(`${file}: @import is not allowed in shipped CSS`);
  if (/\bimport\s.*from\s|require\(/.test(src)) errors.push(`${file}: module imports are not allowed in shipped JS`);
}

if (errors.length) {
  console.error(errors.map((e) => `FAIL ${e}`).join('\n'));
  process.exit(1);
}
console.log(`ok   0 dependencies, ${shipped.length} shipped files clean`);
