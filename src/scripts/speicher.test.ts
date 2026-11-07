// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gespeicherteStadt, ladeEingaben, speichereEingaben, speichereStadt, vergiss } from './speicher';

const formular = () => {
  document.body.innerHTML = `
    <input id="brutto" type="text" value="54.066">
    <input id="age" type="number" value="45">
    <input id="kinderlos" type="checkbox" checked>
    <select id="kist"><option value="0">keine</option><option value="0.08">8 %</option></select>`;
};
const el = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as T;

describe('Eingaben merken', () => {
  beforeEach(() => {
    localStorage.clear();
    formular();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('speichert Text, Zahl, Kontrollkästchen und lädt sie in ein frisches Formular', () => {
    el('brutto').value = '72.000';
    el('age').value = '30';
    el('kinderlos').checked = false;
    speichereEingaben(['brutto', 'age', 'kinderlos']);
    formular();
    ladeEingaben(['brutto', 'age', 'kinderlos']);
    expect(el('brutto').value).toBe('72.000');
    expect(el('age').value).toBe('30');
    expect(el('kinderlos').checked).toBe(false);
  });

  it('mischt gespeicherte Werte statt sie zu überschreiben (Startseite und Rentenseite)', () => {
    el('brutto').value = '60000';
    speichereEingaben(['brutto']);
    el('age').value = '50';
    speichereEingaben(['age']);
    formular();
    ladeEingaben(['brutto', 'age']);
    expect(el('brutto').value).toBe('60000');
    expect(el('age').value).toBe('50');
  });

  it('übernimmt einen Betrag mit Tausenderpunkt in ein Zahlenfeld', () => {
    el('brutto').value = '72.000';
    speichereEingaben(['brutto']);
    document.body.innerHTML = '<input id="brutto" type="number">';
    ladeEingaben(['brutto']);
    expect(el('brutto').value).toBe('72000');
  });

  it('nimmt den Kirchensteuersatz des neuen Landes, wenn vorher eine gewählt war', () => {
    localStorage.setItem('haushalts-check-eingaben', JSON.stringify({ kist: '0.09' }));
    ladeEingaben(['kist']);
    expect(el<HTMLSelectElement>('kist').value).toBe('0.08');
  });

  it('merkt die Stadt und vergisst alles auf Wunsch', () => {
    speichereStadt('muenchen');
    expect(gespeicherteStadt()).toBe('muenchen');
    vergiss();
    expect(gespeicherteStadt()).toBeNull();
  });

  it.each(['null', '42', '"text"', '[1,2]', '{kaputt'])('ignoriert beschädigten Speicherinhalt %s', (inhalt) => {
    localStorage.setItem('haushalts-check-eingaben', inhalt);
    expect(() => ladeEingaben(['brutto'])).not.toThrow();
    expect(el('brutto').value).toBe('54.066');
    expect(gespeicherteStadt()).toBeNull();
  });

  it('funktioniert ohne Speicher (z. B. privates Fenster) ohne Fehler', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => speichereEingaben(['brutto'])).not.toThrow();
    expect(() => ladeEingaben(['brutto'])).not.toThrow();
    expect(gespeicherteStadt()).toBeNull();
  });
});
