// Markdown table of per-file sizes vs. the base branch. Usage: size-diff.mjs <base.json> <head.json>
import { readFileSync, existsSync } from 'node:fs';

const [basePath, headPath] = process.argv.slice(2);
const read = (p) => (p && existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : []);
const key = (e) => `${e.name} ${e.kind}`;
const base = new Map(read(basePath).map((e) => [key(e), e]));

const rows = read(headPath).map((e) => {
  const before = base.get(key(e))?.bytes;
  const delta = before === undefined ? 'new' : e.bytes - before === 0 ? '±0' : `${e.bytes > before ? '+' : ''}${e.bytes - before}`;
  const status = e.bytes > e.limit ? '❌' : '✅';
  return `| ${status} | \`${e.name}\` | ${e.kind} | ${e.bytes} B | ${delta} | ${e.limit} B |`;
});

console.log(
  [
    '### Size budget',
    '',
    'Minified + brotli, compared with the base branch.',
    '',
    '| | File | Type | Size | Diff | Budget |',
    '| --- | --- | --- | ---: | ---: | ---: |',
    ...rows,
  ].join('\n'),
);
