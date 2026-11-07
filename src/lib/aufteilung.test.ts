import { describe, expect, it } from 'vitest';
import { gemeindeEbene, landVon, STAEDTE } from '../data';
import { BUND_GESAMT, ENTWURF_2027_GESAMT } from '../data/bund';
import {
  abgabenquoten,
  aufRaster,
  einzelplanPosten,
  freiAbTag,
  grenzbelastung,
  groessteN,
  kalenderAbschnitte,
  nachZweck,
  summe,
  veraenderung2027,
  ZWECKE,
} from './aufteilung';
import { berechne, summeAbgaben } from './steuer';

const basis = { pkv: false, pkvMonat: 0, kinderlos: true, kirche: 0.09 };
const oldenburg = STAEDTE.find((s) => s.slug === 'oldenburg')!;

describe('aufRaster (größte Reste)', () => {
  it('ergibt immer genau 100 Kästchen, nie negativ, je Wert weniger als ein Kästchen daneben', () => {
    let zufall = 42;
    const naechste = () => {
      zufall = (zufall * 1103515245 + 12345) % 2 ** 31;
      return (zufall / 2 ** 31) * 1000;
    };
    for (let lauf = 0; lauf < 500; lauf++) {
      const werte = Array.from({ length: 1 + (lauf % 9) }, () => naechste());
      const n = aufRaster(werte);
      const gesamt = werte.reduce((s, v) => s + v, 0);
      expect(n.reduce((s, v) => s + v, 0)).toBe(100);
      n.forEach((k, i) => {
        expect(k).toBeGreaterThanOrEqual(0);
        expect(Math.abs(k - (werte[i] / gesamt) * 100)).toBeLessThan(1);
      });
    }
  });
  it('liefert bei Summe 0 nur Nullen statt NaN', () => {
    expect(aufRaster([0, 0])).toEqual([0, 0]);
  });
  it('kennt auch andere Rastergrößen', () => {
    expect(aufRaster([1, 1, 1], 10).reduce((s, v) => s + v, 0)).toBe(10);
  });
});

describe('nachZweck', () => {
  it('verteilt genau die Abgaben (Steuern, Soli, Kirche, Sozialversicherung) und nichts sonst', () => {
    for (const brutto of [20_000, 54_066, 120_000]) {
      const r = berechne({ ...basis, brutto });
      const z = nachZweck(r, landVon(oldenburg), gemeindeEbene(oldenburg));
      expect(summe(z)).toBeCloseTo(summeAbgaben(r), 6);
    }
  });
  it('hält die Reihenfolge der Legende ein und lässt leere Zwecke weg', () => {
    const r = berechne({ ...basis, kirche: 0, brutto: 54_066 });
    const z = nachZweck(r, landVon(oldenburg), gemeindeEbene(oldenburg));
    expect(z.map((d) => d.k)).toEqual(ZWECKE.filter((k) => k !== 'kirche'));
  });
});

describe('groessteN', () => {
  it('fasst die kleinen Posten zusammen, ohne Geld zu verlieren', () => {
    const posten = einzelplanPosten();
    const top = groessteN(posten, 7);
    expect(top).toHaveLength(8);
    expect(top.at(-1)).toMatchObject({ name: `Übrige (${posten.length - 7})`, rest: true });
    expect(summe(top)).toBeCloseTo(BUND_GESAMT, 9);
  });
  it('lässt kurze Listen unverändert (nur sortiert)', () => {
    expect(groessteN([{ name: 'a', v: 1, g: 'soz' }], 5)).toHaveLength(1);
  });
});

describe('Kalender', () => {
  it('Abschnitte schließen lückenlos an und enden am 31. Dezember', () => {
    const r = berechne({ ...basis, brutto: 54_066 });
    const betraege = [r.rv, r.kv + r.pv, r.alv, r.lohnsteuer + r.soli + r.kirche, r.netto];
    const a = kalenderAbschnitte(betraege, r.brutto);
    expect(a[0].von).toBe(0);
    expect(a.at(-1)!.bis).toBe(364);
    expect(a.at(-1)!.ende).toBeCloseTo(1, 9);
    for (let i = 1; i < a.length; i++) expect(a[i].start).toBeCloseTo(a[i - 1].ende, 9);
  });
  it('„für dich ab“ liegt bei rund 34 % Abgaben Ende Mai', () => {
    const r = berechne({ ...basis, kirche: 0, brutto: 54_066 });
    const tag = freiAbTag(r);
    expect(tag).toBeGreaterThan(120);
    expect(tag).toBeLessThan(160);
  });
});

describe('abgabenquoten', () => {
  it('steigt insgesamt mit dem Einkommen, Sozialabgaben sinken oberhalb der Bemessungsgrenzen', () => {
    const q = abgabenquoten(basis);
    expect(q[0].brutto).toBe(15_000);
    expect(q.at(-1)!.brutto).toBe(160_000);
    expect(q.at(-1)!.steuern).toBeGreaterThan(q[0].steuern);
    expect(q.at(-1)!.sozial).toBeLessThan(q[0].sozial);
    for (const p of q) expect(p.gesamt).toBeCloseTo(p.steuern + p.sozial, 12);
  });
});

describe('veraenderung2027', () => {
  it('summiert sich auf die Differenz der Gesamtvolumen', () => {
    expect(summe(veraenderung2027().map((z) => ({ v: z.d })))).toBeCloseTo(ENTWURF_2027_GESAMT - BUND_GESAMT, 1);
  });
});

describe('grenzbelastung', () => {
  it('liegt beim Median-Brutto um 45 Cent je zusätzlichem Euro (vgl. DIW 24/2026)', () => {
    const g = grenzbelastung({ ...basis, kirche: 0, brutto: 54_066 });
    expect(g).toBeGreaterThan(0.4);
    expect(g).toBeLessThan(0.52);
  });
  it('sinkt oberhalb der Bemessungsgrenzen, weil keine Beiträge mehr dazukommen', () => {
    const unter = grenzbelastung({ ...basis, kirche: 0, brutto: 60_000 });
    const ueber = grenzbelastung({ ...basis, kirche: 0, brutto: 120_000 });
    expect(ueber).toBeLessThan(unter);
  });
  it('ist unter dem Grundfreibetrag nur die Sozialversicherung', () => {
    expect(grenzbelastung({ ...basis, kirche: 0, brutto: 10_000 })).toBeCloseTo(0.21, 1);
  });
});
