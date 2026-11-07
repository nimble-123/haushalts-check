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
