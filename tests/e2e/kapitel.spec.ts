import { expect, test } from '@playwright/test';
import { EINZELPLAENE } from '../../src/data/bund';
import { fehlerSammeln } from './helfer';

test.beforeEach(async ({ page }) => {
  await page.goto('/stadt/oldenburg/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('Kapitel 2 zeigt standardmäßig Monatswerte und schaltet auf Jahr um', async ({ page }) => {
  const f = fehlerSammeln(page);
  await expect(page.locator('#unit [aria-pressed="true"]')).toHaveText('pro Monat');
  await expect(page.locator('#tbl-einheit')).toHaveText('€ / Monat');
  await page.locator('#unit').getByRole('button', { name: 'pro Jahr' }).click();
  await expect(page.locator('#tbl-einheit')).toHaveText('€ / Jahr');
  f.pruefe();
});

test('zugeklappte Grafiken haben eine Zusammenfassung und zeichnen beim Aufklappen in voller Breite', async ({
  page,
}) => {
  const toepfe = page.locator('details', { hasText: 'Alle Töpfe, sortiert' });
  await expect(toepfe).not.toHaveAttribute('open', '');
  await expect(toepfe.locator('summary')).toContainText('größter Topf');
  await toepfe.locator('summary').click();
  // Neuzeichnen läuft nach dem toggle-Ereignis: warten, bis die Breite stimmt
  await expect
    .poll(() =>
      page.locator('#toepfe').evaluate((s) => {
        const panel = (s.closest('.rs-panel') as HTMLElement).clientWidth;
        return Number(s.getAttribute('width')) / panel;
      }),
    )
    .toBeGreaterThan(0.8);
});

test('echte Ausgabearten der Stadt mit Durchschnitt', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /tatsächlich ausgibt/ })).toBeVisible();
  await expect(page.locator('.arten-row')).toHaveCount(5);
});

test('Stadtstaat: Ausgaben von Land und Stadt zusammen, Vergleich nur mit Stadtstaaten', async ({ page }) => {
  await page.goto('/stadt/berlin/');
  await expect(page.locator('#result')).toContainText('an Berlin (Land und Stadt)');
  await expect(page.getByRole('heading', { name: 'Was Berlin tatsächlich ausgibt' })).toBeVisible();
  await expect(page.locator('.arten-row')).toHaveCount(5);
  await expect(page.locator('#arten')).toContainText('Durchschnitt der drei Stadtstaaten');
  await expect(page.locator('#arten')).toContainText('dein Anteil an Land und Stadt');
});

test('Bremerhaven zeigt das Land Bremen', async ({ page }) => {
  await page.goto('/stadt/bremerhaven/');
  await expect(page.getByRole('heading', { name: 'Was das Land Bremen tatsächlich ausgibt' })).toBeVisible();
  await expect(page.locator('#arten')).toContainText('Land Bremen, € je Einwohner');
});

test('Stadt außerhalb der Stadtstaaten vergleicht mit den kreisfreien Städten', async ({ page }) => {
  await page.goto('/stadt/oldenburg/');
  await expect(page.locator('#arten')).toContainText('kreisfreien Städte');
  await expect(page.locator('#arten')).toContainText('dein Gemeindeanteil');
});

test('Bundeshaushalt: Umschalten zwischen Fluss und Fläche', async ({ page }) => {
  await expect(page.locator('#ansicht-fluss')).toBeVisible();
  await page.getByRole('button', { name: 'Als Fläche' }).click();
  await expect(page.locator('#ansicht-flaeche')).toBeVisible();
  await expect(page.locator('#ansicht-fluss')).toBeHidden();
  await expect(page.locator('#bund-flaeche rect')).toHaveCount(EINZELPLAENE.length);
});

test('breite Diagramme und Tabellen lassen sich seitlich wischen, die Seite selbst ragt nicht über', async ({
  page,
}) => {
  await page.evaluate(() => {
    for (const d of document.querySelectorAll('details')) d.open = true;
  });
  await page.waitForTimeout(300);
  // nichts darf die Seite verbreitern
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  // jeder Wischbereich bleibt im Panel und scrollt, wenn sein Inhalt breiter ist
  const bereiche = await page.$$eval('.rs-scroll', (es) =>
    es
      .filter((e) => (e as HTMLElement).offsetParent)
      .map((e) => ({
        name: e.getAttribute('aria-label'),
        overflow: getComputedStyle(e).overflowX,
        rechts: Math.round(e.getBoundingClientRect().right),
      })),
  );
  expect(bereiche.length).toBeGreaterThan(0);
  const breite = await page.evaluate(() => window.innerWidth);
  for (const b of bereiche) {
    expect(b.overflow, b.name ?? '').toBe('auto');
    expect(b.rechts, b.name ?? '').toBeLessThanOrEqual(breite);
  }
});
