import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { entfernungKm, naechsteStadt, type Ort } from './naehe';

const ordner = join(__dirname, '..', 'data', 'staedte');
const orte: Ort[] = readdirSync(ordner).map((f) => {
  const s = JSON.parse(readFileSync(join(ordner, f), 'utf8'));
  return [s.slug, s.lat, s.lon] as const;
});

describe('entfernungKm', () => {
  it('misst Berlin–Hamburg mit rund 255 km', () => {
    expect(entfernungKm(52.52, 13.405, 53.551, 9.994)).toBeCloseTo(255, -1);
  });
});

describe('naechsteStadt (echte Koordinaten aller kreisfreien Städte)', () => {
  it('alle 106 Städte haben Koordinaten', () => {
    expect(orte).toHaveLength(106);
    expect(orte.every(([, lat, lon]) => lat > 47 && lat < 55.1 && lon > 5.8 && lon < 15.1)).toBe(true);
  });
  it.each([
    ['Oldenburg, Schlossplatz', 53.139, 8.214, 'oldenburg'],
    ['Nordenham (Landkreis Wesermarsch)', 53.486, 8.484, 'bremerhaven'],
    ['Garmisch-Partenkirchen', 47.492, 11.095, 'kaufbeuren'],
    ['Berlin-Mitte', 52.52, 13.405, 'berlin'],
  ])('%s → %s', (_, lat, lon, slug) => {
    expect(naechsteStadt(orte, lat, lon)).toBe(slug);
  });
});
