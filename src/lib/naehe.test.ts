import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { entfernungKm, type LageDaten, naechsteStadt, type Ort, zielAmStandort } from './naehe';

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

describe('zielAmStandort (alle Gemeinden)', () => {
  const lage: LageDaten = JSON.parse(readFileSync('public/orte-lage.json', 'utf8'));
  it('kennt alle Gemeinden', () => {
    expect(lage.orte.length).toBeGreaterThan(10_000);
    expect(lage.orte.every(([lat, lon, r]) => lat > 47 && lat < 55.1 && lon > 5.8 && lon < 15.1 && r > 0)).toBe(true);
  });
  it.each([
    ['Nordenham', 53.486, 8.484, 'landkreis-wesermarsch'],
    ['Bremerhaven', 53.546, 8.576, 'bremerhaven'],
    ['Oldenburg, Schlossplatz', 53.139, 8.214, 'oldenburg'],
    ['Berlin-Mitte', 52.52, 13.405, 'berlin'],
    ['Berlin-Spandau, am Stadtrand', 52.537, 13.2, 'berlin'],
    ['Falkensee, gleich hinter Berlin', 52.56, 12.928, 'landkreis-havelland'],
    ['Hamburg-Bergedorf', 53.488, 10.215, 'hamburg'],
    ['Garmisch-Partenkirchen', 47.492, 11.095, 'landkreis-garmisch-partenkirchen'],
    ['Hannover', 52.375, 9.732, 'region-hannover'],
    ['Aachen', 50.776, 6.084, 'staedteregion-aachen'],
    ['Schwanewede, neben Bremen', 53.233, 8.597, 'landkreis-osterholz'],
  ])('%s', (_, lat, lon, slug) => {
    expect(zielAmStandort(lage, lat, lon)).toBe(slug);
  });
});
