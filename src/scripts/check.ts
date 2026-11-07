import * as d3 from 'd3';
import { BUND_GESAMT, EINNAHMEN, EINZELPLAENE, ENTWICKLUNG } from '../data/bund';
import { GRUPPEN, type Gruppe } from '../data/types';
import {
  abgabenquoten,
  aufRaster,
  einzelplanPosten,
  freiAbTag,
  grenzbelastung,
  groessteN,
  kalenderAbschnitte,
  nachZweck,
  summe,
  veraenderung2027,
  type Zweck,
} from '../lib/aufteilung';
import { mitKonsum } from '../lib/konsum';
import { naechsteStadt, type Ort } from '../lib/naehe';
import { ergebnisSatz } from '../lib/satz';
import type { SeitenDaten } from '../lib/seite';
import {
  ANTEIL,
  aufEbenen,
  berechne,
  type Eingabe,
  type Ergebnis,
  SV_2026,
  summeAbgaben,
  summeKonsum,
  summeSV,
  verfuegbar,
} from '../lib/steuer';
import { fmtMrdDelta, leseBetrag, satzText, zeitraum } from '../lib/text';
import { betragsfeld } from './betragsfeld';
import { gespeicherteStadt, ladeEingaben, speichereEingaben, speichereStadt, vergiss } from './speicher';
import {
  achseY,
  balkenMasse,
  balkenZeilen,
  css,
  drawSankey,
  esc,
  fadenkreuz,
  fmtEur,
  fmtMrd,
  gitterY,
  hatch,
  hideTip,
  holen,
  type Knoten,
  pct,
  rahmen,
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

/** Daten dieser Seite (Stadt, Land, Gemeinde-Ebene), einmal in start() aus der Seite gelesen */
let seite: SeitenDaten & { landSumme: number; gemSumme: number };
/** Gewählte Ansicht: Einheit nur in Kapitel 2 (Einstieg und Kapitel 1 rechnen jährlich), Bund als Fluss oder Fläche */
const ansicht: { einheit: 'y' | 'm'; bund: 'fluss' | 'flaeche' } = { einheit: 'm', bund: 'fluss' };

const gcol = (g: Gruppe) => css(`--cat-${g}`);
/** Kirchensteuer ist keine Haushaltsebene: neutral in der Linienfarbe */
const farbeKirche = () => css('--line');
const epl = (n: number) => groessteN(einzelplanPosten(), n);
const legendGruppen = () =>
  Object.entries(GRUPPEN)
    .map(
      ([k, l]) =>
        `<li><span class="rs-farbe" style="background:${gcol(k as Gruppe)}${k === 'verw' ? ';box-shadow:inset 0 0 0 1px var(--line)' : ''}"></span>${esc(l)}</li>`,
    )
    .join('');
const legendSV = `<li><span class="rs-farbe rs-hatch"></span>Sozialversicherung</li>`;
const legendSchaetzung = () =>
  seite.gem.schaetzung
    ? `<li>≈ Stadt geschätzt aus dem Durchschnitt der Gemeinden in ${esc(seite.land.name)}</li>`
    : '';

// ---------- Eingaben ----------
function eingabe(bruttoOverride?: number): Eingabe {
  return {
    brutto: bruttoOverride ?? leseBetrag(holen('brutto', HTMLInputElement).value),
    pkv: holen('kv', HTMLSelectElement).value === 'pkv',
    pkvMonat: +holen('pkv', HTMLInputElement).value || 0,
    kinderlos: holen('kinderlos', HTMLInputElement).checked,
    kirche: +holen('kist', HTMLSelectElement).value,
  };
}

// ---------- Ergebnis-Satz und Kennzahlen ----------
function satz(r: Ergebnis) {
  holen('result').innerHTML = ergebnisSatz(r, seite.stadt, seite.land, seite.gem);
}

function kennzahlen(r: Ergebnis, fmt: (v: number) => string) {
  const abg = summeAbgaben(r);
  const fig = (v: string, l: string, mark = false) =>
    `<div class="rs-kennzahl"><b${mark ? ' class="rs-mark"' : ''}>${v}</b><span>${esc(l)}</span></div>`;
  const k = r.konsum;
  holen('pk').innerHTML =
    fig(
      fmt(abg),
      `deine Abgaben${k ? ' mit Konsumsteuern ≈' : ''}, ${r.brutto ? pct(abg / r.brutto) : '–'} vom Brutto`,
    ) +
    fig(fmt(r.lohnsteuer + r.soli), 'Lohnsteuer und Soli') +
    (k
      ? fig(fmt(k.summe), `Konsumsteuern ≈, ${r.netto ? pct(k.summe / r.netto) : '–'} vom Netto`)
      : fig(fmt(summeSV(r)), 'Sozialabgaben, dein Anteil')) +
    fig(
      fmt(verfuegbar(r)),
      k ? 'dein Netto nach Konsumsteuern ≈' : r.pkv ? 'dein Netto nach PKV-Beitrag' : 'dein Netto (Näherung)',
      true,
    );
  // Anteilsbalken: Steuern, Sozialversicherung, PKV, Konsumsteuern, Netto
  const teile = (
    [
      ['Steuern', r.lohnsteuer + r.soli + r.kirche, `background:${css('--ink')}`, ''],
      ['Sozialversicherung', summeSV(r), '', 'rs-hatch'],
      ['PKV-Beitrag', r.pkvBeitrag, `background:${css('--line')}`, ''],
      ['Konsumsteuern ≈', summeKonsum(r), '', 'rs-hatch-konsum'],
      ['Netto', verfuegbar(r), `background:${css('--marker')}`, ''],
    ] as const
  ).filter((t) => t[1] > 0);
  const a = holen('anteil');
  a.setAttribute('aria-label', `${fmtEur(r.brutto)} Brutto: ${teile.map(([n, v]) => `${n} ${fmtEur(v)}`).join(', ')}`);
  a.innerHTML = teile.map(([, v, st, cl]) => `<i class="${cl}" style="flex:${v};${st}"></i>`).join('');
  holen('anteil-lg').innerHTML = teile
    .map(
      ([n, v, st, cl]) =>
        `<li><span class="rs-farbe ${cl}" style="${st}"></span>${esc(n)} <b${n === 'Netto' ? ' class="rs-mark"' : ''}>${fmt(v)}</b> <span style="color:var(--ink-3)">${r.brutto ? pct(v / r.brutto) : ''}</span></li>`,
    )
    .join('');
}

// ---------- Sankey deiner Abgaben ----------
function chartFluss(r: Ergebnis) {
  const withAG = holen('ag', HTMLInputElement).checked,
    showN = holen('shownetto', HTMLInputElement).checked,
    show = holen('split', HTMLSelectElement).value;
  const f = ansicht.einheit === 'm' ? 1 / 12 : 1,
    fmt = (v: number) => fmtEur(v * f);
  const e = aufEbenen(r);
  const svg = d3.select<SVGSVGElement, unknown>('#dein-fluss');
  const sv = hatch(svg, 'dein-fluss');
  const nodes: Knoten[] = [],
    links: Verbindung[] = [];
  const add = (id: string, label: string, color: string, extra: Partial<Knoten> = {}) => {
    nodes.push({ id, label, color, ...extra });
  };
  add('brutto', showN ? 'Dein Brutto' : 'Deine Abgaben', css('--ink'), { bold: true, col: 0 });
  const agSum = withAG ? r.ag.rv + r.ag.alv + r.ag.kv + r.ag.pv : 0;
  if (agSum > 0) add('ag', 'Arbeitgeberanteil', css('--line'), { col: 0 });
  const k = r.konsum;
  if (r.lohnsteuer > 0 || k?.summe) {
    add('bund', 'Bund', css('--ink'), { bold: true, col: 2 });
    add('land', `Land ${seite.land.name}`, css('--ink'), { bold: true, col: 2 });
    add('gem', seite.stadt.stadtstaat ? `${seite.stadt.name} (Gemeindeanteil)` : seite.stadt.name, css('--ink'), {
      bold: true,
      col: 2,
    });
  }
  if (r.lohnsteuer > 0) {
    add('lst', 'Lohnsteuer', css('--ink'), { col: 1 });
    links.push({ source: 'brutto', target: 'lst', value: r.lohnsteuer });
    links.push({ source: 'lst', target: 'bund', value: r.lohnsteuer * ANTEIL.bund });
    links.push({ source: 'lst', target: 'land', value: r.lohnsteuer * ANTEIL.land });
    links.push({ source: 'lst', target: 'gem', value: r.lohnsteuer * ANTEIL.gemeinde });
  }
  if (r.soli > 0) {
    add('soli', 'Soli', css('--ink'), { col: 1 });
    links.push({ source: 'brutto', target: 'soli', value: r.soli }, { source: 'soli', target: 'bund', value: r.soli });
  }
  if (r.kirche > 0) {
    add('ki', 'Kirchensteuer', farbeKirche(), { col: 1 });
    links.push({ source: 'brutto', target: 'ki', value: r.kirche });
  }
  // Konsumsteuern unter den Steuern, damit ihre Bänder zu den Ebenen nicht kreuzen
  if (k?.summe) {
    const tinte = css('--ink');
    add('konsum', 'Konsumsteuern ≈', hatch(svg, 'dein-fluss-konsum', '--ink', -45), { col: 1 });
    links.push({ source: 'brutto', target: 'konsum', value: k.summe, color: tinte });
    links.push({ source: 'konsum', target: 'bund', value: k.bund, color: tinte });
    links.push({ source: 'konsum', target: 'land', value: k.land, color: tinte });
    links.push({ source: 'konsum', target: 'gem', value: k.gemeinde, color: tinte });
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
    ebene('land', groessteN(seite.land.posten, show === 'all' ? 6 : 13), seite.landSumme, e.land, 'Land · ');
  if (e.gemeinde > 0 && (show === 'all' || show === 'gem'))
    ebene(
      'gem',
      groessteN(seite.gem.posten, show === 'all' ? 5 : 12),
      seite.gemSumme,
      e.gemeinde,
      seite.gem.schaetzung ? 'Stadt ≈ ' : 'Stadt · ',
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
    if (verfuegbar(r) > 0) {
      add('netto', k ? 'Netto nach Konsumsteuern ≈' : 'Netto', css('--marker'), { col: 1 });
      links.push({ source: 'brutto', target: 'netto', value: verfuegbar(r) });
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
  holen('lg-fluss').innerHTML = legendSV + legendGruppen() + legendSchaetzung();
}

// ---------- Sortierte Balken ----------
function chartToepfe(r: Ergebnis, fmt: (v: number) => string) {
  const e = aufEbenen(r);
  const sv = hatch(d3.select('#toepfe'), 'toepfe');
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
  if (r.kirche > 0) items.push({ name: 'Kirchensteuer', v: r.kirche, c: farbeKirche() });
  epl(10).forEach((p) => {
    items.push({ name: `Bund · ${p.name.replace(/^EP \d+ /, '')}`, v: (e.bund * p.v) / BUND_GESAMT, c: gcol(p.g) });
  });
  groessteN(seite.land.posten, 7).forEach((p) => {
    items.push({ name: `Land · ${p.name}`, v: (e.land * p.v) / seite.landSumme, c: gcol(p.g) });
  });
  groessteN(seite.gem.posten, 5).forEach((p) => {
    items.push({
      name: (seite.gem.schaetzung ? 'Stadt ≈ ' : 'Stadt · ') + p.name,
      v: (e.gemeinde * p.v) / seite.gemSumme,
      c: gcol(p.g),
    });
  });
  items.sort((a, b) => b.v - a.v);
  const zeile = (schmal: boolean) => (schmal ? 36 : 26);
  const { svg, W, schmal } = rahmen('toepfe', (_, s) => items.length * zeile(s) + 8);
  const mass = balkenMasse(schmal, 280, 5);
  const { by, bh, labW } = mass;
  const { g, beschriften } = balkenZeilen(svg, items, mass, { zeile: zeile(schmal), oben: 4, klasse: 'row' });
  const x = d3
    .scaleLinear()
    .domain([0, d3.max(items, (d) => d.v) || 1])
    .range([0, W - labW - 86]);
  g.append('rect')
    .attr('x', 0)
    .attr('width', W)
    .attr('height', zeile(schmal))
    .attr('fill', 'transparent')
    .on('mousemove', (ev, d) =>
      showTip(ev, `<b>${esc(d.name)}</b>${fmt(d.v)}${r.brutto ? ` · ${pct(d.v / r.brutto)} vom Brutto` : ''}`),
    )
    .on('mouseleave', hideTip);
  beschriften((d) => d.name, true);
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
  holen('barsub').textContent =
    `Alle Ziele deiner Abgaben ${zeitraum(ansicht.einheit)}; kleine Posten je Ebene sind zusammengefasst.`;
  holen('toepfe-sum').textContent = items.length ? `größter Topf: ${items[0].name} mit ${fmt(items[0].v)}` : '';
  holen('lg-toepfe').innerHTML = legendSV + legendGruppen() + legendSchaetzung();
}

// ---------- Abgabenquote ----------
function chartQuote(r: Ergebnis) {
  const base = eingabe();
  const data = abgabenquoten(base, !!r.konsum);
  const { svg, W, H, schmal: narrow } = rahmen('quote', (_, schmal) => (schmal ? 300 : 340));
  const m = { l: 42, r: narrow ? 80 : r.konsum ? 128 : 100, t: 16, b: 28 };
  const x = d3
    .scaleLinear()
    .domain([15000, 160000])
    .range([m.l, W - m.r]);
  const y = d3
    .scaleLinear()
    .domain([0, Math.ceil(((d3.max(data, (d) => d.gesamt) ?? 0.5) + 0.03) * 10) / 10])
    .range([H - m.b, m.t]);
  gitterY(svg, y, m.l, W - m.r, 5);
  achseY(svg, y, m.l, 5, (d) => `${Math.round(+d * 100)} %`);
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
      [SV_2026.bbgKv, 'BBG KV/PV', 0],
      [SV_2026.bbgRv, 'BBG RV/ALV', 1],
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
  const series: [keyof (typeof data)[0], string, string, number, string?][] = [
    ['gesamt', 'Gesamt', css('--ink'), 2.5],
    ['steuern', 'Steuern', css('--ink-3'), 2],
    ['sozial', 'Sozialabgaben', css('--cat-soz'), 2],
  ];
  if (base.pkv) series.splice(2, 1);
  // Konsumsteuern: gepunktet, weil geschätzt
  if (r.konsum) series.push(['konsum', narrow ? 'Konsum ≈' : 'Konsumsteuern ≈', css('--ink-2'), 2, '2 3']);
  series.forEach(([k, l, c, w, strich]) => {
    svg
      .append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', c)
      .attr('stroke-width', w)
      .attr('stroke-dasharray', strich ?? null)
      .attr(
        'd',
        d3
          .line<(typeof data)[0]>()
          .x((d) => x(d.brutto))
          .y((d) => y(d[k] as number)),
      );
    svg
      .append('text')
      .attr('x', W - m.r + 6)
      .attr('y', y(data[data.length - 1][k] as number))
      .attr('dy', '.35em')
      .text(l);
  });
  holen('quote-sum').textContent = r.brutto ? `bei dir ${pct(summeAbgaben(r) / r.brutto)} vom Brutto` : '';
  const grenze = Math.round(grenzbelastung(base) * 100);
  holen('quote-grenze').innerHTML = r.brutto
    ? `Von jedem zusätzlichen Euro Brutto gehen bei dir <b class="rs-mark">${grenze}\u00a0Cent</b> an Lohnsteuer, Soli${base.kirche ? ', Kirche' : ''} und Sozialversicherung.`
    : '';
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
  fadenkreuz(svg, m, W, H, (mx) => {
    const B = Math.round(x.invert(mx) / 500) * 500;
    const d = data.find((q) => q.brutto === B) ?? data[0];
    return {
      x: x(d.brutto),
      html: `<b>${fmtEur(d.brutto)} Brutto</b>Gesamt ${pct(d.gesamt)}<br>Steuern ${pct(d.steuern)}${base.pkv ? '' : `<br>Sozialabgaben ${pct(d.sozial)}`}${r.konsum ? `<br>Konsumsteuern ≈ ${pct(d.konsum)}` : ''}`,
    };
  });
  holen('lg-quote').innerHTML =
    series
      .map(([, l, c, , strich]) =>
        strich
          ? `<li><span class="rs-farbe" style="height:0;border-top:2px dotted ${c};align-self:center"></span>${esc(l)}</li>`
          : `<li><span class="rs-farbe" style="background:${c}"></span>${esc(l)}</li>`,
      )
      .join('') +
    `<li><span class="rs-farbe" style="background:${css('--marker')};border-radius:50%;box-shadow:inset 0 0 0 1.5px ${css('--ink')}"></span>dein Einkommen</li>`;
}

// ---------- Zweck-Aufteilung, Waffel ----------
const zweckFarbe = (k: Zweck) =>
  k === 'sv'
    ? { style: '', cls: 'rs-hatch' }
    : k === 'kirche'
      ? { style: '', cls: 'rs-hohl' }
      : { style: `background:${gcol(k)}`, cls: '' };
function chartRaster(r: Ergebnis, fmt: (v: number) => string) {
  const zwecke = nachZweck(r, seite.land, seite.gem);
  const kaestchen = aufRaster(zwecke.map((d) => d.v));
  const cats = zwecke.map((d, i) => ({ ...d, ...zweckFarbe(d.k), n: kaestchen[i] }));
  const raster = holen('raster'),
    liste = holen('zweck');
  if (!summe(zwecke)) {
    raster.innerHTML = '<i></i>'.repeat(100);
    liste.innerHTML = '';
    return;
  }
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
  const raster = holen('raster');
  raster.classList.toggle('rs-fokus', !!k);
  for (const c of raster.children) c.classList.toggle('rs-im-fokus', !!k && (c as HTMLElement).dataset.k === k);
}

/** Gelegentlicher leiser Schimmer – nur sichtbar, im Bild und ohne Fokus */
function schimmern() {
  const raster = holen('raster');
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
  if (!box || !seite.arten) return;
  const anteil = seite.stadt.stadtstaat ? 0 : aufEbenen(r).gemeinde;
  const summe = seite.arten.posten.reduce((s, p) => s + p.proKopf, 0);
  const max = Math.max(...seite.arten.posten.map((p) => p.proKopf), ...seite.arten.schnitt.map((p) => p.proKopf));
  const de = (v: number) => v.toLocaleString('de-DE');
  box.innerHTML =
    seite.arten.posten
      .map((p, i) => {
        const s = seite.arten!.schnitt[i]?.proKopf ?? 0;
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
    `<ul class="rs-legende"><li><span class="rs-farbe" style="background:${css('--ink')}"></span>${esc(seite.stadt.name)}, € je Einwohner</li><li><span class="rs-farbe" style="width:3px;background:${css('--cat-sich')}"></span>Durchschnitt aller ${seite.arten.anzahl} kreisfreien Städte</li><li><span class="rs-farbe" style="background:${css('--marker')}"></span>dein Gemeindeanteil ${zeitraum(ansicht.einheit)}</li></ul>`;
}

// ---------- Kalender ----------
function chartKalender(r: Ergebnis) {
  const box = holen('cal');
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
      [r.konsum ? 'Bund (inkl. Konsumsteuern ≈)' : 'Bund (Lohnsteuer-Anteil und Soli)', e.bund, 'tax'],
      [`Land ${seite.land.name}`, e.land, 'tax'],
      [seite.stadt.name, e.gemeinde, 'tax'],
      ['Kirche', r.kirche, 'kirche'],
      ['PKV-Beitrag', r.pkvBeitrag, 'pkv'],
      [r.konsum ? 'Für dich (nach Konsumsteuern ≈)' : 'Für dich (Netto)', verfuegbar(r), 'netto'],
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
  const abschnitte = kalenderAbschnitte(
    rows.map((d) => d[1]),
    r.brutto,
    days,
  );
  const html = rows
    .map(([n, , c], i) => {
      const a = abschnitte[i];
      const ds = new Date(Y.getTime() + a.von * dayMs),
        de = new Date(Y.getTime() + a.bis * dayMs);
      return `<div class="cal-row"><span>${esc(n)}</span><span class="cal-bar"><i${c === 'sv' ? ' class="rs-hatch"' : ''} style="left:${a.start * 100}%;width:${Math.max(0.4, (a.ende - a.start) * 100)}%;${bg[c]}"></i></span><span class="cal-d num">${fd(ds)} – ${fd(de)}</span></div>`;
    })
    .join('');
  const frei = new Date(Y.getTime() + freiAbTag(r, days) * dayMs);
  holen('cal-sum').textContent =
    `ab dem ${frei.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })} arbeitest du für dich`;
  box.innerHTML = `<p class="cal-lead">Ab dem <b class="rs-mark">${frei.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}</b> arbeitest du rechnerisch für dich selbst.</p>${html}`;
}

// ---------- Tabelle ----------
function tabelle(r: Ergebnis) {
  const e = aufEbenen(r),
    f = ansicht.einheit === 'm' ? 1 / 12 : 1;
  const money = (v: number) =>
    `${(v * f).toLocaleString('de-DE', {
      maximumFractionDigits: ansicht.einheit === 'm' ? 2 : 0,
      minimumFractionDigits: ansicht.einheit === 'm' ? 2 : 0,
    })} €`;
  const head = (t: string) => `<tr><th colspan="3" scope="colgroup" class="rs-zwischen">${esc(t)}</th></tr>`;
  const rows = (arr: P[], tot: number, amt: number) =>
    `${[...arr]
      .sort((a, b) => b.v - a.v)
      .map(
        (p) =>
          `<tr><td><span class="rs-farbe" style="background:${gcol(p.g)};margin-right:8px"></span>${esc(p.name)}</td><td>${pct(p.v / tot)}</td><td>${money((amt * p.v) / tot)}</td></tr>`,
      )
      .join('')}<tr><td><b>Summe</b></td><td>100 %</td><td><b>${money(amt)}</b></td></tr>`;
  holen('tsub').textContent =
    `Lohnsteuer und Soli${r.konsum ? ' und geschätzte Konsumsteuern' : ''} je Ebene anteilig auf deren Ausgaben umgelegt, ${zeitraum(ansicht.einheit)}.`;
  const mitK = (anteil: number, lohn: string, konsum = 0) =>
    konsum ? `${satzText(anteil)} ${lohn}, ${money(konsum)} Konsumsteuern ≈` : `${satzText(anteil)} ${lohn}`;
  holen('tcount').textContent =
    `${EINZELPLAENE.length + seite.land.posten.length + seite.gem.posten.length} Posten von Bund, ${seite.land.name} und ${seite.stadt.name}`;
  holen('tbl-einheit').textContent = ansicht.einheit === 'm' ? '€ / Monat' : '€ / Jahr';
  holen('tbl', HTMLTableElement).tBodies[0].innerHTML =
    head(`Bund: ${money(e.bund)} (${mitK(ANTEIL.bund, 'Lohnsteuer und Soli', r.konsum?.bund)}), Haushalt 2026`) +
    rows(
      EINZELPLAENE.map((p) => ({ ...p, name: `EP ${p.n} ${p.name}` })),
      BUND_GESAMT,
      e.bund,
    ) +
    head(
      `Land ${seite.land.name}: ${money(e.land)} (${mitK(ANTEIL.land, 'Lohnsteuer', r.konsum?.land)}), ${seite.land.art} ${seite.land.jahr}`,
    ) +
    rows(seite.land.posten, seite.landSumme, e.land) +
    head(
      `${seite.stadt.name}: ${money(e.gemeinde)} (${mitK(ANTEIL.gemeinde, 'Lohnsteuer', r.konsum?.gemeinde)}), ${seite.gem.art}, ${seite.gem.jahr}`,
    ) +
    rows(seite.gem.posten, seite.gemSumme, e.gemeinde);
}

// ---------- Bundeshaushalt (unabhängig von deinen Eingaben) ----------
function bundKennzahlen() {
  const fig = (v: string, l: string) => `<div class="rs-kennzahl"><b>${v}</b><span>${esc(l)}</span></div>`;
  holen('bk').innerHTML =
    fig(fmtMrd(BUND_GESAMT), 'Ausgaben 2026') +
    fig(fmtMrd(EINNAHMEN[0].v), `Steuereinnahmen, ${pct(EINNAHMEN[0].v / BUND_GESAMT)} der Ausgaben`) +
    fig(fmtMrd(EINNAHMEN[1].v), `neue Kredite, ${pct(EINNAHMEN[1].v / BUND_GESAMT)} der Ausgaben`);
}
function chartBund() {
  const svg = d3.select<SVGSVGElement, unknown>('#bund-fluss');
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
  holen('lg-bund').innerHTML = `<li>Graue Ströme links: Einnahmen</li>${legendGruppen()}`;
}
function chartTreemap() {
  const svg = d3.select<SVGSVGElement, unknown>('#bund-flaeche');
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
    .style('fill', (d) => (light(blatt(d).g) ? css('--on-hell') : css('--on-dunkel')))
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
    .style('fill', (d) => (light(blatt(d).g) ? css('--on-hell') : css('--on-dunkel')));
}
function chart2027() {
  const data = veraenderung2027();
  const zeile = (schmal: boolean) => (schmal ? 42 : 28);
  const { svg, W, H, schmal: narrow } = rahmen('entwurf-2027', (_, s) => data.length * zeile(s) + 24);
  const mass = balkenMasse(narrow, 240, 6);
  const { by, bh, labW } = mass;
  const ext = d3.max(data, (d) => Math.abs(d.d)) ?? 1;
  const min = Math.min(0, d3.min(data, (d) => d.d) ?? 0),
    max = Math.max(0, d3.max(data, (d) => d.d) ?? 0);
  let x: d3.ScaleLinear<number, number>;
  if (narrow) {
    // Handy: Null bei knapp zwei Dritteln der Breite; die Werte stehen auf der anderen Seite der
    // Nulllinie (siehe unten), deshalb laufen die Balken bis an den Rand
    const null0 = W * 0.64,
      rechts = W - 4;
    const proPixel = max / Math.max(1, rechts - null0);
    const links = Math.min(min * 1.15, -(null0 - 4) * proPixel);
    x = d3.scaleLinear().domain([links, max]).range([4, rechts]);
  } else {
    x = d3
      .scaleLinear()
      .domain([-ext * 0.6, ext * 1.3])
      .range([labW, W - 4]);
  }
  const unten = H - 20;
  if (narrow) {
    // Hilfslinien an den Teilstrichen, hinter allem
    svg
      .append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(d3.range(Math.ceil(x.domain()[0] / 10) * 10, max + 1, 10).filter((t) => t !== 0))
      .join('line')
      .attr('x1', (t) => x(t))
      .attr('x2', (t) => x(t))
      .attr('y1', 0)
      .attr('y2', unten);
  }
  svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', unten).attr('stroke', css('--ink-3'));
  // Handy: Teilstriche alle 10 Mrd, nur Zahlen (die Einheit steht an jedem Balken)
  const ticks = narrow ? d3.range(Math.ceil(x.domain()[0] / 10) * 10, max + 1, 10) : x.ticks(6);
  svg
    .append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${unten})`)
    .call(
      d3
        .axisBottom(x)
        .tickValues(ticks)
        .tickFormat((v) => `${+v > 0 ? '+' : +v < 0 ? '−' : ''}${Math.abs(+v)}${narrow ? '' : ' Mrd'}`)
        .tickSizeOuter(0),
    );
  const { g, beschriften } = balkenZeilen(svg, data, mass, { zeile: zeile(narrow), oben: 0, klasse: 'r' });
  g.append('rect')
    .attr('x', (d) => x(Math.min(0, d.d)))
    .attr('width', (d) => Math.max(2, Math.abs(x(d.d) - x(0))))
    .attr('y', by)
    .attr('height', bh)
    .attr('rx', 4)
    .attr('fill', (d) => gcol(d.g))
    .on('mousemove', (ev, d) => showTip(ev, `<b>${esc(d.name)}</b>${fmtMrdDelta(d.d)}`))
    .on('mouseleave', hideTip);
  beschriften((d) => d.name);
  // Handy: Namen über den Linien mit einem Rand in Panelfarbe, damit Hilfs- und Nulllinie nicht stören
  if (narrow)
    g.selectAll('text')
      .style('paint-order', 'stroke')
      .style('stroke', css('--surface'))
      .style('stroke-width', 5)
      .style('stroke-linejoin', 'round');
  // Desktop: Wert hinter dem Balkenende. Handy: Wert auf der anderen Seite der Nulllinie, in der freien Fläche
  const wertX = (d: (typeof data)[0]) =>
    narrow ? (d.d >= 0 ? x(0) - 6 : x(0) + 6) : d.d >= 0 ? x(d.d) + 6 : x(d.d) - 6;
  const wertAnker = (d: (typeof data)[0]) => (d.d >= 0 !== narrow ? 'start' : 'end');
  const werte = g
    .append('text')
    .attr('class', 'val')
    .attr('y', by + bh / 2)
    .attr('dy', '.35em')
    .attr('x', wertX)
    .attr('text-anchor', wertAnker)
    .text((d) => fmtMrdDelta(d.d).replace(/\u00a0€$/, ''));
  if (narrow)
    werte
      .style('paint-order', 'stroke')
      .style('stroke', css('--surface'))
      .style('stroke-width', 5)
      .style('stroke-linejoin', 'round');
}
function chartEntwicklung() {
  const { svg, W, H, schmal } = rahmen('entwicklung', () => 296);
  const m = { l: 8, r: 8, t: 26, b: 58 };
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
  // Übrige Ausgaben oben (blasser für Entwurf und Plan), Zinsen unten immer voll, dazwischen 2px Fläche
  const tip = (ev: MouseEvent, d: (typeof ENTWICKLUNG)[0]) =>
    showTip(
      ev,
      `<b>${d.jahr} (${d.status})</b>${fmtMrd(d.v)}<br>davon Zinsen ${fmtMrd(d.zinsen)} (${pct(d.zinsen / d.v)})`,
    );
  g.append('rect')
    .attr('x', (d) => x(d.jahr)!)
    .attr('width', x.bandwidth())
    .attr('y', (d) => y(d.v))
    .attr('height', (d) => Math.max(0, y(d.zinsen) - y(d.v) - 2))
    .attr('rx', 4)
    .attr('fill', css('--line'))
    .attr('fill-opacity', (d) => op[d.status])
    .on('mousemove', tip)
    .on('mouseleave', hideTip);
  g.append('rect')
    .attr('x', (d) => x(d.jahr)!)
    .attr('width', x.bandwidth())
    .attr('y', (d) => y(d.zinsen))
    .attr('height', (d) => y(0) - y(d.zinsen))
    .attr('fill', gcol('zins'))
    .on('mousemove', tip)
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
    .text((d) => (schmal ? { Soll: 'Soll', Entwurf: 'Entw.', Finanzplan: 'Plan' }[d.status] : d.status));
  // Zinsanteil als Zahl unter dem Jahr: Kennzeichen nicht nur über die Farbe
  g.append('text')
    .attr('x', cx)
    .attr('y', H - m.b + 50)
    .attr('text-anchor', 'middle')
    .text((d) => `${Math.round((d.zinsen / d.v) * 100)}\u00a0%`)
    .style('font-weight', 600);
  holen('lg-entwicklung').innerHTML =
    `<li><span class="rs-farbe" style="background:${gcol('zins')}"></span>Zinsen, Anteil unter dem Jahr</li>` +
    `<li><span class="rs-farbe" style="background:${css('--line')}"></span>übrige Ausgaben</li>` +
    '<li>übrige Ausgaben blasser: Entwurf und Finanzplan</li>';
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
  const kv = holen('kv', HTMLSelectElement).value === 'pkv' ? 'privat versichert' : 'gesetzlich versichert';
  const ki = +holen('kist', HTMLSelectElement).value ? 'mit Kirchensteuer' : 'keine Kirchensteuer';
  holen('mehr-sum').textContent =
    `${kv}, ${ki}, ${holen('kinderlos', HTMLInputElement).checked ? 'kinderlos' : 'mit Kindern'}`;
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
const konsumAn = () => holen('konsum', HTMLInputElement).checked;
function persoenlich() {
  const ohne = berechne(eingabe());
  const r = konsumAn() ? mitKonsum(ohne) : ohne;
  holen('k2-konsum').hidden = !r.konsum;
  const fmtK2 = (v: number) => fmtEur(v * (ansicht.einheit === 'm' ? 1 / 12 : 1)); // Kapitel 2: Monat/Jahr
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
  holen('ansicht-fluss').hidden = ansicht.bund !== 'fluss';
  holen('ansicht-flaeche').hidden = ansicht.bund !== 'flaeche';
  holen('bundsub').textContent =
    ansicht.bund === 'fluss'
      ? 'Einnahmen, Bundeshaushalt, Einzelpläne. Antippen oder Überfahren zeigt Beträge.'
      : 'Jedes Rechteck ist ein Einzelplan, die Fläche entspricht den Ausgaben 2026.';
  if (ansicht.bund === 'fluss') chartBund();
  else {
    chartTreemap();
    holen('lg-bund').innerHTML = legendGruppen();
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
function orten(orte: readonly Ort[], ids: string[], vonHand: boolean) {
  const knopf = holen('naehe', HTMLButtonElement),
    status = holen('naehe-status');
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
      if (slug === seite.stadt.slug) {
        knopf.disabled = false;
        status.textContent = `${seite.stadt.name} ist die nächste kreisfreie Stadt.`;
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
  const daten = JSON.parse(holen('daten').textContent ?? '{}') as SeitenDaten;
  seite = { ...daten, landSumme: summe(daten.land.posten), gemSumme: summe(daten.gem.posten) };

  const ids = ['brutto', 'kv', 'pkv', 'kist', 'kinderlos', 'konsum', 'ag', 'shownetto', 'split'];
  const orte = daten.orte;

  // Startseite: gemerkte Stadt öffnen; sonst den Standort nur nutzen, wenn er schon freigegeben ist
  if (location.pathname === '/') {
    const gemerkt = gespeicherteStadt();
    if (gemerkt && gemerkt !== seite.stadt.slug && orte.some(([s]) => s === gemerkt)) {
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
  holen('naehe', HTMLButtonElement).addEventListener('click', () => orten(orte, ids, true));
  const liste = holen('zweck');
  liste.addEventListener('pointerover', (e) =>
    fokusAuf((e.target as HTMLElement).closest<HTMLElement>('li')?.dataset.k ?? null),
  );
  liste.addEventListener('pointerleave', () => fokusAuf(null));
  schimmern();
  holen('vergessen', HTMLButtonElement).addEventListener('click', () => {
    vergiss();
    location.href = '/';
  });

  ladeEingaben(ids);
  const syncPkv = () => (holen('pkvwrap').hidden = holen('kv', HTMLSelectElement).value !== 'pkv');
  syncPkv();

  const brutto = holen('brutto', HTMLInputElement);
  betragsfeld(brutto);
  // Hinweis „Vorbelegt mit dem Median“ nur, solange der Median drinsteht
  const syncVorbelegt = () => {
    holen('vorbelegt').hidden = leseBetrag(brutto.value) !== daten.median;
  };
  syncVorbelegt();
  brutto.addEventListener('input', syncVorbelegt);
  ids.forEach((id) => {
    holen(id).addEventListener('input', () => {
      syncPkv();
      speichereEingaben(ids);
      persoenlich();
    });
  });
  holen('stadt', HTMLSelectElement).addEventListener('change', (ev) => {
    speichereEingaben(ids);
    speichereStadt((ev.target as HTMLSelectElement).value);
    location.href = `/stadt/${(ev.target as HTMLSelectElement).value}/`;
  });
  document.querySelectorAll<HTMLButtonElement>('#unit button').forEach((b) => {
    b.addEventListener('click', () => {
      ansicht.einheit = b.dataset.u as 'y' | 'm';
      document.querySelectorAll('#unit button').forEach((x) => {
        x.setAttribute('aria-pressed', String(x === b));
      });
      persoenlich();
    });
  });
  document.querySelectorAll<HTMLButtonElement>('#bundansicht button').forEach((b) => {
    b.addEventListener('click', () => {
      ansicht.bund = b.dataset.ansicht as 'fluss' | 'flaeche';
      document.querySelectorAll('#bundansicht button').forEach((x) => {
        x.setAttribute('aria-pressed', String(x === b));
      });
      bund();
    });
  });
  // Zugeklappte Diagramme haben keine Breite: beim Aufklappen neu zeichnen
  document.querySelectorAll<HTMLDetailsElement>('details[data-neu-zeichnen]').forEach((d) => {
    d.addEventListener('toggle', () => {
      if (d.open) persoenlich();
    });
  });
  // Nur bei geänderter Breite neu zeichnen (auf dem Handy ändert die Adressleiste ständig die Höhe)
  let t: number;
  let breite = innerWidth;
  addEventListener('resize', () => {
    if (innerWidth === breite) return;
    breite = innerWidth;
    clearTimeout(t);
    t = window.setTimeout(alles, 150);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', alles);
  new MutationObserver(alles).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  alles();
}
