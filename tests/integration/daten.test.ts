// Konsistenz der veröffentlichten Daten: Bund, 16 Länder, 106 kreisfreie Städte.
import { describe, expect, it } from 'vitest';
import { ausgabeVergleich, gemeindeEbene, KREISE, LAENDER, landVon, STAEDTE, summe } from '../../src/data';
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

describe('Landkreise', () => {
  it('294 Kreise mit eindeutigen Slugs, ohne Überschneidung mit den Städten', () => {
    expect(KREISE).toHaveLength(294);
    const slugs = new Set([...STAEDTE, ...KREISE].map((s) => s.slug));
    expect(slugs.size).toBe(400);
    expect(KREISE.filter((s) => !/^[a-z0-9-]+$/.test(s.slug)).map((s) => s.slug)).toEqual([]);
  });
  it.each(KREISE.map((s) => [s.name, s] as const))('%s: Land, Lage, fünf Arten', (_, s) => {
    expect(landVon(s).code).toBe(s.land);
    expect(s.lat! > 47 && s.lat! < 55.1 && s.lon! > 5.8 && s.lon! < 15.1).toBe(true);
    expect(s.ausgabearten!.posten).toHaveLength(5);
    const gesamt = s.ausgabearten!.posten.reduce((x, p) => x + p.proKopf, 0);
    expect(gesamt).toBeGreaterThan(2000);
    expect(gesamt).toBeLessThan(9000);
  });
  it('Vergleich nur unter Landkreisen', () => {
    const v = ausgabeVergleich(KREISE.find((s) => s.slug === 'landkreis-wesermarsch')!)!;
    expect(v.vergleich).toMatch(/Landkreise$/);
    expect(v.schnitt).toHaveLength(5);
  });
});

describe('Ausgabearten der Stadtstaaten (Destatis 71711-08)', () => {
  const v = (slug: string) => ausgabeVergleich(STAEDTE.find((s) => s.slug === slug)!)!;
  it('Berlin: Summe der Arten ergibt die bereinigten Ausgaben je Einwohner', () => {
    const berlin = STAEDTE.find((s) => s.slug === 'berlin')!;
    const summe = v('berlin').posten.reduce((x, p) => x + p.proKopf, 0);
    expect(Math.abs(summe - (39_064 * 1e6) / berlin.einwohner)).toBeLessThan(5);
  });
  it('Bremen und Bremerhaven zeigen dasselbe Land Bremen', () => {
    expect(v('bremerhaven').posten).toEqual(v('bremen').posten);
    expect(v('bremerhaven').traeger).toBe('Land Bremen');
  });
  it('Vergleich nur unter den drei Stadtstaaten, der Schnitt liegt zwischen ihnen', () => {
    const werte = ['berlin', 'hamburg', 'bremen'].map((s) => v(s).posten[0].proKopf);
    expect(v('berlin').vergleich).toBe('der drei Stadtstaaten');
    expect(v('berlin').schnitt[0].proKopf).toBeGreaterThanOrEqual(Math.min(...werte));
    expect(v('berlin').schnitt[0].proKopf).toBeLessThanOrEqual(Math.max(...werte));
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
