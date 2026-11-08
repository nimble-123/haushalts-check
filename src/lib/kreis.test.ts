import { describe, expect, it } from 'vitest';
import type { Stadt } from '../data/types';
import { gemeindenVon, imOrt, kreisFormen } from './kreis';

const kreis = (name: string) => ({ name, kreis: true }) as Stadt;

describe('Namen von Kreisen im Satz', () => {
  it('Landkreis', () => {
    expect(imOrt(kreis('Landkreis Wesermarsch'))).toBe('im Landkreis Wesermarsch');
    expect(gemeindenVon(kreis('Landkreis Wesermarsch'))).toBe('die Gemeinden im Landkreis Wesermarsch');
    expect(kreisFormen('Landkreis Wesermarsch').nom).toBe('der Landkreis Wesermarsch');
  });
  it('Region und Städteregion sind weiblich', () => {
    expect(imOrt(kreis('Region Hannover'))).toBe('in der Region Hannover');
    expect(kreisFormen('Städteregion Aachen').sein).toBe('ihre');
  });
  it('„Oberbergischer Kreis“ wird gebeugt', () => {
    expect(kreisFormen('Oberbergischer Kreis')).toMatchObject({
      nom: 'der Oberbergische Kreis',
      akk: 'den Oberbergischen Kreis',
      im: 'im Oberbergischen Kreis',
    });
  });
  it('Städte bleiben unverändert', () => {
    const s = { name: 'Oldenburg (Oldenburg)' } as Stadt;
    expect(imOrt(s)).toBe('in Oldenburg (Oldenburg)');
    expect(gemeindenVon(s)).toBe('Oldenburg (Oldenburg)');
  });
});
