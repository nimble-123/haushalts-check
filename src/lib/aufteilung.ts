// Aufteilung der Abgaben auf Zwecke, Töpfe, Kästchen und Kalendertage – ohne DOM, für alle Diagramme der Startseite.
import { BUND_GESAMT, EINZELPLAENE, ENTWURF_2027, ENTWURF_2027_GESAMT } from '../data/bund';
import { type Ebene, GRUPPEN, type Gruppe, type Posten } from '../data/types';
import { mitKonsum } from './konsum';
import { aufEbenen, berechne, type Eingabe, type Ergebnis, summeKonsum, summeSV, verfuegbar } from './steuer';

export const summe = (a: readonly { v: number }[]) => a.reduce((s, x) => s + x.v, 0);

/** Posten mit Kennzeichen, ob er die zusammengefassten kleinen Posten darstellt */
export type Topf = Posten & { rest?: boolean };

/** Die n größten Posten, der Rest als „Übrige (k)“ in der Gruppe Verwaltung */
export function groessteN(posten: readonly Posten[], n: number): Topf[] {
  const sortiert = [...posten].sort((a, b) => b.v - a.v);
  const rest = sortiert.slice(n);
  return rest.length
    ? [...sortiert.slice(0, n), { name: `Übrige (${rest.length})`, v: summe(rest), g: 'verw', rest: true }]
    : sortiert;
}

/** Einzelpläne des Bundes als Posten („EP 11 Arbeit & Soziales“) */
export const einzelplanPosten = (): Posten[] =>
  EINZELPLAENE.map((e) => ({ name: `EP ${e.n} ${e.name}`, v: e.v, g: e.g }));

/** Zwecke in Anzeige-Reihenfolge: Sozialversicherung, die sechs Gruppen wie in der Legende, Kirche */
export type Zweck = 'sv' | Gruppe | 'kirche';
export const ZWECKE: readonly Zweck[] = ['sv', ...(Object.keys(GRUPPEN) as Gruppe[]), 'kirche'];
const ZWECK_NAME: Record<Zweck, string> = { sv: 'Sozialversicherung', kirche: 'Kirchensteuer', ...GRUPPEN };

/** Abgaben einer Person nach Zweck über Sozialversicherung, Bund, Land und Gemeinde (nur Zwecke > 0) */
export function nachZweck(r: Ergebnis, land: Pick<Ebene, 'posten'>, gem: Pick<Ebene, 'posten'>) {
  const e = aufEbenen(r);
  const landT = summe(land.posten);
  const gemT = summe(gem.posten);
  const acc = Object.fromEntries(ZWECKE.map((k) => [k, 0])) as Record<Zweck, number>;
  acc.sv = summeSV(r);
  acc.kirche = r.kirche;
  for (const p of EINZELPLAENE) acc[p.g] += (e.bund * p.v) / BUND_GESAMT;
  for (const p of land.posten) acc[p.g] += (e.land * p.v) / landT;
  for (const p of gem.posten) acc[p.g] += (e.gemeinde * p.v) / gemT;
  return ZWECKE.map((k) => ({ k, name: ZWECK_NAME[k], v: acc[k] })).filter((d) => d.v > 0);
}

/**
 * Ganze Kästchen für ein Raster mit `gesamt` Feldern (Methode der größten Reste):
 * Die Summe ist immer genau `gesamt`, kein Wert ist negativ, die Reihenfolge bleibt erhalten.
 */
export function aufRaster(werte: readonly number[], gesamt = 100): number[] {
  const summeWerte = werte.reduce((s, v) => s + v, 0);
  if (summeWerte <= 0) return werte.map(() => 0);
  const roh = werte.map((v) => (v / summeWerte) * gesamt);
  const n = roh.map(Math.floor);
  const fehlend = gesamt - n.reduce((s, v) => s + v, 0);
  roh
    .map((v, i) => ({ i, rest: v - n[i] }))
    .sort((a, b) => b.rest - a.rest)
    .slice(0, fehlend)
    .forEach(({ i }) => {
      n[i]++;
    });
  return n;
}

/** Kalenderabschnitt: von welchem bis zu welchem Tag des Jahres (0-basiert, inklusive) für einen Betrag gearbeitet wird */
export interface Abschnitt {
  von: number;
  bis: number;
  /** Lage im Jahr als Anteil 0…1 (für die Balken) */
  start: number;
  ende: number;
}

/** Brutto der Reihe nach auf die Beträge verteilt, umgerechnet in Kalendertage */
export function kalenderAbschnitte(betraege: readonly number[], brutto: number, tage = 365): Abschnitt[] {
  let acc = 0;
  return betraege.map((v) => {
    const s = (acc / brutto) * tage;
    const e = ((acc + v) / brutto) * tage;
    acc += v;
    return { von: Math.floor(s), bis: Math.max(Math.floor(s), Math.ceil(e) - 1), start: s / tage, ende: e / tage };
  });
}

/** Tag des Jahres (0-basiert), ab dem rechnerisch für das eigene Netto gearbeitet wird */
export const freiAbTag = (r: Ergebnis, tage = 365) => Math.floor(((r.brutto - verfuegbar(r)) / r.brutto) * tage);

/**
 * Abgabenquote (gesamt, Steuern, Sozialabgaben, Konsumsteuern) über eine Spanne von Bruttolöhnen bei sonst
 * gleichen Angaben; Konsumsteuern nur, wenn `konsum` gesetzt ist.
 */
export function abgabenquoten(
  basis: Omit<Eingabe, 'brutto'>,
  konsum = false,
  von = 15_000,
  bis = 160_000,
  schritt = 500,
) {
  const reihe: { brutto: number; gesamt: number; steuern: number; sozial: number; konsum: number }[] = [];
  for (let brutto = von; brutto <= bis; brutto += schritt) {
    const c0 = berechne({ ...basis, brutto });
    const c = konsum ? mitKonsum(c0) : c0;
    const steuern = c.lohnsteuer + c.soli + c.kirche;
    const sozial = summeSV(c);
    const k = summeKonsum(c);
    reihe.push({
      brutto,
      gesamt: (steuern + sozial + k) / brutto,
      steuern: steuern / brutto,
      sozial: sozial / brutto,
      konsum: k / brutto,
    });
  }
  return reihe;
}

/** Veränderung Entwurf 2027 gegenüber Soll 2026 je Einzelplan (Mrd €), Rest als „Alle übrigen“; |Δ| ≥ 0,05 */
export function veraenderung2027() {
  const bekannt = EINZELPLAENE.filter((e) => ENTWURF_2027[e.n] != null);
  const zeilen = bekannt.map((e) => ({ name: `EP ${e.n} ${e.name}`, d: ENTWURF_2027[e.n] - e.v, g: e.g }));
  const entwurfBekannt = Object.values(ENTWURF_2027).reduce((s, v) => s + v, 0);
  zeilen.push({
    name: 'Alle übrigen Einzelpläne',
    d: ENTWURF_2027_GESAMT - entwurfBekannt - (BUND_GESAMT - summe(bekannt)),
    g: 'verw',
  });
  return zeilen.filter((z) => Math.abs(z.d) >= 0.05).sort((a, b) => b.d - a.d);
}
