/**
 * Stammliste aller kreisfreien Städte → src/data/staedte/<slug>.json
 *
 * Quellen: Destatis Gemeindeverzeichnis (GV-ISys)
 *   – Kreisfreie Städte und Landkreise, Stand 31.12.2024 (Name, Einwohner)
 *   – Alle politisch selbständigen Gemeinden, Stand 31.12.2025 (geografische Mittelpunktkoordinaten)
 * Ausgabearten je Stadt ergänzt pipeline/ausgabearten.ts; sie bleiben beim Neuschreiben erhalten.
 *
 * Aufruf:  npm run daten:staedte
 */
import { mkdirSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { GV_GEMEINDEN_URL, GV_KREISE_URL, quelle, ROOT, STADTSTAATEN, schreibeJson, slugify } from './helfer.ts';
import { blatt } from './xlsx.ts';

const ZIEL = join(ROOT, 'src', 'data', 'staedte');
const TYPEN = new Set(['Kreisfreie Stadt', 'Stadtkreis']);

/** „Kiel, Landeshauptstadt“ → „Kiel“; „Oldenburg (Oldenburg), Stadt“ → „Oldenburg (Oldenburg)“ */
const anzeigename = (amtlich: string) => amtlich.split(',')[0].trim();

// Koordinaten: Gemeinde-Zeilen (Satzart 60) mit Land, RB, Kreis, VB, Gem; kreisfreie Stadt = Kreisschlüssel + Gem „000“
const koordinaten = new Map<string, { lat: number; lon: number }>();
for (const r of await blatt(
  await quelle('gv-gemeinden-2025.xlsx', GV_GEMEINDEN_URL),
  'Onlineprodukt_Gemeinden31122025',
)) {
  if (String(r[0]) !== '60') continue;
  const kreis = `${r[2]}${r[3]}${r[4]}`;
  const lon = Number(String(r[14] ?? '').replace(',', '.')),
    lat = Number(String(r[15] ?? '').replace(',', '.'));
  if (!(lat && lon)) continue;
  // Erste Gemeinde des Kreises mit Gem „000“ bevorzugen (die kreisfreie Stadt selbst)
  if (String(r[6]) === '000' || !koordinaten.has(kreis)) koordinaten.set(kreis, { lat, lon });
}

interface Roh {
  ags: string;
  name: string;
  amtlich: string;
  einwohner: number;
  land: string;
  slug?: string;
}
const staedte: Roh[] = [];
for (const r of (
  await blatt(await quelle('gv-kreise-2024.xlsx', GV_KREISE_URL), 'Kreisfreie Städte u. Landkreise')
).slice(3)) {
  const [ags, typ, name, , , ew] = r;
  if (typeof ags !== 'string' || ags.length !== 5 || !TYPEN.has(String(typ))) continue;
  staedte.push({
    ags,
    name: anzeigename(String(name)),
    amtlich: String(name),
    einwohner: Number(ew),
    land: ags.slice(0, 2),
  });
}

// Kurzer Slug ohne Klammerzusatz, solange keine andere Stadt mit demselben Wort beginnt
// (sonst z. B. „frankfurt“ für Frankfurt (Oder) neben „frankfurt-am-main“)
const erstes = staedte.map((s) => slugify(s.name).split('-')[0]);
staedte.forEach((s, i) => {
  const kurz = slugify(s.name.replace(/\s*\(.*?\)/g, ''));
  s.slug = erstes.filter((e) => e === erstes[i]).length === 1 ? kurz : slugify(s.name);
});
if (new Set(staedte.map((s) => s.slug)).size !== staedte.length) throw new Error('Slugs nicht eindeutig');

mkdirSync(ZIEL, { recursive: true });
// Bereits abgerufene Ausgabearten nach AGS merken, damit sie erhalten bleiben
const alt = new Map<string, unknown>();
for (const f of readdirSync(ZIEL).filter((f) => f.endsWith('.json'))) {
  const d = JSON.parse(readFileSync(join(ZIEL, f), 'utf8'));
  if (d.ausgabearten) alt.set(d.ags, d.ausgabearten);
  unlinkSync(join(ZIEL, f));
}
const ohneKoordinaten: string[] = [];
for (const s of staedte) {
  const k = koordinaten.get(s.ags);
  if (!k) ohneKoordinaten.push(s.name);
  schreibeJson(join(ZIEL, `${s.slug}.json`), {
    slug: s.slug,
    ags: s.ags,
    land: s.land,
    name: s.name,
    amtlich: s.amtlich,
    einwohner: s.einwohner,
    stadtstaat: STADTSTAATEN.has(s.land),
    ...(k ? { lat: Number(k.lat.toFixed(4)), lon: Number(k.lon.toFixed(4)) } : {}),
    ...(alt.has(s.ags) ? { ausgabearten: alt.get(s.ags) } : {}),
  });
}
if (ohneKoordinaten.length) throw new Error(`Keine Koordinaten für: ${ohneKoordinaten.join(', ')}`);
console.log(
  `${staedte.length} kreisfreie Städte geschrieben; ${staedte.filter((s) => STADTSTAATEN.has(s.land)).length} davon in Stadtstaaten; alle mit Koordinaten.`,
);
console.log(
  'Beispiele:',
  staedte
    .filter((_, i) => i % 15 === 0)
    .map((s) => `${s.slug} ${JSON.stringify(koordinaten.get(s.ags))}`)
    .join(' · '),
);
