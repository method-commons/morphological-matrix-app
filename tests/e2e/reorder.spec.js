import { test, expect } from './fixtures.js';

const firstRow = page => page.locator('.opt-cell.edit .opt-main textarea')
  .evaluateAll(els => els.slice(0, 4).map(e => e.value));

test('Ausprägungen per Leiste und Alt+Pfeil verschieben', async ({ page }) => {
  await page.click('[data-mode=edit]');
  const first = page.locator('.opt-cell.edit').first();
  await first.hover();
  await expect(first.locator('.opt-tools')).toHaveCSS('opacity', '1');
  await expect(first.getByRole('button', { name: /Nach links/ })).toBeDisabled();
  await first.getByRole('button', { name: /Nach rechts/ }).click();
  expect(await firstRow(page)).toEqual(['Boiler', 'Durchlauferhitzer', 'Thermoblock', 'Induktion']);

  await page.getByLabel('Wassererwärmung: Ausprägung 2').focus();
  await page.keyboard.press('Alt+ArrowRight');
  await page.keyboard.press('Alt+ArrowRight');
  expect(await firstRow(page)).toEqual(['Boiler', 'Thermoblock', 'Induktion', 'Durchlauferhitzer']);
  await expect(page.locator(':focus')).toHaveValue('Durchlauferhitzer');

  await page.click('#undoBtn');
  expect(await firstRow(page)).toEqual(['Boiler', 'Thermoblock', 'Durchlauferhitzer', 'Induktion']);
});

test('Verschieben erhält die Auswahl der Konzepte', async ({ page }) => {
  await page.click('[data-mode=edit]');
  const first = page.locator('.opt-cell.edit').first();
  await first.hover();
  await first.getByRole('button', { name: /Nach rechts/ }).click();
  await page.click('[data-mode=select]');
  await expect(page.locator('.opt-cell.pick.is-active').first()).toContainText('Thermoblock');
});

test('Touch-Geräte: Werkzeuge immer sichtbar', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const { APP_URL } = await import('./fixtures.js');
  await page.goto(APP_URL);
  await page.click('[data-mode=edit]');
  await expect(page.locator('.opt-tools').first()).toHaveCSS('opacity', '1');
  // Auch die Konzept-Aktionen (ohne Maus kein Darüberfahren)
  const inactive = page.locator('.concept:not(.is-active) .concept-tools').first();
  await expect(inactive).toHaveCSS('opacity', '1');
  await expect(inactive).toHaveCSS('position', 'static');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await context.close();
});

/** Parameternamen in Anzeigereihenfolge. */
const paramNames = page => page.locator('.param-cell .param-name').evaluateAll(els => els.map(e => e.value));

/** Griff eines Parameters zur Höhe des Ziels ziehen (`after`: untere Hälfte, sonst obere). */
async function dragParam(page, pid, target, after) {
  const grip = page.locator(`[data-dnd-param="${pid}"] .grip`);
  // Griff ins obere Drittel holen, damit das Ziel nicht am Fensterrand liegt (dort scrollt das Ziehen)
  await grip.evaluate(el => window.scrollBy(0, el.getBoundingClientRect().top - 200));
  const g = await grip.boundingBox();
  const t = await page.locator(target).boundingBox();
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.down();
  const y = after ? t.y + t.height * 0.75 : t.y + t.height * 0.25;
  await page.mouse.move(g.x + 40, y, { steps: 8 });
  return { drop: () => page.mouse.up() };
}

test('Parameter per Griff ziehen: innerhalb und zwischen Kategorien, Escape bricht ab, ↑/↓ auf dem Griff', async ({ page }) => {
  await page.click('[data-mode=edit]');
  const start = ['Wassererwärmung', 'Druckerzeugung', 'Kaffeezufuhr', 'Bedienung', 'Energieversorgung', 'Reinigung'];
  expect(await paramNames(page)).toEqual(start);

  // Druckerzeugung hinter Kaffeezufuhr: Hinweis zeigt die neue Position
  let drag = await dragParam(page, 'p2', '[data-dnd-param="p3"]', true);
  await expect(page.locator('.drag-tip')).toHaveText('Position 3');
  await expect(page.locator('.drop-line')).toHaveCount(1);
  await expect(page.locator('[data-dnd-param="p2"]')).toHaveClass(/dragging/);
  await drag.drop();
  expect(await paramNames(page)).toEqual(['Wassererwärmung', 'Kaffeezufuhr', 'Druckerzeugung', 'Bedienung', 'Energieversorgung', 'Reinigung']);
  await expect(page.locator('.drag-tip, .drop-line, .dragging')).toHaveCount(0);

  // In die andere Kategorie, vor Bedienung: Kategorie wechselt mit
  drag = await dragParam(page, 'p2', '[data-dnd-param="p4"]', false);
  await expect(page.locator('.drag-tip')).toHaveText('Nach „Nutzung & Betrieb“, Position 1');
  await drag.drop();
  expect(await paramNames(page)).toEqual(['Wassererwärmung', 'Kaffeezufuhr', 'Druckerzeugung', 'Bedienung', 'Energieversorgung', 'Reinigung']);
  await expect(page.locator('[data-dnd-param="p2"]')).toHaveAttribute('data-dnd-cat', await page.locator('[data-dnd-param="p4"]').getAttribute('data-dnd-cat'));

  // Escape bricht ab
  drag = await dragParam(page, 'p6', '[data-dnd-param="p1"]', false);
  await page.keyboard.press('Escape');
  await drag.drop();
  expect(await paramNames(page)).toEqual(['Wassererwärmung', 'Kaffeezufuhr', 'Druckerzeugung', 'Bedienung', 'Energieversorgung', 'Reinigung']);

  // Rückgängig nimmt das Ziehen in einem Schritt zurück (Kategorie und Stelle)
  await page.click('#undoBtn');
  expect(await paramNames(page)).toEqual(['Wassererwärmung', 'Kaffeezufuhr', 'Druckerzeugung', 'Bedienung', 'Energieversorgung', 'Reinigung']);
  await expect(page.locator('[data-dnd-param="p2"]')).toHaveAttribute('data-dnd-cat', await page.locator('[data-dnd-param="p1"]').getAttribute('data-dnd-cat'));
  await page.click('#undoBtn');
  expect(await paramNames(page)).toEqual(start);

  // Tastatur: ↓ auf dem Griff verschiebt, der Fokus bleibt auf dem Griff
  await page.locator('[data-dnd-param="p1"] .grip').focus();
  await page.keyboard.press('ArrowDown');
  expect(await paramNames(page)).toEqual(['Druckerzeugung', 'Wassererwärmung', 'Kaffeezufuhr', 'Bedienung', 'Energieversorgung', 'Reinigung']);
  await expect(page.locator('[data-dnd-param="p1"] .grip')).toBeFocused();
});
