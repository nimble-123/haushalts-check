import * as d3 from 'd3';
import { sankey, sankeyJustify, sankeyLinkHorizontal } from 'd3-sankey';

type Svg = d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;

export const $ = (sel: string) => document.querySelector(sel) as HTMLElement;
export const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const fmtMrd = (v: number) => v.toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ' Mrd €';
export const fmtEur = (v: number) => Math.round(v).toLocaleString('de-DE') + ' €';
export const pct = (v: number) => (v * 100).toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ' %';

/** Innenbreite des Panels, in dem das SVG steckt */
export function width(svg: d3.Selection<SVGSVGElement, unknown, any, any>) {
  const box = (svg.node()!.closest('.panel') ?? svg.node()!.parentElement!) as HTMLElement;
  const cs = getComputedStyle(box);
  return Math.max(280, box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
}

/** Leert ein SVG, behält aber <defs> (Schraffur) */
export function clear(svg: d3.Selection<SVGSVGElement, unknown, any, any>) {
  svg.selectChildren(':not(defs)').remove();
}

/** Schraffur für die Sozialversicherung: Soziales-Blau, 45°, nicht über einen Haushalt */
export function hatch(svg: d3.Selection<SVGSVGElement, unknown, any, any>, key: string) {
  const id = 'hatch-' + key;
  let defs = svg.select<SVGDefsElement>('defs');
  if (defs.empty()) defs = svg.insert('defs', ':first-child');
  defs.select('#' + id).remove();
  const blue = css('--cat-sv');
  const p = defs.append('pattern').attr('id', id).attr('patternUnits', 'userSpaceOnUse').attr('width', 5).attr('height', 5).attr('patternTransform', 'rotate(45)');
  p.append('rect').attr('width', 5).attr('height', 5).attr('fill', css('--surface'));
  p.append('rect').attr('width', 2).attr('height', 5).attr('fill', blue);
  return `url(#${id})`;
}

const tip = () => document.getElementById('tip')!;
export function showTip(e: MouseEvent, html: string) {
  const t = tip();
  t.innerHTML = html;
  t.style.opacity = '1';
  t.style.left = Math.min(e.clientX + 14, innerWidth - 290) + 'px';
  t.style.top = e.clientY + 14 + 'px';
}
export const hideTip = () => (tip().style.opacity = '0');

interface SankeyOpt {
  h: number;
  fmt: (v: number) => string;
  share?: (d: any) => string;
  align?: (d: any) => number;
  minW?: number;
  mr?: number;
  pad?: number;
}

export function drawSankey(svg: Svg, nodes: any[], links: any[], opt: SankeyOpt) {
  clear(svg);
  const box = svg.node()!.parentElement!.clientWidth;
  const W = Math.max(box, opt.minW ?? 760), H = opt.h;
  svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const sk = sankey<any, any>().nodeId((d) => d.id).nodeWidth(12).nodePadding(opt.pad ?? 9)
    .nodeAlign((opt.align as any) ?? sankeyJustify).nodeSort(null as any)
    .extent([[4, 6], [W - (opt.mr ?? 190), H - 6]]);
  const g = sk({ nodes: nodes.map((d) => ({ ...d })), links: links.map((d) => ({ ...d })) });
  const surface = css('--surface');

  svg.append('g').attr('fill', 'none').selectAll('path').data(g.links).join('path')
    .attr('d', sankeyLinkHorizontal())
    .attr('stroke', (d: any) => d.color || d.target.color)
    .attr('stroke-opacity', 0.32)
    .attr('stroke-width', (d: any) => Math.max(1, d.width))
    .on('mousemove', (e: MouseEvent, d: any) => showTip(e, `<b>${d.source.label} → ${d.target.label}</b>${opt.fmt(d.value)}`))
    .on('mouseenter', function () { d3.select(this).attr('stroke-opacity', 0.6); })
    .on('mouseleave', function () { d3.select(this).attr('stroke-opacity', 0.32); hideTip(); });

  const nd = svg.append('g').selectAll('g').data(g.nodes).join('g');
  nd.append('rect').attr('x', (d: any) => d.x0).attr('y', (d: any) => d.y0).attr('width', (d: any) => d.x1 - d.x0)
    .attr('height', (d: any) => Math.max(1.5, d.y1 - d.y0)).attr('rx', 2).attr('fill', (d: any) => d.color)
    .on('mousemove', (e: MouseEvent, d: any) => showTip(e, `<b>${d.label}</b>${opt.fmt(d.value)}${opt.share ? '<br>' + opt.share(d) : ''}`))
    .on('mouseleave', hideTip);
  const tall = (d: any) => d.y1 - d.y0 >= 18;
  nd.append('text').attr('x', (d: any) => d.x1 + 6).attr('y', (d: any) => (d.y0 + d.y1) / 2 - (tall(d) ? 7 : 0)).attr('dy', '.35em')
    .text((d: any) => d.label).style('font-weight', (d: any) => (d.bold ? 600 : 400))
    .style('paint-order', 'stroke').style('stroke', surface).style('stroke-width', 3).style('pointer-events', 'none');
  nd.filter(tall).append('text').attr('class', 'val').attr('x', (d: any) => d.x1 + 6).attr('y', (d: any) => (d.y0 + d.y1) / 2 + 8).attr('dy', '.35em')
    .text((d: any) => opt.fmt(d.value))
    .style('paint-order', 'stroke').style('stroke', surface).style('stroke-width', 3).style('pointer-events', 'none');
}
