// Einordnungen aus Studien von ifo und DIW, mit Fundstelle. Zahlen sind im Originaldokument nachgelesen
// (Recherche vom 7. November 2026). DIW-Wochenberichte ab 2025: CC BY 4.0; ifo: Zitat mit Quellenangabe.

export interface Studie {
  /** Satz für die Seite, Du-Form */
  text: string;
  quelle: { label: string; url: string };
  /** Vorbehalt, der mit dem Satz gezeigt wird */
  vorbehalt?: string;
}

export const STUDIEN = {
  renteZuschuss: {
    text: 'Rund ein Drittel der Steuereinnahmen des Bundes fließt 2026 als Zuschuss in die gesetzliche Rente: 127,8 Mrd €.',
    quelle: {
      label: 'ifo Schnelldienst digital 20/2025, Höslinger: Bundeshaushalt 2026 – Investieren oder konsumieren?',
      url: 'https://www.ifo.de/DocDL/sd-digital-2025-20-hoeslinger-bundeshaushalt-2026.pdf',
    },
    vorbehalt: 'Stand Regierungsentwurf 2026, ohne Grundsicherung im Alter.',
  },
  sondervermoegen: {
    text: 'Das Sondervermögen Infrastruktur soll zusätzliche Investitionen bezahlen. Laut ifo ersetzte es 2025 aber größtenteils Investitionen, die sonst im Kernhaushalt gestanden hätten: Die Kredite stiegen um 24,3 Mrd €, die Investitionen des Bundes nur um 1,3 Mrd €.',
    quelle: {
      label: 'ifo Schnelldienst digital 4/2026, Höslinger und Lay: Monitoring der Investitionen des Bundes',
      url: 'https://www.ifo.de/DocDL/sd-digital-2026-04-hoeslinger-lay-investitionsmonitoring-bund.pdf',
    },
    vorbehalt: 'Modellrechnung; die Bundesregierung widerspricht.',
  },
  zinsen2030: {
    text: 'Die Zinsausgaben des Bundes sollen sich laut Finanzplan bis 2030 mehr als verdoppeln, auf knapp 81 Mrd €.',
    quelle: {
      label: 'DIW Wochenbericht 41/2026, Kriwoluzky und Kurcz (CC BY 4.0)',
      url: 'https://doi.org/10.18723/diw_wb:2026-41-1',
    },
  },
  reform2027: {
    text: 'Gerechnet ist mit dem Tarif 2026. Die geplante Reform ab 2027 (Grundfreibetrag voraussichtlich 12.900 €) gleicht laut ifo vor allem die kalte Progression aus.',
    quelle: {
      label: 'ifo Schnelldienst 8/2026, Blömer, Fuest, Neumeier, Peichl: Ausgleich statt Reform',
      url: 'https://www.ifo.de/DocDL/sd-2026-08-zdg-bloemer-fuest-etal-einkommensteuer-reformen.pdf',
    },
    vorbehalt: 'Noch nicht beschlossen (1. Lesung am 8. Oktober 2026).',
  },
  grenzbelastung: {
    text: 'Laut DIW gehen bei mittleren Einkommen gut 45 Cent je zusätzlichem Euro an Steuern und Sozialversicherung; in der OECD liegt nur Belgien höher.',
    quelle: {
      label: 'DIW Wochenbericht 24/2026, Bach: Kommentar (CC BY 4.0)',
      url: 'https://doi.org/10.18723/diw_wb:2026-24-4',
    },
  },
  kapitalrente: {
    text: 'Die Rentenkommission schlägt ab 2028 einen zusätzlichen Beitrag von 0,5 % für eine staatliche Kapitalrente vor, bis 2031 steigend auf 2 %.',
    quelle: {
      label: 'ifo Schnelldienst 9/2026, Bucher-Koenen und Rocholl: Gesetzliche Kapitalrente',
      url: 'https://www.ifo.de/DocDL/sd-2026-09-zdg-bucher-koenen-rocholl-reform-altersvorsorge.pdf',
    },
    vorbehalt: 'Nur eine Empfehlung, nicht beschlossen und hier nicht eingerechnet.',
  },
  kommunen: {
    text: 'Aus dem Sondervermögen Infrastruktur bekommen die Kommunen rund 4,7 Mrd € im Jahr, etwa ein Zehntel ihrer heutigen Sachinvestitionen von knapp 46 Mrd €.',
    quelle: {
      label: 'DIW Wochenbericht 11/2026, Dany-Knedlik, Gornig, Hackmann, Schildmann (CC BY 4.0)',
      url: 'https://doi.org/10.18723/diw_wb:2026-11-4',
    },
  },
} satisfies Record<string, Studie>;
