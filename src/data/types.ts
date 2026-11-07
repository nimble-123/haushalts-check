/** Zweck-Gruppen, über alle Ebenen gleich – steuern Farbe und die „100 €“-Aufteilung. */
export const GRUPPEN = {
  soz: 'Soziales, Jugend & Gesundheit',
  sich: 'Sicherheit & Außen',
  inf: 'Infrastruktur & Wirtschaft',
  for: 'Bildung, Forschung & Kultur',
  zins: 'Zinsen',
  verw: 'Verwaltung, Pensionen & Übriges',
} as const;
export type Gruppe = keyof typeof GRUPPEN;

export interface Posten {
  name: string;
  /** Betrag in der Einheit der Ebene */
  v: number;
  g: Gruppe;
}

export interface Quelle {
  label: string;
  url: string;
}

export interface Ebene {
  name: string;
  /** Haushalts- bzw. Rechnungsjahr */
  jahr: number;
  einheit: 'Mrd €' | 'Mio €';
  /** z. B. „Soll“, „Rechnungsergebnis“ */
  art: string;
  posten: Posten[];
  quellen: Quelle[];
  hinweis?: string;
}

export interface Land extends Ebene {
  /** zweistelliger Länderschlüssel, z. B. "03" */
  code: string;
  slug: string;
  /** Kirchensteuersatz (0,08 in BW und Bayern, sonst 0,09) */
  kirchensteuer: 0.08 | 0.09;
}

export interface Ausgabeart {
  name: string;
  /** € je Einwohner */
  proKopf: number;
}

export interface Stadt {
  slug: string;
  /** Amtlicher Regionalschlüssel (5-stellig) */
  ags: string;
  land: string; // Land.code
  name: string;
  amtlich: string;
  einwohner: number;
  /** Berlin, Hamburg, Bremen, Bremerhaven: Land und Kommune in einem Haushalt */
  stadtstaat: boolean;
  /** Geografischer Mittelpunkt (Gemeindeverzeichnis) */
  lat?: number;
  lon?: number;
  /** Echte Auszahlungen nach Art (Regionaldatenbank 71717-Z-05), sofern abgerufen */
  ausgabearten?: { jahr: number; vorlaeufig: boolean; posten: Ausgabeart[]; quellen: Quelle[] };
}

/** Zweck-Aufteilung der Gemeinde-Ebene, wie sie der Rechner verwendet */
export interface GemeindeEbene extends Ebene {
  /** true: Landesdurchschnitt der Gemeinden, keine stadteigenen Zahlen */
  schaetzung: boolean;
}
