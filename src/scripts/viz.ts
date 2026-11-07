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

export const $ = (sel: string) => document.querySelector(sel) as HTMLElement;
export const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const fmtMrd = (v: number) =>
  `${v.toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} Mrd €`;
export const fmtEur = (v: number) => `${Math.round(v).toLocaleString('de-DE')} €`;
export const pct = (v: number) =>
  `${(v * 100).toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`;

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
export function hatch(svg: Svg, key: string) {
  const id = `hatch-${key}`;
  let defs = svg.select<SVGDefsElement>('defs');
  if (defs.empty()) defs = svg.insert('defs', ':first-child');
  defs.select(`#${id}`).remove();
  const blue = css('--cat-sv');
  const p = defs
    .append('pattern')
    .attr('id', id)
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 5)
    .attr('height', 5)
    .attr('patternTransform', 'rotate(45)');
  p.append('rect').attr('width', 5).attr('height', 5).attr('fill', css('--surface'));
  p.append('rect').attr('width', 2).attr('height', 5).attr('fill', blue);
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

  svg
    .append('g')
    .attr('fill', 'none')
    .selectAll('path')
    .data(links_)
    .join('path')
    .attr('d', sankeyLinkHorizontal())
    .attr('stroke', (d) => d.color || d.target.color)
    .attr('stroke-opacity', 0.32)
    .attr('stroke-width', (d) => Math.max(1, d.width ?? 1))
    .on('mousemove', (e: MouseEvent, d) =>
      showTip(e, `<b>${d.source.label} → ${d.target.label}</b>${opt.fmt(d.value)}`),
    )
    .on('mouseenter', function () {
      d3.select(this).attr('stroke-opacity', 0.6);
    })
    .on('mouseleave', function () {
      d3.select(this).attr('stroke-opacity', 0.32);
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
    .on('mousemove', (e: MouseEvent, d: Gelegt) =>
      showTip(e, `<b>${d.label}</b>${opt.fmt(d.value)}${opt.share ? `<br>${opt.share(d)}` : ''}`),
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
