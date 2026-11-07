import type { Gruppe } from './types';

/** Haushaltsgesetz 2026, Soll, Einzelpläne in Tsd € */
const EPL_TSD: [string, string, number, Gruppe][] = [
  ['01', 'Bundespräsident', 67_388, 'verw'],
  ['02', 'Bundestag', 1_275_973, 'verw'],
  ['03', 'Bundesrat', 40_968, 'verw'],
  ['04', 'Kanzleramt', 4_998_292, 'verw'],
  ['05', 'Auswärtiges Amt', 6_025_293, 'sich'],
  ['06', 'Inneres', 15_761_595, 'sich'],
  ['07', 'Justiz', 1_213_279, 'verw'],
  ['08', 'Finanzen', 10_823_140, 'verw'],
  ['09', 'Wirtschaft & Energie', 5_903_305, 'inf'],
  ['10', 'Landwirtschaft', 6_993_071, 'inf'],
  ['11', 'Arbeit & Soziales', 197_341_040, 'soz'],
  ['12', 'Verkehr', 27_901_360, 'inf'],
  ['14', 'Verteidigung', 82_687_312, 'sich'],
  ['15', 'Gesundheit', 21_773_945, 'soz'],
  ['16', 'Umwelt', 2_772_089, 'inf'],
  ['17', 'Bildung, Familie', 16_664_014, 'soz'],
  ['19', 'Verfassungsgericht', 46_423, 'verw'],
  ['20', 'Rechnungshof', 202_239, 'verw'],
  ['21', 'Datenschutz', 52_154, 'verw'],
  ['22', 'Kontrollrat', 14_600, 'verw'],
  ['23', 'Entwicklung', 10_055_733, 'sich'],
  ['24', 'Digitales', 1_359_624, 'inf'],
  ['25', 'Wohnen & Bau', 7_745_681, 'soz'],
  ['30', 'Forschung & Raumfahrt', 21_818_269, 'for'],
  ['32', 'Bundesschuld (Zinsen)', 33_649_367, 'zins'],
  ['60', 'Allg. Finanzverwaltung', 47_353_984, 'verw'],
];

export interface Einzelplan {
  n: string;
  name: string;
  v: number;
  g: Gruppe;
}

/** Einzelpläne in Mrd € */
export const EINZELPLAENE: Einzelplan[] = EPL_TSD.map(([n, name, v, g]) => ({ n, name, v: v / 1e6, g }));
export const BUND_GESAMT = EINZELPLAENE.reduce((a, b) => a + b.v, 0); // ≈ 524,54

/** Einnahmen 2026 in Mrd € */
export const EINNAHMEN = [
  { name: 'Steuern', v: 387.214, k: 'steuer' },
  { name: 'Neue Kredite', v: 97.964556, k: 'kredit' },
  { name: 'Sonstige Einnahmen', v: 39.361582, k: 'sonst' },
] as const;

/** Regierungsentwurf 2027, nur Einzelpläne mit veröffentlichten Zahlen, Mrd € */
export const ENTWURF_2027: Record<string, number> = {
  '11': 201.46,
  '14': 109.7,
  '32': 43.6,
  '12': 26.4,
  '15': 14.33,
  '17': 15.48,
  '60': 46.88,
  '20': 0.2189,
  '03': 0.041,
};
/** Schlussabstimmung im Bundestag über den Haushalt 2027 */
export const ABSTIMMUNG_2027 = new Date('2026-11-27T12:00:00+01:00');
/** Solange true, sind ENTWURF_2027 und ENTWICKLUNG[2027] Regierungsentwurf; nach Beschluss aktualisieren und auf false setzen */
export const HAUSHALT_2027_IST_ENTWURF = true;

const datum = (d: Date) => d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric' });
/** Satz zur Abstimmung, abhängig vom Build-Datum */
export function abstimmungSatz(heute = new Date()) {
  return heute < ABSTIMMUNG_2027
    ? `Über den Haushalt 2027 stimmt der Bundestag am ${datum(ABSTIMMUNG_2027)} ab.`
    : `Über den Haushalt 2027 hat der Bundestag am ${datum(ABSTIMMUNG_2027)} abgestimmt; die Zahlen für 2027 sind hier noch der Regierungsentwurf.`;
}

/** Kernhaushalt in Mrd €: beschlossen, Entwurf, Finanzplan */
export const ENTWICKLUNG: { jahr: number; v: number; status: 'Soll' | 'Entwurf' | 'Finanzplan' }[] = [
  { jahr: 2025, v: 502.5, status: 'Soll' },
  { jahr: 2026, v: 524.5, status: 'Soll' },
  { jahr: 2027, v: 555.4, status: 'Entwurf' },
  { jahr: 2028, v: 588.2, status: 'Finanzplan' },
  { jahr: 2029, v: 597.8, status: 'Finanzplan' },
  { jahr: 2030, v: 635.4, status: 'Finanzplan' },
];
/** Kernhaushalt 2027 laut Entwurf, aus der Entwicklungsreihe */
export const ENTWURF_2027_GESAMT = ENTWICKLUNG.find((j) => j.jahr === 2027)!.v;

export const BUND_QUELLEN = [
  { label: 'Haushaltsgesetz 2026, Anlage', url: 'https://www.gesetze-im-internet.de/hg_2026/anlage.html' },
  {
    label: 'Bundestag: Bereinigungssitzung 2026',
    url: 'https://www.bundestag.de/dokumente/textarchiv/2025/kw46-pa-haushalt-bereinigung-1126856',
  },
  {
    label: 'Bundestag: Fahrplan Haushalt 2027',
    url: 'https://www.bundestag.de/dokumente/textarchiv/2026/kw34-haushalt-2027-ablauf-1187766',
  },
  { label: 'hib: Entwurf 2027', url: 'https://www.bundestag.de/presse/hib/kurzmeldungen-1193844' },
  {
    label: 'ES&T: Entwurf 2027',
    url: 'https://esut.de/2026/07/meldungen/72572/entwurf-haushalt-2027-5554-milliarden-euro-ausgaben/',
  },
  { label: 'Finanzplan bis 2030', url: 'https://vergabeblog.de/?p=74764' },
];
