// Textbausteine ohne DOM: auf der Seite beim Build und im Browser gleich.

/** Text für HTML-Kontexte (innerHTML, Tooltips) unschädlich machen */
export const esc = (s: string | number) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

/** Satz in Prozent ohne überflüssige Nachkommastellen: 0.425 → „42,5 %“, 0.15 → „15 %“ */
export const satzText = (v: number) => `${(v * 100).toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`;

/** Betrag ganzzahlig mit Tausenderpunkt: 101400 → „101.400 €“ */
export const fmtEur = (v: number) => `${Math.round(v).toLocaleString('de-DE')} €`;
