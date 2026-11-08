import { describe, expect, it } from 'vitest';
import { gemeindeEbene, landVon, STAEDTE } from '../data';
import { ergebnisSatz } from './satz';
import { berechne } from './steuer';

const basis = { pkv: false, pkvMonat: 0, kinderlos: true, kirche: 0 };
const stadt = (slug: string) => STAEDTE.find((s) => s.slug === slug)!;
const satz = (slug: string, brutto: number) => {
  const s = stadt(slug);
  return ergebnisSatz(berechne({ ...basis, brutto }), s, landVon(s), gemeindeEbene(s));
};

describe('ergebnisSatz', () => {
  it('nennt Bund, Land und Stadt mit markierten Beträgen und kennzeichnet die Schätzung', () => {
    const t = satz('oldenburg', 85_000);
    expect(t).toContain('Von <b class="rs-mark">85.000\u00a0€</b> Brutto');
    expect(t).toContain('an Niedersachsen und');
    expect(t).toContain('an Oldenburg (Oldenburg), davon geschätzt');
  });
  it('fasst Land und Stadt bei Stadtstaaten zusammen, ohne „geschätzt“', () => {
    const t = satz('berlin', 85_000);
    expect(t).toContain('an Berlin (Land und Stadt)');
    expect(t).not.toContain('geschätzt');
  });
  it('nennt bei Bremerhaven das Land Bremen als eigenen Empfänger', () => {
    expect(satz('bremerhaven', 85_000)).toContain('an das Land Bremen und Bremerhaven');
  });
  it('erklärt, wenn keine Lohnsteuer anfällt', () => {
    expect(satz('oldenburg', 10_000)).toContain('fällt keine Lohnsteuer an');
  });
  it('fordert ohne Brutto zur Eingabe auf', () => {
    expect(satz('oldenburg', 0)).toBe('Trag oben dein Jahresbrutto ein.');
  });
});
