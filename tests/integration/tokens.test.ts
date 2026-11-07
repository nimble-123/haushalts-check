// Das eingecheckte tokens.css muss zu design-system/tokens.json passen (sonst `npm run tokens` vergessen).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ladeTokens, TOKENS_CSS, tokensCss } from '../../design-system/build-tokens';

describe('Design-Tokens', () => {
  const t = ladeTokens();

  it('tokens.css ist aktuell erzeugt', () => {
    expect(readFileSync(TOKENS_CSS, 'utf8')).toBe(tokensCss(t).css);
  });

  it('jede Farbe hat einen Wert für hell und dunkel und eine Verwendung', () => {
    for (const tok of t.color.tokens) {
      expect(tok.usage, tok.name).toBeTruthy();
      if (typeof tok.value === 'object') expect(Object.keys(tok.value).sort(), tok.name).toEqual(['dark', 'light']);
    }
  });

  it('Aliase zeigen auf existierende Farben', () => {
    const namen = new Set(t.color.tokens.map((x) => x.name));
    for (const tok of t.color.tokens) {
      for (const v of Object.values(typeof tok.value === 'string' ? { a: tok.value } : tok.value)) {
        const alias = /^\{(.+)\}$/.exec(v)?.[1];
        if (alias) expect(namen.has(alias), `${tok.name} → ${alias}`).toBe(true);
      }
    }
  });
});
