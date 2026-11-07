import { describe, expect, it } from 'vitest';
import { abgabenquoten } from './aufteilung';
import { KONSUM, konsumsteuern, mitKonsum } from './konsum';
import { aufEbenen, berechne, summeAbgaben, verfuegbar } from './steuer';

const basis = { pkv: false, pkvMonat: 0, kinderlos: true, kirche: 0 };
const nettoBei = (brutto: number) => berechne({ ...basis, brutto }).netto;

describe('konsumsteuern', () => {
  it('ohne Netto keine Konsumsteuern', () => {
    expect(konsumsteuern(0).summe).toBe(0);
  });

  it('steigt mit dem Netto, belastet hohe Einkommen relativ weniger (mehr wird gespart)', () => {
    const werte = [20_000, 40_000, 54_066, 80_000, 120_000, 160_000].map((b) => {
      const netto = nettoBei(b);
      return { netto, k: konsumsteuern(netto) };
    });
    for (let i = 1; i < werte.length; i++) {
      expect(werte[i].k.summe).toBeGreaterThan(werte[i - 1].k.summe);
      expect(werte[i].k.summe / werte[i].netto).toBeLessThan(werte[i - 1].k.summe / werte[i - 1].netto + 0.005);
    }
  });

  it('gibt nie mehr aus, als netto da ist', () => {
    for (const netto of [3_000, 9_000, 12_000, 20_000]) expect(konsumsteuern(netto).konsum).toBeLessThanOrEqual(netto);
  });

  it('liegt beim Median-Brutto im Rahmen veröffentlichter Schätzungen', () => {
    const netto = nettoBei(54_066);
    const k = konsumsteuern(netto);
    // DIW: Mehrwertsteuer rund 9–11 % des Haushaltsnettos in der Mitte; Alleinlebende mit hohem (steuerfreiem) Mietanteil etwas darunter
    expect(k.summe / netto).toBeGreaterThan(0.06);
    expect(k.summe / netto).toBeLessThan(0.11);
    expect(k.mwst / k.konsum).toBeGreaterThan(0.06);
    expect(k.mwst / k.konsum).toBeLessThan(0.12);
  });

  it('verteilt genau die Summe auf Bund, Land und Gemeinde', () => {
    const k = konsumsteuern(nettoBei(54_066));
    expect(k.bund + k.land + k.gemeinde).toBeCloseTo(k.summe, 9);
    expect(k.mwst + k.energiesteuer + k.stromsteuer + k.versicherungsteuer).toBeCloseTo(k.summe, 9);
  });
});

describe('mitKonsum', () => {
  it('schiebt die Konsumsteuern vom Netto zu den Ebenen, Brutto bleibt aufgeteilt', () => {
    const r = berechne({ ...basis, brutto: 54_066 });
    const m = mitKonsum(r);
    const k = m.konsum!;
    const vorher = aufEbenen(r);
    const nachher = aufEbenen(m);
    expect(nachher.bund - vorher.bund + nachher.land - vorher.land + nachher.gemeinde - vorher.gemeinde).toBeCloseTo(
      k.summe,
      9,
    );
    expect(verfuegbar(m)).toBeCloseTo(r.netto - k.summe, 9);
    expect(summeAbgaben(m) + verfuegbar(m) + m.pkvBeitrag).toBeCloseTo(m.brutto, 6);
  });

  it('Abgabenquote mit Konsumsteuern liegt über der ohne', () => {
    const ohne = abgabenquoten(basis);
    const mit = abgabenquoten(basis, true);
    mit.forEach((p, i) => {
      expect(p.gesamt).toBeCloseTo(ohne[i].gesamt + p.konsum, 12);
      expect(p.konsum).toBeGreaterThan(0);
    });
  });
});

describe('Daten', () => {
  it('Steueranteile je Gruppe zwischen 0 und dem Regelsatz', () => {
    for (const s of Object.values(KONSUM.saetze)) {
      expect(s.mwst).toBeGreaterThanOrEqual(0);
      expect(s.mwst + s.energie + s.strom).toBeLessThan(0.5);
      expect(s.mwst).toBeLessThanOrEqual(19 / 119 + 1e-4);
    }
    const v = KONSUM.mwstVerteilung;
    expect(v.bund + v.land + v.gemeinde).toBeCloseTo(1, 3);
  });
});
