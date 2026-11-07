import { describe, expect, it } from 'vitest';
import { aufEbenen, berechne, est2026, SOLI_FREIGRENZE, SV_2026, soli } from './steuer';

const basis = { brutto: 0, pkv: false, pkvMonat: 550, kinderlos: true, kirche: 0 };

describe('est2026', () => {
  it('ist bis zum Grundfreibetrag 0', () => {
    expect(est2026(12_348)).toBe(0);
    expect(est2026(12_400)).toBeGreaterThan(0);
  });

  it('ist an den Zonengrenzen stetig (Tarifkonstanten passen zusammen)', () => {
    for (const g of [17_799, 69_878, 277_825]) {
      expect(Math.abs(est2026(g + 1) - est2026(g))).toBeLessThanOrEqual(1);
    }
  });
});

describe('soli', () => {
  it('greift erst über der Freigrenze und dann gemildert', () => {
    expect(soli(SOLI_FREIGRENZE)).toBe(0);
    expect(soli(SOLI_FREIGRENZE + 1)).toBeCloseTo(0.119);
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

describe('Beitragsbemessungsgrenzen', () => {
  const sv = (brutto: number) => berechne({ ...basis, brutto });
  it('Renten- und Arbeitslosenbeitrag wachsen bis zur Grenze und keinen Euro darüber', () => {
    const g = SV_2026.bbgRv;
    expect(sv(g).rv).toBeGreaterThan(sv(g - 1).rv);
    expect(sv(g + 1).rv).toBe(sv(g).rv);
    expect(sv(g + 1).alv).toBe(sv(g).alv);
  });
  it('Kranken- und Pflegebeitrag ebenso an ihrer Grenze', () => {
    const g = SV_2026.bbgKv;
    expect(sv(g).kv).toBeGreaterThan(sv(g - 1).kv);
    expect(sv(g + 1).kv).toBe(sv(g).kv);
    expect(sv(g + 1).pv).toBe(sv(g).pv);
  });
});

describe('Angaben', () => {
  it('kinderlos zahlt den Zuschlag zur Pflegeversicherung', () => {
    const mit = berechne({ ...basis, brutto: 54_066, kinderlos: false });
    const ohne = berechne({ ...basis, brutto: 54_066, kinderlos: true });
    expect(ohne.pv - mit.pv).toBeCloseTo(54_066 * SV_2026.pvKinderlos, 6);
    expect(ohne.netto).toBeLessThan(mit.netto);
  });
  it('rvSatz ändert nur den Rentenbeitrag (und über die Vorsorgepauschale die Lohnsteuer)', () => {
    const normal = berechne({ ...basis, brutto: 54_066 });
    const hoeher = berechne({ ...basis, brutto: 54_066 }, { rvSatz: 0.2 });
    expect(hoeher.rv).toBeCloseTo((54_066 * 0.2) / 2, 6);
    expect(hoeher.kv).toBe(normal.kv);
    expect(hoeher.lohnsteuer).toBeLessThanOrEqual(normal.lohnsteuer);
  });
  it('Brutto = Abgaben + PKV + Netto, für alle Kombinationen', () => {
    for (const pkv of [false, true])
      for (const kinderlos of [false, true])
        for (const kirche of [0, 0.08, 0.09])
          for (const brutto of [9_000, 30_000, 70_000, 120_000]) {
            const r = berechne({ brutto, pkv, pkvMonat: 550, kinderlos, kirche });
            const summe = r.rv + r.alv + r.kv + r.pv + r.lohnsteuer + r.soli + r.kirche + r.pkvBeitrag + r.netto;
            expect(summe).toBeCloseTo(brutto, 6);
          }
  });
});
