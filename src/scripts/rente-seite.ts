import * as d3 from 'd3';
import { type RenteErgebnis, renteVsEtf, VORLAGEN } from '../lib/rente';
import { ladeEingaben, speichereEingaben } from './speicher';
import { $, css, fmtEur, hideTip, showTip, width } from './viz';

const el = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as T;
const num = (id: string) => +el(id).value;

function modell() {
  return renteVsEtf({
    modus: el<HTMLSelectElement>('mode').value as 'life' | 'now',
    bruttoHeute: num('brutto'),
    alterHeute: num('age'),
    einstiegsalter: num('c_a0'),
    einstiegsgehalt: num('c_s0'),
    hoehepunktGehalt: num('c_s1'),
    hoehepunktAlter: num('c_ap'),
    dynamik: num('c_g'),
    heuteEinbeziehen: el('c_usenow').checked,
    etfRendite: num('etfr'),
    niveau: num('niveau'),
    depotBis: num('until'),
    pkv: el<HTMLSelectElement>('kv').value === 'pkv',
    pkvMonat: num('pkv'),
    kinderlos: el('kinderlos').checked,
    kirche: num('kist'),
  });
}

interface Serie {
  name: string;
  data: number[];
  c: string;
  w?: number;
  dash?: string;
}
function linien(id: string, x0: number, x1: number, series: Serie[], legend: string, vline?: [number, string]) {
  const svg = d3.select<SVGSVGElement, unknown>(`#${id}`);
  svg.selectAll('*').remove();
  const W = width(svg),
    H = W < 420 ? 240 : 280,
    m = { l: 54, r: 12, t: 14, b: 26 };
  svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const x = d3
    .scaleLinear()
    .domain([x0, x1])
    .range([m.l, W - m.r]);
  const y = d3
    .scaleLinear()
    .domain([0, (d3.max(series, (s) => d3.max(s.data)) ?? 1) * 1.08 || 1])
    .nice()
    .range([H - m.b, m.t]);
  svg
    .append('g')
    .attr('class', 'grid')
    .selectAll('line')
    .data(y.ticks(4))
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
        .ticks(4)
        .tickFormat((v) => `${Math.round(+v / 1000)} T€`)
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
        .ticks(W < 420 ? 4 : 6)
        .tickFormat((v) => String(v))
        .tickSizeOuter(0),
    );
  if (vline) {
    svg
      .append('line')
      .attr('x1', x(vline[0]))
      .attr('x2', x(vline[0]))
      .attr('y1', m.t)
      .attr('y2', H - m.b)
      .attr('stroke', css('--ink-3'))
      .attr('stroke-dasharray', '3 3');
    svg
      .append('text')
      .attr('class', 'muted')
      .attr('x', x(vline[0]) + 4)
      .attr('y', m.t + 10)
      .text(W < 420 ? 'Ø Lebenserw.' : vline[1]);
  }
  series.forEach((s) => {
    svg
      .append('path')
      .datum(s.data)
      .attr('fill', 'none')
      .attr('stroke', s.c)
      .attr('stroke-width', s.w ?? 2)
      .attr('stroke-dasharray', s.dash ?? null)
      .attr(
        'd',
        d3
          .line<number>()
          .x((_, i) => x(x0 + i))
          .y((d) => y(d)),
      );
  });
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
      const i = Math.max(0, Math.min(x1 - x0, Math.round(x.invert(mx) - x0)));
      ch.attr('x1', x(x0 + i))
        .attr('x2', x(x0 + i))
        .style('opacity', 1);
      showTip(ev, `<b>Alter ${x0 + i}</b>${series.map((s) => `${s.name}: ${fmtEur(s.data[i] ?? 0)}`).join('<br>')}`);
    })
    .on('mouseleave', () => {
      ch.style('opacity', 0);
      hideTip();
    });
  $(`#${legend}`).innerHTML = series
    .map((s) => `<li><span class="rs-farbe" style="background:${s.c}"></span>${s.name}</li>`)
    .join('');
}

function gehaltskurve(m: RenteErgebnis) {
  const svg = d3.select<SVGSVGElement, unknown>('#s11s');
  svg.selectAll('*').remove();
  const W = width(svg),
    H = W < 420 ? 240 : 260,
    mg = { l: 54, r: 16, t: 28, b: 26 };
  svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const ages = m.salArr.map((_, i) => m.age + i).concat([67]);
  const real = m.salArr.concat([m.salArr[m.salArr.length - 1]]);
  const nom = ages.map((a, i) => {
    const yrs = m.yearOf(a) - 2026;
    return yrs >= 0 ? real[i] * 1.02 ** yrs : null;
  });
  const x = d3
    .scaleLinear()
    .domain([m.age, 67])
    .range([mg.l, W - mg.r]);
  const y = d3
    .scaleLinear()
    .domain([0, (d3.max([...nom, ...real].filter((v): v is number => v != null)) ?? 1) * 1.1])
    .nice()
    .range([H - mg.b, mg.t]);
  svg
    .append('g')
    .attr('class', 'grid')
    .selectAll('line')
    .data(y.ticks(4))
    .join('line')
    .attr('x1', mg.l)
    .attr('x2', W - mg.r)
    .attr('y1', (d) => y(d))
    .attr('y2', (d) => y(d));
  svg
    .append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(${mg.l},0)`)
    .call(
      d3
        .axisLeft(y)
        .ticks(4)
        .tickFormat((v) => `${Math.round(+v / 1000)} T€`)
        .tickSize(0),
    )
    .select('.domain')
    .remove();
  svg
    .append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${H - mg.b})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(W < 420 ? 4 : 8)
        .tickSizeOuter(0),
    );
  const line = d3
    .line<[number, number | null]>()
    .defined((d) => d[1] != null)
    .x((d) => x(d[0]))
    .y((d) => y(d[1]!));
  svg
    .append('path')
    .datum(ages.map((a, i) => [a, nom[i]] as [number, number | null]))
    .attr('fill', 'none')
    .attr('stroke', css('--ink-3'))
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '5 4')
    .attr('d', line);
  svg
    .append('path')
    .datum(ages.map((a, i) => [a, real[i]] as [number, number | null]))
    .attr('fill', 'none')
    .attr('stroke', css('--cat-soz'))
    .attr('stroke-width', 2.5)
    .attr('d', line);
  const marks: [string, number][] = [['Einstieg', m.age]];
  if (m.useNow) marks.push(['Heute', m.ageNow]);
  marks.push(['Höhepunkt', m.ap], ['Rente', 66]);
  let prevX = -1e9,
    prevBelow = true;
  marks.forEach(([l, a]) => {
    const v = real[a - m.age];
    if (v == null) return;
    const cx = x(a),
      cy = y(v),
      below = cx - prevX < 130 ? !prevBelow : false;
    prevX = cx;
    prevBelow = below;
    svg
      .append('circle')
      .attr('cx', cx)
      .attr('cy', cy)
      .attr('r', 5)
      .attr('fill', css('--cat-soz'))
      .attr('stroke', css('--surface'))
      .attr('stroke-width', 2);
    svg
      .append('text')
      .attr('x', cx)
      .attr('y', below ? cy + 20 : cy - 11)
      .attr('text-anchor', a === m.age ? 'start' : a >= 66 ? 'end' : 'middle')
      .text(`${l} ${a}: ${Math.round(v / 1000)} T€`)
      .style('paint-order', 'stroke')
      .style('stroke', css('--surface'))
      .style('stroke-width', 4);
  });
  $('#lg11s').innerHTML =
    `<li><span class="rs-farbe" style="background:${css('--cat-soz')}"></span>Brutto in heutiger Kaufkraft</li><li><span class="rs-farbe" style="background:${css('--ink-3')}"></span>nominal, mit 2 % Inflation ab heute</li>`;
}

function zeichne() {
  const life = el<HTMLSelectElement>('mode').value === 'life';
  document.querySelectorAll<HTMLElement>('.lifeonly').forEach((e) => {
    e.hidden = !life;
  });
  el('preset').hidden = !life;
  el('pkvwrap').hidden = el<HTMLSelectElement>('kv').value !== 'pkv';
  const m = modell();
  const fig = (v: string, l: string, mark = false) =>
    `<div class="rs-kennzahl"><b${mark ? ' class="rs-mark"' : ''}>${v}</b><span>${l}</span></div>`;
  const lastMonth = m.N ? (m.paid[m.N] - m.paid[m.N - 1]) / 12 : 0;
  $('#rk').innerHTML =
    fig(
      fmtEur(m.gross),
      `Rentenbeiträge in ${m.N} Jahren, brutto (AN und AG), ${m.EP.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Entgeltpunkte`,
    ) +
    fig(
      fmtEur(m.cumPaid),
      m.life
        ? `kosten dich netto, von ${fmtEur(m.firstNet)} bis ${fmtEur(lastMonth)} im Monat`
        : `kosten dich netto, etwa ${fmtEur(m.cumPaid / m.N / 12)} im Monat`,
    ) +
    fig(
      fmtEur(m.renteN),
      `deine gesetzliche Rente ab 67, netto im Monat, lebenslang (${fmtEur(m.renteB)} brutto)`,
      true,
    ) +
    fig(fmtEur(m.depotReal), 'ETF-Depot mit 67, Kaufkraft heute, nach Kosten und Steuern') +
    fig(
      fmtEur(m.etfM),
      `deine ETF-Entnahme bis ${m.until}, netto im Monat, ${m.etfM > m.renteN ? 'mehr' : 'weniger'} als die Rente${m.cross ? `; die Rente holt mit ${m.cross} auf` : ''}`,
      true,
    );
  if (m.life) gehaltskurve(m);
  linien(
    's11a',
    m.age,
    67,
    [
      { name: 'ETF-Depot (real)', data: m.acc, c: css('--cat-soz'), w: 2.5 },
      { name: 'Nettokosten der Beiträge', data: m.paid, c: css('--ink-3'), dash: '5 4' },
    ],
    'lg11a',
  );
  linien(
    's11b',
    67,
    100,
    [
      { name: 'Gesetzliche Rente', data: m.cumR, c: css('--ink'), w: 2.5 },
      { name: `ETF-Entnahmen bis ${m.until}`, data: m.cumE, c: css('--cat-soz'), w: 2.5 },
    ],
    'lg11b',
    [84, 'Ø Lebenserwartung ≈ 83 (M) / 86 (F)'],
  );
}

export function startRente() {
  const shared = ['brutto', 'kv', 'pkv', 'kist', 'kinderlos'];
  ladeEingaben(shared);
  const ids = [
    'mode',
    'brutto',
    'age',
    'c_a0',
    'c_s0',
    'c_s1',
    'c_ap',
    'c_g',
    'c_usenow',
    'etfr',
    'niveau',
    'until',
    'kv',
    'pkv',
    'kist',
    'kinderlos',
  ];
  ids.forEach((id) => {
    el(id).addEventListener('input', () => {
      if (shared.includes(id)) speichereEingaben(shared);
      document.querySelectorAll('#preset button').forEach((b) => {
        b.setAttribute('aria-pressed', 'false');
      });
      zeichne();
    });
  });
  document.querySelectorAll<HTMLButtonElement>('#preset button').forEach((b) => {
    b.onclick = () => {
      const p = VORLAGEN[b.dataset.p as keyof typeof VORLAGEN];
      el('c_a0').value = String(p.einstiegsalter);
      el('c_s0').value = String(p.einstiegsgehalt);
      el('c_s1').value = String(p.hoehepunktGehalt);
      el('c_ap').value = String(p.hoehepunktAlter);
      el('c_usenow').checked = false;
      zeichne();
      document.querySelectorAll('#preset button').forEach((x) => {
        x.setAttribute('aria-pressed', String(x === b));
      });
    };
  });
  let t: number;
  addEventListener('resize', () => {
    clearTimeout(t);
    t = window.setTimeout(zeichne, 150);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', zeichne);
  new MutationObserver(zeichne).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  zeichne();
}
