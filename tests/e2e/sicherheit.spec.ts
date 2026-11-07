import { expect, test } from '@playwright/test';

test.describe('Content-Security-Policy', () => {
  test('keine Verstöße auf allen Seitentypen, auch beim Bedienen', async ({ page }) => {
    const verstoesse: string[] = [];
    page.on('console', (m) => {
      if (/Content Security Policy|Refused to/i.test(m.text())) verstoesse.push(m.text());
    });
    for (const pfad of ['/', '/stadt/berlin/', '/rente/', '/staedte/', '/methodik/', '/gibt-es-nicht/']) {
      await page.goto(pfad);
    }
    await page.goto('/stadt/oldenburg/');
    await page.locator('#brutto').click();
    await page.keyboard.type('60000');
    await page.getByRole('button', { name: 'Als Fläche' }).click();
    await page.locator('details', { hasText: 'Alle Töpfe' }).locator('summary').click();
    await page.locator('#thema').click();
    expect(verstoesse).toEqual([]);
  });

  test('das gehashte Theme-Skript im <head> läuft (gespeicherte Wahl gilt sofort nach dem Laden)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('haushalts-check-thema', 'dark'));
    await page.goto('/methodik/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('404-Seite für unbekannte Adressen', async ({ page }) => {
    const antwort = await page.goto('/stadt/gibt-es-nicht/');
    expect(antwort?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Diese Seite gibt es nicht.');
  });
});
