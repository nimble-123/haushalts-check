import * as d3 from 'd3';
import { aufEbenen, berechne, summeAbgaben, summeSV, type Eingabe, type Ergebnis } from '../lib/steuer';
import { BUND_GESAMT, EINNAHMEN, EINZELPLAENE, ENTWICKLUNG, ENTWURF_2027, ENTWURF_2027_GESAMT } from '../data/bund';
import { GRUPPEN, type GemeindeEbene, type Gruppe, type Land, type Stadt } from '../data/types';
import { $, clear, css, drawSankey, fmtEur, fmtMrd, hatch, hideTip, pct, showTip, width } from './viz';
import { ladeEingaben, speichereEingaben } from './speicher';

interface P { name: string; v: number; g: Gruppe; rest?: boolean }

let stadt: Stadt, land: Land, gem: GemeindeEbene, LAND_T = 0, GEM_T = 0;
let unit: 'y' | 'm' = 'y';

const gcol = (g: Gruppe) => css('--g-' + g);
const sum = (a: { v: number }[]) => a.reduce((s, x) => s + x.v, 0);
function topOf(arr: P[], n: number): P[] {
  const s = [...arr].sort((a, b) => b.v - a.v);
  const top = s.slice(0, n), rest = s.slice(n);
  return rest.length ? [...top, { name: `Übrige (${rest.length})`, v: sum(rest), g: 'verw', rest: true }] : top;
}
const epl = (n: number) => topOf(EINZELPLAENE.map((e) => ({ name: `EP ${e.n} ${e.name}`, v: e.v, g: e.g })), n);
const legendGruppen = () =>
  Object.entries(GRUPPEN).map(([k, l]) => `<li><span class="sw" style="background:${gcol(k as Gruppe)}"></span>${l}</li>`).join('');
const legendSV = `<li><span class="sw hatch"></span>Sozialversicherung</li>`;
const legendSchaetzung = () => (gem.schaetzung ? `<li>≈ geschätzt aus dem Durchschnitt der Gemeinden in ${land.name}</li>` : '');

// ---------- Eingaben ----------
const el = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as T;
function eingabe(bruttoOverride?: number): Eingabe {
  return {
    brutto: bruttoOverride ?? (parseInt(el('brutto').value.replace(/\D/g, ''), 10) || 0),
    pkv: el<HTMLSelectElement>('kv').value === 'pkv',
    pkvMonat: +el('pkv').value || 0,
    kinderlos: el('kinderlos').checked,
    kirche: +el<HTMLSelectElement>('kist').value,
  };
}

// ---------- Ergebnis-Satz und Kennzahlen ----------
function satz(r: Ergebnis) {
  const e = aufEbenen(r);
  const f = (v: number) => `<b>${fmtEur(v)}</b>`;
  const out = $('#result');
  if (!r.brutto) { out.innerHTML = 'Trag oben dein Jahresbrutto ein.'; return; }
  if (!r.lohnsteuer) { out.innerHTML = `Bei ${f(r.brutto)} Brutto fällt keine Lohnsteuer an. Deine Abgaben gehen nur an die Sozialversicherung: ${f(summeSV(r))} im Jahr.`; return; }
  const top = [...gem.posten].sort((a, b) => b.v - a.v).find((p) => p.g !== 'verw') ?? gem.posten[0];
  const davon = `${gem.schaetzung ? 'geschätzt ' : ''}${f((e.gemeinde * top.v) / GEM_T)} für ${top.name}`;
  out.innerHTML = stadt.stadtstaat
    ? `Von ${f(r.brutto)} Brutto gehen ${f(e.bund)} an den Bund und ${f(e.land + e.gemeinde)} an ${stadt.name} (Land und Stadt), davon ${f(((e.land + e.gemeinde) * top.v) / GEM_T)} für ${top.name}.`
    : `Von ${f(r.brutto)} Brutto gehen ${f(e.bund)} an den Bund, ${f(e.land)} an ${land.name} und ${f(e.gemeinde)} an ${stadt.name}, davon ${davon}.`;
}

function kennzahlen(r: Ergebnis, fmt: (v: number) => string) {
  const abg = summeAbgaben(r);
  const fig = (v: string, l: string) => `<div class="fig"><span class="v">${v}</span><span class="l">${l}</span></div>`;
  $('#pk').innerHTML =
    fig(fmt(abg), `Abgaben, ${r.brutto ? pct(abg / r.brutto) : '–'} vom Brutto`) +
    fig(fmt(r.lohnsteuer + r.soli), 'Lohnsteuer und Soli') +
    fig(fmt(summeSV(r)), 'Sozialabgaben, dein Anteil') +
    fig(fmt(r.netto), r.pkv ? 'Netto nach PKV-Beitrag' : 'Netto (Näherung)');
}

// ---------- Sankey deiner Abgaben ----------
function chartFluss(r: Ergebnis) {
  const withAG = el('ag').checked, showN = el('shownetto').checked, show = el<HTMLSelectElement>('split').value;
  const f = unit === 'm' ? 1 / 12 : 1, fmt = (v: number) => fmtEur(v * f);
  const e = aufEbenen(r);
  const svg = d3.select<SVGSVGElement, unknown>('#s2');
  const sv = hatch(svg, 's2');
  const nodes: any[] = [], links: any[] = [];
  const add = (id: string, label: string, color: string, extra = {}) => nodes.push({ id, label, color, ...extra });
  add('brutto', showN ? 'Dein Brutto' : 'Deine Abgaben', css('--ink'), { bold: true, col: 0 });
  const agSum = withAG ? r.ag.rv + r.ag.alv + r.ag.kv + r.ag.pv : 0;
  if (agSum > 0) add('ag', 'Arbeitgeberanteil', css('--g-kirche'), { col: 0 });
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
  if (r.soli > 0) { add('soli', 'Soli', css('--ink'), { col: 1 }); links.push({ source: 'brutto', target: 'soli', value: r.soli }, { source: 'soli', target: 'bund', value: r.soli }); }
  if (r.kirche > 0) { add('ki', 'Kirchensteuer', css('--g-kirche'), { col: 1 }); links.push({ source: 'brutto', target: 'ki', value: r.kirche }); }
  const ebene = (key: string, items: P[], total: number, betrag: number, prefix: string) =>
    items.forEach((p) => { const id = key + p.name; add(id, prefix + p.name, gcol(p.g), { col: 3 }); links.push({ source: key, target: id, value: (betrag * p.v) / total }); });
  if (e.bund > 0 && (show === 'all' || show === 'bund')) ebene('bund', epl(show === 'all' ? 7 : 13), BUND_GESAMT, e.bund, '');
  if (e.land > 0 && (show === 'all' || show === 'land')) ebene('land', topOf(land.posten, show === 'all' ? 6 : 13), LAND_T, e.land, 'Land · ');
  if (e.gemeinde > 0 && (show === 'all' || show === 'gem')) ebene('gem', topOf(gem.posten, show === 'all' ? 5 : 12), GEM_T, e.gemeinde, gem.schaetzung ? 'Stadt ≈ ' : 'Stadt · ');
  ([['rv', 'Rentenversicherung', r.rv, r.ag.rv], ['kv', 'Krankenversicherung', r.kv, r.ag.kv], ['pv', 'Pflegeversicherung', r.pv, r.ag.pv], ['alv', 'Arbeitslosenvers.', r.alv, r.ag.alv]] as const)
    .forEach(([k, l, v, a]) => {
      if (v <= 0) return;
      add('sv_' + k, l, sv, { col: 1 });
      links.push({ source: 'brutto', target: 'sv_' + k, value: v, color: css('--g-soz') });
      if (agSum > 0) links.push({ source: 'ag', target: 'sv_' + k, value: a, color: css('--g-kirche') });
    });
  if (showN) {
    if (r.pkvBeitrag > 0) { add('pkvb', 'PKV-Beitrag', css('--netto'), { col: 1 }); links.push({ source: 'brutto', target: 'pkvb', value: r.pkvBeitrag }); }
    if (r.netto > 0) { add('netto', 'Netto', css('--netto'), { col: 1 }); links.push({ source: 'brutto', target: 'netto', value: r.netto }); }
  }
  if (!links.length) { svg.selectAll('*').remove(); return; }
  drawSankey(svg, nodes, links, { h: show === 'all' ? 820 : 640, align: (d: any) => d.col, fmt, mr: 300, pad: 9,
    share: (d: any) => (r.brutto ? pct(d.value / r.brutto) + ' vom Brutto' : '') });
  $('#lg2').innerHTML = legendSV + legendGruppen() + legendSchaetzung();
}

// ---------- Sortierte Balken ----------
function chartToepfe(r: Ergebnis, fmt: (v: number) => string) {
  const e = aufEbenen(r);
  const sv = hatch(d3.select('#s3'), 's3');
  const items: { name: string; v: number; c: string }[] = [];
  ([['Rentenversicherung', r.rv], ['Krankenversicherung', r.kv], ['Pflegeversicherung', r.pv], ['Arbeitslosenversicherung', r.alv]] as const)
    .forEach(([n, v]) => v > 0 && items.push({ name: n, v, c: sv }));
  if (r.kirche > 0) items.push({ name: 'Kirchensteuer', v: r.kirche, c: css('--g-kirche') });
  epl(10).forEach((p) => items.push({ name: 'Bund · ' + p.name.replace(/^EP \d+ /, ''), v: (e.bund * p.v) / BUND_GESAMT, c: gcol(p.g) }));
  topOf(land.posten, 7).forEach((p) => items.push({ name: 'Land · ' + p.name, v: (e.land * p.v) / LAND_T, c: gcol(p.g) }));
  topOf(gem.posten, 5).forEach((p) => items.push({ name: (gem.schaetzung ? 'Stadt ≈ ' : 'Stadt · ') + p.name, v: (e.gemeinde * p.v) / GEM_T, c: gcol(p.g) }));
  items.sort((a, b) => b.v - a.v);
  const svg = d3.select<SVGSVGElement, unknown>('#s3');
  clear(svg);
  const W = width(svg), narrow = W < 560, rowH = narrow ? 36 : 26, labW = narrow ? 0 : 280, H = items.length * rowH + 8;
  svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const x = d3.scaleLinear().domain([0, d3.max(items, (d) => d.v) || 1]).range([0, W - labW - 86]);
  const g = svg.selectAll('g.row').data(items).join('g').attr('class', 'row').attr('transform', (_, i) => `translate(0,${4 + i * rowH})`);
  const by = narrow ? 17 : 5, bh = narrow ? 13 : 15;
  g.append('rect').attr('x', 0).attr('width', W).attr('height', rowH).attr('fill', 'transparent')
    .on('mousemove', (ev, d) => showTip(ev, `<b>${d.name}</b>${fmt(d.v)}${r.brutto ? ' · ' + pct(d.v / r.brutto) + ' vom Brutto' : ''}`)).on('mouseleave', hideTip);
  g.append('text').attr('x', narrow ? 0 : labW - 10).attr('y', narrow ? 11 : by + bh / 2).attr('dy', narrow ? 0 : '.35em')
    .attr('text-anchor', narrow ? 'start' : 'end').text((d) => d.name).style('pointer-events', 'none');
  g.append('rect').attr('x', labW).attr('y', by).attr('height', bh).attr('width', (d) => Math.max(2, x(d.v)))
    .attr('rx', 4).attr('fill', (d) => d.c).style('pointer-events', 'none');
  g.append('text').attr('class', 'val').attr('x', (d) => labW + Math.max(2, x(d.v)) + 6).attr('y', by + bh / 2).attr('dy', '.35em')
    .text((d) => fmt(d.v)).style('pointer-events', 'none');
  $('#barsub').textContent = `Alle Ziele deiner Abgaben ${unit === 'm' ? 'pro Monat' : 'pro Jahr'}; kleine Posten je Ebene sind zusammengefasst.`;
  $('#lg3').innerHTML = legendSV + legendGruppen() + legendSchaetzung();
}

// ---------- Wasserfall ----------
const KURZ: Record<string, string> = { Rentenversicherung: 'Rente', Krankenversicherung: 'Kranken', Pflegeversicherung: 'Pflege', 'Arbeitslosenvers.': 'Arbeitslos.', Kirchensteuer: 'Kirche' };
function chartWasserfall(r: Ergebnis, fmt: (v: number) => string) {
  const svg = d3.select<SVGSVGElement, unknown>('#s4');
  const sv = hatch(svg, 's4');
  clear(svg);
  type S = { name: string; v: number; type: 'total' | 'tax' | 'sv' | 'pkv'; start: number; end: number };
  const steps: S[] = [{ name: 'Brutto', v: r.brutto, type: 'total', start: 0, end: r.brutto }];
  let run = r.brutto;
  ([['Lohnsteuer', r.lohnsteuer, 'tax'], ['Soli', r.soli, 'tax'], ['Kirchensteuer', r.kirche, 'tax'], ['Rentenversicherung', r.rv, 'sv'],
    ['Krankenversicherung', r.kv, 'sv'], ['Pflegeversicherung', r.pv, 'sv'], ['Arbeitslosenvers.', r.alv, 'sv'], ['PKV-Beitrag', r.pkvBeitrag, 'pkv']] as const)
    .forEach(([n, v, t]) => { if (v > 0) { steps.push({ name: n, v, type: t, end: run, start: run - v }); run -= v; } });
  steps.push({ name: 'Netto', v: run, type: 'total', start: 0, end: run });
  const W = width(svg), narrow = W < 560, labW = narrow ? 104 : 160, rowH = 30, H = steps.length * rowH + 26;
  svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const x = d3.scaleLinear().domain([0, r.brutto || 1]).range([labW, W - 8]);
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - 20})`)
    .call(d3.axisBottom(x).ticks(narrow ? 3 : 6).tickFormat((v) => (+v / 1000).toLocaleString('de-DE') + ' T€').tickSizeOuter(0));
  const col = { total: css('--pen'), tax: css('--ink'), sv, pkv: css('--netto') };
  const g = svg.selectAll('g.st').data(steps).join('g').attr('class', 'st').attr('transform', (_, i) => `translate(0,${i * rowH})`);
  g.append('rect').attr('width', W).attr('height', rowH).attr('fill', 'transparent')
    .on('mousemove', (ev, d) => showTip(ev, `<b>${d.name}</b>${d.type === 'total' ? '' : '− '}${fmt(d.v)}${r.brutto ? ' · ' + pct(d.v / r.brutto) : ''}`)).on('mouseleave', hideTip);
  g.append('text').attr('x', labW - 10).attr('y', rowH / 2).attr('dy', '.35em').attr('text-anchor', 'end')
    .text((d) => (d.type === 'total' ? '' : '− ') + ((narrow && KURZ[d.name]) || d.name)).style('font-weight', (d) => (d.type === 'total' ? 600 : 400)).style('pointer-events', 'none');
  g.append('rect').attr('x', (d) => x(d.start)).attr('width', (d) => Math.max(2, x(d.end) - x(d.start)))
    .attr('y', 6).attr('height', rowH - 12).attr('rx', 4).attr('fill', (d) => col[d.type]).style('pointer-events', 'none');
  const wide = (d: S) => x(d.end) - x(d.start) > 78 && (d.type === 'total' || d.type === 'tax');
  g.append('text').attr('class', 'val').attr('y', rowH / 2).attr('dy', '.35em')
    .attr('x', (d) => (wide(d) ? x(d.start) + 7 : x(d.start) - 7)).attr('text-anchor', (d) => (wide(d) ? 'start' : 'end'))
    .style('fill', (d) => (wide(d) ? css('--surface') : null)).style('font-weight', (d) => (wide(d) ? 600 : null))
    .text((d) => fmt(d.v)).style('pointer-events', 'none');
}

// ---------- Abgabenquote ----------
function chartQuote(r: Ergebnis) {
  const base = eingabe();
  const data = d3.range(15000, 160001, 500).map((B) => {
    const c = berechne({ ...base, brutto: B }), t = c.lohnsteuer + c.soli + c.kirche, s = summeSV(c);
    return { B, tot: (t + s) / B, t: t / B, sv: s / B };
  });
  const svg = d3.select<SVGSVGElement, unknown>('#s5'); svg.selectAll('*').remove();
  const W = width(svg), narrow = W < 560, H = narrow ? 300 : 340, m = { l: 42, r: narrow ? 80 : 100, t: 16, b: 28 };
  svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const x = d3.scaleLinear().domain([15000, 160000]).range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain([0, Math.ceil(((d3.max(data, (d) => d.tot) ?? 0.5) + 0.03) * 10) / 10]).range([H - m.b, m.t]);
  svg.append('g').attr('class', 'grid').selectAll('line').data(y.ticks(5)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', (d) => y(d)).attr('y2', (d) => y(d));
  svg.append('g').attr('class', 'axis').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat((d) => Math.round(+d * 100) + ' %').tickSize(0)).select('.domain').remove();
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(narrow ? 4 : 7).tickFormat((v) => +v / 1000 + ' T€').tickSizeOuter(0));
  ([[69750, 'BBG KV/PV', 0], [101400, 'BBG RV/ALV', 1]] as const).forEach(([v, l, i]) => {
    svg.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', css('--ink-3')).attr('stroke-dasharray', '3 3');
    svg.append('text').attr('class', 'muted').attr('x', x(v) + 4).attr('y', H - m.b - 8 - (narrow ? i * 14 : 0)).text(narrow ? l.replace('BBG ', '') : l);
  });
  const series: [keyof (typeof data)[0], string, string, number][] = [['tot', 'Gesamt', css('--ink'), 2.5], ['t', 'Steuern', css('--ink-3'), 2], ['sv', 'Sozialabgaben', css('--g-soz'), 2]];
  if (base.pkv) series.splice(2, 1);
  series.forEach(([k, l, c, w]) => {
    svg.append('path').datum(data).attr('fill', 'none').attr('stroke', c).attr('stroke-width', w).attr('d', d3.line<(typeof data)[0]>().x((d) => x(d.B)).y((d) => y(d[k] as number)));
    svg.append('text').attr('x', W - m.r + 6).attr('y', y(data[data.length - 1][k] as number)).attr('dy', '.35em').text(l);
  });
  if (r.brutto >= 15000 && r.brutto <= 160000) {
    const me = summeAbgaben(r) / r.brutto;
    svg.append('circle').attr('cx', x(r.brutto)).attr('cy', y(me)).attr('r', 6).attr('fill', css('--pen')).attr('stroke', css('--surface')).attr('stroke-width', 2);
    svg.append('text').attr('x', x(r.brutto)).attr('y', y(me) - 13).attr('text-anchor', 'middle').text('Du: ' + pct(me))
      .style('font-weight', 600).style('fill', css('--pen')).style('paint-order', 'stroke').style('stroke', css('--surface')).style('stroke-width', 4);
  }
  const ch = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).attr('stroke', css('--ink-2')).style('opacity', 0);
  svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
    .on('mousemove', (ev) => {
      const [mx] = d3.pointer(ev); const B = Math.round(x.invert(mx) / 500) * 500; const d = data.find((q) => q.B === B) ?? data[0];
      ch.attr('x1', x(d.B)).attr('x2', x(d.B)).style('opacity', 1);
      showTip(ev, `<b>${fmtEur(d.B)} Brutto</b>Gesamt ${pct(d.tot)}<br>Steuern ${pct(d.t)}${base.pkv ? '' : '<br>Sozialabgaben ' + pct(d.sv)}`);
    })
    .on('mouseleave', () => { ch.style('opacity', 0); hideTip(); });
  $('#lg5').innerHTML = series.map(([, l, c]) => `<li><span class="sw" style="background:${c}"></span>${l}</li>`).join('') +
    `<li><span class="sw" style="background:${css('--pen')};border-radius:50%"></span>dein Einkommen</li>`;
}

// ---------- Zweck-Aufteilung, Waffel ----------
function nachZweck(r: Ergebnis) {
  const e = aufEbenen(r);
  const acc: Record<string, number> = { sv: summeSV(r), kirche: r.kirche };
  (Object.keys(GRUPPEN) as Gruppe[]).forEach((k) => (acc[k] = 0));
  EINZELPLAENE.forEach((p) => (acc[p.g] += (e.bund * p.v) / BUND_GESAMT));
  land.posten.forEach((p) => (acc[p.g] += (e.land * p.v) / LAND_T));
  gem.posten.forEach((p) => (acc[p.g] += (e.gemeinde * p.v) / GEM_T));
  const lab: Record<string, string> = { sv: 'Sozialversicherung', kirche: 'Kirchensteuer', ...GRUPPEN };
  return ['sv', 'soz', 'sich', 'for', 'inf', 'zins', 'verw', 'kirche']
    .map((k) => ({ k, name: lab[k], v: acc[k], style: k === 'sv' ? '' : `background:${k === 'kirche' ? css('--g-kirche') : gcol(k as Gruppe)}` }))
    .filter((d) => d.v > 0);
}
function chartWaffel(r: Ergebnis, fmt: (v: number) => string) {
  const cats = nachZweck(r).map((d) => ({ ...d, raw: 0, n: 0 })), tot = sum(cats), box = $('#waffle');
  if (!tot) { box.innerHTML = ''; return; }
  cats.forEach((d) => { d.raw = (d.v / tot) * 100; d.n = Math.floor(d.raw); });
  const rest = 100 - cats.reduce((s, d) => s + d.n, 0);
  [...cats].sort((a, b) => b.raw - b.n - (a.raw - a.n)).slice(0, rest).forEach((d) => d.n++);
  const cls = (d: (typeof cats)[0]) => (d.k === 'sv' ? ' class="hatch-bg"' : '');
  box.innerHTML = `<div class="waffle-row"><div class="waffle" role="img" aria-label="${cats.map((d) => `${d.name} ${d.n} €`).join(', ')}">${cats.flatMap((d) => Array(d.n).fill(`<i${cls(d)} style="${d.style}"></i>`)).join('')}</div>
    <ul class="wlist">${cats.map((d) => `<li><span><span class="sw${d.k === 'sv' ? ' hatch' : ''}" style="${d.style}"></span>${d.name}</span><span class="num"><b>${d.n} €</b> · ${fmt(d.v)}</span></li>`).join('')}</ul></div>`;
}

// ---------- Kalender ----------
function chartKalender(r: Ergebnis) {
  const box = $('#cal'); if (!r.brutto) { box.innerHTML = ''; return; }
  const e = aufEbenen(r);
  const rows = ([['Rentenversicherung', r.rv, 'sv'], ['Kranken- und Pflegevers.', r.kv + r.pv, 'sv'], ['Arbeitslosenvers.', r.alv, 'sv'],
    ['Bund (Lohnsteuer-Anteil und Soli)', e.bund, 'tax'], [`Land ${land.name}`, e.land, 'tax'], [stadt.name, e.gemeinde, 'tax'],
    ['Kirche', r.kirche, 'kirche'], ['PKV-Beitrag', r.pkvBeitrag, 'netto'], ['Für dich (Netto)', r.netto, 'pen']] as const).filter((d) => d[1] > 0);
  const Y = new Date(2026, 0, 1), dayMs = 864e5, days = 365;
  const fd = (d: Date) => d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  const bg = { sv: '', tax: `background:${css('--ink')}`, kirche: `background:${css('--g-kirche')}`, netto: `background:${css('--netto')}`, pen: `background:${css('--pen')}` };
  let acc = 0;
  const html = rows.map(([n, v, c]) => {
    const s = (acc / r.brutto) * days, en = ((acc + v) / r.brutto) * days; acc += v;
    const ds = new Date(Y.getTime() + Math.floor(s) * dayMs), de = new Date(Y.getTime() + Math.max(Math.floor(s), Math.ceil(en) - 1) * dayMs);
    return `<div class="cal-row"><span>${n}</span><span class="cal-bar"><i${c === 'sv' ? ' class="hatch-bg"' : ''} style="left:${(s / days) * 100}%;width:${Math.max(0.4, ((en - s) / days) * 100)}%;${bg[c]}"></i></span><span class="cal-d num">${fd(ds)} – ${fd(de)}</span></div>`;
  }).join('');
  const frei = new Date(Y.getTime() + Math.floor(((r.brutto - r.netto) / r.brutto) * days) * dayMs);
  box.innerHTML = `<p class="cal-lead">Ab dem <b class="pen">${frei.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}</b> arbeitest du rechnerisch für dich selbst.</p>${html}`;
}

// ---------- Tabelle ----------
function tabelle(r: Ergebnis) {
  const e = aufEbenen(r), f = unit === 'm' ? 1 / 12 : 1;
  const money = (v: number) => (v * f).toLocaleString('de-DE', { maximumFractionDigits: unit === 'm' ? 2 : 0, minimumFractionDigits: unit === 'm' ? 2 : 0 }) + ' €';
  const head = (t: string) => `<tr><th colspan="3" scope="colgroup" style="text-align:left;padding-top:18px;color:var(--ink);font-size:15px;font-weight:600">${t}</th></tr>`;
  const rows = (arr: P[], tot: number, amt: number) => [...arr].sort((a, b) => b.v - a.v)
    .map((p) => `<tr><td><span class="sw" style="background:${gcol(p.g)};margin-right:8px"></span>${p.name}</td><td>${pct(p.v / tot)}</td><td>${money((amt * p.v) / tot)}</td></tr>`).join('') +
    `<tr><td><b>Summe</b></td><td>100 %</td><td><b>${money(amt)}</b></td></tr>`;
  $('#tsub').textContent = `Lohnsteuer und Soli je Ebene anteilig auf deren Ausgaben umgelegt, ${unit === 'm' ? 'pro Monat' : 'pro Jahr'}.`;
  $('#tbl th.uy').textContent = unit === 'm' ? '€ / Monat' : '€ / Jahr';
  $('#tbl tbody').innerHTML =
    head(`Bund: ${money(e.bund)} (42,5 % Lohnsteuer und Soli), Haushalt 2026`) + rows(EINZELPLAENE.map((p) => ({ ...p, name: `EP ${p.n} ${p.name}` })), BUND_GESAMT, e.bund) +
    head(`Land ${land.name}: ${money(e.land)} (42,5 % Lohnsteuer), ${land.art} ${land.jahr}`) + rows(land.posten, LAND_T, e.land) +
    head(`${stadt.name}: ${money(e.gemeinde)} (15 % Lohnsteuer), ${gem.art}, ${gem.jahr}`) + rows(gem.posten, GEM_T, e.gemeinde);
}

// ---------- Bundeshaushalt (unabhängig von deinen Eingaben) ----------
function bundKennzahlen() {
  const fig = (v: string, l: string) => `<div class="fig"><span class="v ink">${v}</span><span class="l">${l}</span></div>`;
  $('#bk').innerHTML = fig(fmtMrd(BUND_GESAMT), 'Ausgaben 2026') + fig(fmtMrd(EINNAHMEN[0].v), `Steuereinnahmen, ${pct(EINNAHMEN[0].v / BUND_GESAMT)} der Ausgaben`) +
    fig(fmtMrd(EINNAHMEN[1].v), `neue Kredite, ${pct(EINNAHMEN[1].v / BUND_GESAMT)} der Ausgaben`);
}
function chartBund() {
  const svg = d3.select<SVGSVGElement, unknown>('#s1');
  const nodes: any[] = [], links: any[] = [];
  const shade = { steuer: css('--ink-2'), kredit: css('--ink-3'), sonst: css('--g-verw') };
  EINNAHMEN.forEach((i) => nodes.push({ id: 'in_' + i.k, label: i.name, color: shade[i.k] }));
  nodes.push({ id: 'hub', label: 'Bundeshaushalt', color: css('--ink'), bold: true });
  EINNAHMEN.forEach((i) => links.push({ source: 'in_' + i.k, target: 'hub', value: i.v, color: shade[i.k] }));
  epl(13).forEach((p) => { nodes.push({ id: 'ep' + p.name, label: p.name, color: gcol(p.g) }); links.push({ source: 'hub', target: 'ep' + p.name, value: p.v }); });
  drawSankey(svg, nodes, links, { h: 600, fmt: fmtMrd, mr: 230, pad: 10, share: (d: any) => pct(d.value / BUND_GESAMT) + ' des Haushalts' });
  $('#lg1').innerHTML = `<li>Graue Ströme links: Einnahmen</li>` + legendGruppen();
}
function chartTreemap() {
  const svg = d3.select<SVGSVGElement, unknown>('#s6'); svg.selectAll('*').remove();
  const W = width(svg), H = W < 560 ? 520 : 460;
  svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const root = d3.hierarchy<any>({ children: (Object.keys(GRUPPEN) as Gruppe[]).map((g) => ({ g, children: EINZELPLAENE.filter((e) => e.g === g) })) })
    .sum((d) => d.v || 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  d3.treemap<any>().size([W, H]).paddingInner(2).round(true)(root);
  const leaf = svg.selectAll('g').data(root.leaves() as d3.HierarchyRectangularNode<any>[]).join('g').attr('transform', (d) => `translate(${d.x0},${d.y0})`);
  leaf.append('rect').attr('width', (d) => d.x1 - d.x0).attr('height', (d) => d.y1 - d.y0).attr('rx', 4).attr('fill', (d) => gcol(d.data.g))
    .on('mousemove', (ev, d) => showTip(ev, `<b>EP ${d.data.n} ${d.data.name}</b>${fmtMrd(d.data.v)} · ${pct(d.data.v / BUND_GESAMT)}`)).on('mouseleave', hideTip);
  // Textfarbe je nach Fläche: hell auf dunklen, Tinte auf hellen Gruppen
  const light = (g: Gruppe) => d3.hsl(gcol(g)).l > 0.62;
  const lab = leaf.filter((d) => d.x1 - d.x0 > 64 && d.y1 - d.y0 > 32);
  lab.append('text').attr('x', 7).attr('y', 17).text((d) => d.data.name).style('font-weight', 600).style('pointer-events', 'none')
    .style('fill', (d) => (light(d.data.g) ? '#1c1f24' : '#fff'))
    .each(function (d) { const w = d.x1 - d.x0 - 12; let t = d.data.name; while (this.getComputedTextLength() > w && t.length > 3) { t = t.slice(0, -1); this.textContent = t + '…'; } });
  lab.filter((d) => d.y1 - d.y0 > 46).append('text').attr('x', 7).attr('y', 33).text((d) => fmtMrd(d.data.v)).style('font-size', '12px').style('pointer-events', 'none')
    .style('fill', (d) => (light(d.data.g) ? '#1c1f24' : '#fff'));
}
function chart2027() {
  const svg = d3.select<SVGSVGElement, unknown>('#s9'); svg.selectAll('*').remove();
  const known = EINZELPLAENE.filter((e) => ENTWURF_2027[e.n] != null);
  const rows = known.map((e) => ({ name: `EP ${e.n} ${e.name}`, d: ENTWURF_2027[e.n] - e.v, g: e.g }));
  rows.push({ name: 'Alle übrigen Einzelpläne', d: ENTWURF_2027_GESAMT - d3.sum(Object.values(ENTWURF_2027)) - (BUND_GESAMT - d3.sum(known, (e) => e.v)), g: 'verw' });
  const data = rows.filter((d) => Math.abs(d.d) >= 0.05).sort((a, b) => b.d - a.d);
  const W = width(svg), narrow = W < 560, rowH = narrow ? 36 : 28, labW = narrow ? 0 : 240, H = data.length * rowH + 24;
  svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const ext = d3.max(data, (d) => Math.abs(d.d)) ?? 1;
  const x = d3.scaleLinear().domain([-ext * (narrow ? 0.85 : 0.6), ext * (narrow ? 1.6 : 1.3)]).range([labW, W - 4]);
  svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', H - 20).attr('stroke', css('--ink-3'));
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - 20})`).call(d3.axisBottom(x).ticks(narrow ? 4 : 6).tickFormat((v) => (+v > 0 ? '+' : '') + v + ' Mrd').tickSizeOuter(0));
  const g = svg.selectAll('g.r').data(data).join('g').attr('class', 'r').attr('transform', (_, i) => `translate(0,${i * rowH})`);
  const by = narrow ? 17 : 6, bh = narrow ? 13 : 15;
  g.append('rect').attr('x', (d) => x(Math.min(0, d.d))).attr('width', (d) => Math.max(2, Math.abs(x(d.d) - x(0)))).attr('y', by).attr('height', bh).attr('rx', 4).attr('fill', (d) => gcol(d.g))
    .on('mousemove', (ev, d) => showTip(ev, `<b>${d.name}</b>${(d.d > 0 ? '+' : '') + fmtMrd(d.d)}`)).on('mouseleave', hideTip);
  g.append('text').attr('x', narrow ? 0 : labW - 10).attr('text-anchor', narrow ? 'start' : 'end').attr('y', narrow ? 11 : by + bh / 2).attr('dy', narrow ? 0 : '.35em').text((d) => d.name);
  g.append('text').attr('class', 'val').attr('y', by + bh / 2).attr('dy', '.35em').attr('x', (d) => (d.d >= 0 ? x(d.d) + 6 : x(d.d) - 6)).attr('text-anchor', (d) => (d.d >= 0 ? 'start' : 'end'))
    .text((d) => (d.d > 0 ? '+' : '−') + Math.abs(d.d).toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ' Mrd');
}
function chartEntwicklung() {
  const svg = d3.select<SVGSVGElement, unknown>('#s10'); svg.selectAll('*').remove();
  const W = width(svg), H = 280, m = { l: 8, r: 8, t: 26, b: 42 };
  svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const x = d3.scaleBand<number>().domain(ENTWICKLUNG.map((d) => d.jahr)).range([m.l, W - m.r]).padding(0.3);
  const y = d3.scaleLinear().domain([0, 700]).range([H - m.b, m.t]);
  const op = { Soll: 1, Entwurf: 0.6, Finanzplan: 0.32 };
  const g = svg.selectAll('g.c').data(ENTWICKLUNG).join('g').attr('class', 'c');
  g.append('rect').attr('x', (d) => x(d.jahr)!).attr('width', x.bandwidth()).attr('y', (d) => y(d.v)).attr('height', (d) => y(0) - y(d.v)).attr('rx', 4)
    .attr('fill', css('--ink-2')).attr('fill-opacity', (d) => op[d.status])
    .on('mousemove', (ev, d) => showTip(ev, `<b>${d.jahr} (${d.status})</b>${fmtMrd(d.v)}`)).on('mouseleave', hideTip);
  const cx = (d: (typeof ENTWICKLUNG)[0]) => x(d.jahr)! + x.bandwidth() / 2;
  g.append('text').attr('x', cx).attr('y', (d) => y(d.v) - 7).attr('text-anchor', 'middle').text((d) => d.v.toLocaleString('de-DE', { minimumFractionDigits: 1 })).style('font-weight', 600);
  g.append('text').attr('x', cx).attr('y', H - m.b + 17).attr('text-anchor', 'middle').text((d) => d.jahr);
  g.append('text').attr('class', 'muted').attr('x', cx).attr('y', H - m.b + 32).attr('text-anchor', 'middle').text((d) => (W < 560 ? { Soll: 'Soll', Entwurf: 'Entw.', Finanzplan: 'Plan' }[d.status] : d.status));
  svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', css('--rule'));
}

// ---------- Ablauf ----------
function persoenlich() {
  const r = berechne(eingabe());
  const fmt = (v: number) => fmtEur(v * (unit === 'm' ? 1 / 12 : 1));
  satz(r); kennzahlen(r, fmt); chartWasserfall(r, fmt); chartKalender(r); chartQuote(r);
  chartFluss(r); chartToepfe(r, fmt); chartWaffel(r, fmt); tabelle(r);
}
function alles() { persoenlich(); bundKennzahlen(); chartBund(); chartTreemap(); chart2027(); chartEntwicklung(); }

export function start() {
  const daten = JSON.parse($('#daten').textContent!);
  stadt = daten.stadt; land = daten.land; gem = daten.gem;
  LAND_T = sum(land.posten); GEM_T = sum(gem.posten);

  const ids = ['brutto', 'kv', 'pkv', 'kist', 'kinderlos', 'ag', 'shownetto', 'split'];
  ladeEingaben(ids);
  const syncPkv = () => (el('pkvwrap').hidden = el<HTMLSelectElement>('kv').value !== 'pkv');
  syncPkv();

  const brutto = el('brutto');
  brutto.addEventListener('input', () => {
    const clean = brutto.value.replace(/\D/g, '').slice(0, 7);
    if (clean !== brutto.value) brutto.value = clean;
  });
  ids.forEach((id) => el(id).addEventListener('input', () => { syncPkv(); speichereEingaben(ids); persoenlich(); }));
  el<HTMLSelectElement>('stadt').addEventListener('change', (ev) => {
    speichereEingaben(ids);
    location.href = `/stadt/${(ev.target as HTMLSelectElement).value}/`;
  });
  document.querySelectorAll<HTMLButtonElement>('#unit button').forEach((b) => (b.onclick = () => {
    unit = b.dataset.u as 'y' | 'm';
    document.querySelectorAll('#unit button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    persoenlich();
  }));
  let t: number;
  addEventListener('resize', () => { clearTimeout(t); t = window.setTimeout(alles, 150); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', alles);
  alles();
}
