import type { Stadt } from '../data/types';

/** Gebeugte Formen eines Kreisnamens: „Region Hannover“ ist weiblich, „Oberbergischer Kreis“ wird als Adjektiv gebeugt. */
export function kreisFormen(name: string) {
  if (/^(Region|Städteregion)\b/.test(name)) {
    return { nom: `die ${name}`, akk: `die ${name}`, im: `in der ${name}`, sein: 'ihre' };
  }
  const adj = (endung: string) => name.replace(/er Kreis$/, `${endung} Kreis`);
  return { nom: `der ${adj('e')}`, akk: `den ${adj('en')}`, im: `im ${adj('en')}`, sein: 'seine' };
}

/** „in Oldenburg“, „im Landkreis Wesermarsch“ */
export const imOrt = (s: Stadt) => (s.kreis ? kreisFormen(s.name).im : `in ${s.name}`);

/** Wer den Gemeindeanteil bekommt: die Stadt selbst oder die Gemeinden im Kreis */
export const gemeindenVon = (s: Stadt) => (s.kreis ? `die Gemeinden ${kreisFormen(s.name).im}` : s.name);
