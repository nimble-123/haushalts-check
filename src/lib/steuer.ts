// Lohnsteuer- und Sozialversicherungs-Näherung 2026 (Steuerklasse I).
// Aus dem Prototyp haushalt/index.html übernommen, aber ohne DOM-Zugriff.
import type { Konsumsteuern } from './konsum';

export const SV_2026 = {
  bbgRv: 101_400, // RV/ALV
  bbgKv: 69_750, // KV/PV
  rv: 0.186,
  alv: 0.026,
  kv: 0.146,
  kvZusatz: 0.029,
  pv: 0.036,
  pvKinderlos: 0.006,
  /** ermäßigter KV-Satz für die Vorsorgepauschale */
  kvErmaessigt: 0.14,
} as const;

/** Pauschbeträge im Lohnsteuerabzug (Steuerklasse I) */
export const PAUSCHALEN = {
  /** Arbeitnehmer-Pauschbetrag (Werbungskosten) */
  werbungskosten: 1230,
  /** Werbungskosten-Pauschbetrag für Renten und Versorgungsbezüge */
  werbungskostenRente: 102,
  /** Sonderausgaben-Pauschbetrag */
  sonderausgaben: 36,
} as const;

/** Grundfreibetrag 2026 (§ 32a EStG) */
export const GRUNDFREIBETRAG = 12_348;
/** Freigrenze des Solidaritätszuschlags (Lohnsteuer pro Jahr) */
export const SOLI_FREIGRENZE = 20_350;

/** Einkommensteuer nach § 32a EStG, Tarif 2026, Grundtabelle. */
export function est2026(zvE: number): number {
  const x = Math.floor(Math.max(0, zvE));
  if (x <= GRUNDFREIBETRAG) return 0;
  if (x <= 17_799) {
    const y = (x - GRUNDFREIBETRAG) / 1e4;
    return Math.floor((914.51 * y + 1400) * y);
  }
  if (x <= 69_878) {
    const z = (x - 17_799) / 1e4;
    return Math.floor((173.1 * z + 2397) * z + 1034.87);
  }
  if (x <= 277_825) return Math.floor(0.42 * x - 11_135.63);
  return Math.floor(0.45 * x - 19_470.38);
}

/** Solidaritätszuschlag mit Freigrenze 20.350 € und Milderungszone. */
export function soli(est: number): number {
  if (est <= SOLI_FREIGRENZE) return 0;
  return Math.min(est * 0.055, (est - SOLI_FREIGRENZE) * 0.119);
}

export interface Eingabe {
  brutto: number;
  pkv: boolean;
  /** PKV-Basisbeitrag inkl. PV, Arbeitnehmeranteil, € pro Monat */
  pkvMonat: number;
  kinderlos: boolean;
  /** Kirchensteuersatz, 0 / 0.08 / 0.09 */
  kirche: number;
}

export interface Ergebnis {
  brutto: number;
  pkv: boolean;
  rv: number;
  alv: number;
  kv: number;
  pv: number;
  lohnsteuer: number;
  soli: number;
  kirche: number;
  pkvBeitrag: number;
  netto: number;
  ag: { rv: number; alv: number; kv: number; pv: number };
  /** geschätzte Konsumsteuern aus dem Netto, nur wenn gewählt (`mitKonsum`) */
  konsum?: Konsumsteuern;
}

/** Lohnsteuer, Soli, Kirche, Sozialabgaben und Netto; `rvSatz` überschreibt den Rentenbeitragssatz (Rentenmodell). */
export function berechne(e: Eingabe, opt: { rvSatz?: number } = {}): Ergebnis {
  const B = Math.max(0, e.brutto || 0);
  const bR = Math.min(B, SV_2026.bbgRv);
  const bK = Math.min(B, SV_2026.bbgKv);
  const rv = (bR * (opt.rvSatz ?? SV_2026.rv)) / 2;
  const alv = (bR * SV_2026.alv) / 2;
  const pkvBeitrag = e.pkv ? Math.max(0, e.pkvMonat || 0) * 12 : 0;

  let kv = 0,
    pv = 0,
    kvAG = 0,
    pvAG = 0,
    vorsorgeKV: number;
  if (!e.pkv) {
    kv = bK * (SV_2026.kv / 2 + SV_2026.kvZusatz / 2);
    pv = bK * (SV_2026.pv / 2 + (e.kinderlos ? SV_2026.pvKinderlos : 0));
    kvAG = kv;
    pvAG = bK * (SV_2026.pv / 2);
    // Vorsorgepauschale: KV mit ermäßigtem Satz
    vorsorgeKV = bK * (SV_2026.kvErmaessigt / 2 + SV_2026.kvZusatz / 2) + pv;
  } else {
    vorsorgeKV = pkvBeitrag;
  }

  const zvE = B - PAUSCHALEN.werbungskosten - PAUSCHALEN.sonderausgaben - rv - alv - vorsorgeKV;
  const lohnsteuer = est2026(zvE);
  const so = soli(lohnsteuer);
  const kirche = lohnsteuer * e.kirche;
  const netto = B - rv - alv - kv - pv - lohnsteuer - so - kirche - pkvBeitrag;

  return {
    brutto: B,
    pkv: e.pkv,
    rv,
    alv,
    kv,
    pv,
    lohnsteuer,
    soli: so,
    kirche,
    pkvBeitrag,
    netto,
    ag: { rv, alv, kv: kvAG, pv: pvAG },
  };
}

/** Verteilung der Lohnsteuer nach Art. 106 GG; Soli geht ganz an den Bund. */
export const ANTEIL = { bund: 0.425, land: 0.425, gemeinde: 0.15 } as const;

/** Was Bund, Land und Gemeinde von dir bekommen; mit Konsumsteuern, wenn sie gewählt sind */
export function aufEbenen(r: Ergebnis) {
  return {
    bund: r.lohnsteuer * ANTEIL.bund + r.soli + (r.konsum?.bund ?? 0),
    land: r.lohnsteuer * ANTEIL.land + (r.konsum?.land ?? 0),
    gemeinde: r.lohnsteuer * ANTEIL.gemeinde + (r.konsum?.gemeinde ?? 0),
  };
}

export const summeSV = (r: Ergebnis) => r.rv + r.alv + r.kv + r.pv;
export const summeKonsum = (r: Ergebnis) => r.konsum?.summe ?? 0;
export const summeAbgaben = (r: Ergebnis) => r.lohnsteuer + r.soli + r.kirche + summeSV(r) + summeKonsum(r);
/** Was nach allen Abgaben bleibt: das Netto, mit gewählten Konsumsteuern abzüglich dieser */
export const verfuegbar = (r: Ergebnis) => r.netto - summeKonsum(r);
