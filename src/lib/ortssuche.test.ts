import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalisiere, type OrtDaten, ortssuche } from './ortssuche';

const daten: OrtDaten = JSON.parse(readFileSync('public/orte.json', 'utf8'));
const suche = ortssuche(daten);

describe('Ortssuche', () => {
  it('kennt alle Gemeinden und jedes Ziel', () => {
    expect(daten.ziele).toHaveLength(400);
    expect(daten.orte.length).toBeGreaterThan(10_000);
    expect(new Set(daten.orte.map(([, z]) => z)).size).toBe(400);
  });
  it('führt eine Gemeinde zu ihrem Landkreis', () => {
    expect(suche('Nordenham')[0]).toEqual({ name: 'Nordenham', slug: 'landkreis-wesermarsch' });
  });
  it('führt eine kreisfreie Stadt zu ihrer Seite', () => {
    expect(suche('Oldenburg')[0].slug).toBe('oldenburg');
  });
  it('findet Städte in Stadtstaaten', () => {
    expect(suche('Bremerhaven')[0].slug).toBe('bremerhaven');
    expect(suche('Berlin')[0].slug).toBe('berlin');
  });
  it('kreisangehörige Großstädte gehen zu Region und Kreis', () => {
    expect(suche('Hannover')[0].slug).toBe('region-hannover');
    expect(suche('Aachen')[0].slug).toBe('staedteregion-aachen');
  });
  it('findet auch den Kreis selbst', () => {
    expect(suche('Wesermarsch').map((t) => t.slug)).toContain('landkreis-wesermarsch');
  });
  it('versteht Umlaute und Umschreibungen gleich', () => {
    expect(suche('muenchen')[0].name).toBe(suche('München')[0].name);
    expect(suche('Goettingen')[0].name).toBe('Göttingen');
  });
  it('findet Wortanfänge im Namen', () => {
    expect(suche('Zwischenahn').map((t) => t.name)).toContain('Bad Zwischenahn');
  });
  it('bei gleichen Namen steht die größte Gemeinde vorn und alles ist begrenzt', () => {
    expect(suche('Neustadt').length).toBe(8);
  });
  it('sucht erst ab zwei Zeichen', () => {
    expect(suche('a')).toEqual([]);
    expect(suche('xyzq')).toEqual([]);
  });
  it('normalisiert Satzzeichen', () => {
    expect(normalisiere('Bad Münder a. D.')).toBe('bad muender a d');
  });
});
