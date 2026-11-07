import { describe, expect, it } from 'vitest';
import { renteVsEtf, type RenteEingabe } from './rente';

const basis: RenteEingabe = {
  modus: 'life', bruttoHeute: 85_000, alterHeute: 37,
  einstiegsalter: 25, einstiegsgehalt: 48_000, hoehepunktGehalt: 85_000, hoehepunktAlter: 45,
  dynamik: 0.005, heuteEinbeziehen: true, etfRendite: 0.07, niveau: 45, depotBis: 90,
  pkv: false, pkvMonat: 550, kinderlos: true, kirche: 0,
};

// Referenzwerte aus rvModel() des Prototyps (haushalt/index.html)
describe('renteVsEtf – gleiche Ergebnisse wie der Prototyp', () => {
  it.each([
    [{}, 66.651908, 703_637.7, 390_059.96, 1_031_658.31, 2_023.92, 4_480.05],
    [{ modus: 'now' as const }, 49.091329, 531_335, 293_649.38, 597_977.25, 1_571.23, 2_646.43],
    [{ pkv: true, kirche: 0.09, etfRendite: 0.05, niveau: 48, depotBis: 95 }, 66.651908, 703_637.7, 364_317.95, 615_841.11, 2_358.71, 1_916.43],
    [{ einstiegsalter: 20, einstiegsgehalt: 31_500, hoehepunktGehalt: 54_066, hoehepunktAlter: 40, dynamik: 0, heuteEinbeziehen: false },
      44.974353, 491_386.89, 310_024.05, 952_697.99, 1_458.54, 4_110.22],
  ])('%#', (ov, EP, gross, cumPaid, depot, renteN, etfM) => {
    const m = renteVsEtf({ ...basis, ...ov });
    expect(m.EP).toBeCloseTo(EP, 5);
    expect(m.gross).toBeCloseTo(gross, 1);
    expect(m.cumPaid).toBeCloseTo(cumPaid, 1);
    expect(m.depotReal).toBeCloseTo(depot, 1);
    expect(m.renteN).toBeCloseTo(renteN, 1);
    expect(m.etfM).toBeCloseTo(etfM, 1);
    expect(m.cross).toBeNull();
  });
});
