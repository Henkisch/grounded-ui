// Small helpers for writing MDX that Blume renders safely.

// Inline text: escape JSX/expression characters.
export const esc = (s) => String(s).replace(/[{}<>]/g, (c) => ({ '{': '&#123;', '}': '&#125;', '<': '&lt;', '>': '&gt;' })[c]);
export const code = (s) => '`' + String(s).replace(/`/g, '\\`') + '`';
export const cell = (s) => esc(s).replace(/\|/g, '\\|');
export const table = (head, rows) =>
  [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
export const typeTable = (rows) => `<TypeTable type={${JSON.stringify(rows)}} />`;
export const frontmatter = (fields) => ['---', ...Object.entries(fields).map(([k, v]) => (typeof v === 'object' ? `${k}:\n${Object.entries(v).map(([a, b]) => `  ${a}: ${b}`).join('\n')}` : `${k}: ${JSON.stringify(v)}`)), '---', ''];
