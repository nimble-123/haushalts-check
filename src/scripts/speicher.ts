// Eigene Eingaben dauerhaft in diesem Browser merken (localStorage), damit sie beim nächsten Besuch
// wieder drinstehen. Nichts davon verlässt den Browser. Gespeichert wird erst, wenn jemand etwas ändert.
const KEY = 'haushalts-check-eingaben';
const STADT = 'stadt';

type Werte = Record<string, string | boolean>;

function lies(): Werte {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}
function schreibe(daten: Werte) {
  try {
    localStorage.setItem(KEY, JSON.stringify(daten));
  } catch {
    // privates Fenster o. Ä.: dann eben ohne Merken
  }
}

/** Werte der Felder mit diesen IDs speichern; andere gespeicherte Werte bleiben erhalten. */
export function speichereEingaben(ids: string[]) {
  const daten = lies();
  for (const id of ids) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) daten[id] = el.type === 'checkbox' ? el.checked : el.value;
  }
  schreibe(daten);
}

/** Gespeicherte Werte in die Felder mit diesen IDs eintragen. */
export function ladeEingaben(ids: string[]) {
  const daten = lies();
  for (const id of ids) {
    const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
    if (!el || !(id in daten)) continue;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = !!daten[id];
    else if (el instanceof HTMLSelectElement) {
      // Kirchensteuer: Satz des neuen Landes übernehmen, wenn vorher eine gewählt war
      const v = String(daten[id]);
      const treffer =
        [...el.options].find((o) => o.value === v) ?? (id === 'kist' && v !== '0' ? el.options[1] : undefined);
      if (treffer) el.value = treffer.value;
    } else el.value = el.type === 'number' ? String(daten[id]).replace(/\./g, '') : String(daten[id]);
  }
}

export const gespeicherteStadt = () => {
  const s = lies()[STADT];
  return typeof s === 'string' ? s : null;
};
export function speichereStadt(slug: string) {
  schreibe({ ...lies(), [STADT]: slug });
}

/** Alle gemerkten Eingaben vergessen. */
export function vergiss() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nichts zu tun
  }
}
