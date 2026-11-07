// Rentenbeitrag vs. ETF-Sparplan – aus rvModel() des Prototyps, ohne DOM-Zugriff.
import { MEDIAN_BRUTTO } from '../data/eckwerte';
import { berechne, est2026, PAUSCHALEN, SV_2026, soli } from './steuer';

export interface RenteEingabe {
  modus: 'life' | 'now';
  bruttoHeute: number;
  alterHeute: number;
  einstiegsalter: number;
  einstiegsgehalt: number;
  hoehepunktGehalt: number;
  hoehepunktAlter: number;
  /** reale Gehaltsdynamik nach dem Höhepunkt p. a. */
  dynamik: number;
  heuteEinbeziehen: boolean;
  etfRendite: number;
  /** Rentenniveau in Prozent, z. B. 45 */
  niveau: number;
  depotBis: number;
  pkv: boolean;
  pkvMonat: number;
  kinderlos: boolean;
  kirche: number;
}

export const VORLAGEN = {
  aka: { einstiegsalter: 25, einstiegsgehalt: 48_000, hoehepunktGehalt: 85_000, hoehepunktAlter: 45 },
  med: { einstiegsalter: 20, einstiegsgehalt: 31_500, hoehepunktGehalt: MEDIAN_BRUTTO, hoehepunktAlter: 40 },
} as const;

/** Rentenwert ab 1. Juli 2026 (DRV) */
export const RENTENWERT = 42.52;
/** Durchschnittsentgelt 2026: Brutto für einen Entgeltpunkt */
export const DURCHSCHNITTSENTGELT = 51_944;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Beitragssatz RV laut Rentenversicherungsbericht 2025 */
export const rvSatz = (jahr: number) =>
  jahr <= 2027
    ? 0.186
    : jahr === 2028
      ? 0.199
      : jahr <= 2030
        ? 0.2
        : jahr <= 2034
          ? 0.204 + (jahr - 2031) * 0.002
          : 0.212;

export function renteVsEtf(p: RenteEingabe) {
  const life = p.modus === 'life';
  const Bnow = Math.max(0, p.bruttoHeute || 0);
  const ageNow = clamp(Math.round(p.alterHeute || 37), 16, 66);
  const age = life ? clamp(Math.round(p.einstiegsalter || 25), 16, 60) : ageNow;
  const s0 = Math.max(0, p.einstiegsgehalt || 0);
  const s1 = Math.max(0, p.hoehepunktGehalt || 0);
  const ap = Math.max(age + 1, Math.min(66, Math.round(p.hoehepunktAlter || 45)));
  const g = p.dynamik || 0;
  const useNow = life && p.heuteEinbeziehen && ageNow > age && ageNow < 67;

  // Stützpunkte: Einstieg, ggf. heute, Höhepunkt; danach Dynamik g real p. a.
  const pts: [number, number][] = [
    [age, s0],
    [ap, s1],
  ];
  if (useNow && ageNow !== ap) pts.push([ageNow, Bnow]);
  pts.sort((a, b) => a[0] - b[0]);
  const lastPt = pts[pts.length - 1];
  const sal = (a: number) => {
    if (!life) return Bnow;
    if (a >= lastPt[0]) return lastPt[1] * (1 + g) ** (a - lastPt[0]);
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0] = pts[k],
        [x1, y1] = pts[k + 1];
      if (a >= x0 && a <= x1) {
        const t = (a - x0) / (x1 - x0 || 1);
        return y0 + (y1 - y0) * (y1 >= y0 ? t ** 0.75 : t);
      }
    }
    return s0;
  };
  const yearOf = (a: number) => (useNow || !life ? 2026 + (a - ageNow) : 2026 + (a - age));

  const N = 67 - age;
  const r0 = p.etfRendite,
    until = p.depotBis;
  const bR = SV_2026.bbgRv;
  const infl = 0.02,
    ter = 0.002,
    basis = 0.025,
    kest = 0.26375,
    teil = 0.7,
    spb = 1000;

  // Netto bei gegebenem Rentenbeitragssatz: dieselbe Rechnung wie für die Startseite
  const netIncome = (Bx: number, rvRate: number) =>
    berechne(
      { brutto: Bx, pkv: p.pkv, pkvMonat: p.pkvMonat, kinderlos: p.kinderlos, kirche: p.kirche },
      { rvSatz: rvRate },
    ).netto;
  function netCost(rate: number, B: number) {
    const ag = (Math.min(B, bR) * rate) / 2;
    return { gross: Math.min(B, bR) * rate, net: netIncome(B + ag, 0) - netIncome(B, rate) };
  }

  let EP = 0,
    depot = 0,
    basisCost = 0,
    cumPaid = 0,
    gross = 0;
  const salArr: number[] = [],
    acc = [0],
    paid = [0];
  const rm = (1 + r0 - ter) ** (1 / 12);
  for (let i = 0; i < N; i++) {
    const Bi = sal(age + i);
    salArr.push(Bi);
    EP += Math.min(Bi, bR) / DURCHSCHNITTSENTGELT;
    const pi = (1 + infl) ** i;
    const c = netCost(rvSatz(Math.max(2026, yearOf(age + i))), Bi);
    gross += c.gross;
    cumPaid += c.net;
    const contrib = c.net * pi,
      start = depot;
    for (let m = 0; m < 12; m++) depot = depot * rm + contrib / 12;
    basisCost += contrib;
    const vp = Math.max(0, Math.min(depot - start - contrib, start * basis * 0.7));
    depot -= Math.max(0, vp * teil - spb * pi) * kest;
    basisCost += vp;
    acc.push(depot / (1 + infl) ** (i + 1));
    paid.push(cumPaid);
  }

  // Entnahmeplan: konstante reale Entnahme, sodass das Depot bis `until` reicht
  const rp = r0 - 0.02 - ter,
    yrs = until - 67;
  function sim(Wr: number) {
    let d = depot,
      bc = basisCost;
    const out: number[] = [];
    for (let k = 0; k < yrs; k++) {
      const pi = (1 + infl) ** (N + k),
        W = Wr * pi,
        gs = d > 0 ? Math.max(0, 1 - bc / d) : 0;
      const tax = Math.max(0, W * gs * teil - spb * pi) * kest;
      bc -= W * (1 - gs);
      d = (d - W) * (1 + rp);
      out.push((W - tax) / pi);
    }
    return { d, out };
  }
  let lo = 0,
    hi = Math.max(1, depot);
  for (let it = 0; it < 70; it++) {
    const mid = (lo + hi) / 2;
    if (sim(mid).d > 0) lo = mid;
    else hi = mid;
  }
  const pay = sim(lo);

  // gesetzliche Rente
  const renteB = (EP * RENTENWERT * p.niveau) / 48;
  // Besteuerungsanteil der Rente nach Jahr des Rentenbeginns
  const bAnteil = Math.min(1, (83.5 + 0.5 * (yearOf(67) - 2025)) / 100);
  // Rentner zahlen den halben KV-Satz samt halbem Zusatzbeitrag und die volle Pflegeversicherung
  const kvpv = p.pkv ? 0 : SV_2026.kv / 2 + SV_2026.kvZusatz / 2 + SV_2026.pv + (p.kinderlos ? SV_2026.pvKinderlos : 0);
  const e = est2026(
    renteB * 12 * bAnteil - PAUSCHALEN.werbungskostenRente - PAUSCHALEN.sonderausgaben - renteB * 12 * kvpv,
  );
  const renteN = renteB - renteB * kvpv - (e + soli(e) + e * p.kirche) / 12;

  const cumR = [0],
    cumE = [0];
  let a = 0,
    b = 0;
  for (let k = 0; k < 33; k++) {
    a += renteN * 12;
    b += k < pay.out.length ? pay.out[k] : 0;
    cumR.push(a);
    cumE.push(b);
  }
  let cross: number | null = null;
  for (let k = 1; k <= 33; k++)
    if (cumR[k] >= cumE[k] && cumR[k - 1] < cumE[k - 1]) {
      cross = 67 + k;
      break;
    }

  return {
    jahre: N,
    startAlter: age,
    alterHeute: ageNow,
    hoehepunktAlter: ap,
    mitHeute: useNow,
    lebensverlauf: life,
    entgeltpunkte: EP,
    gehaelter: salArr,
    jahrBeiAlter: yearOf,
    ersteNettokosten: netCost(rvSatz(2026), sal(age)).net / 12,
    beitragBrutto: gross,
    beitragNetto: cumPaid,
    depotReal: acc[acc.length - 1],
    depotVerlauf: acc,
    nettokostenVerlauf: paid,
    renteBrutto: renteB,
    renteNetto: renteN,
    etfMonat: (pay.out[0] || 0) / 12,
    summeRente: cumR,
    summeEtf: cumE,
    einholAlter: cross,
    depotBis: until,
  } satisfies RenteErgebnis;
}

/** Ergebnis von renteVsEtf; Beträge in heutiger Kaufkraft, wo nicht anders genannt */
export interface RenteErgebnis {
  /** Beitragsjahre bis 67 */
  jahre: number;
  startAlter: number;
  alterHeute: number;
  hoehepunktAlter: number;
  /** heutiges Gehalt als Stützpunkt im Lebensverlauf */
  mitHeute: boolean;
  /** ganzer Lebensverlauf statt „ab heute“ */
  lebensverlauf: boolean;
  entgeltpunkte: number;
  /** Bruttogehalt je Beitragsjahr */
  gehaelter: number[];
  jahrBeiAlter: (alter: number) => number;
  /** Nettokosten der Beiträge im ersten Monat */
  ersteNettokosten: number;
  /** Beiträge brutto, Arbeitnehmer und Arbeitgeber, über alle Jahre */
  beitragBrutto: number;
  /** was die Beiträge dich netto gekostet haben, über alle Jahre */
  beitragNetto: number;
  /** ETF-Depot mit 67, real */
  depotReal: number;
  depotVerlauf: number[];
  nettokostenVerlauf: number[];
  /** gesetzliche Rente im Monat */
  renteBrutto: number;
  renteNetto: number;
  /** ETF-Entnahme im Monat, netto */
  etfMonat: number;
  /** aufsummierte Rente bzw. ETF-Entnahmen ab 67, je Jahr */
  summeRente: number[];
  summeEtf: number[];
  /** Alter, ab dem die Rente die ETF-Entnahmen eingeholt hat */
  einholAlter: number | null;
  /** Alter, bis zu dem das Depot reicht */
  depotBis: number;
}
