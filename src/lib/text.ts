// Textbausteine ohne DOM: auf der Seite beim Build und im Browser gleich.

/** Text für HTML-Kontexte (innerHTML, Tooltips) unschädlich machen */
export const esc = (s: string | number) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

export const fmtEur = (v: number) => `${Math.round(v).toLocaleString('de-DE')} €`;
