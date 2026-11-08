// Abruf großer Tabellen aus der Regionaldatenbank als Hintergrund-Auftrag.
// API laut GENESIS-Webservices-Doku (Destatis): nur POST, Zugangsdaten im HTTP-Header, Parameter als
// application/x-www-form-urlencoded. Große Tabellen gehen nur mit job=true (Auftrag anlegen, per resultfile abholen).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { alsText } from './helfer.ts';

const REST = 'https://www.regionalstatistik.de/genesisws/rest/2020';
const WARTEN_MS = 15_000,
  MAX_MS = 20 * 60_000;

async function post(pfad: string, params: Record<string, string>, user: string, pass: string) {
  const res = await fetch(`${REST}/${pfad}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', username: user, password: pass },
    body: new URLSearchParams({ language: 'de', ...params }),
  });
  // Fehlerseiten (5xx, Proxy) nie als Rohdaten behandeln
  if (!res.ok) throw new Error(`HTTP ${res.status} bei ${pfad}`);
  return Buffer.from(await res.arrayBuffer());
}

interface Status {
  Code?: string | number;
  Content?: string;
}
const statusVon = (text: string): Status => {
  try {
    return JSON.parse(text).Status ?? {};
  } catch {
    return {};
  }
};

/** Lädt eine Tabelle als ffcsv nach `ziel`. Braucht REGIO_USER und REGIO_PASS (Aufträge gehen nicht mit Token). */
export async function ladeTabelle(tabelle: string, ziel: string, abJahr: string) {
  const { REGIO_USER: user, REGIO_PASS: pass = '' } = process.env;
  if (!user || !pass) {
    throw new Error(
      'REGIO_USER und REGIO_PASS fehlen (Aufträge mit job=true gehen nicht mit Token). Siehe .env.example.',
    );
  }
  // 1. Auftrag anlegen
  const buf = await post(
    'data/tablefile',
    { name: tabelle, area: 'all', startyear: abJahr, format: 'ffcsv', quality: 'on', job: 'true' },
    user,
    pass,
  );
  const st = statusVon(alsText(buf));
  const ergebnis = new RegExp(`(${tabelle}_\\d+)`).exec(st.Content ?? '')?.[1];
  if (!ergebnis) throw new Error(`Auftrag nicht angelegt: Code ${st.Code}: ${st.Content}`);
  console.log(`Auftrag angelegt, Ergebnis heißt ${ergebnis}. Warte …`);

  // 2. Warten, bis resultfile Daten statt einer Fehlermeldung liefert
  const start = Date.now();
  for (;;) {
    await new Promise((r) => setTimeout(r, WARTEN_MS));
    const rb = await post(
      'data/resultfile',
      { name: ergebnis, area: 'Meine', format: 'ffcsv', compress: 'false' },
      user,
      pass,
    );
    const text = alsText(rb);
    // Echte Daten erkennen: CSV im Flatfile-Format beginnt mit der Spalte statistics_code
    if (text.startsWith('statistics_code;')) {
      mkdirSync(dirname(ziel), { recursive: true });
      writeFileSync(ziel, text);
      console.log(
        `Gespeichert: ${ziel} (${text.length.toLocaleString('de-DE')} Zeichen) nach ${Math.round((Date.now() - start) / 1000)} s`,
      );
      return;
    }
    const jb = await post('catalogue/jobs', { selection: ergebnis, pagelength: '5' }, user, pass);
    let zustand = '?';
    try {
      zustand = JSON.parse(alsText(jb)).List?.[0]?.State ?? '?';
    } catch {}
    if (/fehler|abgebrochen/i.test(zustand)) throw new Error(`Auftrag ${ergebnis}: ${zustand}`);
    if (Date.now() - start > MAX_MS) {
      throw new Error(
        `Nach 20 Minuten noch kein Ergebnis (Auftrag: ${zustand}). Später erneut starten; das Ergebnis ${ergebnis} bleibt im Konto unter „Meine“.`,
      );
    }
    console.log(`… Auftrag ${zustand} (${Math.round((Date.now() - start) / 1000)} s)`);
  }
}
