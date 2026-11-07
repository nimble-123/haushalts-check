import { describe, expect, it } from 'vitest';
import { aufEbenen, berechne, est2026, soli } from './steuer';

const basis = { brutto: 0, pkv: false, pkvMonat: 550, kinderlos: true, kirche: 0 };

describe('est2026', () => {
  it('ist bis zum Grundfreibetrag 0', () => {
    expect(est2026(12_348)).toBe(0);
    expect(est2026(12_349)).toBeGreaterThanOrEqual(0);
  });

  it('ist an den Zonengrenzen stetig (Tarifkonstanten passen zusammen)', () => {
    for (const g of [17_799, 69_878, 277_825]) {
      expect(Math.abs(est2026(g + 1) - est2026(g))).toBeLessThanOrEqual(1);
    }
  });
});

describe('soli', () => {
  it('greift erst über der Freigrenze und dann gemildert', () => {
    expect(soli(20_350)).toBe(0);
    expect(soli(21_000)).toBeCloseTo((21_000 - 20_350) * 0.119);
    expect(soli(100_000)).toBeCloseTo(5_500);
  });
});

// Referenzwerte aus calc() des Prototyps (haushalt/index.html)
describe('berechne – gleiche Ergebnisse wie der Prototyp', () => {
  it.each([
    [{ ...basis, brutto: 85_000 }, 17_082, 0, 0, 51_130.88],
    [{ ...basis, brutto: 30_000, kinderlos: false, kirche: 0.09 }, 2_194, 0, 197.46, 21_263.54],
    [{ ...basis, brutto: 150_000, pkv: true, kirche: 0.08 }, 44_046, 2_422.53, 3_523.68, 82_659.39],
    [{ ...basis, brutto: 0 }, 0, 0, 0, 0],
  ])('%#', (e, lst, so, ki, netto) => {
    const r = berechne(e);
    expect(r.lohnsteuer).toBe(lst);
    expect(r.soli).toBeCloseTo(so, 2);
    expect(r.kirche).toBeCloseTo(ki, 2);
    expect(r.netto).toBeCloseTo(netto, 2);
  });
});

describe('aufEbenen', () => {
  it('verteilt Lohnsteuer 42,5/42,5/15 und gibt den Soli dem Bund', () => {
    const r = berechne({ ...basis, brutto: 150_000, pkv: true });
    const e = aufEbenen(r);
    expect(e.bund + e.land + e.gemeinde).toBeCloseTo(r.lohnsteuer + r.soli, 6);
    expect(e.land).toBeCloseTo(r.lohnsteuer * 0.425, 6);
  });
});
