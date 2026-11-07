import { describe, expect, it } from 'vitest';
import { esc, fmtEur, fmtMrd, fmtMrdDelta, pct, satzText, zeitraum } from './text';

const nb = (s: string) => s.replace(/ /g, ' ');

describe('Formatierung', () => {
  it('Beträge und Anteile deutsch, Einheit nie allein am Zeilenanfang', () => {
    expect(fmtEur(101_400.4)).toBe(nb('101.400 €'));
    expect(fmtMrd(524.46)).toBe(nb('524,5 Mrd €'));
    expect(pct(0.4249)).toBe(nb('42,5 %'));
    expect(satzText(0.15)).toBe(nb('15 %'));
  });
  it('Veränderungen mit echtem Plus- und Minuszeichen', () => {
    expect(fmtMrdDelta(27)).toBe(nb('+27,0 Mrd €'));
    expect(fmtMrdDelta(-3.21)).toBe(nb('−3,2 Mrd €'));
    expect(fmtMrdDelta(0)).toBe(nb('0,0 Mrd €'));
  });
  it('Zeitraum zur Einheit', () => {
    expect(zeitraum('m')).toBe('pro Monat');
    expect(zeitraum('y')).toBe('pro Jahr');
  });
  it('esc entschärft HTML', () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});
