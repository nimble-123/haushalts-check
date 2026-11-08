import AxeBuilder from '@axe-core/playwright';
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
  const sankeyVorher = await page.locator('#dein-fluss').innerHTML();
  await page.locator('#brutto').click();
  await page.keyboard.type('72000');
  await expect(ergebnis(page)).toContainText('Von 72.000 € Brutto');
  await expect(page.locator('#vorbelegt')).toBeHidden();
  expect(await page.locator('#dein-fluss').innerHTML()).not.toBe(sankeyVorher);
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

// Ohne Überblendung: Die Tests wechseln die Seite schneller, als der Seitenwechsel dauert
test.describe('Ortssuche', () => {
  test.use({ reducedMotion: 'reduce' });

  test('Gemeinde führt zum Landkreis', async ({ page }) => {
    const f = fehlerSammeln(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Ort suchen' }).click();
    const feld = page.locator('#ort-suche');
    await expect(feld).toBeFocused();
    await expect(page.locator('#stadt')).toBeHidden();
    await feld.fill('Nordenham');
    const treffer = page.locator('#ort-treffer li').first();
    await expect(treffer).toContainText('Nordenham');
    await expect(treffer).toContainText('Landkreis Wesermarsch, Niedersachsen');
    await expect(feld).toHaveAttribute('aria-expanded', 'true');
    await treffer.click();
    await expect(page).toHaveURL(/\/stadt\/landkreis-wesermarsch\/$/);
    await expect(page.locator('#stadt')).toHaveValue('landkreis-wesermarsch');
    f.pruefe();
  });

  test('Umschreibung findet den Ort, Auswahl per Tastatur', async ({ page }) => {
    const f = fehlerSammeln(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Ort suchen' }).click();
    await page.locator('#ort-suche').fill('Goettingen');
    await expect(page.locator('#ort-treffer li').first()).toContainText('Göttingen');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#ort-treffer li').first()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/stadt\/landkreis-goettingen\/$/);
    f.pruefe();
  });

  test('ohne Treffer ein Hinweis, Escape schließt', async ({ page }) => {
    await page.goto('/');
    const knopf = page.getByRole('button', { name: 'Ort suchen' });
    await knopf.click();
    await expect(knopf).toHaveAttribute('aria-expanded', 'true');
    const feld = page.locator('#ort-suche');
    await feld.fill('Xyzqw');
    await expect(page.locator('#ort-status')).toContainText('Kein Ort gefunden');
    await feld.fill('Kiel');
    await expect(page.locator('#ort-treffer')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#ort-treffer')).toBeHidden();
    await expect(feld).toHaveAttribute('aria-expanded', 'false');
    await expect(feld).toBeHidden();
    await expect(page.locator('#stadt')).toBeVisible();
    await expect(knopf).toBeFocused();
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
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

test('Konsumsteuern: Checkbox senkt das Netto, verteilt auf die Ebenen und wird gemerkt', async ({ page }) => {
  const f = fehlerSammeln(page);
  await page.goto('/');
  const netto = page.locator('#pk .rs-kennzahl').last();
  const ohne = await netto.locator('b').textContent();
  await expect(page.locator('#anteil-lg')).not.toContainText('Konsumsteuern');

  await page.locator('#konsum').check();
  await expect(page.locator('#anteil-lg')).toContainText('Konsumsteuern ≈');
  await expect(netto).toContainText('nach Konsumsteuern ≈');
  await expect(netto).toContainText('vom Brutto');
  await expect(page.locator('#pk')).not.toContainText('≈,');
  // Die Kennzahl zählt zum neuen Betrag hoch: auf den Endstand warten
  await expect(netto.locator('b')).not.toHaveText(ohne ?? '');
  await expect(ergebnis(page)).toContainText('Konsumsteuern');
  await expect(page.locator('#k2-konsum')).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);

  await page.reload();
  await expect(page.locator('#konsum')).toBeChecked();
  await expect(page.locator('#anteil-lg')).toContainText('Konsumsteuern ≈');
  f.pruefe();
});

test('Bewegung: Zeitraffer der Bundesausgaben startet erst im Bild', async ({ page }) => {
  const f = fehlerSammeln(page);
  await page.goto('/');
  const svg = page.locator('#entwicklung');
  await expect(svg.locator('.wachsen').first()).toBeAttached();
  await expect(svg).not.toHaveClass(/rs-zeitraffer/);
  await svg.scrollIntoViewIfNeeded();
  await expect(svg).toHaveClass(/rs-zeitraffer/);
  f.pruefe();
});

test.describe('Bewegung bei „weniger Bewegung“', () => {
  test.use({ reducedMotion: 'reduce' });
  test('kein Zeitraffer, neue Bänder stehen sofort', async ({ page }) => {
    const f = fehlerSammeln(page);
    await page.goto('/');
    await expect(page.locator('#entwicklung rect').first()).toBeAttached();
    await expect(page.locator('#entwicklung .wachsen')).toHaveCount(0);
    await page.locator('#ag').check();
    await expect(page.locator('#dein-fluss [data-k="n:ag"]')).toBeAttached();
    await expect(page.locator('#dein-fluss [style*="opacity"]')).toHaveCount(0);
    f.pruefe();
  });
});
