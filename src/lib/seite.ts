// Vertrag zwischen Check.astro (Build) und check.ts (Browser): Daten, die als JSON in der Seite stehen.
import type { ausgabeVergleich } from '../data';
import type { GemeindeEbene, Land, Stadt } from '../data/types';
import type { Ort } from './naehe';

/** Ausgabearten der Stadt im Vergleich zum Schnitt aller kreisfreien Städte */
export type Ausgabevergleich = NonNullable<ReturnType<typeof ausgabeVergleich>>;

export interface SeitenDaten {
  stadt: Stadt;
  land: Land;
  gem: GemeindeEbene;
  arten: Ausgabevergleich | null;
  /** alle Städte mit Koordinaten, für „In meiner Nähe“ */
  orte: readonly Ort[];
  median: number;
}
