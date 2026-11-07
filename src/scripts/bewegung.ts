// Bewegung zeigt, was sich ändert: Nach einer Eingabe gleiten Diagramme und Kennzahlen vom alten zum
// neuen Stand, statt zu springen. Die Diagramme zeichnen weiter jedes Mal neu; dieses Modul merkt sich
// vorher die Lage aller Elemente mit `data-k` und lässt die neuen Elemente von dort aus übergehen.
import * as d3 from 'd3';

export const wenigBewegung = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const dauer = (name: string) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;

/** Attribute, die gleiten dürfen; Farben und Texte wechseln sofort */
const LAGE = ['x', 'y', 'width', 'height', 'd', 'cx', 'cy', 'x1', 'x2', 'y1', 'y2', 'transform'];
type Lage = Map<string, Record<string, string>>;

let aktiv = false;
const vorher = new Map<SVGSVGElement, Lage>();

/**
 * Führt `zeichnen` aus; alles, was darin neu gezeichnet wird, gleitet vom alten Stand aus. Nur für
 * Eingaben der Person, nicht für Größenänderung, Thema oder das erste Zeichnen.
 */
export function mitUebergang(zeichnen: () => void) {
  aktiv = !wenigBewegung();
  try {
    zeichnen();
  } finally {
    aktiv = false;
    for (const [svg, lage] of vorher) gleiten(svg, lage);
    vorher.clear();
  }
}

/** Vor dem Leeren eines SVG aufrufen: merkt sich die Lage der benannten Elemente */
export function merken(svg: SVGSVGElement) {
  if (!aktiv) return;
  const lage: Lage = new Map();
  for (const el of svg.querySelectorAll<SVGElement>('[data-k]')) {
    const werte: Record<string, string> = {};
    for (const a of LAGE) {
      const v = el.getAttribute(a);
      if (v !== null) werte[a] = v;
    }
    lage.set(el.dataset.k!, werte);
  }
  vorher.set(svg, lage);
  d3.select(svg).selectAll('*').interrupt('wechsel');
}

/** Zahl der Zahlen in einem Pfad: nur bei gleicher Form kann d3 sinnvoll zwischen zwei Pfaden gleiten */
const zahlen = (d: string) => d.match(/-?[\d.]+(e-?\d+)?/g)?.length ?? 0;

function gleiten(svg: SVGSVGElement, lage: Lage) {
  const t = d3.transition('wechsel').duration(dauer('--dauer-wechsel')).ease(d3.easeCubicOut);
  for (const el of svg.querySelectorAll<SVGElement>('[data-k]')) {
    const alt = lage.get(el.dataset.k!);
    const sel = d3.select(el);
    if (!alt) {
      // Neu hinzugekommen: Flächen blenden ein, Beschriftungen stehen sofort (Kontrast bleibt prüfbar)
      if (el.tagName !== 'text' && !el.querySelector('text'))
        sel.style('opacity', 0).transition(t).duration(dauer('--dauer-einblenden')).style('opacity', null);
      continue;
    }
    const tr = sel.transition(t);
    for (const [a, v] of Object.entries(alt)) {
      const neu = el.getAttribute(a);
      if (neu === null || neu === v || (a === 'd' && zahlen(neu) !== zahlen(v))) continue;
      sel.attr(a, v);
      tr.attr(a, neu);
    }
  }
}

/**
 * Kennzahlen zählen vom alten zum neuen Betrag. `setzen` schreibt das neue HTML; Zahlen darin stehen in
 * Elementen mit `data-v` (Rohwert) und werden mit `fmt` formatiert.
 */
export function zaehlen(box: HTMLElement, setzen: () => void, fmt: (v: number) => string) {
  const alt = [...box.querySelectorAll<HTMLElement>('[data-v]')].map((e) => +e.dataset.v!);
  const lief = aktiv;
  setzen();
  if (!lief) return;
  const ziele = [...box.querySelectorAll<HTMLElement>('[data-v]')];
  if (ziele.length !== alt.length) return;
  const ms = dauer('--dauer-wechsel');
  const start = performance.now();
  const schritt = (jetzt: number) => {
    const p = Math.min(1, (jetzt - start) / ms);
    const e = d3.easeCubicOut(p);
    for (const [i, el] of ziele.entries()) {
      if (!el.isConnected) return;
      const ziel = +el.dataset.v!;
      el.textContent = fmt(alt[i] + (ziel - alt[i]) * e);
    }
    if (p < 1) requestAnimationFrame(schritt);
  };
  requestAnimationFrame(schritt);
}
