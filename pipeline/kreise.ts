/**
 * Landkreise → src/data/kreise/<slug>.json
 *
 * Ausgaben nach Art aus der Regionaldatenbank (Tabelle 71717-Z-05): amtliche Summe je Kreis aus Kreisverwaltung und
 * kreisangehörigen Gemeinden, Kreisumlagen sind darin schon abgezogen. Name, Einwohner und Lage aus dem Gemeindeverzeichnis.
 * Braucht beim ersten Lauf ein Konto bei regionalstatistik.de (siehe .env.example); der Export hat rund 210 MB.
 *
 * Aufruf:  npm run daten:kreise
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  alsText,
  felder,
  GV_GEMEINDEN_URL,
  GV_KREISE_URL,
  QUELLEN,
  quelle,
  ROOT,
  schreibeJson,
  slugify,
} from './helfer.ts';
import { ladeTabelle } from './regio.ts';
import { blatt } from './xlsx.ts';

const ROH = join(QUELLEN, '71717-Z-05-gemeinden.csv');
const ZIEL = join(ROOT, 'src', 'data', 'kreise');
const STAEDTE = join(ROOT, 'src', 'data', 'staedte');
const TYPEN = new Set(['Landkreis', 'Kreis', 'Regionalverband']);
// Laut Tabellenhinweis der Regionaldatenbank sind die Werte des jüngsten Berichtsjahres vorläufig
const VORLAEUFIG_AB = 2025;
const QUELLE = {
  label: 'Regionaldatenbank Deutschland: Rechnungsergebnisse der kommunalen Kernhaushalte, Tabelle 71717-Z-05',
  url: 'https://www.regionalstatistik.de/genesis/online?operation=table&code=71717-Z-05',
};

if (!existsSync(ROH)) await ladeTabelle('71717-Z-05', ROH, '2022');

// ── Stammdaten ──────────────────────────────────────────────────────────────────────────────────

/** „Wesermarsch“ → „Landkreis Wesermarsch“; „Heidekreis“, „Region Hannover“ bleiben, wie sie sind. */
const anzeigename = (name: string, typ: string) => (/kreis\b|region|verband/i.test(name) ? name : `${typ} ${name}`);

interface Kreis {
  ags: string;
  name: string;
  amtlich: string;
  einwohner: number;
  slug: string;
}
const kreise: Kreis[] = [];
for (const r of (
  await blatt(await quelle('gv-kreise-2024.xlsx', GV_KREISE_URL), 'Kreisfreie Städte u. Landkreise')
).slice(3)) {
  const [ags, typ, roh, , , ew] = r;
  if (typeof ags !== 'string' || ags.length !== 5 || !TYPEN.has(String(typ))) continue;
  const name = anzeigename(String(roh).split(',')[0].trim(), String(typ));
  kreise.push({ ags, name, amtlich: `${roh}, ${typ}`, einwohner: Number(ew), slug: slugify(name) });
}
const stadtSlugs = new Set(readdirSync(STAEDTE).map((f) => f.replace('.json', '')));
if (new Set(kreise.map((k) => k.slug)).size !== kreise.length || kreise.some((k) => stadtSlugs.has(k.slug))) {
  throw new Error('Slugs der Kreise nicht eindeutig');
}

// Lage: nach Einwohnern gewichteter Mittelpunkt der Gemeinden (Satzart 60)
const summen = new Map<string, { lat: number; lon: number; ew: number }>();
for (const r of await blatt(
  await quelle('gv-gemeinden-2025.xlsx', GV_GEMEINDEN_URL),
  'Onlineprodukt_Gemeinden31122025',
)) {
  if (String(r[0]) !== '60') continue;
  const lon = Number(String(r[14] ?? '').replace(',', '.')),
    lat = Number(String(r[15] ?? '').replace(',', '.')),
    ew = Number(r[9]) || 1;
  if (!(lat && lon)) continue;
  const k = `${r[2]}${r[3]}${r[4]}`;
  const s = summen.get(k) ?? { lat: 0, lon: 0, ew: 0 };
  s.lat += lat * ew;
  s.lon += lon * ew;
  s.ew += ew;
  summen.set(k, s);
}

// ── Finanzdaten: nur die Zeilen der Kreisebene ──────────────────────────────────────────────────

const LFD = 'Auszahlungen aus laufender Verwaltungstätigkeit (bereinigt)';
const FELDER: Record<string, [string, string]> = {
  bev: ['Bevölkerung am 30.06.', ''],
  gesamt: ['Auszahlungen insgesamt (ohne Finanzierungstätigkeit, bereinigt)', ''],
  lfd: [LFD, ''],
  personal: [LFD, 'Personal- und Versorgungsauszahlungen'],
  sach: [LFD, 'Sach- und Dienstleistungen'],
  sozial: [LFD, 'Soziale Leistungen und aufgabenbezogene Leistungsbeteiligungen'],
  invest: ['Auszahlungen aus Investitionstätigkeit (bereinigt)', ''],
};
const schluessel = new Map(Object.entries(FELDER).map(([k, [m, d]]) => [`${m}|${d}`, k]));

const zeilen = alsText(readFileSync(ROH)).split(/\r?\n/);
const kopf = felder(zeilen[0]);
const sp = (n: string) => {
  const i = kopf.indexOf(n);
  if (i < 0) throw new Error(`Spalte „${n}“ fehlt`);
  return i;
};
const [iJahr, iCode, iDetail, iWert, iMerkmal] = [
  'time',
  '1_variable_attribute_code',
  '2_variable_attribute_label',
  'value',
  'value_variable_label',
].map(sp);

const gesucht = new Set(kreise.map((k) => `F${k.ags}`));
const daten = new Map<string, Map<number, Record<string, number>>>(); // ags → jahr → Werte
for (const z of zeilen) {
  if (!z.includes(';Kreise und kreisfreie Städte;')) continue;
  const f = z.split(';');
  if (!gesucht.has(f[iCode])) continue;
  const k = schluessel.get(`${f[iMerkmal].trim()}|${f[iDetail].trim()}`);
  if (!k || !/^-?\d+$/.test(f[iWert])) continue;
  const ags = f[iCode].slice(1);
  const jahr = Number(f[iJahr]);
  if (!daten.has(ags)) daten.set(ags, new Map());
  const j = daten.get(ags)!;
  if (!j.has(jahr)) j.set(jahr, {});
  j.get(jahr)![k] = Number(f[iWert]);
}

const fehler: string[] = [];
function rechne(name: string, jahr: number, v: Record<string, number>) {
  if (Object.keys(FELDER).some((k) => v[k] === undefined) || v.bev <= 0) return null;
  const pk = (x: number) => x / v.bev;
  const uebrige = pk(v.lfd - v.personal - v.sach - v.sozial);
  if (uebrige < 0) fehler.push(`${name} ${jahr}: Übrige laufende Auszahlungen negativ (${uebrige.toFixed(0)} €/EW)`);
  const posten: [string, number][] = [
    ['Personal und Versorgung', pk(v.personal)],
    ['Sach- und Dienstleistungen', pk(v.sach)],
    ['Soziale Leistungen', pk(v.sozial)],
    ['Investitionen', pk(v.invest)],
    ['Übrige laufende Auszahlungen', Math.max(0, uebrige)],
  ];
  const summe = posten.reduce((a, [, x]) => a + x, 0);
  if (Math.abs(summe - pk(v.gesamt)) > 0.01 * pk(v.gesamt)) {
    fehler.push(`${name} ${jahr}: Summe ${summe.toFixed(0)} ≠ insgesamt ${pk(v.gesamt).toFixed(0)} €/EW`);
  }
  return {
    jahr,
    vorlaeufig: jahr >= VORLAEUFIG_AB,
    posten: posten.map(([n, x]) => ({ name: n, proKopf: Math.round(x) })),
    quellen: [QUELLE],
  };
}

type Ergebnis = NonNullable<ReturnType<typeof rechne>>;
const ergebnisse = new Map<string, Map<number, Ergebnis>>();
for (const k of kreise) {
  const m = new Map<number, Ergebnis>();
  for (const [jahr, v] of daten.get(k.ags) ?? []) {
    const e = rechne(k.name, jahr, v);
    if (e) m.set(jahr, e);
  }
  ergebnisse.set(k.ags, m);
}
if (fehler.length)
  throw new Error(`Plausibilitätsprüfung fehlgeschlagen (${fehler.length}):\n  ${fehler.join('\n  ')}`);

// Neuestes Jahr, das für mindestens 90 % der Kreise vollständig ist
const jahre = [...new Set([...ergebnisse.values()].flatMap((m) => [...m.keys()]))].sort((a, b) => b - a);
const vollstaendig = (j: number) => [...ergebnisse.values()].filter((m) => m.has(j)).length;
const jahr = jahre.find((j) => vollstaendig(j) >= 0.9 * kreise.length);
if (!jahr) throw new Error(`Kein Jahr vollständig: ${jahre.map((j) => `${j}: ${vollstaendig(j)}`).join(', ')}`);

// ── Schreiben ───────────────────────────────────────────────────────────────────────────────────

mkdirSync(ZIEL, { recursive: true });
for (const f of readdirSync(ZIEL)) unlinkSync(join(ZIEL, f));
const rueckfall: string[] = [];
for (const k of kreise) {
  const m = ergebnisse.get(k.ags)!;
  const j: number | undefined = [...m.keys()].filter((x) => x <= jahr).sort((a, b) => b - a)[0];
  const lage = summen.get(k.ags);
  if (!j || !lage) throw new Error(`${k.name}: ${j ? 'keine Koordinaten' : 'keine Finanzdaten'}`);
  if (j !== jahr) rueckfall.push(`${k.name} (${j})`);
  schreibeJson(join(ZIEL, `${k.slug}.json`), {
    slug: k.slug,
    ags: k.ags,
    land: k.ags.slice(0, 2),
    name: k.name,
    amtlich: k.amtlich,
    einwohner: k.einwohner,
    stadtstaat: false,
    kreis: true,
    lat: Number((lage.lat / lage.ew).toFixed(4)),
    lon: Number((lage.lon / lage.ew).toFixed(4)),
    ausgabearten: m.get(j)!,
  });
}
console.log(`${kreise.length} Kreise geschrieben, Jahr ${jahr}${jahr >= VORLAEUFIG_AB ? ' (vorläufig)' : ''}.`);
console.log(`Jahre: ${jahre.map((j) => `${j} (${vollstaendig(j)})`).join(', ')}`);
if (rueckfall.length) console.log(`Älteres Jahr: ${rueckfall.join(', ')}`);
