import type { GemeindeEbene, Land, Stadt } from '../data/types';
import { aufEbenen, type Ergebnis, summeSV } from './steuer';
import { esc, fmtEur } from './text';

/** Ergebnissatz im Einstieg als HTML; persönliche Beträge als Markierung */
export function ergebnisSatz(r: Ergebnis, stadt: Stadt, land: Land, gem: GemeindeEbene) {
  const f = (v: number) => `<b class="rs-mark">${fmtEur(v)}</b>`;
  if (!r.brutto) return 'Trag oben dein Jahresbrutto ein.';
  if (!r.lohnsteuer) {
    return `Bei ${f(r.brutto)} Brutto fällt keine Lohnsteuer an. Deine Abgaben gehen nur an die Sozialversicherung: ${f(summeSV(r))} im Jahr.`;
  }
  const e = aufEbenen(r);
  const gesamt = gem.posten.reduce((s, p) => s + p.v, 0);
  // größter Zweck, der nicht „Verwaltung/Übriges“ ist
  const top = [...gem.posten].sort((a, b) => b.v - a.v).find((p) => p.g !== 'verw') ?? gem.posten[0];
  if (stadt.stadtstaat) {
    const beide = e.land + e.gemeinde;
    return `Von ${f(r.brutto)} Brutto gehen ${f(e.bund)} an den Bund und ${f(beide)} an ${esc(stadt.name)} (Land und Stadt), davon ${f((beide * top.v) / gesamt)} für ${esc(top.name)}.`;
  }
  const davon = `${gem.schaetzung ? 'geschätzt ' : ''}${f((e.gemeinde * top.v) / gesamt)} für ${esc(top.name)}`;
  return `Von ${f(r.brutto)} Brutto gehen ${f(e.bund)} an den Bund, ${f(e.land)} an ${esc(land.name)} und ${f(e.gemeinde)} an ${esc(stadt.name)}, davon ${davon}.`;
}
