import * as d3 from 'd3';
import { BUND_GESAMT, EINNAHMEN, EINZELPLAENE, ENTWICKLUNG, ENTWURF_2027, ENTWURF_2027_GESAMT } from '../data/bund';
import { type GemeindeEbene, GRUPPEN, type Gruppe, type Land, type Stadt } from '../data/types';
import { naechsteStadt, type Ort } from '../lib/naehe';
import { aufEbenen, berechne, type Eingabe, type Ergebnis, summeAbgaben, summeSV } from '../lib/steuer';
import { gespeicherteStadt, ladeEingaben, speichereEingaben, speichereStadt, vergiss } from './speicher';
import {
  $,
  clear,
  css,
  drawSankey,
  esc,
  fmtEur,
  fmtMrd,
  hatch,
  hideTip,
  type Knoten,
  pct,
  type SKnoten,
  showTip,
  type Verbindung,
  width,
} from './viz';

interface P {
  name: string;
  v: number;
  g: Gruppe;
  rest?: boolean;
}

let stadt: Stadt,
  land: Land,
  gem: GemeindeEbene,
  LAND_T = 0,
  GEM_T = 0;
interface Arten {
  jahr: number;
  vorlaeufig: boolean;
  posten: { name: string; proKopf: number }[];
  schnitt: { name: string; proKopf: number }[];
  anzahl: number;
}
let arten: Arten | null = null;
let unit: 'y' | 'm' = 'm'; // nur Kapitel 2; Einstieg und Kapitel 1 rechnen jährlich
let bundAnsicht: 'fluss' | 'flaeche' = 'fluss';

const gcol = (g: Gruppe) => css(`--cat-${g}`);
const KIRCHE = () => css('--line');
const sum = (a: { v: number }[]) => a.reduce((s, x) => s + x.v, 0);
function topOf(arr: P[], n: number): P[] {
  const s = [...arr].sort((a, b) => b.v - a.v);
  const top = s.slice(0, n),
    rest = s.slice(n);
  return rest.length ? [...top, { name: `Übrige (${rest.length})`, v: sum(rest), g: 'verw', rest: true }] : top;
}
const epl = (n: number) =>
  topOf(
    EINZELPLAENE.map((e) => ({ name: `EP ${e.n} ${e.name}`, v: e.v, g: e.g })),
    n,
  );
const legendGruppen = () =>
  Object.entries(GRUPPEN)
    .map(
      ([k, l]) =>
        `<li><span class="rs-farbe" style="background:${gcol(k as Gruppe)}${k === 'verw' ? ';box-shadow:inset 0 0 0 1px var(--line)' : ''}"></span>${esc(l)}</li>`,
    )
    .join('');
const legendSV = `<li><span class="rs-farbe rs-hatch"></span>Sozialversicherung</li>`;
const legendSchaetzung = () =>
  gem.schaetzung ? `<li>≈ Stadt geschätzt aus dem Durchschnitt der Gemeinden in ${esc(land.name)}</li>` : '';

// ---------- Eingaben ----------
const leseBetrag = (s: string) => Math.min(9_999_999, parseInt(s.replace(/\D/g, ''), 10) || 0);
const schreibeBetrag = (v: number) => (v ? v.toLocaleString('de-DE') : '');
const el = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as T;
function eingabe(bruttoOverride?: number): Eingabe {
  return {
    brutto: bruttoOverride ?? leseBetrag(el('brutto').value),
    pkv: el<HTMLSelectElement>('kv').value === 'pkv',
    pkvMonat: +el('pkv').value || 0,
    kinderlos: el('kinderlos').checked,
    kirche: +el<HTMLSelectElement>('kist').value,
  };
}

// ---------- Ergebnis-Satz und Kennzahlen ----------
function satz(r: Ergebnis) {
  const e = aufEbenen(r);
  const f = (v: number) => `<b class="rs-mark">${fmtEur(v)}</b>`;
  const out = $('#result');
  if (!r.brutto) {
    out.innerHTML = 'Trag oben dein Jahresbrutto ein.';
    return;
  }
  if (!r.lohnsteuer) {
    out.innerHTML = `Bei ${f(r.brutto)} Brutto fällt keine Lohnsteuer an. Deine Abgaben gehen nur an die Sozialversicherung: ${f(summeSV(r))} im Jahr.`;
    return;
  }
  const top = [...gem.posten].sort((a, b) => b.v - a.v).find((p) => p.g !== 'verw') ?? gem.posten[0];
  const davon = `${gem.schaetzung ? 'geschätzt ' : ''}${f((e.gemeinde * top.v) / GEM_T)} für ${esc(top.name)}`;
  out.innerHTML = stadt.stadtstaat
    ? `Von ${f(r.brutto)} Brutto gehen ${f(e.bund)} an den Bund und ${f(e.land + e.gemeinde)} an ${esc(stadt.name)} (Land und Stadt), davon ${f(((e.land + e.gemeinde) * top.v) / GEM_T)} für ${esc(top.name)}.`
    : `Von ${f(r.brutto)} Brutto gehen ${f(e.bund)} an den Bund, ${f(e.land)} an ${esc(land.name)} und ${f(e.gemeinde)} an ${esc(stadt.name)}, davon ${davon}.`;
}

function kennzahlen(r: Ergebnis, fmt: (v: number) => string) {
  const abg = summeAbgaben(r);
  const fig = (v: string, l: string, mark = false) =>
    `<div class="rs-kennzahl"><b${mark ? ' class="rs-mark"' : ''}>${v}</b><span>${esc(l)}</span></div>`;
  $('#pk').innerHTML =
    fig(fmt(abg), `deine Abgaben, ${r.brutto ? pct(abg / r.brutto) : '–'} vom Brutto`) +
    fig(fmt(r.lohnsteuer + r.soli), 'Lohnsteuer und Soli') +
    fig(fmt(summeSV(r)), 'Sozialabgaben, dein Anteil') +
    fig(fmt(r.netto), r.pkv ? 'dein Netto nach PKV-Beitrag' : 'dein Netto (Näherung)', true);
  // Anteilsbalken: Steuern, Sozialversicherung, PKV, Netto
  const teile = (
    [
      ['Steuern', r.lohnsteuer + r.soli + r.kirche, `background:${css('--ink')}`, ''],
      ['Sozialversicherung', summeSV(r), '', 'rs-hatch'],
      ['PKV-Beitrag', r.pkvBeitrag, `background:${css('--line')}`, ''],
      ['Netto', r.netto, `background:${css('--marker')}`, ''],
    ] as const
  ).filter((t) => t[1] > 0);
  const a = $('#anteil');
  a.setAttribute('aria-label', `${fmtEur(r.brutto)} Brutto: ${teile.map(([n, v]) => `${n} ${fmtEur(v)}`).join(', ')}`);
  a.innerHTML = teile.map(([, v, st, cl]) => `<i class="${cl}" style="flex:${v};${st}"></i>`).join('');
  $('#anteil-lg').innerHTML = teile
    .map(
      ([n, v, st, cl]) =>
        `<li><span class="rs-farbe ${cl}" style="${st}"></span>${esc(n)} <b${n === 'Netto' ? ' class="rs-mark"' : ''}>${fmt(v)}</b> <span style="color:var(--ink-3)">${r.brutto ? pct(v / r.brutto) : ''}</span></li>`,
    )
    .join('');
}

// ---------- Sankey deiner Abgaben ----------
function chartFluss(r: Ergebnis) {
  const withAG = el('ag').checked,
    showN = el('shownetto').checked,
    show = el<HTMLSelectElement>('split').value;
  const f = unit === 'm' ? 1 / 12 : 1,
    fmt = (v: number) => fmtEur(v * f);
  const e = aufEbenen(r);
  const svg = d3.select<SVGSVGElement, unknown>('#s2');
  const sv = hatch(svg, 's2');
  const nodes: Knoten[] = [],
    links: Verbindung[] = [];
  const add = (id: string, label: string, color: string, extra: Partial<Knoten> = {}) => {
    nodes.push({ id, label, color, ...extra });
  };
  add('brutto', showN ? 'Dein Brutto' : 'Deine Abgaben', css('--ink'), { bold: true, col: 0 });
  const agSum = withAG ? r.ag.rv + r.ag.alv + r.ag.kv + r.ag.pv : 0;
  if (agSum > 0) add('ag', 'Arbeitgeberanteil', css('--line'), { col: 0 });
  if (r.lohnsteuer > 0) {
    add('lst', 'Lohnsteuer', css('--ink'), { col: 1 });
    links.push({ source: 'brutto', target: 'lst', value: r.lohnsteuer });
    add('bund', 'Bund', css('--ink'), { bold: true, col: 2 });
    add('land', `Land ${land.name}`, css('--ink'), { bold: true, col: 2 });
    add('gem', stadt.stadtstaat ? `${stadt.name} (Gemeindeanteil)` : stadt.name, css('--ink'), { bold: true, col: 2 });
    links.push({ source: 'lst', target: 'bund', value: r.lohnsteuer * 0.425 });
    links.push({ source: 'lst', target: 'land', value: r.lohnsteuer * 0.425 });
    links.push({ source: 'lst', target: 'gem', value: r.lohnsteuer * 0.15 });
  }
  if (r.soli > 0) {
    add('soli', 'Soli', css('--ink'), { col: 1 });
    links.push({ source: 'brutto', target: 'soli', value: r.soli }, { source: 'soli', target: 'bund', value: r.soli });
  }
  if (r.kirche > 0) {
    add('ki', 'Kirchensteuer', KIRCHE(), { col: 1 });
    links.push({ source: 'brutto', target: 'ki', value: r.kirche });
  }
  const ebene = (key: string, items: P[], total: number, betrag: number, prefix: string) =>
    items.forEach((p) => {
      const id = key + p.name;
      add(id, prefix + p.name, gcol(p.g), { col: 3 });
      links.push({ source: key, target: id, value: (betrag * p.v) / total });
    });
  if (e.bund > 0 && (show === 'all' || show === 'bund'))
    ebene('bund', epl(show === 'all' ? 7 : 13), BUND_GESAMT, e.bund, '');
  if (e.land > 0 && (show === 'all' || show === 'land'))
    ebene('land', topOf(land.posten, show === 'all' ? 6 : 13), LAND_T, e.land, 'Land · ');
  if (e.gemeinde > 0 && (show === 'all' || show === 'gem'))
    ebene(
      'gem',
      topOf(gem.posten, show === 'all' ? 5 : 12),
      GEM_T,
      e.gemeinde,
      gem.schaetzung ? 'Stadt ≈ ' : 'Stadt · ',
    );
  (
    [
      ['rv', 'Rentenversicherung', r.rv, r.ag.rv],
      ['kv', 'Krankenversicherung', r.kv, r.ag.kv],
      ['pv', 'Pflegeversicherung', r.pv, r.ag.pv],
      ['alv', 'Arbeitslosenvers.', r.alv, r.ag.alv],
    ] as const
  ).forEach(([k, l, v, a]) => {
    if (v <= 0) return;
    add(`sv_${k}`, l, sv, { col: 1 });
    links.push({ source: 'brutto', target: `sv_${k}`, value: v, color: css('--cat-sv') });
    if (agSum > 0) links.push({ source: 'ag', target: `sv_${k}`, value: a, color: css('--line') });
  });
  if (showN) {
    if (r.pkvBeitrag > 0) {
      add('pkvb', 'PKV-Beitrag', css('--line'), { col: 1 });
      links.push({ source: 'brutto', target: 'pkvb', value: r.pkvBeitrag });
    }
    if (r.netto > 0) {
      add('netto', 'Netto', css('--marker'), { col: 1 });
      links.push({ source: 'brutto', target: 'netto', value: r.netto });
    }
  }
  if (!links.length) {
    svg.selectAll('*').remove();
    return;
  }
  drawSankey(svg, nodes, links, {
    h: show === 'all' ? 820 : 640,
    align: (d: SKnoten) => d.col ?? 0,
    fmt,
    mr: 300,
    pad: 9,
    share: (d: SKnoten) => (r.brutto ? `${pct((d.value ?? 0) / r.brutto)} vom Brutto` : ''),
  });
  $('#lg2').innerHTML = legendSV + legendGruppen() + legendSchaetzung();
}

// ---------- Sortierte Balken ----------
function chartToepfe(r: Ergebnis, fmt: (v: number) => string) {
  const e = aufEbenen(r);
  const sv = hatch(d3.select('#s3'), 's3');
  const items: { name: string; v: number; c: string }[] = [];
  (
    [
      ['Rentenversicherung', r.rv],
      ['Krankenversicherung', r.kv],
      ['Pflegeversicherung', r.pv],
      ['Arbeitslosenversicherung', r.alv],
    ] as const
  ).forEach(([n, v]) => {
    v > 0 && items.push({ name: n, v, c: sv });
  });
  if (r.kirche > 0) items.push({ name: 'Kirchensteuer', v: r.kirche, c: KIRCHE() });
  epl(10).forEach((p) => {
    items.push({ name: `Bund · ${p.name.replace(/^EP \d+ /, '')}`, v: (e.bund * p.v) / BUND_GESAMT, c: gcol(p.g) });
  });
  topOf(land.posten, 7).forEach((p) => {
    items.push({ name: `Land · ${p.name}`, v: (e.land * p.v) / LAND_T, c: gcol(p.g) });
  });
  topOf(gem.posten, 5).forEach((p) => {
    items.push({
      name: (gem.schaetzung ? 'Stadt ≈ ' : 'Stadt · ') + p.name,
      v: (e.gemeinde * p.v) / GEM_T,
      c: gcol(p.g),
    });
  });
  items.sort((a, b) => b.v - a.v);
  const svg = d3.select<SVGSVGElement, unknown>('#s3');
  clear(svg);
  const W = width(svg),
    narrow = W < 560,
    rowH = narrow ? 36 : 26,
    labW = narrow ? 0 : 280,
    H = items.length * rowH + 8;
  svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const x = d3
    .scaleLinear()
    .domain([0, d3.max(items, (d) => d.v) || 1])
    .range([0, W - labW - 86]);
  const g = svg
    .selectAll('g.row')
    .data(items)
    .join('g')
    .attr('class', 'row')
    .attr('transform', (_, i) => `translate(0,${4 + i * rowH})`);
  const by = narrow ? 17 : 5,
    bh = narrow ? 13 : 15;
  g.append('rect')
    .attr('x', 0)
    .attr('width', W)
    .attr('height', rowH)
    .attr('fill', 'transparent')
    .on('mousemove', (ev, d) =>
      showTip(ev, `<b>${esc(d.name)}</b>${fmt(d.v)}${r.brutto ? ` · ${pct(d.v / r.brutto)} vom Brutto` : ''}`),
    )
    .on('mouseleave', hideTip);
  g.append('text')
    .attr('x', narrow ? 0 : labW - 10)
    .attr('y', narrow ? 11 : by + bh / 2)
    .attr('dy', narrow ? 0 : '.35em')
    .attr('text-anchor', narrow ? 'start' : 'end')
    .text((d) => d.name)
    .style('pointer-events', 'none');
  g.append('rect')
    .attr('x', labW)
    .attr('y', by)
    .attr('height', bh)
    .attr('width', (d) => Math.max(2, x(d.v)))
    .attr('rx', 4)
    .attr('fill', (d) => d.c)
    .style('pointer-events', 'none');
  g.append('text')
    .attr('class', 'val')
    .attr('x', (d) => labW + Math.max(2, x(d.v)) + 6)
    .attr('y', by + bh / 2)
    .attr('dy', '.35em')
    .text((d) => fmt(d.v))
    .style('pointer-events', 'none');
  $('#barsub').textContent =
    `Alle Ziele deiner Abgaben ${unit === 'm' ? 'pro Monat' : 'pro Jahr'}; kleine Posten je Ebene sind zusammengefasst.`;
  $('#toepfe-sum').textContent = items.length ? `größter Topf: ${items[0].name} mit ${fmt(items[0].v)}` : '';
  $('#lg3').innerHTML = legendSV + legendGruppen() + legendSchaetzung();
}

// ---------- Abgabenquote ----------
function chartQuote(r: Ergebnis) {
  const base = eingabe();
  const data = d3.range(15000, 160001, 500).map((B) => {
    const c = berechne({ ...base, brutto: B }),
      t = c.lohnsteuer + c.soli + c.kirche,
      s = summeSV(c);
    return { B, tot: (t + s) / B, t: t / B, sv: s / B };
  });
  const svg = d3.select<SVGSVGElement, unknown>('#s5');
  svg.selectAll('*').remove();
  const W = width(svg),
    narrow = W < 560,
    H = narrow ? 300 : 340,
    m = { l: 42, r: narrow ? 80 : 100, t: 16, b: 28 };
  svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const x = d3
    .scaleLinear()
    .domain([15000, 160000])
    .range([m.l, W - m.r]);
  const y = d3
    .scaleLinear()
    .domain([0, Math.ceil(((d3.max(data, (d) => d.tot) ?? 0.5) + 0.03) * 10) / 10])
    .range([H - m.b, m.t]);
  svg
    .append('g')
    .attr('class', 'grid')
    .selectAll('line')
    .data(y.ticks(5))
    .join('line')
    .attr('x1', m.l)
    .attr('x2', W - m.r)
    .attr('y1', (d) => y(d))
    .attr('y2', (d) => y(d));
  svg
    .append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(${m.l},0)`)
    .call(
      d3
        .axisLeft(y)
        .ticks(5)
        .tickFormat((d) => `${Math.round(+d * 100)} %`)
        .tickSize(0),
    )
    .select('.domain')
    .remove();
  svg
    .append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${H - m.b})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(narrow ? 4 : 7)
        .tickFormat((v) => `${+v / 1000} T€`)
        .tickSizeOuter(0),
    );
  (
    [
      [69750, 'BBG KV/PV', 0],
      [101400, 'BBG RV/ALV', 1],
    ] as const
  ).forEach(([v, l, i]) => {
    svg
      .append('line')
      .attr('x1', x(v))
      .attr('x2', x(v))
      .attr('y1', m.t)
      .attr('y2', H - m.b)
      .attr('stroke', css('--ink-3'))
      .attr('stroke-dasharray', '3 3');
    svg
      .append('text')
      .attr('class', 'muted')
      .attr('x', x(v) + 4)
      .attr('y', H - m.b - 8 - (narrow ? i * 14 : 0))
      .text(narrow ? l.replace('BBG ', '') : l);
  });
  const series: [keyof (typeof data)[0], string, string, number][] = [
    ['tot', 'Gesamt', css('--ink'), 2.5],
    ['t', 'Steuern', css('--ink-3'), 2],
    ['sv', 'Sozialabgaben', css('--cat-soz'), 2],
  ];
  if (base.pkv) series.splice(2, 1);
  series.forEach(([k, l, c, w]) => {
    svg
      .append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', c)
      .attr('stroke-width', w)
      .attr(
        'd',
        d3
          .line<(typeof data)[0]>()
          .x((d) => x(d.B))
          .y((d) => y(d[k] as number)),
      );
    svg
      .append('text')
      .attr('x', W - m.r + 6)
      .attr('y', y(data[data.length - 1][k] as number))
      .attr('dy', '.35em')
      .text(l);
  });
  $('#quote-sum').textContent = r.brutto ? `bei dir ${pct(summeAbgaben(r) / r.brutto)} vom Brutto` : '';
  if (r.brutto >= 15000 && r.brutto <= 160000) {
    const me = summeAbgaben(r) / r.brutto;
    svg
      .append('circle')
      .attr('cx', x(r.brutto))
      .attr('cy', y(me))
      .attr('r', 6)
      .attr('fill', css('--marker'))
      .attr('stroke', css('--ink'))
      .attr('stroke-width', 2);
    svg
      .append('text')
      .attr('x', x(r.brutto))
      .attr('y', y(me) - 13)
      .attr('text-anchor', 'middle')
      .text(`Du: ${pct(me)}`)
      .style('font-weight', 650)
      .style('fill', css('--ink'))
      .style('paint-order', 'stroke')
      .style('stroke', css('--surface'))
      .style('stroke-width', 4);
  }
  const ch = svg
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
      const B = Math.round(x.invert(mx) / 500) * 500;
      const d = data.find((q) => q.B === B) ?? data[0];
      ch.attr('x1', x(d.B)).attr('x2', x(d.B)).style('opacity', 1);
      showTip(
        ev,
        `<b>${fmtEur(d.B)} Brutto</b>Gesamt ${pct(d.tot)}<br>Steuern ${pct(d.t)}${base.pkv ? '' : `<br>Sozialabgaben ${pct(d.sv)}`}`,
      );
    })
    .on('mouseleave', () => {
      ch.style('opacity', 0);
      hideTip();
    });
  $('#lg5').innerHTML =
    series.map(([, l, c]) => `<li><span class="rs-farbe" style="background:${c}"></span>${esc(l)}</li>`).join('') +
    `<li><span class="rs-farbe" style="background:${css('--marker')};border-radius:50%;box-shadow:inset 0 0 0 1.5px ${css('--ink')}"></span>dein Einkommen</li>`;
}

// ---------- Zweck-Aufteilung, Waffel ----------
function nachZweck(r: Ergebnis) {
  const e = aufEbenen(r);
  const acc: Record<string, number> = { sv: summeSV(r), kirche: r.kirche };
  (Object.keys(GRUPPEN) as Gruppe[]).forEach((k) => {
    acc[k] = 0;
  });
  EINZELPLAENE.forEach((p) => {
    acc[p.g] += (e.bund * p.v) / BUND_GESAMT;
  });
  land.posten.forEach((p) => {
    acc[p.g] += (e.land * p.v) / LAND_T;
  });
  gem.posten.forEach((p) => {
    acc[p.g] += (e.gemeinde * p.v) / GEM_T;
  });
  const lab: Record<string, string> = { sv: 'Sozialversicherung', kirche: 'Kirchensteuer', ...GRUPPEN };
  return ['sv', 'soz', 'sich', 'for', 'inf', 'zins', 'verw', 'kirche']
    .map((k) => ({
      k,
      name: lab[k],
      v: acc[k],
      style: k === 'sv' ? '' : k === 'kirche' ? '' : `background:${gcol(k as Gruppe)}`,
      cls: k === 'sv' ? 'rs-hatch' : k === 'kirche' ? 'rs-hohl' : '',
    }))
    .filter((d) => d.v > 0);
}
function chartRaster(r: Ergebnis, fmt: (v: number) => string) {
  const cats = nachZweck(r).map((d) => ({ ...d, raw: 0, n: 0 })),
    tot = sum(cats);
  const raster = $('#raster'),
    liste = $('#zweck');
  if (!tot) {
    raster.innerHTML = '<i></i>'.repeat(100);
    liste.innerHTML = '';
    return;
  }
  cats.forEach((d) => {
    d.raw = (d.v / tot) * 100;
    d.n = Math.floor(d.raw);
  });
  const rest = 100 - cats.reduce((s, d) => s + d.n, 0);
  [...cats]
    .sort((a, b) => b.raw - b.n - (a.raw - a.n))
    .slice(0, rest)
    .forEach((d) => {
      d.n++;
    });
  raster.setAttribute('aria-label', `Von 100 € deiner Abgaben: ${cats.map((d) => `${d.n} € ${d.name}`).join(', ')}`);
  // Kästchen behalten, nur umfärben: so läuft die Umfärbung als Welle über das Raster
  const neu = raster.children.length !== 100;
  if (neu) raster.innerHTML = '<i></i>'.repeat(100);
  const zellen = cats.flatMap((d) => Array(d.n).fill(d));
  [...raster.children].forEach((c, i) => {
    const d = zellen[i];
    const diagonal = Math.floor(i / 10) + (i % 10); // 0 … 18, von links oben nach rechts unten
    const zelle = c as HTMLElement;
    zelle.className = `${d?.cls === 'rs-hohl' ? '' : (d?.cls ?? '')}${fokus && d?.k === fokus ? ' rs-im-fokus' : ''}`;
    zelle.dataset.k = d?.k ?? '';
    zelle.style.cssText =
      `--d:${diagonal * 30}ms;--welle:${diagonal * 12}ms;` +
      (d?.k === 'kirche' ? `box-shadow:inset 0 0 0 1.5px ${css('--ink-3')};background:transparent` : (d?.style ?? ''));
  });
  if (neu) auftritt(raster);
  liste.innerHTML = cats
    .map(
      (d) =>
        `<li data-k="${d.k}"><span class="rs-farbe ${d.cls}" style="${d.style}"></span><span>${esc(d.name)}</span><span><b>${d.n} €</b><small>${fmt(d.v)}</small></span></li>`,
    )
    .join('');
}

// ---------- Bewegung im Raster ----------
const wenigBewegung = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let fokus: string | null = null;

/** Einmalige diagonale Welle beim ersten Zeichnen */
function auftritt(raster: HTMLElement) {
  if (wenigBewegung()) return;
  raster.classList.add('rs-auftritt');
  setTimeout(() => raster.classList.remove('rs-auftritt'), 1200);
}

/** Zweck in der Liste überfahren: dessen Kästchen bleiben, die übrigen treten zurück */
function fokusAuf(k: string | null) {
  fokus = k;
  const raster = $('#raster');
  raster.classList.toggle('rs-fokus', !!k);
  for (const c of raster.children) c.classList.toggle('rs-im-fokus', !!k && (c as HTMLElement).dataset.k === k);
}

/** Gelegentlicher leiser Schimmer – nur sichtbar, im Bild und ohne Fokus */
function schimmern() {
  const raster = $('#raster');
  let imBild = false;
  new IntersectionObserver(([e]) => {
    imBild = e.isIntersecting;
  }).observe(raster);
  setInterval(() => {
    if (!imBild || document.hidden || fokus || wenigBewegung() || raster.classList.contains('rs-auftritt')) return;
    raster.classList.add('rs-schimmer');
    setTimeout(() => raster.classList.remove('rs-schimmer'), 2100);
  }, 9000);
}

// ---------- Echte Ausgabearten der Stadt ----------
function chartArten(r: Ergebnis, fmt: (v: number) => string) {
  const box = document.getElementById('arten');
  if (!box || !arten) return;
  const anteil = stadt.stadtstaat ? 0 : aufEbenen(r).gemeinde;
  const summe = arten.posten.reduce((s, p) => s + p.proKopf, 0);
  const max = Math.max(...arten.posten.map((p) => p.proKopf), ...arten.schnitt.map((p) => p.proKopf));
  const de = (v: number) => v.toLocaleString('de-DE');
  box.innerHTML =
    arten.posten
      .map((p, i) => {
        const s = arten!.schnitt[i]?.proKopf ?? 0;
        return `<div class="arten-row">
      <span class="arten-name">${esc(p.name)}</span>
      <span class="arten-bar" role="img" aria-label="${esc(p.name)}: ${de(p.proKopf)} € je Einwohner, Durchschnitt ${de(s)} €">
        <i style="width:${(p.proKopf / max) * 100}%"></i><b style="left:${(s / max) * 100}%"></b>
      </span>
      <span class="arten-wert"><strong>${de(p.proKopf)} €</strong><small>Ø ${de(s)} €</small></span>
      <span class="arten-du"><b class="rs-mark">${fmt((anteil * p.proKopf) / summe)}</b></span>
    </div>`;
      })
      .join('') +
    `<ul class="rs-legende"><li><span class="rs-farbe" style="background:${css('--ink')}"></span>${esc(stadt.name)}, € je Einwohner</li><li><span class="rs-farbe" style="width:3px;background:${css('--cat-sich')}"></span>Durchschnitt aller ${arten.anzahl} kreisfreien Städte</li><li><span class="rs-farbe" style="background:${css('--marker')}"></span>dein Gemeindeanteil ${unit === 'm' ? 'pro Monat' : 'pro Jahr'}</li></ul>`;
}

// ---------- Kalender ----------
function chartKalender(r: Ergebnis) {
  const box = $('#cal');
  if (!r.brutto) {
    box.innerHTML = '';
    return;
  }
  const e = aufEbenen(r);
  const rows = (
    [
      ['Rentenversicherung', r.rv, 'sv'],
      ['Kranken- und Pflegevers.', r.kv + r.pv, 'sv'],
      ['Arbeitslosenvers.', r.alv, 'sv'],
      ['Bund (Lohnsteuer-Anteil und Soli)', e.bund, 'tax'],
      [`Land ${land.name}`, e.land, 'tax'],
      [stadt.name, e.gemeinde, 'tax'],
      ['Kirche', r.kirche, 'kirche'],
      ['PKV-Beitrag', r.pkvBeitrag, 'pkv'],
      ['Für dich (Netto)', r.netto, 'netto'],
    ] as const
  ).filter((d) => d[1] > 0);
  const Y = new Date(2026, 0, 1),
    dayMs = 864e5,
    days = 365;
  const fd = (d: Date) => d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  const bg = {
    sv: '',
    tax: `background:${css('--ink')}`,
    kirche: `box-shadow:inset 0 0 0 1.5px ${css('--ink-3')}`,
    pkv: `background:${css('--line')}`,
    netto: `background:${css('--marker')}`,
  };
  let acc = 0;
  const html = rows
    .map(([n, v, c]) => {
      const s = (acc / r.brutto) * days,
        en = ((acc + v) / r.brutto) * days;
      acc += v;
      const ds = new Date(Y.getTime() + Math.floor(s) * dayMs),
        de = new Date(Y.getTime() + Math.max(Math.floor(s), Math.ceil(en) - 1) * dayMs);
      return `<div class="cal-row"><span>${esc(n)}</span><span class="cal-bar"><i${c === 'sv' ? ' class="rs-hatch"' : ''} style="left:${(s / days) * 100}%;width:${Math.max(0.4, ((en - s) / days) * 100)}%;${bg[c]}"></i></span><span class="cal-d num">${fd(ds)} – ${fd(de)}</span></div>`;
    })
    .join('');
  const frei = new Date(Y.getTime() + Math.floor(((r.brutto - r.netto) / r.brutto) * days) * dayMs);
  $('#cal-sum').textContent =
    `ab dem ${frei.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })} arbeitest du für dich`;
  box.innerHTML = `<p class="cal-lead">Ab dem <b class="rs-mark">${frei.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}</b> arbeitest du rechnerisch für dich selbst.</p>${html}`;
}

// ---------- Tabelle ----------
function tabelle(r: Ergebnis) {
  const e = aufEbenen(r),
    f = unit === 'm' ? 1 / 12 : 1;
  const money = (v: number) =>
    `${(v * f).toLocaleString('de-DE', {
      maximumFractionDigits: unit === 'm' ? 2 : 0,
      minimumFractionDigits: unit === 'm' ? 2 : 0,
    })} €`;
  const head = (t: string) =>
    `<tr><th colspan="3" scope="colgroup" style="text-align:left;padding-top:18px;color:var(--ink);font-size:15px;font-weight:600">${esc(t)}</th></tr>`;
  const rows = (arr: P[], tot: number, amt: number) =>
    `${[...arr]
      .sort((a, b) => b.v - a.v)
      .map(
        (p) =>
          `<tr><td><span class="rs-farbe" style="background:${gcol(p.g)};margin-right:8px"></span>${esc(p.name)}</td><td>${pct(p.v / tot)}</td><td>${money((amt * p.v) / tot)}</td></tr>`,
      )
      .join('')}<tr><td><b>Summe</b></td><td>100 %</td><td><b>${money(amt)}</b></td></tr>`;
  $('#tsub').textContent =
    `Lohnsteuer und Soli je Ebene anteilig auf deren Ausgaben umgelegt, ${unit === 'm' ? 'pro Monat' : 'pro Jahr'}.`;
  $('#tcount').textContent =
    `${EINZELPLAENE.length + land.posten.length + gem.posten.length} Posten von Bund, ${land.name} und ${stadt.name}`;
  $('#tbl th.uy').textContent = unit === 'm' ? '€ / Monat' : '€ / Jahr';
  $('#tbl tbody').innerHTML =
    head(`Bund: ${money(e.bund)} (42,5 % Lohnsteuer und Soli), Haushalt 2026`) +
    rows(
      EINZELPLAENE.map((p) => ({ ...p, name: `EP ${p.n} ${p.name}` })),
      BUND_GESAMT,
      e.bund,
    ) +
    head(`Land ${land.name}: ${money(e.land)} (42,5 % Lohnsteuer), ${land.art} ${land.jahr}`) +
    rows(land.posten, LAND_T, e.land) +
    head(`${stadt.name}: ${money(e.gemeinde)} (15 % Lohnsteuer), ${gem.art}, ${gem.jahr}`) +
    rows(gem.posten, GEM_T, e.gemeinde);
}

// ---------- Bundeshaushalt (unabhängig von deinen Eingaben) ----------
function bundKennzahlen() {
  const fig = (v: string, l: string) => `<div class="rs-kennzahl"><b>${v}</b><span>${esc(l)}</span></div>`;
  $('#bk').innerHTML =
    fig(fmtMrd(BUND_GESAMT), 'Ausgaben 2026') +
    fig(fmtMrd(EINNAHMEN[0].v), `Steuereinnahmen, ${pct(EINNAHMEN[0].v / BUND_GESAMT)} der Ausgaben`) +
    fig(fmtMrd(EINNAHMEN[1].v), `neue Kredite, ${pct(EINNAHMEN[1].v / BUND_GESAMT)} der Ausgaben`);
}
function chartBund() {
  const svg = d3.select<SVGSVGElement, unknown>('#s1');
  const nodes: Knoten[] = [],
    links: Verbindung[] = [];
  const shade = { steuer: css('--ink-2'), kredit: css('--ink-3'), sonst: css('--cat-verw') };
  EINNAHMEN.forEach((i) => {
    nodes.push({ id: `in_${i.k}`, label: i.name, color: shade[i.k] });
  });
  nodes.push({ id: 'hub', label: 'Bundeshaushalt', color: css('--ink'), bold: true });
  EINNAHMEN.forEach((i) => {
    links.push({ source: `in_${i.k}`, target: 'hub', value: i.v, color: shade[i.k] });
  });
  epl(13).forEach((p) => {
    nodes.push({ id: `ep${p.name}`, label: p.name, color: gcol(p.g) });
    links.push({ source: 'hub', target: `ep${p.name}`, value: p.v });
  });
  drawSankey(svg, nodes, links, {
    h: 600,
    fmt: fmtMrd,
    mr: 230,
    pad: 10,
    share: (d: SKnoten) => `${pct((d.value ?? 0) / BUND_GESAMT)} des Haushalts`,
  });
  $('#lg1').innerHTML = `<li>Graue Ströme links: Einnahmen</li>${legendGruppen()}`;
}
function chartTreemap() {
  const svg = d3.select<SVGSVGElement, unknown>('#s6');
  svg.selectAll('*').remove();
  const W = width(svg),
    H = W < 560 ? 520 : 460;
  svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const root = d3
    .hierarchy<Baum>({
      children: (Object.keys(GRUPPEN) as Gruppe[]).map((g) => ({ g, children: EINZELPLAENE.filter((e) => e.g === g) })),
    })
    .sum((d) => d.v || 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  d3.treemap<Baum>().size([W, H]).paddingInner(2).round(true)(root);
  const leaf = svg
    .selectAll('g')
    .data(root.leaves() as d3.HierarchyRectangularNode<Baum>[])
    .join('g')
    .attr('transform', (d) => `translate(${d.x0},${d.y0})`);
  leaf
    .append('rect')
    .attr('width', (d) => d.x1 - d.x0)
    .attr('height', (d) => d.y1 - d.y0)
    .attr('rx', 4)
    .attr('fill', (d) => gcol(blatt(d).g))
    .on('mousemove', (ev, d) =>
      showTip(
        ev,
        `<b>EP ${blatt(d).n} ${esc(blatt(d).name)}</b>${fmtMrd(blatt(d).v)} · ${pct(blatt(d).v / BUND_GESAMT)}`,
      ),
    )
    .on('mouseleave', hideTip);
  // Textfarbe je nach Fläche: hell auf dunklen, Tinte auf hellen Gruppen
  const light = (g: Gruppe) => d3.hsl(gcol(g)).l > 0.62;
  const lab = leaf.filter((d) => d.x1 - d.x0 > 64 && d.y1 - d.y0 > 32);
  lab
    .append('text')
    .attr('x', 7)
    .attr('y', 17)
    .text((d) => blatt(d).name)
    .style('font-weight', 600)
    .style('pointer-events', 'none')
    .style('fill', (d) => (light(blatt(d).g) ? '#1c1f24' : '#fff'))
    .each(function (d) {
      const w = d.x1 - d.x0 - 12;
      let t = blatt(d).name;
      while (this.getComputedTextLength() > w && t.length > 3) {
        t = t.slice(0, -1);
        this.textContent = `${t}…`;
      }
    });
  lab
    .filter((d) => d.y1 - d.y0 > 46)
    .append('text')
    .attr('x', 7)
    .attr('y', 33)
    .text((d) => fmtMrd(blatt(d).v))
    .style('font-size', '12px')
    .style('pointer-events', 'none')
    .style('fill', (d) => (light(blatt(d).g) ? '#1c1f24' : '#fff'));
}
function chart2027() {
  const svg = d3.select<SVGSVGElement, unknown>('#s9');
  svg.selectAll('*').remove();
  const known = EINZELPLAENE.filter((e) => ENTWURF_2027[e.n] != null);
  const rows = known.map((e) => ({ name: `EP ${e.n} ${e.name}`, d: ENTWURF_2027[e.n] - e.v, g: e.g }));
  rows.push({
    name: 'Alle übrigen Einzelpläne',
    d: ENTWURF_2027_GESAMT - d3.sum(Object.values(ENTWURF_2027)) - (BUND_GESAMT - d3.sum(known, (e) => e.v)),
    g: 'verw',
  });
  const data = rows.filter((d) => Math.abs(d.d) >= 0.05).sort((a, b) => b.d - a.d);
  const W = width(svg),
    narrow = W < 560,
    rowH = narrow ? 36 : 28,
    labW = narrow ? 0 : 240,
    H = data.length * rowH + 24;
  svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const ext = d3.max(data, (d) => Math.abs(d.d)) ?? 1;
  const x = d3
    .scaleLinear()
    .domain([-ext * (narrow ? 0.85 : 0.6), ext * (narrow ? 1.6 : 1.3)])
    .range([labW, W - 4]);
  svg
    .append('line')
    .attr('x1', x(0))
    .attr('x2', x(0))
    .attr('y1', 0)
    .attr('y2', H - 20)
    .attr('stroke', css('--ink-3'));
  svg
    .append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${H - 20})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(narrow ? 4 : 6)
        .tickFormat((v) => `${(+v > 0 ? '+' : '') + v} Mrd`)
        .tickSizeOuter(0),
    );
  const g = svg
    .selectAll('g.r')
    .data(data)
    .join('g')
    .attr('class', 'r')
    .attr('transform', (_, i) => `translate(0,${i * rowH})`);
  const by = narrow ? 17 : 6,
    bh = narrow ? 13 : 15;
  g.append('rect')
    .attr('x', (d) => x(Math.min(0, d.d)))
    .attr('width', (d) => Math.max(2, Math.abs(x(d.d) - x(0))))
    .attr('y', by)
    .attr('height', bh)
    .attr('rx', 4)
    .attr('fill', (d) => gcol(d.g))
    .on('mousemove', (ev, d) => showTip(ev, `<b>${esc(d.name)}</b>${(d.d > 0 ? '+' : '') + fmtMrd(d.d)}`))
    .on('mouseleave', hideTip);
  g.append('text')
    .attr('x', narrow ? 0 : labW - 10)
    .attr('text-anchor', narrow ? 'start' : 'end')
    .attr('y', narrow ? 11 : by + bh / 2)
    .attr('dy', narrow ? 0 : '.35em')
    .text((d) => d.name);
  g.append('text')
    .attr('class', 'val')
    .attr('y', by + bh / 2)
    .attr('dy', '.35em')
    .attr('x', (d) => (d.d >= 0 ? x(d.d) + 6 : x(d.d) - 6))
    .attr('text-anchor', (d) => (d.d >= 0 ? 'start' : 'end'))
    .text(
      (d) =>
        (d.d > 0 ? '+' : '−') +
        Math.abs(d.d).toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) +
        ' Mrd',
    );
}
function chartEntwicklung() {
  const svg = d3.select<SVGSVGElement, unknown>('#s10');
  svg.selectAll('*').remove();
  const W = width(svg),
    H = 280,
    m = { l: 8, r: 8, t: 26, b: 42 };
  svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const x = d3
    .scaleBand<number>()
    .domain(ENTWICKLUNG.map((d) => d.jahr))
    .range([m.l, W - m.r])
    .padding(0.3);
  const y = d3
    .scaleLinear()
    .domain([0, 700])
    .range([H - m.b, m.t]);
  const op = { Soll: 1, Entwurf: 0.6, Finanzplan: 0.32 };
  const g = svg.selectAll('g.c').data(ENTWICKLUNG).join('g').attr('class', 'c');
  g.append('rect')
    .attr('x', (d) => x(d.jahr)!)
    .attr('width', x.bandwidth())
    .attr('y', (d) => y(d.v))
    .attr('height', (d) => y(0) - y(d.v))
    .attr('rx', 4)
    .attr('fill', css('--ink-2'))
    .attr('fill-opacity', (d) => op[d.status])
    .on('mousemove', (ev, d) => showTip(ev, `<b>${d.jahr} (${d.status})</b>${fmtMrd(d.v)}`))
    .on('mouseleave', hideTip);
  const cx = (d: (typeof ENTWICKLUNG)[0]) => x(d.jahr)! + x.bandwidth() / 2;
  g.append('text')
    .attr('x', cx)
    .attr('y', (d) => y(d.v) - 7)
    .attr('text-anchor', 'middle')
    .text((d) => d.v.toLocaleString('de-DE', { minimumFractionDigits: 1 }))
    .style('font-weight', 600);
  g.append('text')
    .attr('x', cx)
    .attr('y', H - m.b + 17)
    .attr('text-anchor', 'middle')
    .text((d) => d.jahr);
  g.append('text')
    .attr('class', 'muted')
    .attr('x', cx)
    .attr('y', H - m.b + 32)
    .attr('text-anchor', 'middle')
    .text((d) => (W < 560 ? { Soll: 'Soll', Entwurf: 'Entw.', Finanzplan: 'Plan' }[d.status] : d.status));
  svg
    .append('line')
    .attr('x1', m.l)
    .attr('x2', W - m.r)
    .attr('y1', y(0))
    .attr('y2', y(0))
    .attr('stroke', css('--rule'));
}

/** Zeile im zugeklappten „Weitere Angaben“: was gerade eingestellt ist */
function zusammenfassung() {
  const kv = el<HTMLSelectElement>('kv').value === 'pkv' ? 'privat versichert' : 'gesetzlich versichert';
  const ki = +el<HTMLSelectElement>('kist').value ? 'mit Kirchensteuer' : 'keine Kirchensteuer';
  $('#mehr-sum').textContent = `${kv}, ${ki}, ${el('kinderlos').checked ? 'kinderlos' : 'mit Kindern'}`;
}

/** Knoten der Treemap: Gruppen mit Einzelplänen als Blättern */
interface Blatt {
  g: Gruppe;
  n: string;
  name: string;
  v: number;
}
interface Baum extends Partial<Blatt> {
  children?: Baum[];
}
/** Blätter der Treemap sind immer Einzelpläne mit allen Feldern */
const blatt = (d: d3.HierarchyRectangularNode<Baum>) => d.data as Blatt;

// ---------- Ablauf ----------
function persoenlich() {
  const r = berechne(eingabe());
  const fmtK2 = (v: number) => fmtEur(v * (unit === 'm' ? 1 / 12 : 1)); // Kapitel 2: Monat/Jahr
  satz(r);
  kennzahlen(r, fmtEur);
  chartKalender(r);
  chartQuote(r);
  chartFluss(r);
  chartArten(r, fmtK2);
  chartToepfe(r, fmtK2);
  chartRaster(r, fmtEur);
  tabelle(r);
  zusammenfassung();
}
function bund() {
  $('#ansicht-fluss').hidden = bundAnsicht !== 'fluss';
  $('#ansicht-flaeche').hidden = bundAnsicht !== 'flaeche';
  $('#bundsub').textContent =
    bundAnsicht === 'fluss'
      ? 'Einnahmen, Bundeshaushalt, Einzelpläne. Antippen oder Überfahren zeigt Beträge.'
      : 'Jedes Rechteck ist ein Einzelplan, die Fläche entspricht den Ausgaben 2026.';
  if (bundAnsicht === 'fluss') chartBund();
  else {
    chartTreemap();
    $('#lg1').innerHTML = legendGruppen();
  }
}
function alles() {
  persoenlich();
  bundKennzahlen();
  bund();
  chart2027();
  chartEntwicklung();
}

// ---------- Stadt in der Nähe ----------
function orten(orte: Ort[], ids: string[], vonHand: boolean) {
  const knopf = el<HTMLButtonElement>('naehe'),
    status = $('#naehe-status');
  if (!('geolocation' in navigator)) {
    if (vonHand) status.textContent = 'Dein Browser kann keinen Standort ermitteln. Wähl deine Stadt in der Liste.';
    return;
  }
  knopf.disabled = true;
  if (vonHand) status.textContent = 'Suche deinen Standort …';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const slug = naechsteStadt(orte, pos.coords.latitude, pos.coords.longitude);
      speichereStadt(slug);
      if (slug === stadt.slug) {
        knopf.disabled = false;
        status.textContent = `${stadt.name} ist die nächste kreisfreie Stadt.`;
        return;
      }
      speichereEingaben(ids);
      location.href = `/stadt/${slug}/`;
    },
    (fehler) => {
      knopf.disabled = false;
      if (!vonHand) return;
      status.textContent =
        fehler.code === fehler.PERMISSION_DENIED
          ? 'Standort nicht freigegeben. Wähl deine Stadt in der Liste.'
          : 'Standort nicht gefunden. Wähl deine Stadt in der Liste.';
    },
    { timeout: 10_000, maximumAge: 10 * 60_000 },
  );
}

export function start() {
  const daten = JSON.parse($('#daten').textContent!);
  stadt = daten.stadt;
  land = daten.land;
  gem = daten.gem;
  arten = daten.arten;
  LAND_T = sum(land.posten);
  GEM_T = sum(gem.posten);

  const ids = ['brutto', 'kv', 'pkv', 'kist', 'kinderlos', 'ag', 'shownetto', 'split'];
  const orte: Ort[] = daten.orte;

  // Startseite: gemerkte Stadt öffnen; sonst den Standort nur nutzen, wenn er schon freigegeben ist
  if (location.pathname === '/') {
    const gemerkt = gespeicherteStadt();
    if (gemerkt && gemerkt !== stadt.slug && orte.some(([s]) => s === gemerkt)) {
      location.replace(`/stadt/${gemerkt}/`);
      return;
    }
    if (!gemerkt && navigator.permissions) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((p) => {
          if (p.state === 'granted') orten(orte, ids, false);
        })
        .catch(() => {});
    }
  }
  el('naehe').addEventListener('click', () => orten(orte, ids, true));
  const liste = $('#zweck');
  liste.addEventListener('pointerover', (e) =>
    fokusAuf((e.target as HTMLElement).closest<HTMLElement>('li')?.dataset.k ?? null),
  );
  liste.addEventListener('pointerleave', () => fokusAuf(null));
  schimmern();
  el('vergessen').addEventListener('click', () => {
    vergiss();
    location.href = '/';
  });

  ladeEingaben(ids);
  const syncPkv = () => (el('pkvwrap').hidden = el<HTMLSelectElement>('kv').value !== 'pkv');
  syncPkv();

  const brutto = el('brutto');
  // Während des Tippens nur Ziffern und Punkte zulassen; beim Verlassen mit Tausenderpunkten formatieren
  brutto.value = schreibeBetrag(leseBetrag(brutto.value));
  brutto.addEventListener('input', () => {
    const clean = brutto.value.replace(/[^\d.]/g, '');
    if (clean !== brutto.value) brutto.value = clean;
  });
  brutto.addEventListener('change', () => {
    brutto.value = schreibeBetrag(leseBetrag(brutto.value));
  });
  // Beim Hineinklicken alles markieren: Tippen ersetzt den Betrag statt Ziffern einzufügen
  brutto.addEventListener('focus', () => brutto.select());
  // Hinweis „Vorbelegt mit dem Median“ nur, solange der Median drinsteht
  const syncVorbelegt = () => {
    el('vorbelegt').hidden = leseBetrag(brutto.value) !== daten.median;
  };
  syncVorbelegt();
  brutto.addEventListener('input', syncVorbelegt);
  ids.forEach((id) => {
    el(id).addEventListener('input', () => {
      syncPkv();
      speichereEingaben(ids);
      persoenlich();
    });
  });
  el<HTMLSelectElement>('stadt').addEventListener('change', (ev) => {
    speichereEingaben(ids);
    speichereStadt((ev.target as HTMLSelectElement).value);
    location.href = `/stadt/${(ev.target as HTMLSelectElement).value}/`;
  });
  document.querySelectorAll<HTMLButtonElement>('#unit button').forEach((b) => {
    b.onclick = () => {
      unit = b.dataset.u as 'y' | 'm';
      document.querySelectorAll('#unit button').forEach((x) => {
        x.setAttribute('aria-pressed', String(x === b));
      });
      persoenlich();
    };
  });
  document.querySelectorAll<HTMLButtonElement>('#bundansicht button').forEach((b) => {
    b.onclick = () => {
      bundAnsicht = b.dataset.ansicht as 'fluss' | 'flaeche';
      document.querySelectorAll('#bundansicht button').forEach((x) => {
        x.setAttribute('aria-pressed', String(x === b));
      });
      bund();
    };
  });
  // Zugeklappte Diagramme haben keine Breite: beim Aufklappen neu zeichnen
  document.querySelectorAll<HTMLDetailsElement>('details[data-neu-zeichnen]').forEach((d) => {
    d.addEventListener('toggle', () => {
      if (d.open) persoenlich();
    });
  });
  let t: number;
  addEventListener('resize', () => {
    clearTimeout(t);
    t = window.setTimeout(alles, 150);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', alles);
  new MutationObserver(alles).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  alles();
}
