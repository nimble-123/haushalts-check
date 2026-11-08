/** Ort einer Stadt: Slug, Breite, Länge */
export type Ort = readonly [slug: string, lat: number, lon: number];

/** Entfernung auf der Erdkugel in km (Haversine) */
export function entfernungKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** Inhalt von /orte-lage.json: je Gemeinde Mittelpunkt, Radius in km und Index des Ziels */
export interface LageDaten {
  ziele: string[];
  orte: [lat: number, lon: number, radius: number, ziel: number][];
}

/**
 * Stadt oder Landkreis am Standort: das Ziel der Gemeinde mit dem kleinsten Abstand zum Mittelpunkt, gemessen in ihrem
 * Radius. Sonst gewänne am Stadtrand von Berlin die kleine Nachbargemeinde mit dem näheren Mittelpunkt.
 */
export function zielAmStandort(d: LageDaten, lat: number, lon: number) {
  let best = d.orte[0];
  let bestAbstand = Number.POSITIVE_INFINITY;
  for (const o of d.orte) {
    const abstand = entfernungKm(lat, lon, o[0], o[1]) / o[2];
    if (abstand < bestAbstand) {
      best = o;
      bestAbstand = abstand;
    }
  }
  return d.ziele[best[3]];
}

/** Slug der nächsten Stadt zu einem Standort */
export function naechsteStadt(orte: readonly Ort[], lat: number, lon: number) {
  let best = orte[0];
  let bestKm = Number.POSITIVE_INFINITY;
  for (const o of orte) {
    const km = entfernungKm(lat, lon, o[1], o[2]);
    if (km < bestKm) {
      best = o;
      bestKm = km;
    }
  }
  return best[0];
}
