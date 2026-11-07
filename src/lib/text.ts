// Textbausteine ohne DOM: auf der Seite beim Build und im Browser gleich.

/** Text für HTML-Kontexte (innerHTML, Tooltips) unschädlich machen */
export const esc = (s: string | number) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

/** Satz in Prozent ohne überflüssige Nachkommastellen: 0.425 → „42,5 %“, 0.15 → „15 %“ */
export const satzText = (v: number) => `${(v * 100).toLocaleString('de-DE', { maximumFractionDigits: 2 })}\u00a0%`;

/** Betrag ganzzahlig mit Tausenderpunkt: 101400 → „101.400 €“ */
export const fmtEur = (v: number) => `${Math.round(v).toLocaleString('de-DE')}\u00a0€`;

const zahl1 = (v: number) => v.toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

/** Milliarden mit einer Nachkommastelle: 524.5 → „524,5 Mrd €“ */
export const fmtMrd = (v: number) => `${zahl1(v)}\u00a0Mrd\u00a0€`;

/** Veränderung in Milliarden mit echtem Plus- und Minuszeichen: −3.2 → „−3,2 Mrd €“ */
export const fmtMrdDelta = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtMrd(Math.abs(v))}`;

/** Anteil mit einer Nachkommastelle: 0.425 → „42,5 %“ */
export const pct = (v: number) => `${zahl1(v * 100)}\u00a0%`;

/** Zeitraum zur gewählten Einheit */
export const zeitraum = (einheit: 'm' | 'y') => (einheit === 'm' ? 'pro Monat' : 'pro Jahr');

/** Betrag aus einem Eingabefeld: nur Ziffern zählen („54.066 €“ → 54066), höchstens 9.999.999 */
export const leseBetrag = (s: string) => Math.min(9_999_999, parseInt(s.replace(/\D/g, ''), 10) || 0);

/** Betrag fürs Eingabefeld mit Tausenderpunkten, 0 als leeres Feld */
export const schreibeBetrag = (v: number) => (v ? v.toLocaleString('de-DE') : '');
