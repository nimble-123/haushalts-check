import * as d3 from 'd3';
import { type SankeyLink, type SankeyNode, sankey, sankeyJustify, sankeyLinkHorizontal } from 'd3-sankey';

/** Ein SVG, unabhängig davon, wie es ausgewählt wurde */
export type Svg = d3.Selection<SVGSVGElement, unknown, d3.BaseType, unknown>;

/** Knoten und Verbindungen, wie die Diagramme sie übergeben */
export interface Knoten {
  id: string;
  label: string;
  color: string;
  bold?: boolean;
  /** Spalte, falls die Knoten fest ausgerichtet werden */
  col?: number;
}
export interface Verbindung {
  source: string;
  target: string;
  value: number;
  color?: string;
}
export type SKnoten = SankeyNode<Knoten, Verbindung>;
type SVerbindung = SankeyLink<Knoten, Verbindung> & { source: SKnoten; target: SKnoten; width?: number };
/** Knoten nach dem Layout: Position und Wert sind gesetzt */
type Gelegt = SKnoten & { x0: number; x1: number; y0: number; y1: number; value: number };

/**
 * Element per ID mit Typprüfung. Fehlt es oder hat es einen anderen Typ, passen Seite und Skript nicht
 * zusammen; das soll sofort auffallen statt später als „undefined“.
 */
export function holen<T extends HTMLElement = HTMLElement>(
  id: string,
  typ: abstract new (...args: never[]) => T = HTMLElement as unknown as abstract new (
    ...args: never[]
  ) => T,
): T {
  const e = document.getElementById(id);
  if (!(e instanceof typ)) throw new Error(`#${id} fehlt oder ist kein ${typ.name}`);
  return e;
}
export const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

import { esc, fmtEur, fmtMrd, pct } from '../lib/text';

export { esc, fmtEur, fmtMrd, pct };

/** Innenbreite des Panels, in dem das SVG steckt */
export function width(svg: Svg) {
  const box = (svg.node()!.closest('.rs-panel') ?? svg.node()!.parentElement!) as HTMLElement;
  const cs = getComputedStyle(box);
  return Math.max(280, box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
}

/** Leert ein SVG, behält aber <defs> (Schraffur) */
export function clear(svg: Svg) {
  svg.selectChildren(':not(defs)').remove();
}

/** Schraffur für die Sozialversicherung: Soziales-Blau, 45°, nicht über einen Haushalt */
/** Schraffur als SVG-Muster: Sozialversicherung (cat-sv, 45°), geschätzte Konsumsteuern (ink, −45°) */
export function hatch(svg: Svg, key: string, farbe = '--cat-sv', winkel = 45) {
  const id = `hatch-${key}`;
  let defs = svg.select<SVGDefsElement>('defs');
  if (defs.empty()) defs = svg.insert('defs', ':first-child');
  defs.select(`#${id}`).remove();
  const strich = css(farbe);
  const p = defs
    .append('pattern')
    .attr('id', id)
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 5)
    .attr('height', 5)
    .attr('patternTransform', `rotate(${winkel})`);
  p.append('rect').attr('width', 5).attr('height', 5).attr('fill', css('--surface'));
  p.append('rect').attr('width', 2).attr('height', 5).attr('fill', strich);
  return `url(#${id})`;
}

const tip = () => document.getElementById('tip')!;
export function showTip(e: MouseEvent, html: string) {
  const t = tip();
  t.innerHTML = html;
  t.style.opacity = '1';
  t.style.left = `${Math.min(e.clientX + 14, innerWidth - 290)}px`;
  t.style.top = `${e.clientY + 14}px`;
}
export const hideTip = () => {
  tip().style.opacity = '0';
};

interface SankeyOpt {
  h: number;
  fmt: (v: number) => string;
  share?: (d: SKnoten) => string;
  align?: (d: SKnoten, n: number) => number;
  minW?: number;
  mr?: number;
  pad?: number;
}

export function drawSankey(svg: Svg, nodes: Knoten[], links: Verbindung[], opt: SankeyOpt) {
  clear(svg);
  const box = svg.node()!.parentElement!.clientWidth;
  const W = Math.max(box, opt.minW ?? 760),
    H = opt.h;
  svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const sk = sankey<Knoten, Verbindung>()
    .nodeId((d) => d.id)
    .nodeWidth(12)
    .nodePadding(opt.pad ?? 9)
    .nodeAlign(opt.align ?? sankeyJustify)
    // null = Reihenfolge der Eingabe behalten (die Typdefinition kennt nur Funktionen)
    .nodeSort(null as unknown as (a: SKnoten, b: SKnoten) => number)
    .extent([
      [4, 6],
      [W - (opt.mr ?? 190), H - 6],
    ]);
  const g = sk({ nodes: nodes.map((d) => ({ ...d })), links: links.map((d) => ({ ...d })) });
  const links_ = g.links as SVerbindung[];
  const knoten_ = g.nodes as Gelegt[];
  const surface = css('--surface');
  // Bänder deckender im Dunkeln, weil dunkle Farben auf dunklem Grund sonst verschwinden
  const dunkel = getComputedStyle(document.documentElement).colorScheme === 'dark';
  const deckkraft = dunkel ? 0.55 : 0.45;
  const verw = css('--cat-verw'),
    linie = css('--line');

  svg
    .append('g')
    .attr('fill', 'none')
    .selectAll('path')
    .data(links_)
    .join('path')
    .attr('d', sankeyLinkHorizontal())
    .attr('stroke', (d) => d.color || d.target.color)
    .attr('stroke-opacity', deckkraft)
    .attr('stroke-width', (d) => Math.max(1, d.width ?? 1))
    .on('mousemove', (e: MouseEvent, d) =>
      showTip(e, `<b>${esc(d.source.label)} → ${esc(d.target.label)}</b>${opt.fmt(d.value)}`),
    )
    .on('mouseenter', function () {
      d3.select(this).attr('stroke-opacity', 0.75);
    })
    .on('mouseleave', function () {
      d3.select(this).attr('stroke-opacity', deckkraft);
      hideTip();
    });

  const nd = svg.append('g').selectAll('g').data(knoten_).join('g');
  nd.append('rect')
    .attr('x', (d: Gelegt) => d.x0)
    .attr('y', (d: Gelegt) => d.y0)
    .attr('width', (d: Gelegt) => d.x1 - d.x0)
    .attr('height', (d: Gelegt) => Math.max(1.5, d.y1 - d.y0))
    .attr('rx', 2)
    .attr('fill', (d: Gelegt) => d.color)
    // Verwaltungsgrau hebt sich kaum von der Fläche ab: feine Kontur als zweites Merkmal
    .attr('stroke', (d: Gelegt) => (d.color === verw ? linie : null))
    .attr('stroke-width', 1)
    .on('mousemove', (e: MouseEvent, d: Gelegt) =>
      showTip(e, `<b>${esc(d.label)}</b>${opt.fmt(d.value)}${opt.share ? `<br>${opt.share(d)}` : ''}`),
    )
    .on('mouseleave', hideTip);
  const tall = (d: Gelegt) => d.y1 - d.y0 >= 18;
  nd.append('text')
    .attr('x', (d: Gelegt) => d.x1 + 6)
    .attr('y', (d: Gelegt) => (d.y0 + d.y1) / 2 - (tall(d) ? 7 : 0))
    .attr('dy', '.35em')
    .text((d: Gelegt) => d.label)
    .style('font-weight', (d: Gelegt) => (d.bold ? 600 : 400))
    .style('paint-order', 'stroke')
    .style('stroke', surface)
    .style('stroke-width', 3)
    .style('pointer-events', 'none');
  nd.filter(tall)
    .append('text')
    .attr('class', 'val')
    .attr('x', (d: Gelegt) => d.x1 + 6)
    .attr('y', (d: Gelegt) => (d.y0 + d.y1) / 2 + 8)
    .attr('dy', '.35em')
    .text((d: Gelegt) => opt.fmt(d.value))
    .style('paint-order', 'stroke')
    .style('stroke', surface)
    .style('stroke-width', 3)
    .style('pointer-events', 'none');
}

// ---------- Bausteine für die Diagramme ----------

/** Innenränder eines Diagramms in px */
export interface Raender {
  l: number;
  r: number;
  t: number;
  b: number;
}

/**
 * Zeichenfläche: leert das SVG (Muster in <defs> bleiben), nimmt die Breite des Panels und setzt die Höhe,
 * die von Breite und „schmal“ (Handy) abhängen darf.
 */
export function rahmen(id: string, hoehe: (W: number, schmal: boolean) => number, schmalAb = 560) {
  const svg = d3.select<SVGSVGElement, unknown>(`#${id}`);
  clear(svg);
  const W = width(svg),
    schmal = W < schmalAb,
    H = hoehe(W, schmal);
  svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  return { svg, W, H, schmal };
}

/** Waagrechte Hilfslinien an den Teilstrichen der y-Achse */
export function gitterY(svg: Svg, y: d3.ScaleLinear<number, number>, x1: number, x2: number, anzahl: number) {
  svg
    .append('g')
    .attr('class', 'grid')
    .selectAll('line')
    .data(y.ticks(anzahl))
    .join('line')
    .attr('x1', x1)
    .attr('x2', x2)
    .attr('y1', (d) => y(d))
    .attr('y2', (d) => y(d));
}

/** y-Achse links ohne Achsenlinie und ohne Striche, nur Beschriftung */
export function achseY(
  svg: Svg,
  y: d3.ScaleLinear<number, number>,
  links: number,
  anzahl: number,
  format: (v: d3.NumberValue) => string,
) {
  svg
    .append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(${links},0)`)
    .call(d3.axisLeft(y).ticks(anzahl).tickFormat(format).tickSize(0))
    .select('.domain')
    .remove();
}

/**
 * Senkrechte Linie, die der Maus folgt, und Tooltip. `an` bekommt die Mausposition und liefert
 * die Lage der Linie (eingerastet) und den Tooltip-Inhalt.
 */
export function fadenkreuz(
  svg: Svg,
  m: Raender,
  W: number,
  H: number,
  an: (mx: number) => { x: number; html: string },
) {
  const linie = svg
    .append('line')
    .attr('y1', m.t)
    .attr('y2', H - m.b)
    .attr('stroke', css('--ink-2'))
    .style('opacity', 0);
  svg
    .append('rect')
    .attr('x', m.l)
    .attr('y', m.t)
    .attr('width', W - m.l - m.r)
    .attr('height', H - m.t - m.b)
    .attr('fill', 'transparent')
    .on('mousemove', (ev) => {
      const [mx] = d3.pointer(ev);
      const { x, html } = an(mx);
      linie.attr('x1', x).attr('x2', x).style('opacity', 1);
      showTip(ev, html);
    })
    .on('mouseleave', () => {
      linie.style('opacity', 0);
      hideTip();
    });
}

/** Maße einer Balkenzeile: auf dem Handy steht der Name über dem Balken, sonst links davor */
export function balkenMasse(schmal: boolean, labelBreite: number, balkenOben: number) {
  return { by: schmal ? 17 : balkenOben, bh: schmal ? 13 : 15, labW: schmal ? 0 : labelBreite, schmal };
}

/** Je Datensatz eine Zeile (<g>) für waagrechte Balken, dazu eine Funktion für den Namen der Zeile */
export function balkenZeilen<T>(
  svg: Svg,
  daten: readonly T[],
  mass: ReturnType<typeof balkenMasse>,
  o: { zeile: number; oben: number; klasse: string },
) {
  const { by, bh, labW, schmal } = mass;
  const g = svg
    .selectAll<SVGGElement, T>(`g.${o.klasse}`)
    .data(daten)
    .join('g')
    .attr('class', o.klasse)
    .attr('transform', (_, i) => `translate(0,${o.oben + i * o.zeile})`);
  /** `durchlaessig` lässt die Maus zur Trefferfläche unter dem Namen durch */
  const beschriften = (name: (d: T) => string, durchlaessig = false) => {
    const t = g
      .append('text')
      .attr('x', schmal ? 0 : labW - 10)
      .attr('y', schmal ? 11 : by + bh / 2)
      .attr('dy', schmal ? 0 : '.35em')
      .attr('text-anchor', schmal ? 'start' : 'end')
      .text(name);
    if (durchlaessig) t.style('pointer-events', 'none');
  };
  return { g, beschriften };
}
