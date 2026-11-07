// Schätzung der Konsumsteuern, die eine alleinlebende Person aus ihrem Netto zahlt: Mehrwertsteuer,
// Energie- und Stromsteuer, Versicherungsteuer. Grundlage und Annahmen: pipeline/konsum.ts.
import roh from '../data/konsum.json';
import type { KonsumDaten, KonsumKategorie } from '../data/types';
import type { Ergebnis } from './steuer';

export const KONSUM = roh as KonsumDaten;

export interface Konsumsteuern {
  /** geschätzte Konsumausgaben im Jahr */
  konsum: number;
  mwst: number;
  energiesteuer: number;
  stromsteuer: number;
  versicherungsteuer: number;
  summe: number;
  /** wer die Konsumsteuern bekommt */
  bund: number;
  land: number;
  gemeinde: number;
}

/** Wert zwischen den Klassen linear, unterhalb der ersten anteilig, oberhalb der letzten mit der letzten Steigung */
function zwischen(x: number, xs: readonly number[], ys: readonly number[]) {
  if (x <= xs[0]) return (ys[0] * x) / xs[0];
  let i = xs.findIndex((v) => v >= x);
  if (i < 0) i = xs.length - 1;
  const [x0, x1, y0, y1] = [xs[i - 1], xs[i], ys[i - 1], ys[i]];
  return Math.max(0, y0 + ((y1 - y0) * (x - x0)) / (x1 - x0));
}

/** Konsumsteuern zu einem Jahresnetto; ohne Netto keine Konsumsteuern */
export function konsumsteuern(nettoJahr: number, d: KonsumDaten = KONSUM): Konsumsteuern {
  const monat = Math.max(0, nettoJahr) / 12;
  // in Preisen von 2018 einordnen, Ergebnis wieder in heutige Preise
  const real = monat / d.preisfaktor;
  const xs = d.klassen.map((k) => k.netto);
  const wert = (y: (k: KonsumDaten['klassen'][number]) => number) =>
    zwischen(real, xs, d.klassen.map(y)) * d.preisfaktor;

  const kategorien = Object.keys(d.saetze) as KonsumKategorie[];
  const ausgaben = kategorien.map((k) => wert((c) => c.kategorien[k]));
  const versicherung = wert((c) => c.versicherung);
  // nie mehr ausgeben, als netto da ist (in der Statistik leben Kleinverdiener teils von Erspartem)
  const bedarf = ausgaben.reduce((s, v) => s + v, 0) + versicherung;
  const kappe = bedarf > monat ? monat / bedarf : 1;

  let mwst = 0,
    energiesteuer = 0,
    stromsteuer = 0;
  kategorien.forEach((k, i) => {
    const a = ausgaben[i] * kappe;
    mwst += a * d.saetze[k].mwst;
    energiesteuer += a * d.saetze[k].energie;
    stromsteuer += a * d.saetze[k].strom;
  });
  const versicherungsteuer = versicherung * kappe * d.versicherungsteuer;
  const jahr = (v: number) => v * 12;
  const v = d.mwstVerteilung;
  const r = {
    konsum: jahr((bedarf - versicherung) * kappe),
    mwst: jahr(mwst),
    energiesteuer: jahr(energiesteuer),
    stromsteuer: jahr(stromsteuer),
    versicherungsteuer: jahr(versicherungsteuer),
  };
  const summe = r.mwst + r.energiesteuer + r.stromsteuer + r.versicherungsteuer;
  const anteil = v.bund + v.land + v.gemeinde;
  return {
    ...r,
    summe,
    // Energie-, Strom- und Versicherungsteuer sind Bundessteuern
    bund: (r.mwst * v.bund) / anteil + r.energiesteuer + r.stromsteuer + r.versicherungsteuer,
    land: (r.mwst * v.land) / anteil,
    gemeinde: (r.mwst * v.gemeinde) / anteil,
  };
}

/** Ergebnis mit geschätzten Konsumsteuern aus dem Netto */
export const mitKonsum = (r: Ergebnis): Ergebnis => ({ ...r, konsum: konsumsteuern(r.netto) });
