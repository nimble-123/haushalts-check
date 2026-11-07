/**
 * Länderhaushalte und Gemeinden je Land nach Aufgabenbereichen.
 *
 * Quelle: Destatis, Statistischer Bericht „Rechnungsergebnisse der Kern- und Extrahaushalte
 * des Öffentlichen Gesamthaushalts 2022“, Tabelle 71711-12, Zeilen „Bereinigte Ausgaben“
 * (.44 = Staat/Land, .45 = Gemeinden/Gemeindeverbände), Mio €.
 *
 * Schreibt:
 *   src/data/laender/<slug>.json          – Landesebene
 *   src/data/gemeinden-schaetzung.json    – Zweck-Anteile der Gemeinden je Land (Schätzbasis für Städte)
 *
 * Aufruf:  npm run daten:laender
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { blatt, quelle, ROOT, schreibeJson, type Zelle } from './xlsx.ts';

const URL =
  'https://www.destatis.de/DE/Themen/Staat/Oeffentliche-Finanzen/Ausgaben-Einnahmen/Publikationen/' +
  'Downloads-Ausgaben-und-Einnahmen/statistischer-bericht-rechnungsergebnis-oeffentlicher-haushalt-2140310227015.xlsx' +
  '?__blob=publicationFile&v=2';
const JAHR = 2022;
const QUELLE = {
  label: 'Destatis: Rechnungsergebnisse des Öffentlichen Gesamthaushalts 2022, Tabelle 71711-12',
  url: 'https://www.destatis.de/DE/Themen/Staat/Oeffentliche-Finanzen/Ausgaben-Einnahmen/Publikationen/_publikationen-innen-ausgaben-einnahmen.html',
};

type Gruppe = 'soz' | 'sich' | 'inf' | 'for' | 'zins' | 'verw';

// Spaltenreihenfolge im Blatt (ab Spalte D) → Länderschlüssel, Name, Slug, Kirchensteuer
const LAENDER: [string, string, string, number][] = [
  ['08', 'Baden-Württemberg', 'baden-wuerttemberg', 0.08],
  ['09', 'Bayern', 'bayern', 0.08],
  ['12', 'Brandenburg', 'brandenburg', 0.09],
  ['06', 'Hessen', 'hessen', 0.09],
  ['13', 'Mecklenburg-Vorpommern', 'mecklenburg-vorpommern', 0.09],
  ['03', 'Niedersachsen', 'niedersachsen', 0.09],
  ['05', 'Nordrhein-Westfalen', 'nordrhein-westfalen', 0.09],
  ['07', 'Rheinland-Pfalz', 'rheinland-pfalz', 0.09],
  ['10', 'Saarland', 'saarland', 0.09],
  ['14', 'Sachsen', 'sachsen', 0.09],
  ['15', 'Sachsen-Anhalt', 'sachsen-anhalt', 0.09],
  ['01', 'Schleswig-Holstein', 'schleswig-holstein', 0.09],
  ['16', 'Thüringen', 'thueringen', 0.09],
  ['11', 'Berlin', 'berlin', 0.09],
  ['04', 'Bremen', 'bremen', 0.09],
  ['02', 'Hamburg', 'hamburg', 0.09],
];
const STADTSTAATEN = new Set(['02', '04', '11']);

// Anzeige-Kategorien: Name, Gruppe, Formel aus Aufgabenbereichen (negativ = abziehen)
const KATEGORIEN: [string, Gruppe, number[]][] = [
  ['Schulen', 'for', [1012]],
  ['Hochschulen', 'for', [1015]],
  ['Forschung und sonstige Bildung', 'for', [1016, 1017, 1018]],
  ['Kultur und Religion', 'for', [1019]],
  ['Kindertagesbetreuung', 'soz', [1028]],
  ['Soziales, Familie, Jugend', 'soz', [1021, -1028]],
  ['Gesundheit und Sport', 'soz', [1031, 1032]],
  ['Polizei, Sicherheit und Justiz', 'sich', [1008]],
  ['Umwelt- und Naturschutz', 'inf', [1030, -1031, -1032]],
  ['Wohnen, Städtebau, kommunale Dienste', 'inf', [1034]],
  ['Landwirtschaft und Forsten', 'inf', [1038]],
  ['Energie, Wasser, Wirtschaft', 'inf', [1039]],
  ['Verkehr', 'inf', [1046]],
  ['Zinsen', 'zins', [1058]],
  ['Finanzausgleich an Kommunen', 'verw', [1057]],
  ['Vermögen und Sondervermögen', 'verw', [1055, -1057, -1058]],
  ['Politische Führung und Verwaltung', 'verw', [1002]],
  ['Pensionen und Beihilfen', 'verw', [1059, 1060]],
];
const GESAMT = 1001;
const UEBRIG: [string, Gruppe] = ['Übriges, nicht einzeln ausgewiesen', 'verw'];

interface Posten {
  name: string;
  v: number;
  g: Gruppe;
}

const zahl = (v: Zelle) => (v === null || ['-', '.', 'x', '–'].includes(String(v)) ? 0 : Number(v));
const runde1 = (x: number) => Math.round(x * 10) / 10;
const summe = (ps: Posten[]) => ps.reduce((s, p) => s + p.v, 0);
function pruefe(bedingung: boolean, ...info: unknown[]): asserts bedingung {
  if (!bedingung) throw new Error(`Prüfung fehlgeschlagen: ${JSON.stringify(info)}`);
}

/** Map "bereich.zeile" → 16 Länderwerte, plus Prüfung der Zeilenbeschriftungen. */
function werte(rows: Zelle[][]) {
  const kopf = rows[3].slice(3, 19).map((c) => String(c).replace(/-\n/g, '-').replace(/\n/g, '').trim());
  const ohneLeer = (s: string) => s.replace(/ /g, '');
  pruefe(kopf.map(ohneLeer).join() === LAENDER.map((l) => ohneLeer(l[1])).join(), kopf);
  const out = new Map<string, number[]>();
  for (const r of rows.slice(5)) {
    const key = String(r[0] ?? '')
      .split('\n')
      .pop()!
      .trim();
    const teile = key.split('.');
    if (teile.length !== 2 || !/^\d+$/.test(teile[0]) || !/^\d+$/.test(teile[1])) continue;
    const [b, z] = teile;
    out.set(`${Number(b)}.${z}`, r.slice(3, 19).map(zahl));
    const lab = String(r[1] ?? '').trim();
    if (z === '43') pruefe(lab.startsWith('Bereinigte Ausgaben'), b, lab);
    if (z === '44') pruefe(lab === 'Staat', b, lab);
    if (z === '45') pruefe(lab.startsWith('Gemeinden'), b, lab);
  }
  return out;
}

/** Kategorien für Land i. Positive Posten plus „Übriges“ (Rest zur Gesamtzeile); saldiert negative werden zurückgegeben. */
function kategorien(w: Map<string, number[]>, zeile: string, i: number) {
  const v = (b: number) => w.get(`${Math.abs(b)}.${zeile}`)![i] * (b > 0 ? 1 : -1);
  const gesamt = w.get(`${GESAMT}.${zeile}`)![i];
  const alle: Posten[] = KATEGORIEN.map(([name, g, f]) => ({ name, v: runde1(f.reduce((s, b) => s + v(b), 0)), g }));
  const rest = runde1(gesamt - summe(alle));
  if (rest >= 0.5) alle.push({ name: UEBRIG[0], v: rest, g: UEBRIG[1] });
  const posten = alle.filter((p) => p.v > 0.4);
  const negativ = alle.filter((p) => p.v < -0.4);
  return { posten, gesamt, abw: gesamt - summe(posten), negativ };
}

/** −1.234 statt -1234 */
const deZahl = (v: number) => (v < 0 ? '−' : '') + Math.round(Math.abs(v)).toLocaleString('de-DE');
const fmtNeg = (neg: Posten[]) => neg.map((p) => `${p.name} (${deZahl(p.v)} Mio €)`).join(', ');
const absteigend = (ps: Posten[]) => [...ps].sort((a, b) => b.v - a.v);

const pfad = await quelle('rechnungsergebnis-oeh-2022.xlsx', URL);
const w = werte(await blatt(pfad, '71711-12'));
const ziel = join(ROOT, 'src', 'data', 'laender');
mkdirSync(ziel, { recursive: true });
const schaetzung: Record<string, { jahr: number; gesamt: number; posten: Posten[] }> = {};

LAENDER.forEach(([code, name, slug, kist], i) => {
  const { posten, gesamt, abw, negativ } = kategorien(w, '44', i);
  // exakte Abstimmung: Gesamt = positive + negative Posten
  pruefe(Math.abs(abw - summe(negativ)) < 1, name, abw);
  let hinweis = STADTSTAATEN.has(code)
    ? 'Stadtstaat: Land und Stadt haben einen gemeinsamen Haushalt.'
    : '„Finanzausgleich an Kommunen“ fließt an Städte, Gemeinden und Landkreise weiter.';
  if (negativ.length) hinweis += ` Unterm Strich negativ und daher nicht gezeigt: ${fmtNeg(negativ)}.`;
  schreibeJson(join(ziel, `${slug}.json`), {
    code,
    slug,
    name,
    jahr: JAHR,
    einheit: 'Mio €',
    art: 'Rechnungsergebnis, bereinigte Ausgaben nach Aufgabenbereichen',
    kirchensteuer: kist,
    posten: absteigend(posten),
    quellen: [QUELLE],
    hinweis,
  });
  console.log(
    `${name.padEnd(24)} ${gesamt.toFixed(0).padStart(9)} Mio €  ${String(posten.length).padStart(2)} Posten  Abw. ${abw >= 0 ? '+' : ''}${abw.toFixed(1)}  ${fmtNeg(negativ)}`,
  );
  if (!STADTSTAATEN.has(code)) {
    const g = kategorien(w, '45', i);
    // Teilsummen der Gemeinden überschneiden sich leicht
    pruefe(Math.abs(g.abw - summe(g.negativ)) / g.gesamt < 0.01, name, 'Gemeinden', g.abw);
    schaetzung[code] = { jahr: JAHR, gesamt: g.gesamt, posten: absteigend(g.posten) };
  }
});
schreibeJson(join(ROOT, 'src', 'data', 'gemeinden-schaetzung.json'), { quelle: QUELLE, laender: schaetzung });
console.log('Gemeinden-Schätzbasis für', Object.keys(schaetzung).length, 'Länder geschrieben.');
