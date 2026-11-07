// Auszahlungen nach Art je kreisfreier Stadt aus der Regionaldatenbank (Tabelle 71717-Z-05,
// Rechnungsergebnisse der kommunalen Kernhaushalte) → Schlüssel „ausgabearten“ in src/data/staedte/*.json.
// Braucht ein kostenloses Konto bei regionalstatistik.de; Zugangsdaten in web/.env.local:
//   REGIO_USER=…   REGIO_PASS=…      (oder REGIO_USER=<API-Token> und REGIO_PASS leer)
// Aufruf:  npm run daten:ausgabearten
//
// Schritt 1: Rohdaten nach pipeline/quellen/71717-Z-05.csv laden (nur, wenn noch nicht vorhanden).
// Schritt 2: Je Stadt das neueste Jahr wählen, das für die meisten Städte vollständig ist, und € je Einwohner schreiben.
//
// API laut GENESIS-Webservices-Doku (Destatis) und POST-Beispielen von 05/2025: nur POST, Zugangsdaten im
// HTTP-Header, Parameter als application/x-www-form-urlencoded. ffcsv kommt als ZIP mit genau einer CSV im
// neuen Flatfile-Format (eine Zeile je Wert: time, <n>_variable_attribute_code, value, value_unit,
// value_variable_label, value_q). quality=on liefert value_q; „p“ = vorläufige Zahl.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { QUELLEN, ROOT } from './xlsx.ts';
const ROH = join(QUELLEN, '71717-Z-05.csv');
const STAEDTE = join(ROOT, 'src', 'data', 'staedte');
// Die Tabelle hat Gemeinde-Tiefe und ist für den direkten Abruf zu groß (Code 98), auch mit Regionalfilter.
// Deshalb als Hintergrund-Auftrag (job=true): Auftrag anlegen, auf das Ergebnis warten, per resultfile abholen.
const AB_JAHR = '2022';
const REST = 'https://www.regionalstatistik.de/genesisws/rest/2020';
const WARTEN_MS = 15_000, MAX_MS = 20 * 60_000;
const QUELLE = {
  label: 'Regionaldatenbank Deutschland: Rechnungsergebnisse der kommunalen Kernhaushalte, Tabelle 71717-Z-05',
  url: 'https://www.regionalstatistik.de/genesis/online?operation=table&code=71717-Z-05',
};

// ── Schritt 1: Abruf ────────────────────────────────────────────────────────────────────────────

/** Erste Datei aus einem ZIP-Archiv (GENESIS liefert genau eine je Archiv). */
function entpacke(buf: Buffer): Buffer {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('ZIP ohne Inhaltsverzeichnis');
  const cd = buf.readUInt32LE(eocd + 16);
  const methode = buf.readUInt16LE(cd + 10);
  const groesse = buf.readUInt32LE(cd + 20);
  const lokal = buf.readUInt32LE(cd + 42);
  const start = lokal + 30 + buf.readUInt16LE(lokal + 26) + buf.readUInt16LE(lokal + 28);
  const daten = buf.subarray(start, start + groesse);
  if (methode === 0) return daten;
  if (methode === 8) return inflateRawSync(daten);
  throw new Error(`ZIP-Kompression ${methode} nicht unterstützt`);
}

const alsText = (buf: Buffer) =>
  (buf.length >= 4 && buf.readUInt32LE(0) === 0x04034b50 ? entpacke(buf) : buf).toString('utf8').replace(/^﻿/, '');

async function post(pfad: string, params: Record<string, string>, user: string, pass: string) {
  const res = await fetch(`${REST}/${pfad}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', username: user, password: pass },
    body: new URLSearchParams({ language: 'de', ...params }),
  });
  return { res, buf: Buffer.from(await res.arrayBuffer()) };
}
interface Status { Code?: string | number; Content?: string }
const statusVon = (text: string): Status => { try { return JSON.parse(text).Status ?? {}; } catch { return {}; } };

async function lade() {
  const { REGIO_USER: user, REGIO_PASS: pass = '' } = process.env;
  if (!user || !pass) {
    console.error('REGIO_USER und REGIO_PASS fehlen (Aufträge mit job=true gehen nicht mit Token). Siehe Kopf dieser Datei.');
    process.exit(1);
  }
  // 1. Auftrag anlegen
  const { buf } = await post('data/tablefile', {
    name: '71717-Z-05', area: 'all', startyear: AB_JAHR, format: 'ffcsv', quality: 'on', job: 'true',
  }, user, pass);
  const st = statusVon(alsText(buf));
  const ergebnis = /(71717-Z-05_\d+)/.exec(st.Content ?? '')?.[1];
  if (!ergebnis) { console.error(`Auftrag nicht angelegt: Code ${st.Code}: ${st.Content}`); process.exit(1); }
  console.log(`Auftrag angelegt, Ergebnis heißt ${ergebnis}. Warte …`);

  // 2. Warten, bis resultfile Daten statt einer Fehlermeldung liefert
  const start = Date.now();
  for (;;) {
    await new Promise((r) => setTimeout(r, WARTEN_MS));
    const { buf: rb } = await post('data/resultfile', { name: ergebnis, area: 'Meine', format: 'ffcsv', compress: 'false' }, user, pass);
    const text = alsText(rb);
    if (!text.trimStart().startsWith('{')) {
      mkdirSync(QUELLEN, { recursive: true });
      writeFileSync(ROH, text);
      console.log(`Gespeichert: ${ROH} (${text.length.toLocaleString('de-DE')} Zeichen) nach ${Math.round((Date.now() - start) / 1000)} s`);
      return;
    }
    const { buf: jb } = await post('catalogue/jobs', { selection: ergebnis, pagelength: '5' }, user, pass);
    let zustand = '?';
    try { zustand = JSON.parse(alsText(jb)).List?.[0]?.State ?? '?'; } catch {}
    if (/fehler|abgebrochen/i.test(zustand)) { console.error(`Auftrag ${ergebnis}: ${zustand}`); process.exit(1); }
    if (Date.now() - start > MAX_MS) {
      console.error(`Nach 20 Minuten noch kein Ergebnis (Auftrag: ${zustand}). Später erneut starten; das Ergebnis ${ergebnis} bleibt im Konto unter „Meine“.`);
      process.exit(1);
    }
    console.log(`… Auftrag ${zustand} (${Math.round((Date.now() - start) / 1000)} s)`);
  }
}

if (!existsSync(ROH)) await lade();

// ── Schritt 2: Einlesen ─────────────────────────────────────────────────────────────────────────

function felder(zeile: string): string[] {
  if (!zeile.includes('"')) return zeile.split(';');
  const out: string[] = [];
  let f = '', q = false;
  for (let i = 0; i < zeile.length; i++) {
    const c = zeile[i];
    if (q && c === '"' && zeile[i + 1] === '"') { f += '"'; i++; }
    else if (c === '"') q = !q;
    else if (c === ';' && !q) { out.push(f); f = ''; }
    else f += c;
  }
  out.push(f);
  return out;
}

/** Deutsche Zahl; „-“ = nichts vorhanden (0); „.“, „...“, „/“, „x“ = kein Wert. */
function zahl(s: string): number | null {
  s = s.trim();
  if (s === '-') return 0;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replaceAll('.', '');
  return /^-?\d+(,\d+)?$/.test(s) ? Number(s.replace(',', '.')) : null;
}

const faktor = (einheit: string) => (/mill|mio/i.test(einheit) ? 1e6 : /tsd|tausend|1000/i.test(einheit) ? 1e3 : 1);

interface Ausgabearten { jahr: number; vorlaeufig: boolean; posten: { name: string; proKopf: number }[]; quellen: typeof QUELLE[] }
interface StadtJson { ags: string; name: string; stadtstaat: boolean; ausgabearten?: Ausgabearten; [k: string]: unknown }
const staedte = readdirSync(STAEDTE).filter((f) => f.endsWith('.json')).map((f) => {
  const datei = join(STAEDTE, f);
  return { datei, s: JSON.parse(readFileSync(datei, 'utf8')) as StadtJson };
});
const nachAgs = new Map(staedte.map((x) => [x.s.ags, x]));

// Regionalschlüssel der Tabelle (Gemeinde-Tiefe): „F“ + 5-stelliger Kreisschlüssel + 9 Nullen = kreisfreie Stadt
const zuAgs = (code: string | undefined) => /^F(\d{5})0{9}$/.exec(code ?? '')?.[1] ?? code ?? '';

let text = alsText(readFileSync(ROH));
if (text.trimStart().startsWith('{')) {
  console.error(`${ROH} enthält eine Fehlerantwort statt Daten – Datei löschen und neu abrufen.`);
  process.exit(1);
}
// Der Export enthält alle Gemeinden (~200 MB). Einmalig auf die kreisfreien Städte filtern und so speichern.
{
  const roh = text.split(/\r?\n/).filter((z) => z.trim());
  const kopfFelder = felder(roh[0]);
  const regionSpalten = kopfFelder.map((k, i) => (/^\d+_variable_attribute_code$/.test(k) ? i : -1)).filter((i) => i >= 0);
  const behalten = [roh[0], ...roh.slice(1).filter((z) => { const f = z.split(';'); return regionSpalten.some((i) => nachAgs.has(zuAgs(f[i]))); })];
  if (behalten.length < roh.length) {
    text = behalten.join('\n') + '\n';
    writeFileSync(ROH, text);
    console.log(`Rohdatei auf die Städte gefiltert: ${(roh.length - 1).toLocaleString('de-DE')} → ${(behalten.length - 1).toLocaleString('de-DE')} Zeilen`);
  }
}
const [kopf, ...zeilen] = text.split(/\r?\n/).filter((z) => z.trim()).map(felder);
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
const treffer = (n: string) => zeilen.filter((z) => nachAgs.has(zuAgs(z[sp[`${n}_variable_attribute_code`]]?.trim()))).length;
const region = dims.reduce((a, b) => (treffer(b) > treffer(a) ? b : a), dims[0]);
if (!region || !treffer(region)) throw new Error('Keine Spalte mit Regionalschlüsseln der Städte gefunden.');
const andere = dims.filter((n) => n !== region);

// daten: ags → jahr → Merkmal (Ausprägungen der übrigen Dimensionen + Wertmerkmal) → { wert, einheit, q }
interface Wert { wert: number | null; einheit: string; q: string }
const daten = new Map<string, Map<number, Map<string, Wert>>>();
const merkmale = new Map<string, Set<string>>(); // Merkmal → Einheiten (für Fehlermeldungen)
for (const z of zeilen) {
  const ags = zuAgs(z[sp[`${region}_variable_attribute_code`]]?.trim());
  if (!nachAgs.has(ags)) continue;
  const jahr = Number(z[sp.time]);
  const merkmal = [...andere.map((n) => z[sp[`${n}_variable_attribute_label`]]), z[sp.value_variable_label]]
    .map((s) => s?.trim()).filter(Boolean).join(' | ');
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
  if (k === 'personal') m = m.some((x) => /personal/i.test(x) && /versorg/i.test(x)) ? m.filter((x) => /personal/i.test(x) && /versorg/i.test(x)) : m;
  if (m.length !== 1 && !(k === 'personal' && m.length === 2)) {
    console.error(`Merkmal „${k}“ nicht eindeutig zuzuordnen (${m.length} Treffer: ${m.join(' / ') || '–'}).`);
    console.error('Merkmale in der Tabelle:');
    for (const [x, e] of merkmale) console.error(`  ${x}  [${[...e].join(', ')}]`);
    process.exit(1);
  }
  zuordnung[k] = m;
}
console.log('Zuordnung:');
for (const [k, m] of Object.entries(zuordnung)) console.log(`  ${k.padEnd(8)} ← ${m.map((x) => `${x} [${[...merkmale.get(x)!].join(', ')}]`).join(' + ')}`);

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
    fehler.push(`${name} ${jahr}: Summe der Posten ${summePosten.toFixed(0)} €/EW ≠ Auszahlungen insgesamt ${gesamt.toFixed(0)} €/EW`);
  }
  return {
    jahr, vorlaeufig,
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
  console.error(`Plausibilitätsprüfung fehlgeschlagen (${fehler.length}):`);
  fehler.forEach((f) => console.error('  ' + f));
  process.exit(1);
}

// Neuestes Jahr, das für mindestens 90 % der Städte im Abruf vollständig ist
const jahre = [...new Set([...ergebnisse.values()].flatMap((m) => [...m.keys()]))].sort((a, b) => b - a);
const vollstaendig = (j: number) => [...ergebnisse.values()].filter((m) => m.has(j)).length;
const jahr = jahre.find((j) => vollstaendig(j) >= 0.9 * kandidaten.length);
if (!jahr) throw new Error(`Kein Jahr für die meisten Städte vollständig: ${jahre.map((j) => `${j}: ${vollstaendig(j)}`).join(', ')}`);

// ── Schreiben ───────────────────────────────────────────────────────────────────────────────────

const geschrieben: { s: StadtJson; gesamt: number }[] = [], rueckfall: string[] = [], ohne: string[] = [];
for (const { datei, s } of staedte) {
  if (s.stadtstaat) continue;
  const m = ergebnisse.get(s.ags);
  const j: number | undefined = m && [...m.keys()].filter((x) => x <= jahr).sort((a, b) => b - a)[0];
  if (!j) { ohne.push(s.name); continue; }
  const { gesamt, ...e } = m!.get(j)!;
  s.ausgabearten = e; // bestehender Schlüssel behält seine Position, neuer kommt ans Ende
  writeFileSync(datei, JSON.stringify(s, null, 2) + '\n');
  geschrieben.push({ s, gesamt });
  if (j !== jahr) rueckfall.push(`${s.name} (${j})`);
}

const n = staedte.filter((x) => !x.s.stadtstaat).length;
console.log(`\nJahre im Abruf: ${jahre.map((j) => `${j} (${vollstaendig(j)} Städte vollständig)`).join(', ')}`);
console.log(`Gewähltes Jahr: ${jahr}${geschrieben.some((g) => g.s.ausgabearten?.jahr === jahr && g.s.ausgabearten?.vorlaeufig) ? ' – vorläufig' : ''}`);
console.log(`Geschrieben: ${geschrieben.length} von ${n} Städten (ohne Stadtstaaten); davon vorläufig: ${geschrieben.filter((g) => g.s.ausgabearten?.vorlaeufig).length}`);
if (rueckfall.length) console.log(`Älteres Jahr: ${rueckfall.join(', ')}`);
if (ohne.length) console.log(`Ohne Daten: ${ohne.join(', ')}`);
console.log('Beispiele (€ je Einwohner):');
for (const { s, gesamt } of [0, 0.5, 0.99].map((f) => geschrieben[Math.floor(f * (geschrieben.length - 1))]).filter(Boolean)) {
  const a = s.ausgabearten!;
  console.log(`  ${s.name} ${a.jahr}${a.vorlaeufig ? ' (vorl.)' : ''}: ${a.posten.map((p) => `${p.name} ${p.proKopf}`).join(', ')} | insgesamt ${Math.round(gesamt)}`);
}
