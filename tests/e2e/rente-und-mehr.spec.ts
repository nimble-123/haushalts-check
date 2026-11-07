import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { fehlerSammeln } from './helfer';

test('Rentenseite: typische Person vorbelegt, Änderungen rechnen sofort und werden gemerkt', async ({ page }) => {
  const f = fehlerSammeln(page);
  await page.goto('/rente/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#brutto')).toHaveValue('54.066');
  await expect(page.locator('#age')).toHaveValue('45');
  const vorher = await page.locator('#rk b').first().textContent();
  await page.locator('#age').fill('30');
  await expect(page.locator('#rk b').first()).not.toHaveText(vorher ?? '');
  await page.reload();
  await expect(page.locator('#age')).toHaveValue('30');
  f.pruefe();
});

test('Rentenseite: Euro-Felder mit Tausenderpunkten, Gehaltskurve auch „ab heute“', async ({ page }) => {
  const f = fehlerSammeln(page);
  await page.goto('/rente/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#c_s0')).toHaveValue('31.500');
  const vorher = await page.locator('#rk b').first().textContent();
  await page.locator('#c_s1').fill('120000');
  await page.locator('#c_s1').blur();
  await expect(page.locator('#c_s1')).toHaveValue('120.000');
  await expect(page.locator('#rk b').first()).not.toHaveText(vorher ?? '');
  // gemerkt und nach dem Neuladen wieder formatiert
  await page.reload();
  await expect(page.locator('#c_s1')).toHaveValue('120.000');
  // „ab heute“: Kurve bleibt sichtbar, beginnt beim heutigen Alter
  await page.locator('#mode').selectOption('now');
  await expect(page.locator('#gehaltskurve path:not(.domain)').first()).toBeVisible();
  await expect(page.locator('#gehaltskurve')).toContainText('Heute');
  await expect(page.locator('#gehaltskurve')).not.toContainText('Höhepunkt');
  f.pruefe();
});

test('Theme-Schalter wechselt das Design und merkt die Wahl', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const knopf = page.locator('#thema');
  await expect(knopf).toHaveAttribute('aria-pressed', 'false');
  await knopf.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/rente/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#thema')).toHaveAttribute('aria-pressed', 'true');
});

test.describe('In meiner Nähe', () => {
  test('mit Freigabe: wählt die nächste kreisfreie Stadt', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 53.486, longitude: 8.484 }); // Nordenham
    await page.goto('/stadt/oldenburg/');
    await page.evaluate(() => localStorage.clear());
    await page.getByRole('button', { name: 'In meiner Nähe' }).click();
    await expect(page).toHaveURL(/\/stadt\/bremerhaven\/$/);
  });

  test('ohne Freigabe: verständliche Meldung, Seite bleibt', async ({ page }) => {
    await page.goto('/stadt/oldenburg/');
    await page.getByRole('button', { name: 'In meiner Nähe' }).click();
    await expect(page.locator('#naehe-status')).toContainText('Wähl deine Stadt in der Liste');
    await expect(page).toHaveURL(/oldenburg/);
  });
});

test.describe('Barrierefreiheit (axe, WCAG 2 AA)', () => {
  for (const pfad of ['/stadt/oldenburg/', '/rente/', '/staedte/', '/methodik/', '/impressum/', '/datenschutz/']) {
    test(pfad, async ({ page }) => {
      await page.goto(pfad);
      const ergebnis = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(ergebnis.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
    });
  }
});

test('alle Seiten laden ohne Fehler, auch jede 20. Stadt', async ({ page }) => {
  const f = fehlerSammeln(page);
  await page.goto('/staedte/');
  const links = await page
    .locator('main a[href^="/stadt/"]')
    .evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
  expect(links).toHaveLength(106);
  for (const href of links.filter((_, i) => i % 20 === 0)) {
    const antwort = await page.goto(href);
    expect(antwort?.status()).toBe(200);
    await expect(page.locator('#raster > i')).toHaveCount(100);
  }
  f.pruefe();
});
