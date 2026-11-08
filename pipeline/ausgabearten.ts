// Auszahlungen nach Art je kreisfreier Stadt aus der Regionaldatenbank (Tabelle 71717-Z-05,
// Rechnungsergebnisse der kommunalen Kernhaushalte) → Schlüssel „ausgabearten“ in src/data/staedte/*.json.
// Braucht ein kostenloses Konto bei regionalstatistik.de; Zugangsdaten in .env.local (Vorlage: .env.example):
//   REGIO_USER=…   REGIO_PASS=…      (oder REGIO_USER=<API-Token> und REGIO_PASS leer)
// Aufruf:  npm run daten:ausgabearten
//
// Schritt 1: Rohdaten nach pipeline/quellen/71717-Z-05.csv laden (nur, wenn noch nicht vorhanden).
// Schritt 2: Je Stadt das neueste Jahr wählen, das für die meisten Städte vollständig ist, und € je Einwohner schreiben.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Stadt } from '../src/data/types.ts';
import { alsText, felder, QUELLEN, ROOT, schreibeJson, zahl, zuAgs } from './helfer.ts';
import { ladeTabelle } from './regio.ts';

const ROH = join(QUELLEN, '71717-Z-05.csv');
const STAEDTE = join(ROOT, 'src', 'data', 'staedte');
const QUELLE = {
  label: 'Regionaldatenbank Deutschland: Rechnungsergebnisse der kommunalen Kernhaushalte, Tabelle 71717-Z-05',
  url: 'https://www.regionalstatistik.de/genesis/online?operation=table&code=71717-Z-05',
};

if (!existsSync(ROH)) await ladeTabelle('71717-Z-05', ROH, '2022');

// ── Schritt 2: Einlesen ─────────────────────────────────────────────────────────────────────────

const faktor = (einheit: string) => (/mill|mio/i.test(einheit) ? 1e6 : /tsd|tausend|1000/i.test(einheit) ? 1e3 : 1);

const staedte = readdirSync(STAEDTE)
  .filter((f) => f.endsWith('.json'))
  .map((f) => {
    const datei = join(STAEDTE, f);
    return { datei, s: JSON.parse(readFileSync(datei, 'utf8')) as Stadt };
  });
const nachAgs = new Map(staedte.map((x) => [x.s.ags, x]));

let text = alsText(readFileSync(ROH));
if (text.trimStart().startsWith('{')) {
  throw new Error(`${ROH} enthält eine Fehlerantwort statt Daten – Datei löschen und neu abrufen.`);
}
// Der Export enthält alle Gemeinden (~200 MB). Einmalig auf die kreisfreien Städte filtern und so speichern.
{
  const roh = text.split(/\r?\n/).filter((z) => z.trim());
  const kopfFelder = felder(roh[0]);
  const regionSpalten = kopfFelder
    .map((k, i) => (/^\d+_variable_attribute_code$/.test(k) ? i : -1))
    .filter((i) => i >= 0);
  const behalten = [
    roh[0],
    ...roh.slice(1).filter((z) => {
      const f = z.split(';');
      return regionSpalten.some((i) => nachAgs.has(zuAgs(f[i])));
    }),
  ];
  if (behalten.length < roh.length) {
    text = `${behalten.join('\n')}\n`;
    writeFileSync(ROH, text);
    console.log(
      `Rohdatei auf die Städte gefiltert: ${(roh.length - 1).toLocaleString('de-DE')} → ${(behalten.length - 1).toLocaleString('de-DE')} Zeilen`,
    );
  }
}
const [kopf, ...zeilen] = text
  .split(/\r?\n/)
  .filter((z) => z.trim())
  .map(felder);
const sp: Record<string, number> = Object.fromEntries(kopf.map((k, i) => [k.trim(), i]));
for (const k of ['time', 'value', 'value_unit', 'value_variable_label']) {
  if (!(k in sp)) throw new Error(`Spalte „${k}“ fehlt – kein ffcsv im neuen Format? Kopf: ${kopf.join(';')}`);
}
const hatQ = 'value_q' in sp;
// Der Hintergrund-Export (resultfile) liefert keine Spalte value_q. Laut Tabellenhinweis der Regionaldatenbank
// sind die Werte des jüngsten Berichtsjahres (2025) vorläufig.
const VORLAEUFIG_AB = 2025;

// Regionale Dimension = die <n>_variable, deren Ausprägungscodes am häufigsten Stadt-AGS sind.
const dims = kopf.map((k) => k.match(/^(\d+)_variable_attribute_code$/)?.[1]).filter((x): x is string => !!x);
const treffer = (n: string) =>
  zeilen.filter((z) => nachAgs.has(zuAgs(z[sp[`${n}_variable_attribute_code`]]?.trim()))).length;
const region = dims.reduce((a, b) => (treffer(b) > treffer(a) ? b : a), dims[0]);
if (!region || !treffer(region)) throw new Error('Keine Spalte mit Regionalschlüsseln der Städte gefunden.');
const andere = dims.filter((n) => n !== region);

// daten: ags → jahr → Merkmal (Ausprägungen der übrigen Dimensionen + Wertmerkmal) → { wert, einheit, q }
interface Wert {
  wert: number | null;
  einheit: string;
  q: string;
}
const daten = new Map<string, Map<number, Map<string, Wert>>>();
const merkmale = new Map<string, Set<string>>(); // Merkmal → Einheiten (für Fehlermeldungen)
for (const z of zeilen) {
  const ags = zuAgs(z[sp[`${region}_variable_attribute_code`]]?.trim());
  if (!nachAgs.has(ags)) continue;
  const jahr = Number(z[sp.time]);
  const merkmal = [...andere.map((n) => z[sp[`${n}_variable_attribute_label`]]), z[sp.value_variable_label]]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(' | ');
  const einheit = z[sp.value_unit]?.trim() ?? '';
  if (!merkmale.has(merkmal)) merkmale.set(merkmal, new Set());
  merkmale.get(merkmal)!.add(einheit);
  if (!daten.has(ags)) daten.set(ags, new Map());
  const proJahr = daten.get(ags)!;
  if (!proJahr.has(jahr)) proJahr.set(jahr, new Map());
  proJahr.get(jahr)!.set(merkmal, { wert: zahl(z[sp.value]), einheit, q: hatQ ? z[sp.value_q].trim() : '' });
}

// ── Zuordnung der Merkmale ──────────────────────────────────────────────────────────────────────

const JE_EW = /je (einw|ew)/i;
const REGELN: Record<string, (m: string) => boolean> = {
  bev: (m) => /bevölkerung|einwohner/i.test(m),
  gesamt: (m) => /auszahl/i.test(m) && /insgesamt/i.test(m) && !/verwaltungst|investition/i.test(m),
  lfd: (m) => /(laufende[nr]?|lfd\.?)\s*verwaltungst/i.test(m) && !/personal|versorg|sach|sozial/i.test(m),
  personal: (m) => /personal|versorg/i.test(m),
  sach: (m) => /sach.*dienstleist/i.test(m),
  sozial: (m) => /soziale leistung|sozialleistung/i.test(m),
  invest: (m) => /investitionst/i.test(m) && !m.includes(' | '), // Summe, nicht der Unterposten „Sachinvestitionen“
};
const alle = [...merkmale.keys()].filter((m) => !JE_EW.test(m));
const zuordnung: Record<string, string[]> = {};
for (const [k, regel] of Object.entries(REGELN)) {
  let m = alle.filter(regel);
  // Personal und Versorgung: ein gemeinsames Merkmal oder zwei getrennte
  if (k === 'personal')
    m = m.some((x) => /personal/i.test(x) && /versorg/i.test(x))
      ? m.filter((x) => /personal/i.test(x) && /versorg/i.test(x))
      : m;
  if (m.length !== 1 && !(k === 'personal' && m.length === 2)) {
    const liste = [...merkmale].map(([x, e]) => `  ${x}  [${[...e].join(', ')}]`).join('\n');
    throw new Error(
      `Merkmal „${k}“ nicht eindeutig zuzuordnen (${m.length} Treffer: ${m.join(' / ') || '–'}).\nMerkmale in der Tabelle:\n${liste}`,
    );
  }
  zuordnung[k] = m;
}
console.log('Zuordnung:');
for (const [k, m] of Object.entries(zuordnung))
  console.log(`  ${k.padEnd(8)} ← ${m.map((x) => `${x} [${[...merkmale.get(x)!].join(', ')}]`).join(' + ')}`);

// ── Berechnung je Stadt und Jahr ────────────────────────────────────────────────────────────────

const fehler: string[] = [];
function rechne(name: string, jahr: number, werte: Map<string, Wert>) {
  let vorlaeufig = !hatQ && jahr >= VORLAEUFIG_AB;
  const summe = (ms: string[]): number | null => {
    let s = 0;
    for (const m of ms) {
      const w = werte.get(m);
      if (!w || w.wert === null) return null;
      if (w.q === 'p') vorlaeufig = true;
      s += w.wert * faktor(w.einheit);
    }
    return s;
  };
  const roh = Object.fromEntries(Object.entries(zuordnung).map(([k, ms]) => [k, summe(ms)]));
  if (Object.values(roh).some((x) => x === null) || !((roh.bev ?? 0) > 0)) return null;
  const v = roh as Record<string, number>;
  const pk = (x: number) => x / v.bev;
  const uebrige = pk(v.lfd - v.personal - v.sach - v.sozial);
  if (uebrige < -0.5) fehler.push(`${name} ${jahr}: Übrige laufende Auszahlungen negativ (${uebrige.toFixed(2)} €/EW)`);
  const posten: [string, number][] = [
    ['Personal und Versorgung', pk(v.personal)],
    ['Sach- und Dienstleistungen', pk(v.sach)],
    ['Soziale Leistungen', pk(v.sozial)],
    ['Investitionen', pk(v.invest)],
    ['Übrige laufende Auszahlungen', Math.max(0, uebrige)],
  ];
  const summePosten = posten.reduce((a, [, x]) => a + x, 0);
  const gesamt = pk(v.gesamt);
  if (Math.abs(summePosten - gesamt) > 0.01 * gesamt) {
    fehler.push(
      `${name} ${jahr}: Summe der Posten ${summePosten.toFixed(0)} €/EW ≠ Auszahlungen insgesamt ${gesamt.toFixed(0)} €/EW`,
    );
  }
  return {
    jahr,
    vorlaeufig,
    posten: posten.map(([n, x]) => ({ name: n, proKopf: Math.round(x) })),
    quellen: [QUELLE],
    gesamt,
  };
}

const kandidaten = staedte.filter((x) => !x.s.stadtstaat && daten.has(x.s.ags));
type Ergebnis = NonNullable<ReturnType<typeof rechne>>;
const ergebnisse = new Map<string, Map<number, Ergebnis>>(); // ags → Map(jahr → Ergebnis)
for (const { s } of kandidaten) {
  const m = new Map<number, Ergebnis>();
  for (const [jahr, werte] of daten.get(s.ags)!) {
    const e = rechne(s.name, jahr, werte);
    if (e) m.set(jahr, e);
  }
  ergebnisse.set(s.ags, m);
}
if (fehler.length) {
  throw new Error(`Plausibilitätsprüfung fehlgeschlagen (${fehler.length}):\n  ${fehler.join('\n  ')}`);
}

// Neuestes Jahr, das für mindestens 90 % der Städte im Abruf vollständig ist
const jahre = [...new Set([...ergebnisse.values()].flatMap((m) => [...m.keys()]))].sort((a, b) => b - a);
const vollstaendig = (j: number) => [...ergebnisse.values()].filter((m) => m.has(j)).length;
const jahr = jahre.find((j) => vollstaendig(j) >= 0.9 * kandidaten.length);
if (!jahr)
  throw new Error(
    `Kein Jahr für die meisten Städte vollständig: ${jahre.map((j) => `${j}: ${vollstaendig(j)}`).join(', ')}`,
  );

// ── Schreiben ───────────────────────────────────────────────────────────────────────────────────

const geschrieben: { s: Stadt; gesamt: number }[] = [],
  rueckfall: string[] = [],
  ohne: string[] = [];
for (const { datei, s } of staedte) {
  if (s.stadtstaat) continue;
  const m = ergebnisse.get(s.ags);
  const j: number | undefined = m && [...m.keys()].filter((x) => x <= jahr).sort((a, b) => b - a)[0];
  if (!j) {
    ohne.push(s.name);
    continue;
  }
  const { gesamt, ...e } = m!.get(j)!;
  s.ausgabearten = e; // bestehender Schlüssel behält seine Position, neuer kommt ans Ende
  schreibeJson(datei, s);
  geschrieben.push({ s, gesamt });
  if (j !== jahr) rueckfall.push(`${s.name} (${j})`);
}

const n = staedte.filter((x) => !x.s.stadtstaat).length;
console.log(`\nJahre im Abruf: ${jahre.map((j) => `${j} (${vollstaendig(j)} Städte vollständig)`).join(', ')}`);
console.log(
  `Gewähltes Jahr: ${jahr}${geschrieben.some((g) => g.s.ausgabearten?.jahr === jahr && g.s.ausgabearten?.vorlaeufig) ? ' – vorläufig' : ''}`,
);
console.log(
  `Geschrieben: ${geschrieben.length} von ${n} Städten (ohne Stadtstaaten); davon vorläufig: ${geschrieben.filter((g) => g.s.ausgabearten?.vorlaeufig).length}`,
);
if (rueckfall.length) console.log(`Älteres Jahr: ${rueckfall.join(', ')}`);
if (ohne.length) console.log(`Ohne Daten: ${ohne.join(', ')}`);
console.log('Beispiele (€ je Einwohner):');
for (const { s, gesamt } of [0, 0.5, 0.99]
  .map((f) => geschrieben[Math.floor(f * (geschrieben.length - 1))])
  .filter(Boolean)) {
  const a = s.ausgabearten!;
  console.log(
    `  ${s.name} ${a.jahr}${a.vorlaeufig ? ' (vorl.)' : ''}: ${a.posten.map((p) => `${p.name} ${p.proKopf}`).join(', ')} | insgesamt ${Math.round(gesamt)}`,
  );
}
