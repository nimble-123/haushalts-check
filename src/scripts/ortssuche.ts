// „Ort suchen“: Die Auswahl im Satz wird zum Eingabefeld. Die Gemeindeliste lädt beim ersten Öffnen; ein Treffer führt
// zur Seite der Stadt oder des Landkreises.
import { type OrtDaten, ortssuche, type Treffer } from '../lib/ortssuche';
import { esc } from '../lib/text';

export function ortssucheStarten(beiWahl: (slug: string) => void) {
  const feld = document.getElementById('ort-suche') as HTMLInputElement | null;
  const liste = document.getElementById('ort-treffer');
  const status = document.getElementById('ort-status');
  const anzahl = document.getElementById('ort-anzahl');
  const knopf = document.getElementById('ort-suchen');
  const box = document.getElementById('ort-wahl');
  const auswahl = document.getElementById('stadt') as HTMLSelectElement | null;
  if (!feld || !liste || !status || !anzahl || !knopf || !box || !auswahl) return;

  // Name und Land der Ziele stehen schon in der Auswahl
  const ziele = new Map(
    [...auswahl.options].map((o) => [
      o.value,
      { name: o.text, land: (o.parentElement as HTMLOptGroupElement).label.replace(': Landkreise', '') },
    ]),
  );

  let suche: ReturnType<typeof ortssuche> | null = null;
  let laedt = false;
  let treffer: Treffer[] = [];
  let aktiv = -1;

  const schliessen = () => {
    liste.hidden = true;
    feld.setAttribute('aria-expanded', 'false');
    feld.removeAttribute('aria-activedescendant');
    aktiv = -1;
  };
  const markiere = (i: number) => {
    aktiv = i;
    [...liste.children].forEach((li, j) => {
      li.setAttribute('aria-selected', String(j === i));
    });
    if (i >= 0) {
      feld.setAttribute('aria-activedescendant', `ort-t${i}`);
      liste.children[i].scrollIntoView({ block: 'nearest' });
    } else feld.removeAttribute('aria-activedescendant');
  };
  const zeichnen = () => {
    if (!suche) return;
    const eingabe = feld.value.trim();
    treffer = suche(eingabe);
    if (!treffer.length) {
      liste.innerHTML = '';
      schliessen();
      anzahl.textContent = '';
      status.textContent =
        eingabe.length >= 2 ? 'Kein Ort gefunden. Ortsteile kennt die Suche nicht, probier deine Gemeinde.' : '';
      return;
    }
    status.textContent = '';
    anzahl.textContent = `${treffer.length} ${treffer.length === 1 ? 'Ort' : 'Orte'} gefunden`;
    liste.innerHTML = treffer
      .map((t, i) => {
        const ziel = ziele.get(t.slug);
        const wohin = ziel && ziel.name !== t.name ? `${ziel.name}, ${ziel.land}` : (ziel?.land ?? '');
        return `<li id="ort-t${i}" role="option" aria-selected="false" data-slug="${esc(t.slug)}"><b>${esc(t.name)}</b><span>${esc(wohin)}</span></li>`;
      })
      .join('');
    liste.hidden = false;
    feld.setAttribute('aria-expanded', 'true');
    aktiv = -1;
    feld.removeAttribute('aria-activedescendant');
  };
  const laden = () => {
    if (laedt) return;
    laedt = true;
    fetch('/orte.json')
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<OrtDaten>;
      })
      .then((d) => {
        suche = ortssuche(d);
        zeichnen();
      })
      .catch(() => {
        laedt = false;
        status.textContent = 'Die Suche ist gerade nicht erreichbar. Wähl deine Stadt oben aus der Liste.';
      });
  };

  const offen = () => box.hasAttribute('data-suche');
  const beenden = (fokusZurueck: boolean) => {
    if (!offen()) return;
    box.removeAttribute('data-suche');
    knopf.setAttribute('aria-expanded', 'false');
    schliessen();
    status.textContent = '';
    anzahl.textContent = '';
    if (fokusZurueck) knopf.focus();
  };
  const oeffnen = () => {
    // Mindestens so breit wie die Auswahl, damit der Satz möglichst nicht springt
    box.style.setProperty('--breite', `${Math.max(auswahl.offsetWidth, 260)}px`);
    box.setAttribute('data-suche', '');
    knopf.setAttribute('aria-expanded', 'true');
    feld.value = '';
    feld.focus();
    laden();
  };
  // Der Knopf nimmt dem Feld den Fokus nicht, sonst schlösse der Blur die Suche, und der Klick öffnete sie gleich wieder
  knopf.addEventListener('pointerdown', (e) => e.preventDefault());
  knopf.addEventListener('click', () => (offen() ? beenden(true) : oeffnen()));
  feld.addEventListener('input', zeichnen);
  feld.addEventListener('blur', () => beenden(false));
  feld.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      beenden(true);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const t = treffer[Math.max(aktiv, 0)];
      if (t && !liste.hidden) beiWahl(t.slug);
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !liste.hidden) {
      e.preventDefault();
      const n = treffer.length;
      markiere(e.key === 'ArrowDown' ? (aktiv + 1) % n : (aktiv - 1 + n) % n);
    }
  });
  // Der Fokus bleibt beim Klick im Feld, sonst schließt der Blur die Liste, bevor der Klick ankommt
  liste.addEventListener('pointerdown', (e) => e.preventDefault());
  liste.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('li[data-slug]');
    if (li?.dataset.slug) beiWahl(li.dataset.slug);
  });
}
