// Eingaben nur für diesen Tab merken (z. B. beim Wechsel der Stadt). Nichts verlässt den Browser.
const KEY = 'haushalts-check';

export function speichereEingaben(ids: string[]) {
  const data: Record<string, string | boolean> = {};
  ids.forEach((id) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) data[id] = el.type === 'checkbox' ? el.checked : el.value;
  });
  try { sessionStorage.setItem(KEY, JSON.stringify(data)); } catch { /* privates Fenster o. Ä. */ }
}

export function ladeEingaben(ids: string[]) {
  let data: Record<string, string | boolean> = {};
  try { data = JSON.parse(sessionStorage.getItem(KEY) ?? '{}'); } catch { return; }
  ids.forEach((id) => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
    if (!el || !(id in data)) return;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = !!data[id];
    else if (el instanceof HTMLSelectElement) {
      // Kirchensteuer: Satz des neuen Landes übernehmen, wenn vorher eine gewählt war
      const v = String(data[id]);
      const match = [...el.options].find((o) => o.value === v) ?? (id === 'kist' && v !== '0' ? el.options[1] : undefined);
      if (match) el.value = match.value;
    } else el.value = String(data[id]);
  });
}
