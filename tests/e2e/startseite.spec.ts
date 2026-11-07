import { expect, test } from '@playwright/test';
import { ergebnis, fehlerSammeln } from './helfer';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('Einstieg: Median vorbelegt, Ergebnis, Raster mit 100 Kästchen', async ({ page }) => {
  const f = fehlerSammeln(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wohin geht dein Geld?');
  await expect(page.locator('#brutto')).toHaveValue('54.066');
  await expect(page.locator('#vorbelegt')).toBeVisible();
  await expect(ergebnis(page)).toContainText('Von 54.066 € Brutto gehen');
  await expect(page.locator('#raster > i')).toHaveCount(100);
  await expect(page.locator('#zweck li').first()).toContainText('Sozialversicherung');
  f.pruefe();
});

test('Brutto ändern zeichnet Satz, Kennzahlen und Diagramme neu und wird gemerkt', async ({ page }) => {
  await page.goto('/');
  const sankeyVorher = await page.locator('#s2').innerHTML();
  await page.locator('#brutto').click();
  await page.keyboard.type('72000');
  await expect(ergebnis(page)).toContainText('Von 72.000 € Brutto');
  await expect(page.locator('#vorbelegt')).toBeHidden();
  expect(await page.locator('#s2').innerHTML()).not.toBe(sankeyVorher);
  await page.reload();
  await expect(page.locator('#brutto')).toHaveValue('72.000');
});

test('Stadtwahl öffnet die Stadtseite und die Startseite merkt sie sich', async ({ page }) => {
  await page.goto('/');
  await page.locator('#stadt').selectOption('muenchen');
  await expect(page).toHaveURL(/\/stadt\/muenchen\/$/);
  await expect(ergebnis(page)).toContainText('an München');
  await page.goto('/');
  await expect(page).toHaveURL(/\/stadt\/muenchen\/$/);
});

test('„Eingaben vergessen“ setzt alles zurück', async ({ page }) => {
  await page.goto('/');
  await page.locator('#stadt').selectOption('koeln');
  await expect(page).toHaveURL(/koeln/);
  await page.getByText('Weitere Angaben').click();
  await page.getByRole('button', { name: 'Eingaben vergessen' }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  await expect(page.locator('#brutto')).toHaveValue('54.066');
});

test('Weitere Angaben: private Krankenversicherung blendet das Beitragsfeld ein', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Weitere Angaben').click();
  await expect(page.locator('#pkvwrap')).toBeHidden();
  await page.locator('#kv').selectOption('pkv');
  await expect(page.locator('#pkvwrap')).toBeVisible();
  await expect(page.locator('#mehr-sum')).toContainText('privat versichert');
});
