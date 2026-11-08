import schaetzung from './gemeinden-schaetzung.json';
import type { Ebene, GemeindeEbene, Land, Stadt } from './types';

const laenderMods = import.meta.glob<Land>('./laender/*.json', { eager: true, import: 'default' });
const staedteMods = import.meta.glob<Stadt>('./staedte/*.json', { eager: true, import: 'default' });

export const LAENDER: Land[] = Object.values(laenderMods).sort((a, b) => a.name.localeCompare(b.name, 'de'));
export const STAEDTE: Stadt[] = Object.values(staedteMods).sort((a, b) => a.name.localeCompare(b.name, 'de'));

export const landVon = (s: Stadt): Land => {
  const l = LAENDER.find((x) => x.code === s.land);
  if (!l) throw new Error(`Kein Land ${s.land} für ${s.name}`);
  return l;
};

export const summe = (e: { posten: { v: number }[] }) => e.posten.reduce((a, b) => a + b.v, 0);

/** Wofür die Gemeinde-Ebene ausgibt: Stadtstaaten → Landeshaushalt, sonst Gemeinden des Landes (Schätzung). */
export function gemeindeEbene(stadt: Stadt): GemeindeEbene {
  const land = landVon(stadt);
  if (stadt.stadtstaat) {
    return {
      ...stripLand(land),
      name: stadt.name,
      schaetzung: false,
      hinweis:
        stadt.land === '04'
          ? 'Bremen und Bremerhaven haben eigene Haushalte, die Statistik weist sie aber nur zusammen mit dem Land Bremen aus. Deshalb dieselbe Aufteilung wie beim Land.'
          : `${land.name} ist ein Stadtstaat: Land und Stadt haben einen gemeinsamen Haushalt, deshalb dieselbe Aufteilung wie beim Land.`,
    };
  }
  const g = (schaetzung.laender as Record<string, { jahr: number; posten: Ebene['posten'] }>)[stadt.land];
  if (!g) throw new Error(`Keine Gemeinde-Schätzung für Land ${stadt.land}`);
  return {
    name: stadt.name,
    jahr: g.jahr,
    einheit: 'Mio €',
    schaetzung: true,
    art: `Schätzung: Ausgaben aller Gemeinden und Kreise in ${land.name} nach Aufgabenbereichen`,
    posten: g.posten,
    quellen: [schaetzung.quelle],
    hinweis: `Für einzelne Städte gibt es keine amtliche Aufteilung nach Zweck. Gezeigt ist der Durchschnitt aller Gemeinden und Kreise in ${land.name}; kreisfreie Städte erfüllen beide Aufgaben.`,
  };
}

function stripLand(l: Land): Ebene {
  const { name, jahr, einheit, art, posten, quellen } = l;
  return { name, jahr, einheit, art, posten, quellen };
}

/** Stadtstaaten: Land und Stadt zusammen, verglichen nur untereinander (€ je Einwohner, gewichtet). */
function stadtstaatVergleich(stadt: Stadt) {
  const land = landVon(stadt);
  const a = land.ausgabearten;
  if (!a) return null;
  const einwohner = (code: string) => STAEDTE.filter((s) => s.land === code).reduce((x, s) => x + s.einwohner, 0);
  const staaten = LAENDER.filter((l) => l.ausgabearten);
  const ewAlle = staaten.reduce((x, l) => x + einwohner(l.code), 0);
  const proKopf = (mio: number, ew: number) => Math.round((mio * 1e6) / ew);
  return {
    jahr: a.jahr,
    vorlaeufig: false,
    quellen: a.quellen,
    posten: a.posten.map((p) => ({ name: p.name, proKopf: proKopf(p.mio, einwohner(land.code)) })),
    schnitt: a.posten.map((p) => ({
      name: p.name,
      proKopf: proKopf(
        staaten.reduce((x, l) => x + (l.ausgabearten!.posten.find((q) => q.name === p.name)?.mio ?? 0), 0),
        ewAlle,
      ),
    })),
    anzahl: staaten.length,
    traeger: land.code === '04' ? 'Land Bremen' : stadt.name,
    vergleich: 'der drei Stadtstaaten',
  };
}

/** Echte Ausgabearten plus Durchschnitt der Vergleichsgruppe desselben Jahres (€ je Einwohner, gewichtet). */
export function ausgabeVergleich(stadt: Stadt) {
  if (stadt.stadtstaat) return stadtstaatVergleich(stadt);
  const a = stadt.ausgabearten;
  if (!a) return null;
  const gleiche = STAEDTE.filter((s) => s.ausgabearten?.jahr === a.jahr);
  const ew = gleiche.reduce((x, s) => x + s.einwohner, 0);
  const schnitt = a.posten.map((p) => ({
    name: p.name,
    proKopf: Math.round(
      gleiche.reduce(
        (x, s) => x + (s.ausgabearten!.posten.find((q) => q.name === p.name)?.proKopf ?? 0) * s.einwohner,
        0,
      ) / ew,
    ),
  }));
  return {
    ...a,
    schnitt,
    anzahl: gleiche.length,
    traeger: stadt.name,
    vergleich: `aller ${gleiche.length} kreisfreien Städte`,
  };
}
