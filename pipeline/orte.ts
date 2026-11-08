/**
 * Ortssuche: alle Gemeinden → public/orte.json (Name und Ziel, also ihre kreisfreie Stadt oder ihr Landkreis).
 *
 * Quelle: Destatis Gemeindeverzeichnis (GV-ISys), Gemeinden Stand 31.12.2025. Sortiert nach Einwohnern, damit bei
 * gleichen Namen die größte Gemeinde zuerst kommt. Der Browser lädt die Datei erst, wenn jemand ins Suchfeld klickt.
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

const gemeinden: { name: string; ew: number; ziel: number }[] = [];
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
  gemeinden.push({ name: String(r[7]).split(',')[0].trim(), ew: Number(r[9]), ziel });
}
if (gemeinden.length < 10_000) throw new Error(`Nur ${gemeinden.length} Gemeinden gefunden`);
gemeinden.sort((a, b) => b.ew - a.ew || a.name.localeCompare(b.name, 'de'));

// Kreise selbst sind auch suchbar („Wesermarsch“); sie stehen hinter den Gemeinden gleichen Namens
const orte = [
  ...gemeinden.map((g) => [g.name, g.ziel] as const),
  ...kreise.map((k) => [k.name, ziele.indexOf(k.slug)] as const),
];
writeFileSync(join(ROOT, 'public', 'orte.json'), JSON.stringify({ ziele, orte }));
console.log(`${gemeinden.length} Gemeinden und ${kreise.length} Kreise geschrieben, ${ziele.length} Ziele.`);
