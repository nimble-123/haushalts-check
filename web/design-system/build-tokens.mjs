// tokens.json → src/styles/tokens.css (für die Website).
// Aufruf (aus web/): npm run tokens
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const t = JSON.parse(readFileSync(join(HERE, 'tokens.json'), 'utf8'));
const [first, ...rest] = t.color.themes.map((x) => x.id);

const val = (v, theme) => {
  const raw = typeof v === 'string' ? v : (v[theme] ?? v[first]);
  const alias = /^\{(.+)\}$/.exec(raw);
  return alias ? `var(--${alias[1]})` : raw;
};
const colorBlock = (theme) =>
  [...t.color.tokens, ...(t.shadow?.tokens ?? [])].map((x) => `  --${x.name}: ${val(x.value, theme)};`).join('\n');
const plain = ['spacing', 'radius', 'size'].flatMap((k) => t[k]?.tokens ?? []).map((x) => `  --${x.name}: ${x.value};`);
const fams = Object.entries(t.type.families).map(([k, v]) => `  --font-${k}: ${v};`);

const styles = t.type.groups.flatMap((g) => g.styles.map((s) => {
  const fam = s.family ?? g.family;
  const lh = typeof s.lineHeight === 'number' ? s.lineHeight : s.lineHeight;
  return `.t-${s.name} { font-family: var(--font-${fam}); font-size: ${s.fontSize}; line-height: ${lh}; font-weight: ${s.fontWeight};${s.letterSpacing ? ` letter-spacing: ${s.letterSpacing};` : ''} }`;
}));

const dark = rest[0];
const css = `/* ${t.name} — generated from tokens.json */
/* Nicht von Hand ändern: design-system/tokens.json bearbeiten und \`npm run tokens\` ausführen. */
:root, [data-theme="${first}"] {
  color-scheme: light;
${colorBlock(first)}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="${first}"]) {
    color-scheme: dark;
${colorBlock(dark).replace(/^/gm, '  ')}
  }
}
:root[data-theme="${dark}"] {
  color-scheme: dark;
${colorBlock(dark)}
}
:root {
${[...plain, ...fams].join('\n')}
}
${styles.join('\n')}
`;
writeFileSync(join(HERE, '..', 'src', 'styles', 'tokens.css'), css);
console.log(`tokens.css: ${t.color.tokens.length} Farben × ${t.color.themes.length} Themes, ${plain.length} Maße, ${styles.length} Schriftstile`);
