/** Inhalt von /orte.json: Slugs der Ziele und je Ort Name und Index des Ziels, nach Einwohnern sortiert */
export interface OrtDaten {
  ziele: string[];
  orte: [name: string, ziel: number][];
}
export interface Treffer {
  name: string;
  slug: string;
}

/** Klein, Umlaute ausgeschrieben, ohne Akzente und Satzzeichen: „Bad Münder a. D.“ → „bad muender a d“ */
export const normalisiere = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Baut eine Suchfunktion über alle Orte; die Normalisierung läuft nur einmal. */
export function ortssuche(daten: OrtDaten) {
  const orte = daten.orte.map(([name, ziel]) => ({ name, slug: daten.ziele[ziel], n: normalisiere(name) }));
  return (eingabe: string, grenze = 8): Treffer[] => {
    const q = normalisiere(eingabe);
    if (q.length < 2) return [];
    const rang = (n: string) => (n === q ? 0 : n.startsWith(q) ? 1 : n.includes(` ${q}`) ? 2 : -1);
    const stufen: Treffer[][] = [[], [], []];
    for (const o of orte) {
      const r = rang(o.n);
      if (r >= 0) stufen[r].push({ name: o.name, slug: o.slug });
    }
    const gesehen = new Set<string>();
    return stufen
      .flat()
      .filter((t) => {
        const k = `${t.name}|${t.slug}`;
        if (gesehen.has(k)) return false;
        gesehen.add(k);
        return true;
      })
      .slice(0, grenze);
  };
}
