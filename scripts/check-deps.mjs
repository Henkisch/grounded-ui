// The reference implementation ships with zero dependencies: no runtime deps, no external @import.
// The conformance runner is a dev tool; its dependencies (Playwright, axe) are devDependencies.
import { readFileSync, globSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const errors = [];

for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies', 'bundleDependencies']) {
  const deps = Object.keys(pkg[field] ?? {});
  if (deps.length) errors.push(`package.json ${field}: ${deps.join(', ')}`);
}

const shipped = globSync(['reference/**/*.css', 'reference/**/*.js', 'conformance/src/*.js'], { cwd: root });
for (const file of shipped) {
  const src = readFileSync(join(root, file), 'utf8');
  if (/@import\s/.test(src)) errors.push(`${file}: @import is not allowed in shipped CSS`);
  if (file.startsWith('reference/') && /\bimport\s.*from\s|require\(/.test(src)) errors.push(`${file}: module imports are not allowed in reference JS`);
}

if (errors.length) {
  console.error(errors.map((e) => `FAIL ${e}`).join('\n'));
  process.exit(1);
}
console.log(`ok   0 dependencies, ${shipped.length} shipped files clean`);
