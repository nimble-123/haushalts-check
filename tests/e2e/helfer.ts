import { expect, type Page } from '@playwright/test';

/** Sammelt JS-Fehler der Seite; am Testende muss die Liste leer sein. */
export function fehlerSammeln(page: Page) {
  const fehler: string[] = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') fehler.push(m.text());
  });
  return { pruefe: () => expect(fehler, fehler.join('\n')).toEqual([]) };
}

/** Text des Ergebnissatzes im Einstieg */
export const ergebnis = (page: Page) => page.locator('#result');
