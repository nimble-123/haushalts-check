// Eingabefeld für Euro-Beträge mit Tausenderpunkten, auf Startseite und Rentenseite gleich.
import { leseBetrag, schreibeBetrag } from '../lib/text';

/**
 * Formatiert das Feld sofort; beim Tippen bleiben nur Ziffern und Punkte, beim Verlassen kommen die
 * Tausenderpunkte. Ein Klick markiert alles, damit Tippen den Betrag ersetzt statt Ziffern einzufügen.
 * Vor den übrigen input-Listenern aufrufen, damit diese schon den bereinigten Wert sehen.
 */
export function betragsfeld(feld: HTMLInputElement) {
  feld.value = schreibeBetrag(leseBetrag(feld.value));
  feld.addEventListener('input', () => {
    const sauber = feld.value.replace(/[^\d.]/g, '');
    if (sauber !== feld.value) feld.value = sauber;
  });
  feld.addEventListener('change', () => {
    feld.value = schreibeBetrag(leseBetrag(feld.value));
  });
  feld.addEventListener('focus', () => feld.select());
}
