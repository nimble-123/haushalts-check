/**
 * Alle Gemeinden und ihr Ziel, also ihre kreisfreie Stadt oder ihr Landkreis:
 *   public/orte.json       – Name und Ziel, für die Ortssuche
 *   public/orte-lage.json  – Mittelpunkt, Radius und Ziel, für „In meiner Nähe“
 *
 * Quelle: Destatis Gemeindeverzeichnis (GV-ISys), Gemeinden Stand 31.12.2025. Sortiert nach Einwohnern, damit bei
 * gleichen Namen die größte Gemeinde zuerst kommt. Der Browser lädt die Dateien erst, wenn sie gebraucht werden.
 *
 * Aufruf:  npm run daten:orte   (nach daten:staedte und daten:kreise)
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Stadt } from '../src/data/types.ts';
import { GV_GEMEINDEN_URL, quelle, ROOT } from './helfer.ts';
import { blatt } from './xlsx.ts';

const lies = (ordner: string): Stadt[] =>
  readdirSync(join(ROOT, 'src', 'data', ordner)).map((f) =>
    JSON.parse(readFileSync(join(ROOT, 'src', 'data', ordner, f), 'utf8')),
  );
const staedte = lies('staedte');
const kreise = lies('kreise');

const ziele = [...staedte, ...kreise].map((s) => s.slug);
const nachAgs = new Map([...staedte, ...kreise].map((s) => [s.ags, ziele.indexOf(s.slug)]));

const gemeinden: { name: string; ew: number; ziel: number; lat: number; lon: number; radius: number }[] = [];
for (const r of await blatt(
  await quelle('gv-gemeinden-2025.xlsx', GV_GEMEINDEN_URL),
  'Onlineprodukt_Gemeinden31122025',
)) {
  if (String(r[0]) !== '60') continue;
  const ags = `${r[2]}${r[3]}${r[4]}`;
  const ziel = nachAgs.get(ags);
  // Gemeindefreie Gebiete haben keine Einwohner und sind kein Wohnort
  if (!Number(r[9])) continue;
  if (ziel === undefined) throw new Error(`Kein Ziel für Kreis ${ags} (${r[7]})`);
  const lon = Number(String(r[14] ?? '').replace(',', '.')),
    lat = Number(String(r[15] ?? '').replace(',', '.')),
    flaeche = Number(r[8]);
  if (!(lat && lon && flaeche)) throw new Error(`Keine Lage für ${r[7]}`);
  gemeinden.push({
    name: String(r[7]).split(',')[0].trim(),
    ew: Number(r[9]),
    ziel,
    lat,
    lon,
    // Radius eines Kreises mit der Fläche der Gemeinde
    radius: Math.sqrt(flaeche / Math.PI),
  });
}
if (gemeinden.length < 10_000) throw new Error(`Nur ${gemeinden.length} Gemeinden gefunden`);
gemeinden.sort((a, b) => b.ew - a.ew || a.name.localeCompare(b.name, 'de'));

// Kreise selbst sind auch suchbar („Wesermarsch“); sie stehen hinter den Gemeinden gleichen Namens
const orte = [
  ...gemeinden.map((g) => [g.name, g.ziel] as const),
  ...kreise.map((k) => [k.name, ziele.indexOf(k.slug)] as const),
];
writeFileSync(join(ROOT, 'public', 'orte.json'), JSON.stringify({ ziele, orte }));
const r3 = (x: number) => Number(x.toFixed(3));
writeFileSync(
  join(ROOT, 'public', 'orte-lage.json'),
  JSON.stringify({ ziele, orte: gemeinden.map((g) => [r3(g.lat), r3(g.lon), Number(g.radius.toFixed(1)), g.ziel]) }),
);
console.log(`${gemeinden.length} Gemeinden und ${kreise.length} Kreise geschrieben, ${ziele.length} Ziele.`);
