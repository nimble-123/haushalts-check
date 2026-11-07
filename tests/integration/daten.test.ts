// Konsistenz der veröffentlichten Daten: Bund, 16 Länder, 106 kreisfreie Städte.
import { describe, expect, it } from 'vitest';
import { ausgabeVergleich, gemeindeEbene, LAENDER, landVon, STAEDTE, summe } from '../../src/data';
import {
  ABSTIMMUNG_2027,
  abstimmungSatz,
  BUND_GESAMT,
  EINZELPLAENE,
  HAUSHALT_2027_IST_ENTWURF,
} from '../../src/data/bund';
import { GRUPPEN } from '../../src/data/types';

const gruppen = Object.keys(GRUPPEN);

describe('Bund', () => {
  it('Einzelpläne summieren sich auf das Haushaltsvolumen 2026 (524,5 Mrd €)', () => {
    expect(BUND_GESAMT).toBeCloseTo(524.54, 1);
    expect(EINZELPLAENE.every((e) => e.v > 0 && gruppen.includes(e.g))).toBe(true);
  });
});

describe('Länder', () => {
  it('alle 16 Länder mit eindeutigem Schlüssel', () => {
    expect(LAENDER).toHaveLength(16);
    expect(new Set(LAENDER.map((l) => l.code)).size).toBe(16);
  });
  it.each(LAENDER.map((l) => [l.name, l] as const))('%s: nur positive Posten mit bekannter Gruppe', (_, l) => {
    expect(l.posten.length).toBeGreaterThan(10);
    for (const p of l.posten) {
      expect(p.v).toBeGreaterThan(0);
      expect(gruppen).toContain(p.g);
    }
    expect([0.08, 0.09]).toContain(l.kirchensteuer);
    expect(l.quellen.length).toBeGreaterThan(0);
  });
  it('Kirchensteuer 8 % genau in Baden-Württemberg und Bayern', () => {
    expect(
      LAENDER.filter((l) => l.kirchensteuer === 0.08)
        .map((l) => l.name)
        .sort(),
    ).toEqual(['Baden-Württemberg', 'Bayern']);
  });
});

describe('Städte', () => {
  it('106 kreisfreie Städte mit eindeutigem Slug und Schlüssel', () => {
    expect(STAEDTE).toHaveLength(106);
    expect(new Set(STAEDTE.map((s) => s.slug)).size).toBe(106);
    expect(new Set(STAEDTE.map((s) => s.ags)).size).toBe(106);
  });
  it.each(STAEDTE.map((s) => [s.name, s] as const))('%s: Land, Koordinaten, Zweck-Aufteilung', (_, s) => {
    const land = landVon(s);
    expect(s.ags.startsWith(land.code)).toBe(true);
    expect(s.lat).toBeGreaterThan(47);
    expect(s.lon).toBeGreaterThan(5.8);
    const gem = gemeindeEbene(s);
    expect(summe(gem)).toBeGreaterThan(0);
    // Stadtstaaten nutzen den Landeshaushalt, alle anderen die gekennzeichnete Schätzung
    expect(gem.schaetzung).toBe(!s.stadtstaat);
  });
  it('genau Berlin, Hamburg, Bremen und Bremerhaven sind Stadtstaaten-Städte', () => {
    expect(
      STAEDTE.filter((s) => s.stadtstaat)
        .map((s) => s.slug)
        .sort(),
    ).toEqual(['berlin', 'bremen', 'bremerhaven', 'hamburg']);
  });
});

describe('Ausgabearten je Stadt (Regionaldatenbank)', () => {
  const mit = STAEDTE.filter((s) => s.ausgabearten);
  it('alle 102 Städte außerhalb der Stadtstaaten haben Daten, Stadtstaaten keine', () => {
    expect(mit).toHaveLength(102);
    expect(mit.every((s) => !s.stadtstaat)).toBe(true);
  });
  it('fünf Arten je Stadt, Beträge je Einwohner plausibel', () => {
    for (const s of mit) {
      const a = s.ausgabearten!;
      expect(a.posten.map((p) => p.name)).toEqual([
        'Personal und Versorgung',
        'Sach- und Dienstleistungen',
        'Soziale Leistungen',
        'Investitionen',
        'Übrige laufende Auszahlungen',
      ]);
      const gesamt = a.posten.reduce((x, p) => x + p.proKopf, 0);
      expect(gesamt).toBeGreaterThan(1500);
      expect(gesamt).toBeLessThan(15000);
    }
  });
  it('der Durchschnitt liegt je Art zwischen Minimum und Maximum der Städte', () => {
    const v = ausgabeVergleich(mit[0])!;
    v.schnitt.forEach((p, i) => {
      const werte = mit.map((s) => s.ausgabearten!.posten[i].proKopf);
      expect(p.proKopf).toBeGreaterThanOrEqual(Math.min(...werte));
      expect(p.proKopf).toBeLessThanOrEqual(Math.max(...werte));
    });
  });
});

describe('Aktualität', () => {
  it('Satz zur Abstimmung über den Haushalt 2027 passt zum Datum', () => {
    expect(abstimmungSatz(new Date('2026-11-01'))).toContain('stimmt der Bundestag am 27.11.2026 ab');
    expect(abstimmungSatz(new Date('2026-12-01'))).toContain('hat der Bundestag am 27.11.2026 abgestimmt');
  });
  it('30 Tage nach der Abstimmung stehen keine Entwurfszahlen mehr drin (Erinnerung: Haushalt 2027 eintragen)', () => {
    const frist = new Date(ABSTIMMUNG_2027.getTime() + 30 * 864e5);
    if (new Date() > frist)
      expect(
        HAUSHALT_2027_IST_ENTWURF,
        'Haushalt 2027 ist beschlossen: ENTWURF_2027 und ENTWICKLUNG in src/data/bund.ts aktualisieren',
      ).toBe(false);
  });
});

describe('Daten sind HTML-sicher (Schutz vor manipulierten Quelldateien)', () => {
  const unsicher = /[<>"]/;
  it('kein Name in Bund, Ländern, Städten und Schätzbasis enthält < > oder "', () => {
    const namen = [
      ...EINZELPLAENE.map((e) => e.name),
      ...LAENDER.flatMap((l) => [l.name, l.art, ...l.posten.map((p) => p.name)]),
      ...STAEDTE.flatMap((s) => [s.name, s.amtlich, s.slug, ...(s.ausgabearten?.posten.map((p) => p.name) ?? [])]),
      ...STAEDTE.flatMap((s) => gemeindeEbene(s).posten.map((p) => p.name)),
    ];
    expect(namen.filter((n) => unsicher.test(n))).toEqual([]);
  });
  it('Slugs bestehen nur aus Kleinbuchstaben, Ziffern und Bindestrich', () => {
    expect(STAEDTE.filter((s) => !/^[a-z0-9-]+$/.test(s.slug)).map((s) => s.slug)).toEqual([]);
  });
});
