// Auszahlungen nach Art je kreisfreier Stadt aus der Regionaldatenbank (Tabelle 71717-Z-05).
// Braucht ein kostenloses Konto bei regionalstatistik.de; Zugangsdaten in web/.env.local:
//   REGIO_USER=…   REGIO_PASS=…
// Aufruf (aus web/):  npm run daten:ausgabearten
//
// Schritt 1: Rohdaten nach pipeline/quellen/71717-Z-05.csv laden (nur, wenn noch nicht vorhanden).
// Schritt 2: Spalten anzeigen – die Zuordnung zu den Stadt-JSONs folgt, sobald das Format bekannt ist.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QUELLEN = join(ROOT, 'pipeline', 'quellen');
const ROH = join(QUELLEN, '71717-Z-05.csv');
const API = 'https://www.regionalstatistik.de/genesisws/rest/2020/data/tablefile';

async function lade() {
  const { REGIO_USER: user, REGIO_PASS: pass } = process.env;
  if (!user || !pass) {
    console.error('REGIO_USER und REGIO_PASS fehlen. Lege web/.env.local an (siehe Kopf dieser Datei).');
    process.exit(1);
  }
  const body = new URLSearchParams({
    name: '71717-Z-05', area: 'all', compress: 'false', transpose: 'false',
    startyear: '2023', endyear: '2025', format: 'ffcsv', language: 'de',
  });
  const res = await fetch(API, {
    method: 'POST',
    headers: { username: user, password: pass, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();
  // Fehlerantworten der GENESIS-API kommen als JSON mit Code/Content
  if (!res.ok || text.trimStart().startsWith('{')) {
    let info = text.slice(0, 400);
    try { const j = JSON.parse(text); info = `Code ${j.Status?.Code ?? j.Code}: ${j.Status?.Content ?? j.Content}`; } catch {}
    console.error(`Abruf fehlgeschlagen (HTTP ${res.status}). ${info}`);
    process.exit(1);
  }
  mkdirSync(QUELLEN, { recursive: true });
  writeFileSync(ROH, text);
  console.log(`Gespeichert: ${ROH} (${text.length.toLocaleString('de-DE')} Zeichen)`);
}

if (!existsSync(ROH)) await lade();
const zeilen = readFileSync(ROH, 'utf8').split(/\r?\n/).filter(Boolean);
console.log('Spalten:', zeilen[0]);
console.log('Beispielzeilen:');
zeilen.slice(1, 6).forEach((z) => console.log(' ', z));
console.log(`${zeilen.length - 1} Datenzeilen.`);
