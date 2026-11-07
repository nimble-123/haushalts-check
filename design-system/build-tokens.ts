// tokens.json → src/styles/tokens.css (für die Website).
// Aufruf: npm run tokens
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
type Wert = string | Record<string, string>;
interface Token {
  name: string;
  value: Wert;
  usage?: string;
}
interface Stil {
  name: string;
  family?: string;
  fontSize: string;
  lineHeight: number | string;
  fontWeight: number;
  letterSpacing?: string;
}
interface Tokens {
  name: string;
  color: { themes: { id: string }[]; tokens: Token[] };
  shadow?: { tokens: Token[] };
  spacing?: { tokens: Token[] };
  radius?: { tokens: Token[] };
  size?: { tokens: Token[] };
  type: { families: Record<string, string>; groups: { family: string; styles: Stil[] }[] };
}
const t: Tokens = JSON.parse(readFileSync(join(HERE, 'tokens.json'), 'utf8'));
const [first, ...rest] = t.color.themes.map((x) => x.id);

const val = (v: Wert, theme: string) => {
  const raw = typeof v === 'string' ? v : (v[theme] ?? v[first]);
  const alias = /^\{(.+)\}$/.exec(raw);
  return alias ? `var(--${alias[1]})` : raw;
};
const colorBlock = (theme: string) =>
  [...t.color.tokens, ...(t.shadow?.tokens ?? [])].map((x) => `  --${x.name}: ${val(x.value, theme)};`).join('\n');
const plain = (['spacing', 'radius', 'size'] as const)
  .flatMap((k) => t[k]?.tokens ?? [])
  .map((x) => `  --${x.name}: ${x.value};`);
const fams = Object.entries(t.type.families).map(([k, v]) => `  --font-${k}: ${v};`);

const styles = t.type.groups.flatMap((g) =>
  g.styles.map((s) => {
    const fam = s.family ?? g.family;
    return `.t-${s.name} { font-family: var(--font-${fam}); font-size: ${s.fontSize}; line-height: ${s.lineHeight}; font-weight: ${s.fontWeight};${s.letterSpacing ? ` letter-spacing: ${s.letterSpacing};` : ''} }`;
  }),
);

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
console.log(
  `tokens.css: ${t.color.tokens.length} Farben × ${t.color.themes.length} Themes, ${plain.length} Maße, ${styles.length} Schriftstile`,
);
