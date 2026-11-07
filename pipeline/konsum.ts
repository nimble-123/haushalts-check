// Konsumsteuern: Wie viel vom Netto Alleinlebende ausgeben, wofür, und welcher Steueranteil darin steckt.
// Schreibt src/data/konsum.json. Ausführen: npm run daten:konsum
//
// Quellen:
//  - EVS 2018, Fachserie 15 Heft 4, Tab. 6.1 Alleinlebende (nur als PDF): Konsum nach Einkommensklasse
//  - Laufende Wirtschaftsrechnungen 2024, Tab. 63111-01 Einpersonenhaushalte: Warenkorb im Detail
//  - Steuersätze 2026 (UStG, EnergieStG, StromStG, VersStG), Steuerschätzung Oktober 2026 für die Verteilung
import { join } from 'node:path';
import type { KonsumDaten, KonsumKategorie } from '../src/data/types.ts';
import { quelle, ROOT, schreibeJson } from './helfer.ts';
import { blatt, type Zelle } from './xlsx.ts';

const VOLL = 19 / 119; // Anteil der Mehrwertsteuer am Bruttopreis, Regelsatz
const ERM = 7 / 107; // ermäßigter Satz

// ---------- EVS 2018, Tab. 6.1 Alleinlebende, je Haushalt und Monat in € (Zeilen 43, 54–65, 70, 71) ----------
// https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/DEHeft_derivate_00057921/2152604189004_korr19112020.pdf, S. 100
const EVS_NETTO = [736, 1091, 1399, 1743, 2273, 3032, 4157, 7684];
const EVS_KONSUM = [865, 1117, 1325, 1563, 1881, 2315, 2822, 3565];
const EVS: Record<KonsumKategorie, number[]> = {
  nahrung: [166, 184, 199, 214, 228, 235, 250, 266],
  bekleidung: [28, 40, 52, 65, 79, 94, 105, 135],
  wohnen: [409, 493, 547, 620, 719, 853, 990, 1126],
  innen: [20, 38, 52, 67, 87, 113, 139, 187],
  gesundheit: [21, 30, 38, 52, 65, 98, 170, 369],
  verkehr: [51, 94, 122, 168, 231, 323, 432, 483],
  post: [36, 42, 48, 51, 55, 61, 65, 72],
  freizeit: [61, 99, 138, 173, 214, 279, 336, 429],
  bildung: [7, 6, 5, 7, 8, 10, 10, 18],
  gast: [35, 49, 63, 79, 116, 145, 207, 268],
  andere: [31, 44, 61, 67, 80, 104, 117, 210],
};
const EVS_VERSICHERUNG = [20, 34, 51, 74, 96, 124, 165, 254];
/** darunter Zusatz-Kranken- und Pflegeversicherung: ohne Versicherungsteuer */
const EVS_ZUSATZ_KV = [3, 5, 8, 11, 14, 19, 23, 28];

// ---------- Preise und Steuersätze 2026 ----------
/** Verbraucherpreisindex 2020 = 100 (Destatis): 2018 aus den langen Reihen, 2025 Jahresdurchschnitt */
const VPI = { 2018: 98.1, 2025: 121.9 };
/** Energiesteuer €/l; Tankrabatt −14,04 ct/l im Mai/Juni und Oktober–Dezember 2026, also 5 von 12 Monaten */
const RABATT_MONATE = 5;
const jahresmittel = (satz: number) => satz - (0.1404 * RABATT_MONATE) / 12;
const ENERGIESTEUER = { benzin: jahresmittel(0.6545), diesel: jahresmittel(0.4704) };
/** Annahmen: Literpreis im Jahresmittel 2026 (ADAC-Monatsmittel Sept. 2,27 €/2,39 €, Okt. rund 2,11 €/2,26 €), Benzin-Anteil */
const LITERPREIS = 2.0;
const BENZIN_ANTEIL = 0.75;
const KRAFTSTOFF_QUOTE =
  (BENZIN_ANTEIL * ENERGIESTEUER.benzin + (1 - BENZIN_ANTEIL) * ENERGIESTEUER.diesel) / LITERPREIS;
/** Haushaltsenergie, Preise inkl. Steuern 1. Hj. 2026 (Destatis 61241-04, -15): Strom 1.000–2.500 kWh, Gas 5.600–55.600 kWh */
const STROM = { steuer: 0.0205, preis: 0.4165 };
const GAS = { steuer: 0.0055, preis: 0.1156 };
/** Annahme: Strom macht die Hälfte der Energieausgaben aus, Heizung (Gas, Öl, Fernwärme) die andere */
const STROM_ANTEIL = 0.5;
/** Umsatzsteuer 2026 nach Steuerschätzung Oktober 2026, Mrd €: Bund, Länder, Gemeinden */
const UST_2026 = { bund: 154.2, land: 155.5, gemeinde: 10.4 };

const QUELLEN_KONSUM = [
  {
    label: 'Destatis: EVS 2018, Fachserie 15 Heft 4, Tab. 6.1 Alleinlebende',
    url: 'https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/DEHeft_derivate_00057921/2152604189004_korr19112020.pdf',
  },
  {
    label: 'Destatis: Laufende Wirtschaftsrechnungen 2024, Konsumausgaben nach Haushaltsgröße (63111-01)',
    url: 'https://www.destatis.de/DE/Themen/Gesellschaft-Umwelt/Einkommen-Konsum-Lebensbedingungen/Konsumausgaben-Lebenshaltungskosten/_inhalt.html',
  },
  {
    label: 'Destatis: Verbraucherpreisindex, Jahresdurchschnitte',
    url: 'https://www.destatis.de/DE/Themen/Wirtschaft/Konjunkturindikatoren/Basisdaten/vpi141a.html',
  },
  {
    label: 'Destatis: Daten zur Energiepreisentwicklung (61241), Strom und Gas für Haushalte',
    url: 'https://www.destatis.de/DE/Themen/Wirtschaft/Preise/Publikationen/Energiepreise/_inhalt.html',
  },
  {
    label: 'BMF: Ergebnisse der 171. Steuerschätzung, Oktober 2026',
    url: 'https://www.bundesfinanzministerium.de/Content/DE/Standardartikel/Themen/Steuern/Steuerschaetzungen_und_Steuereinnahmen/Steuerschaetzung/2026-10-22-ergebnisse-171-steuerschaetzung-dl-xlsx.xlsx?__blob=publicationFile&v=3',
  },
  {
    label: 'Bundestag: Tankrabatt, befristete Senkung der Energiesteuer 2026',
    url: 'https://www.bundestag.de/dokumente/textarchiv/2026/kw17-de-energiesteuersenkung-1165890',
  },
  {
    label: 'ADAC-Monatsauswertung Kraftstoffpreise September 2026 (Bericht)',
    url: 'https://www.autohaus.de/nachrichten/politik/vor-dem-tankrabatt-september-war-teuerster-tankmonat-aller-zeiten-3910741',
  },
];

// ---------- Warenkorb 2024, Einpersonenhaushalte ----------
const LWR_URL =
  'https://www.destatis.de/DE/Themen/Gesellschaft-Umwelt/Einkommen-Konsum-Lebensbedingungen/Konsumausgaben-Lebenshaltungskosten/Publikationen/Downloads-Konsumausgaben/statistischer-bericht-laufende-wirtschaftsrechnungen-2150100247005.xlsx?__blob=publicationFile&v=8';

type Verbrauch = 'kraftstoff' | 'energie';
interface Posten {
  /** Zeile in 63111-01 (Anfang genügt), innerhalb der Obergruppe `in` */
  zeile: string;
  in: string;
  kat: KonsumKategorie;
  /** Mehrwertsteuer als Anteil am Bruttopreis */
  mwst: number;
  verbrauch?: Verbrauch;
}
const p = (inGruppe: string, zeile: string, kat: KonsumKategorie, mwst: number, verbrauch?: Verbrauch): Posten => ({
  in: inGruppe,
  zeile,
  kat,
  mwst,
  verbrauch,
});
const NAHRUNG = 'Nahrungsmittel, Getränke, Tabakwaren';
const WOHNEN = 'Wohnen, Energie';
const GESUND = 'Gesundheit';
const VERKEHR = 'Verkehr';
const IUK = 'Information und Kommunikation';
const FREIZEIT = 'Freizeit, Sport und Kultur';
const GAST = 'Gastronomie- und Beherbergung';
const ANDERE = 'Andere Waren und Dienstleistungen';
const mix = (anteilVoll: number) => anteilVoll * VOLL + (1 - anteilVoll) * ERM;

/** Jede Ausgabe genau einmal; Zuordnung zu den Gruppen der EVS 2018 und der Mehrwertsteuersatz 2026 */
const WARENKORB: Posten[] = [
  // Annahme: 12 % alkoholfreie Getränke zum Regelsatz, Lebensmittel ermäßigt
  p(NAHRUNG, 'Nahrungsmittel, alkoholfreie Getränke', 'nahrung', mix(0.12)),
  p(NAHRUNG, 'alkoholische Getränke, Tabakwaren', 'nahrung', VOLL),
  p('Bekleidung und Schuhe', 'Bekleidung und Schuhe', 'bekleidung', VOLL),
  p(WOHNEN, 'Wohnungsmieten', 'wohnen', 0),
  p(WOHNEN, 'Energie', 'wohnen', VOLL, 'energie'),
  p(WOHNEN, 'Wohnungsinstandhaltung', 'wohnen', VOLL),
  p('Innenausstattung', 'Innenausstattung', 'innen', VOLL),
  p(GESUND, 'Hilfsmittel für die Gesundheit', 'gesundheit', VOLL),
  p(GESUND, 'Arzneimittel', 'gesundheit', VOLL),
  p(GESUND, 'Gesundheitsdienstleistungen', 'gesundheit', 0),
  p(VERKEHR, 'Personenkraftwagen', 'verkehr', VOLL),
  p(VERKEHR, 'Kraft- und Fahrräder', 'verkehr', VOLL),
  p(VERKEHR, 'Ersatzteile und Zubehör', 'verkehr', VOLL),
  p(VERKEHR, 'Kraft- und Schmierstoffe', 'verkehr', VOLL, 'kraftstoff'),
  p(VERKEHR, 'Wartung, Reparaturen', 'verkehr', VOLL),
  p(VERKEHR, 'sonstige Dienstleistungen', 'verkehr', VOLL),
  p(VERKEHR, 'Personenbeförderungsdienstleistungen', 'verkehr', ERM),
  // Briefe steuerfrei, Pakete zum Regelsatz
  p(VERKEHR, 'Transportdienstleistungen für Waren', 'post', VOLL / 2),
  p(IUK, 'Telefone und andere Geräte', 'post', VOLL),
  p(IUK, 'Computer, Laptops', 'freizeit', VOLL),
  p(IUK, 'Peripheriegeräte', 'freizeit', VOLL),
  p(IUK, 'Ton- und Bildempfangs', 'freizeit', VOLL),
  p(IUK, 'Aufzeichnungsträger', 'freizeit', VOLL),
  p(IUK, 'andere Geräte', 'freizeit', VOLL),
  p(IUK, 'anderes Zubehör', 'freizeit', VOLL),
  p(IUK, 'Software', 'freizeit', VOLL),
  p(IUK, 'Dienstleistungen für Festnetz', 'post', VOLL),
  p(IUK, 'Reparatur und Miete von Geräten', 'freizeit', VOLL),
  // vor allem Rundfunkbeitrag: keine Umsatzsteuer
  p(IUK, 'andere Dienstleistungen und Gebühren', 'freizeit', 0),
  p(FREIZEIT, 'Foto-, Filmausrüstung', 'freizeit', VOLL),
  p(FREIZEIT, 'größere langlebige Gebrauchsgüter', 'freizeit', VOLL),
  p(FREIZEIT, 'Geräte und Ausrüstungen für Sport', 'freizeit', VOLL),
  p(FREIZEIT, 'Musikinstrumente', 'freizeit', VOLL),
  p(FREIZEIT, 'Spielwaren und Hobbys', 'freizeit', VOLL),
  p(FREIZEIT, 'Blumen und Gärten', 'freizeit', ERM),
  // Futter ermäßigt, Tierarzt zum Regelsatz
  p(FREIZEIT, 'Haustiere', 'freizeit', mix(0.5)),
  // Sportvereine und öffentliche Bäder teils steuerfrei
  p(FREIZEIT, 'Freizeitdienstleistungen', 'freizeit', 0.8 * VOLL),
  p(FREIZEIT, 'Kulturdienstleistungen', 'freizeit', ERM),
  p(FREIZEIT, 'Bücher', 'freizeit', ERM),
  p(FREIZEIT, 'Zeitungen, Zeitschriften', 'freizeit', ERM),
  p(FREIZEIT, 'Schreibwaren', 'freizeit', VOLL),
  // Margenbesteuerung (§ 25 UStG): Steuer nur auf die Marge des Veranstalters, Annahme rund 3 % des Preises
  p(FREIZEIT, 'Pauschalreisen', 'freizeit', 0.03),
  p('Bildungsdienstleistungen', 'Bildungsdienstleistungen', 'bildung', 0),
  // Speisen ermäßigt (seit 2026), Annahme 30 % Getränke zum Regelsatz
  p(GAST, 'Gastronomiedienstleistungen', 'gast', mix(0.3)),
  p(GAST, 'Beherbergungsdienstleistungen', 'gast', ERM),
  p('Versicherungs- und Finanzdienstleistungen', 'Versicherungs- und Finanzdienstleistungen', 'andere', 0),
  p(ANDERE, 'Schmuck, Uhren', 'andere', VOLL),
  p(ANDERE, 'sonstige persönliche Gebrauchsgegenstände', 'andere', VOLL),
  p(ANDERE, 'Dienstleistungen für die Körperpflege', 'andere', VOLL),
  p(ANDERE, 'Körperpflegeartikel', 'andere', VOLL),
  // Sozialdienste und Betreuung steuerfrei, übrige zum Regelsatz
  p(ANDERE, 'sonstige Dienstleistungen', 'andere', VOLL / 2),
];

const text = (z: Zelle) =>
  String(z ?? '')
    .replace(/\s+/g, ' ')
    .trim();
const euro = (z: Zelle) => (typeof z === 'number' ? z : 0); // „/“ = keine Angabe

async function warenkorb() {
  const zeilen = await blatt(await quelle('lwr-2024.xlsx', LWR_URL), '63111-01');
  const kopf = zeilen.findIndex((z) => text(z[0]).startsWith('Art der Ausgaben'));
  const spalte = zeilen[kopf].findIndex((z) => text(z) === 'Einpersonenhaushalte');
  if (kopf < 0 || spalte < 0) throw new Error('63111-01: Kopfzeile oder Spalte „Einpersonenhaushalte“ fehlt');

  // Obergruppen erkennen: Zeilen, deren Name einer bekannten Gruppe entspricht
  const gruppen = [...new Set(WARENKORB.map((w) => w.in))];
  let gruppe = '';
  let gesamt = 0;
  const gefunden = new Map<Posten, number>();
  for (const z of zeilen.slice(kopf + 1)) {
    const name = text(z[0]);
    if (name.startsWith('Private Konsumausgaben')) {
      gesamt = euro(z[spalte]);
      break;
    }
    const g = gruppen.find((x) => name.startsWith(x));
    if (g) gruppe = g;
    const w = WARENKORB.find((x) => x.in === gruppe && name.startsWith(x.zeile) && !gefunden.has(x));
    if (w) gefunden.set(w, euro(z[spalte]));
  }
  const fehlt = WARENKORB.filter((w) => !gefunden.has(w));
  if (fehlt.length) throw new Error(`63111-01: nicht gefunden: ${fehlt.map((w) => w.zeile).join('; ')}`);
  const summe = [...gefunden.values()].reduce((s, v) => s + v, 0);
  // Abgleich: jede Ausgabe genau einmal; Abweichung nur durch Rundung und unterdrückte Werte („/“)
  if (!gesamt || Math.abs(summe - gesamt) > 6)
    throw new Error(`63111-01: Summe der Posten ${summe} € statt ${gesamt} € Konsumausgaben`);
  console.log(`Warenkorb 2024: ${gefunden.size} Posten, ${summe} € von ${gesamt} €`);
  return gefunden;
}

function saetze(korb: Map<Posten, number>) {
  const leer = () => ({ euro: 0, mwst: 0, energie: 0, strom: 0 });
  const acc = Object.fromEntries(Object.keys(EVS).map((k) => [k, leer()])) as Record<
    KonsumKategorie,
    ReturnType<typeof leer>
  >;
  for (const [w, euro] of korb) {
    const a = acc[w.kat];
    a.euro += euro;
    a.mwst += euro * w.mwst;
    if (w.verbrauch === 'kraftstoff') a.energie += euro * KRAFTSTOFF_QUOTE;
    if (w.verbrauch === 'energie') {
      a.strom += euro * STROM_ANTEIL * (STROM.steuer / STROM.preis);
      a.energie += euro * (1 - STROM_ANTEIL) * (GAS.steuer / GAS.preis);
    }
  }
  const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
  return Object.fromEntries(
    Object.entries(acc).map(([k, a]) => [
      k,
      { mwst: r4(a.mwst / a.euro || 0), energie: r4(a.energie / a.euro || 0), strom: r4(a.strom / a.euro || 0) },
    ]),
  ) as KonsumDaten['saetze'];
}

function evsPruefen() {
  EVS_NETTO.forEach((_, i) => {
    const summe = Object.values(EVS).reduce((s, reihe) => s + reihe[i], 0);
    if (Math.abs(summe - EVS_KONSUM[i]) > 2)
      throw new Error(`EVS 2018 Klasse ${i + 1}: Gruppen ${summe} € statt ${EVS_KONSUM[i]} € Konsum`);
  });
}

async function main() {
  evsPruefen();
  const saetzeJeGruppe = saetze(await warenkorb());
  const ust = UST_2026.bund + UST_2026.land + UST_2026.gemeinde;
  const daten: KonsumDaten = {
    preisfaktor: Math.round((VPI[2025] / VPI[2018]) * 1e4) / 1e4,
    klassen: EVS_NETTO.map((netto, i) => ({
      netto,
      konsum: EVS_KONSUM[i],
      kategorien: Object.fromEntries(Object.entries(EVS).map(([k, reihe]) => [k, reihe[i]])) as Record<
        KonsumKategorie,
        number
      >,
      versicherung: EVS_VERSICHERUNG[i] - EVS_ZUSATZ_KV[i],
    })),
    saetze: saetzeJeGruppe,
    versicherungsteuer: Math.round(VOLL * 1e4) / 1e4,
    mwstVerteilung: {
      bund: Math.round((UST_2026.bund / ust) * 1e4) / 1e4,
      land: Math.round((UST_2026.land / ust) * 1e4) / 1e4,
      gemeinde: Math.round((UST_2026.gemeinde / ust) * 1e4) / 1e4,
    },
    annahmen: {
      literpreis: LITERPREIS,
      benzinAnteil: BENZIN_ANTEIL,
      kraftstoffQuote: Math.round(KRAFTSTOFF_QUOTE * 1e4) / 1e4,
      stromAnteil: STROM_ANTEIL,
      rabattMonate: RABATT_MONATE,
    },
    quellen: QUELLEN_KONSUM,
  };
  for (const [k, s] of Object.entries(daten.saetze)) console.log(k.padEnd(11), s);
  schreibeJson(join(ROOT, 'src', 'data', 'konsum.json'), daten);
  console.log('src/data/konsum.json geschrieben');
}

await main();
