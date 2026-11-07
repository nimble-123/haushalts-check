import * as d3 from 'd3';
import { type RenteErgebnis, renteVsEtf, VORLAGEN } from '../lib/rente';
import { leseBetrag, schreibeBetrag } from '../lib/text';
import { betragsfeld } from './betragsfeld';
import { mitUebergang, zaehlen } from './bewegung';
import { ladeEingaben, speichereEingaben } from './speicher';
import { achseY, css, esc, fadenkreuz, fmtEur, gitterY, holen, rahmen, teilstriche } from './viz';

const tausendEuro = (v: d3.NumberValue) => `${Math.round(+v / 1000)} T€`;

/** Euro-Betrag aus einem Betragsfeld („120.000“) */
const betrag = (id: string) => leseBetrag(holen(id, HTMLInputElement).value);
/** Euro-Felder mit Tausenderpunkten */
const BETRAEGE = ['brutto', 'c_s0', 'c_s1', 'pkv'];

/** Zahl aus einem Eingabefeld oder einer Auswahl */
const num = (id: string) => {
  const e = holen(id);
  if (!(e instanceof HTMLInputElement || e instanceof HTMLSelectElement))
    throw new Error(`#${id} ist kein Eingabefeld`);
  return +e.value;
};

function modell() {
  return renteVsEtf({
    modus: holen('mode', HTMLSelectElement).value as 'life' | 'now',
    bruttoHeute: betrag('brutto'),
    alterHeute: num('age'),
    einstiegsalter: num('c_a0'),
    einstiegsgehalt: betrag('c_s0'),
    hoehepunktGehalt: betrag('c_s1'),
    hoehepunktAlter: num('c_ap'),
    dynamik: num('c_g'),
    heuteEinbeziehen: holen('c_usenow', HTMLInputElement).checked,
    etfRendite: num('etfr'),
    niveau: num('niveau'),
    depotBis: num('until'),
    pkv: holen('kv', HTMLSelectElement).value === 'pkv',
    pkvMonat: betrag('pkv'),
    kinderlos: holen('kinderlos', HTMLInputElement).checked,
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
  const { svg, W, H } = rahmen(id, (_, schmal) => (schmal ? 240 : 280), 420);
  const m = { l: 54, r: 12, t: 14, b: 26 };
  const x = d3
    .scaleLinear()
    .domain([x0, x1])
    .range([m.l, W - m.r]);
  const y = d3
    .scaleLinear()
    .domain([0, (d3.max(series, (s) => d3.max(s.data)) ?? 1) * 1.08 || 1])
    .nice()
    .range([H - m.b, m.t]);
  gitterY(svg, y, m.l, W - m.r, 4);
  achseY(svg, y, m.l, 4, tausendEuro);
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
    )
    .call(teilstriche, 'ax');
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
  series.forEach((s, i) => {
    svg
      .append('path')
      .attr('data-k', `s${i}`)
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
  fadenkreuz(svg, m, W, H, (mx) => {
    const i = Math.max(0, Math.min(x1 - x0, Math.round(x.invert(mx) - x0)));
    return {
      x: x(x0 + i),
      html: `<b>Alter ${x0 + i}</b>${series.map((s) => `${esc(s.name)}: ${fmtEur(s.data[i] ?? 0)}`).join('<br>')}`,
    };
  });
  holen(legend).innerHTML = series
    .map((s) => `<li><span class="rs-farbe" style="background:${s.c}"></span>${esc(s.name)}</li>`)
    .join('');
}

function gehaltskurve(m: RenteErgebnis) {
  const { svg, W, H } = rahmen('gehaltskurve', (_, schmal) => (schmal ? 240 : 260), 420);
  const mg = { l: 54, r: 16, t: 28, b: 26 };
  const ages = m.gehaelter.map((_, i) => m.startAlter + i).concat([67]);
  const real = m.gehaelter.concat([m.gehaelter[m.gehaelter.length - 1]]);
  const nom = ages.map((a, i) => {
    const yrs = m.jahrBeiAlter(a) - 2026;
    return yrs >= 0 ? real[i] * 1.02 ** yrs : null;
  });
  const x = d3
    .scaleLinear()
    .domain([m.startAlter, 67])
    .range([mg.l, W - mg.r]);
  const y = d3
    .scaleLinear()
    .domain([0, (d3.max([...nom, ...real].filter((v): v is number => v != null)) ?? 1) * 1.1])
    .nice()
    .range([H - mg.b, mg.t]);
  gitterY(svg, y, mg.l, W - mg.r, 4);
  achseY(svg, y, mg.l, 4, tausendEuro);
  svg
    .append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${H - mg.b})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(W < 420 ? 4 : 8)
        .tickSizeOuter(0),
    )
    .call(teilstriche, 'ax');
  const line = d3
    .line<[number, number | null]>()
    .defined((d) => d[1] != null)
    .x((d) => x(d[0]))
    .y((d) => y(d[1]!));
  svg
    .append('path')
    .attr('data-k', 'nominal')
    .datum(ages.map((a, i) => [a, nom[i]] as [number, number | null]))
    .attr('fill', 'none')
    .attr('stroke', css('--ink-3'))
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '5 4')
    .attr('d', line);
  svg
    .append('path')
    .attr('data-k', 'real')
    .datum(ages.map((a, i) => [a, real[i]] as [number, number | null]))
    .attr('fill', 'none')
    .attr('stroke', css('--cat-soz'))
    .attr('stroke-width', 2.5)
    .attr('d', line);
  // „ab heute“: real gleichbleibend ab heutigem Alter, ohne Einstieg und Höhepunkt
  const marks: [string, number][] = m.lebensverlauf ? [['Einstieg', m.startAlter]] : [['Heute', m.startAlter]];
  if (m.lebensverlauf && m.mitHeute) marks.push(['Heute', m.alterHeute]);
  if (m.lebensverlauf) marks.push(['Höhepunkt', m.hoehepunktAlter]);
  marks.push(['Rente', 66]);
  let prevX = -1e9,
    prevBelow = true;
  marks.forEach(([l, a]) => {
    const v = real[a - m.startAlter];
    if (v == null) return;
    const cx = x(a),
      cy = y(v),
      below = cx - prevX < 130 ? !prevBelow : false;
    prevX = cx;
    prevBelow = below;
    svg
      .append('circle')
      .attr('data-k', `p:${l}`)
      .attr('cx', cx)
      .attr('cy', cy)
      .attr('r', 5)
      .attr('fill', css('--cat-soz'))
      .attr('stroke', css('--surface'))
      .attr('stroke-width', 2);
    svg
      .append('text')
      .attr('data-k', `pt:${l}`)
      .attr('x', cx)
      .attr('y', below ? cy + 20 : cy - 11)
      .attr('text-anchor', a === m.startAlter ? 'start' : a >= 66 ? 'end' : 'middle')
      .text(`${l} ${a}: ${Math.round(v / 1000)} T€`)
      .style('paint-order', 'stroke')
      .style('stroke', css('--surface'))
      .style('stroke-width', 4);
  });
  holen('lg-gehaltskurve').innerHTML =
    `<li><span class="rs-farbe" style="background:${css('--cat-soz')}"></span>Brutto in heutiger Kaufkraft</li><li><span class="rs-farbe" style="background:${css('--ink-3')}"></span>nominal, mit 2 % Inflation ab heute</li>`;
}

function zeichne() {
  const life = holen('mode', HTMLSelectElement).value === 'life';
  document.querySelectorAll<HTMLElement>('.lifeonly').forEach((e) => {
    e.hidden = !life;
  });
  holen('preset').hidden = !life;
  holen('pkvwrap').hidden = holen('kv', HTMLSelectElement).value !== 'pkv';
  const m = modell();
  const fig = (v: number, l: string, mark = false) =>
    `<div class="rs-kennzahl"><b data-v="${v}"${mark ? ' class="rs-mark"' : ''}>${fmtEur(v)}</b><span>${esc(l)}</span></div>`;
  const lastMonth = m.jahre ? (m.nettokostenVerlauf[m.jahre] - m.nettokostenVerlauf[m.jahre - 1]) / 12 : 0;
  zaehlen(
    holen('rk'),
    () => {
      holen('rk').innerHTML =
        fig(
          m.beitragBrutto,
          `Rentenbeiträge in ${m.jahre} Jahren, brutto (AN und AG), ${m.entgeltpunkte.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Entgeltpunkte`,
        ) +
        fig(
          m.beitragNetto,
          m.lebensverlauf
            ? `kosten dich netto, von ${fmtEur(m.ersteNettokosten)} bis ${fmtEur(lastMonth)} im Monat`
            : `kosten dich netto, etwa ${fmtEur(m.beitragNetto / m.jahre / 12)} im Monat`,
        ) +
        fig(
          m.renteNetto,
          `deine gesetzliche Rente ab 67, netto im Monat, lebenslang (${fmtEur(m.renteBrutto)} brutto)`,
          true,
        ) +
        fig(m.depotReal, 'ETF-Depot mit 67, Kaufkraft heute, nach Kosten und Steuern') +
        fig(
          m.etfMonat,
          `deine ETF-Entnahme bis ${m.depotBis}, netto im Monat, ${m.etfMonat > m.renteNetto ? 'mehr' : 'weniger'} als die Rente${m.einholAlter ? `; die Rente holt mit ${m.einholAlter} auf` : ''}`,
          true,
        );
    },
    fmtEur,
  );
  gehaltskurve(m);
  linien(
    'ansparen',
    m.startAlter,
    67,
    [
      { name: 'ETF-Depot (real)', data: m.depotVerlauf, c: css('--cat-soz'), w: 2.5 },
      { name: 'Nettokosten der Beiträge', data: m.nettokostenVerlauf, c: css('--ink-3'), dash: '5 4' },
    ],
    'lg-ansparen',
  );
  linien(
    'auszahlen',
    67,
    100,
    [
      { name: 'Gesetzliche Rente', data: m.summeRente, c: css('--ink'), w: 2.5 },
      { name: `ETF-Entnahmen bis ${m.depotBis}`, data: m.summeEtf, c: css('--cat-soz'), w: 2.5 },
    ],
    'lg-auszahlen',
    [84, 'Ø Lebenserwartung ≈ 83 (M) / 86 (F)'],
  );
}

export function startRente() {
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
  // Eigene Angaben vom letzten Besuch (Brutto, Versicherung, Kirche, Kinder teilen sich die Seiten)
  ladeEingaben(ids);
  for (const id of BETRAEGE) betragsfeld(holen(id, HTMLInputElement));
  ids.forEach((id) => {
    holen(id).addEventListener('input', () => {
      speichereEingaben(ids);
      document.querySelectorAll('#preset button').forEach((b) => {
        b.setAttribute('aria-pressed', 'false');
      });
      mitUebergang(zeichne);
    });
  });
  document.querySelectorAll<HTMLButtonElement>('#preset button').forEach((b) => {
    b.addEventListener('click', () => {
      const p = VORLAGEN[b.dataset.p as keyof typeof VORLAGEN];
      holen('c_a0', HTMLInputElement).value = String(p.einstiegsalter);
      holen('c_s0', HTMLInputElement).value = schreibeBetrag(p.einstiegsgehalt);
      holen('c_s1', HTMLInputElement).value = schreibeBetrag(p.hoehepunktGehalt);
      holen('c_ap', HTMLInputElement).value = String(p.hoehepunktAlter);
      holen('c_usenow', HTMLInputElement).checked = false;
      speichereEingaben(ids);
      mitUebergang(zeichne);
      document.querySelectorAll('#preset button').forEach((x) => {
        x.setAttribute('aria-pressed', String(x === b));
      });
    });
  });
  // Nur bei geänderter Breite neu zeichnen (auf dem Handy ändert die Adressleiste ständig die Höhe)
  let t: number;
  let breite = innerWidth;
  addEventListener('resize', () => {
    if (innerWidth === breite) return;
    breite = innerWidth;
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
