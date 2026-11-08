// Gemeinsame Helfer der Daten-Pipeline: Pfade, Quelldateien, JSON schreiben und reine Parser ohne Dateizugriff.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const QUELLEN = join(ROOT, 'pipeline', 'quellen');

/** Länderschlüssel der Stadtstaaten (Hamburg, Bremen, Berlin): die Finanzstatistik weist Städte nur gemeinsam mit dem Land aus */
export const STADTSTAATEN: ReadonlySet<string> = new Set(['02', '04', '11']);

/** Gemeindeverzeichnis von Destatis: Kreise (Stand 31.12.2024) und Gemeinden (Stand 31.12.2025) */
export const GV_KREISE_URL =
  'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/04-kreise.xlsx?__blob=publicationFile';
export const GV_GEMEINDEN_URL =
  'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GVAuszugJ/31122025_Auszug_GV.xlsx?__blob=publicationFile';

/** Lädt eine Quelldatei nach pipeline/quellen/, falls sie noch nicht da ist. */
export async function quelle(datei: string, url: string): Promise<string> {
  const pfad = join(QUELLEN, datei);
  if (!existsSync(pfad)) {
    mkdirSync(QUELLEN, { recursive: true });
    console.log('Lade', url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download fehlgeschlagen (HTTP ${res.status}): ${url}`);
    writeFileSync(pfad, Buffer.from(await res.arrayBuffer()));
  }
  return pfad;
}

export const schreibeJson = (pfad: string, daten: unknown) =>
  writeFileSync(pfad, `${JSON.stringify(daten, null, 2)}\n`);

/** Bricht den Lauf mit einer lesbaren Meldung ab, wenn eine Prüfung gegen die Quelle fehlschlägt. */
export function pruefe(bedingung: unknown, ...info: unknown[]): asserts bedingung {
  if (!bedingung) throw new Error(`Prüfung fehlgeschlagen: ${JSON.stringify(info)}`);
}

/** „Frankfurt am Main“ → „frankfurt-am-main“, Umlaute ausgeschrieben, Akzente entfernt */
export const slugify = (s: string) =>
  s
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[\u0080-￿]/g, '') // Akzente und übrige Nicht-ASCII-Zeichen entfernen
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Eine CSV-Zeile mit Semikolon, Felder optional in Anführungszeichen ("" = ein Anführungszeichen) */
export function felder(zeile: string): string[] {
  if (!zeile.includes('"')) return zeile.split(';');
  const out: string[] = [];
  let f = '',
    q = false;
  for (let i = 0; i < zeile.length; i++) {
    const c = zeile[i];
    if (q && c === '"' && zeile[i + 1] === '"') {
      f += '"';
      i++;
    } else if (c === '"') q = !q;
    else if (c === ';' && !q) {
      out.push(f);
      f = '';
    } else f += c;
  }
  out.push(f);
  return out;
}

/** Deutsche Zahl; „-“ = nichts vorhanden (0); „.“, „...“, „/“, „x“ = kein Wert (null). */
export function zahl(s: string): number | null {
  s = s.trim();
  if (s === '-') return 0;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replaceAll('.', '');
  return /^-?\d+(,\d+)?$/.test(s) ? Number(s.replace(',', '.')) : null;
}

/** Regionalschlüssel mit Gemeinde-Tiefe: „F“ + 5-stelliger Kreisschlüssel + 9 Nullen = kreisfreie Stadt */
export const zuAgs = (code: string | undefined) => /^F(\d{5})0{9}$/.exec(code ?? '')?.[1] ?? code ?? '';

/** Erste Datei aus einem ZIP-Archiv (GENESIS liefert genau eine je Archiv). */
export function entpacke(buf: Buffer): Buffer {
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
  // Größe begrenzen: Schutz vor einem fehlerhaften oder manipulierten Archiv (ZIP-Bombe)
  if (methode === 8) return inflateRawSync(daten, { maxOutputLength: 500_000_000 });
  throw new Error(`ZIP-Kompression ${methode} nicht unterstützt`);
}

/** Antwort als Text; ZIP wird entpackt, ein BOM entfernt */
export const alsText = (buf: Buffer) =>
  (buf.length >= 4 && buf.readUInt32LE(0) === 0x04034b50 ? entpacke(buf) : buf).toString('utf8').replace(/^﻿/, '');
