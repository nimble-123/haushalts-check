import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { alsText, entpacke, felder, pruefe, slugify, zahl, zuAgs } from './helfer';

/** Minimales ZIP mit einer Datei (Methode 0 = gespeichert, 8 = deflate), wie es GENESIS liefert */
function zip(inhalt: string, methode: 0 | 8 = 8, name = 'daten.csv'): Buffer {
  const roh = Buffer.from(inhalt, 'utf8');
  const daten = methode === 8 ? deflateRawSync(roh) : roh;
  const n = Buffer.from(name);
  const lokal = Buffer.alloc(30);
  lokal.writeUInt32LE(0x04034b50, 0);
  lokal.writeUInt16LE(methode, 8);
  lokal.writeUInt32LE(daten.length, 18);
  lokal.writeUInt32LE(roh.length, 22);
  lokal.writeUInt16LE(n.length, 26);
  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(methode, 10);
  cd.writeUInt32LE(daten.length, 20);
  cd.writeUInt32LE(roh.length, 24);
  cd.writeUInt16LE(n.length, 28);
  cd.writeUInt32LE(0, 42); // Offset des lokalen Kopfs
  const cdStart = lokal.length + n.length + daten.length;
  const ende = Buffer.alloc(22);
  ende.writeUInt32LE(0x06054b50, 0);
  ende.writeUInt16LE(1, 8);
  ende.writeUInt16LE(1, 10);
  ende.writeUInt32LE(cd.length + n.length, 12);
  ende.writeUInt32LE(cdStart, 16);
  return Buffer.concat([lokal, n, daten, cd, n, ende]);
}

describe('slugify', () => {
  it.each([
    ['Frankfurt am Main', 'frankfurt-am-main'],
    ['Mülheim an der Ruhr', 'muelheim-an-der-ruhr'],
    ['Gießen', 'giessen'],
    ['Halle (Saale)', 'halle-saale'],
    ['Zweibrücken', 'zweibruecken'],
    ['Øresund – Café', 'resund-cafe'],
  ])('%s → %s', (ein, aus) => {
    expect(slugify(ein)).toBe(aus);
  });
});

describe('felder (CSV mit Semikolon)', () => {
  it('trennt einfache Zeilen und behält leere Felder', () => {
    expect(felder('a;;c;')).toEqual(['a', '', 'c', '']);
  });
  it('lässt Semikolon in Anführungszeichen stehen und liest doppelte Anführungszeichen als eines', () => {
    expect(felder('"Soziale Leistungen; netto";"sagt ""ja""";3')).toEqual([
      'Soziale Leistungen; netto',
      'sagt "ja"',
      '3',
    ]);
  });
});

describe('zahl (deutsche Schreibweise)', () => {
  it.each([
    ['1.234.567,5', 1_234_567.5],
    ['12,25', 12.25],
    ['-3', -3],
    [' 42 ', 42],
    ['-', 0],
  ])('%s → %d', (ein, aus) => {
    expect(zahl(ein)).toBe(aus);
  });
  it.each(['.', '...', '/', 'x', '', '1.23'])('„%s“ ist kein Wert', (ein) => {
    expect(zahl(ein)).toBeNull();
  });
});

describe('zuAgs', () => {
  it('macht aus dem Gemeinde-Schlüssel einer kreisfreien Stadt den Kreisschlüssel', () => {
    expect(zuAgs('F03403000000000')).toBe('03403');
  });
  it('lässt andere Schlüssel unverändert', () => {
    expect(zuAgs('F03403000001234')).toBe('F03403000001234');
    expect(zuAgs('03403')).toBe('03403');
    expect(zuAgs(undefined)).toBe('');
  });
});

describe('entpacke und alsText', () => {
  const csv = 'statistics_code;time;value\n71717;2025;1,5\n';
  it('liest gespeicherte und komprimierte Archive', () => {
    expect(entpacke(zip(csv, 0)).toString('utf8')).toBe(csv);
    expect(entpacke(zip(csv, 8)).toString('utf8')).toBe(csv);
  });
  it('erkennt ZIP am Kopf, sonst Text; entfernt das BOM', () => {
    expect(alsText(zip(`﻿${csv}`))).toBe(csv);
    expect(alsText(Buffer.from(`﻿${csv}`))).toBe(csv);
  });
  it('lehnt Daten ohne Inhaltsverzeichnis ab', () => {
    expect(() => entpacke(Buffer.from('kein zip, sondern eine Fehlerseite vom Server'))).toThrow(/Inhaltsverzeichnis/);
  });
});

describe('pruefe', () => {
  it('bricht mit den Angaben ab, wenn die Prüfung fehlschlägt', () => {
    expect(() => pruefe(false, 'Bayern', 12.5)).toThrow('Prüfung fehlgeschlagen: ["Bayern",12.5]');
    expect(() => pruefe(true, 'egal')).not.toThrow();
  });
});
