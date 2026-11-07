import { expect, test } from '@playwright/test';
import { fehlerSammeln } from './helfer';

test.beforeEach(async ({ page }) => {
  await page.goto('/stadt/oldenburg/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('Kapitel 2 zeigt standardmäßig Monatswerte und schaltet auf Jahr um', async ({ page }) => {
  const f = fehlerSammeln(page);
  await expect(page.locator('#unit [aria-pressed="true"]')).toHaveText('pro Monat');
  await expect(page.locator('#tbl th.uy')).toHaveText('€ / Monat');
  await page.locator('#unit').getByRole('button', { name: 'pro Jahr' }).click();
  await expect(page.locator('#tbl th.uy')).toHaveText('€ / Jahr');
  f.pruefe();
});

test('zugeklappte Grafiken haben eine Zusammenfassung und zeichnen beim Aufklappen in voller Breite', async ({
  page,
}) => {
  const toepfe = page.locator('details', { hasText: 'Alle Töpfe, sortiert' });
  await expect(toepfe).not.toHaveAttribute('open', '');
  await expect(toepfe.locator('summary')).toContainText('größter Topf');
  await toepfe.locator('summary').click();
  const breite = Number(await page.locator('#s3').getAttribute('width'));
  const panel = await page.locator('#s3').evaluate((s) => (s.closest('.rs-panel') as HTMLElement).clientWidth);
  expect(breite).toBeGreaterThan(panel * 0.8);
});

test('echte Ausgabearten der Stadt mit Durchschnitt', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /tatsächlich ausgibt/ })).toBeVisible();
  await expect(page.locator('.arten-row')).toHaveCount(5);
});

test('Stadtstaat: keine Ausgabearten-Grafik, Land und Stadt zusammen im Satz', async ({ page }) => {
  await page.goto('/stadt/berlin/');
  await expect(page.locator('#arten')).toHaveCount(0);
  await expect(page.locator('#result')).toContainText('an Berlin (Land und Stadt)');
});

test('Bundeshaushalt: Umschalten zwischen Fluss und Fläche', async ({ page }) => {
  await expect(page.locator('#ansicht-fluss')).toBeVisible();
  await page.getByRole('button', { name: 'Als Fläche' }).click();
  await expect(page.locator('#ansicht-flaeche')).toBeVisible();
  await expect(page.locator('#ansicht-fluss')).toBeHidden();
  await expect(page.locator('#s6 rect')).toHaveCount(26);
});
