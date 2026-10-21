import { test, expect, menu } from './fixtures.js';

/** Nutzwert aktivieren und Kriterien anlegen (das erste übernimmt die bisherigen Werte). */
async function setupCriteria(page, names) {
  await menu(page, 'settings');
  await page.check('#setUtility');
  await page.locator('.criteria-name').first().fill(names[0]);
  for (const n of names.slice(1)) {
    await page.click('#addCriterionBtn');
    await expect(page.locator('.criteria-name').last()).toBeFocused();
    await page.keyboard.type(n);
  }
}

test('Kriterien: Gewichte, Bewertung im Popover mit Enter-Navigation, Vergleich je Kriterium', async ({ page }) => {
  await setupCriteria(page, ['Geschmack', 'Komfort']);
  await expect(page.locator('.criteria-share')).toHaveText(['50 %', '50 %']);
  await page.locator('.criteria-weight').first().fill('75');
  await page.locator('.criteria-weight').last().fill('25');
  await expect(page.locator('.criteria-share')).toHaveText(['75 %', '25 %']);
  await page.click('#settingsDone');

  await page.click('[data-mode="edit"]');
  // Thermoblock hatte Nutzwert 8 → jetzt Geschmack 8, Komfort fehlt (teilweise bewertet)
  const btn = page.locator('[data-score-btn="p1o3"]');
  await expect(btn).toContainText('6');
  await expect(btn.locator('.score-partial')).toHaveText('1/2');
  await btn.click();
  const pop = page.locator('#scorePop');
  await expect(pop).toBeVisible();
  await expect(pop.locator('input').first()).toBeFocused();
  await page.keyboard.type('9'); // ersetzt die markierte 8
  await page.keyboard.press('Enter');
  await page.keyboard.type('5');
  await expect(pop.locator('.score-total b')).toHaveText('8'); // 0,75 × 9 + 0,25 × 5
  await page.keyboard.press('Enter'); // nach dem letzten Kriterium: nächste Ausprägung
  await expect(pop.locator('h3')).toHaveText('Nutzwert von „Induktion“');
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
  await expect(btn).toContainText('8');
  await expect(btn.locator('.score-partial')).toHaveCount(0);

  // Konzeptvergleich: Zeilen je Kriterium
  await page.click('[data-mode="select"]');
  await expect(page.locator('#compareTable .crit-row th')).toHaveText(['Geschmack (75 %)', 'Komfort (25 %)']);

  // Rückgängig nimmt die Eingabe zurück
  await page.keyboard.press('Control+z');
  await page.click('[data-mode="edit"]');
  await expect(btn.locator('.score-partial')).toHaveText('1/2');
});

test('Bewertungstabelle: Werte aller Ausprägungen, ↓/Enter springen eine Zeile weiter', async ({ page }) => {
  await setupCriteria(page, ['Geschmack', 'Komfort']);
  await page.click('#scoreTableBtn');
  const dialog = page.locator('#valueDialog');
  await expect(dialog).toBeVisible();
  // Das Beispiel hat zwei Merkmale: Reiter sichtbar, „Nutzwert“ gewählt
  await expect(page.locator('#valueHeading')).toHaveText('Werte aller Ausprägungen');
  await expect(dialog.getByRole('tab')).toHaveText(['Nutzwert2 Kriterien', 'Eigene Merkmale2']);
  await expect(dialog.getByRole('tab', { name: /Nutzwert/ })).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.locator('input[data-r="0"][data-c="0"]')).toBeFocused();
  await page.keyboard.type('4');
  await page.keyboard.press('Enter');
  await expect(dialog.locator('input[data-r="1"][data-c="0"]')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(dialog.locator('input[data-r="0"][data-c="0"]')).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.type('8');
  await expect(dialog.locator('tbody tr').nth(1).locator('td.num')).toHaveText('6'); // (4 + 8) / 2
  // Reiter wechseln: Merkmal-Tabelle, Fokus im ersten Feld; zurück zum Nutzwert
  await dialog.getByRole('tab', { name: /Eigene Merkmale/ }).click();
  await expect(dialog.locator('.attr-table')).toBeVisible();
  await expect(dialog.locator('[data-r="0"][data-c="0"]')).toBeFocused();
  await dialog.getByRole('tab', { name: /Nutzwert/ }).click();
  await expect(dialog.locator('input[data-r="0"][data-c="0"]')).toHaveValue('4');
  await page.click('#valueDone');
  await page.click('#settingsDone');
  await page.click('[data-mode="edit"]');
  await expect(page.locator('[data-score-btn="p1o1"]')).toContainText('6');
});

test('Zurück auf ein Kriterium: wieder das einfache Zahlenfeld in der Zelle', async ({ page }) => {
  await setupCriteria(page, ['Geschmack', 'Komfort']);
  page.on('dialog', d => d.accept());
  await page.locator('.criteria-list .icon-btn.danger').last().click();
  await expect(page.locator('.criteria-name')).toHaveCount(1);
  // Tabelle auch mit einem Kriterium: eine Spalte, ohne gewichtete Summe
  await page.click('#scoreTableBtn');
  await expect(page.locator('#valueDialog .score-table thead th')).toHaveCount(2);
  await page.click('#valueDone');
  await page.click('#settingsDone');
  await page.click('[data-mode="edit"]');
  await expect(page.locator('[data-score-btn]')).toHaveCount(0);
  await expect(page.locator('.opt-cell.edit[data-oid="p1o3"] .metric-field input').last()).toHaveValue('8');
});

test('Popover bleibt beim Weiterblättern offen, auch wenn dafür gescrollt wird; Bildlauf sonst schließt', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 520 });
  await setupCriteria(page, ['Geschmack', 'Komfort']);
  await page.click('#settingsDone');
  await page.click('[data-mode="edit"]');
  await page.click('[data-score-btn="p1o4"]');
  const pop = page.locator('#scorePop');
  for (let i = 0; i < 4; i++) await pop.getByRole('button', { name: 'Nächste Ausprägung' }).click();
  await expect(pop).toBeVisible();
  await expect(pop.locator('h3')).toHaveText('Nutzwert von „Handhebel“');
  await expect(page.locator('[data-score-btn="p2o4"]')).toBeInViewport();
  await page.waitForTimeout(400); // nach der Schonfrist für das eigene Scrollen
  await page.mouse.wheel(0, 300);
  await expect(pop).toBeHidden();
});

test('Kosten in der Tabelle: eigene Spalte vorne, auch ohne Nutzwert', async ({ page }) => {
  // Nur Kosten: Knopf in den Einstellungen, Reiter „Kosten“ ohne Kriterien-Spalten
  await menu(page, 'settings');
  await page.check('#setCosts');
  await page.click('#costTableBtn');
  const dialog = page.locator('#valueDialog');
  await expect(dialog.getByRole('tab')).toHaveText(['Kosten', 'Eigene Merkmale2']);
  await expect(dialog.locator('.score-table thead th')).toHaveText(['Ausprägung', 'Kosten€']);
  await expect(dialog.locator('input[data-r="0"][data-c="0"]')).toBeFocused();
  await page.keyboard.type('20');
  await page.keyboard.press('Enter');
  await expect(dialog.locator('input[data-r="1"][data-c="0"]')).toBeFocused();
  await page.click('#valueDone');

  // Mit Nutzwert: Reiter „Bewertung“, Kosten vor den Kriterien, Tab springt zum ersten Kriterium
  await page.check('#setUtility');
  await expect(page.locator('#costTableBtn')).toHaveCount(0);
  await page.locator('.criteria-name').first().fill('Geschmack');
  await page.click('#addCriterionBtn');
  await page.keyboard.type('Komfort');
  await page.click('#scoreTableBtn');
  await expect(dialog.getByRole('tab')).toHaveText(['Bewertung2 Kriterien', 'Eigene Merkmale2']);
  await expect(dialog.locator('.score-table thead th')).toHaveText(['Ausprägung', 'Kosten€', 'Geschmack50 %', 'Komfort50 %', 'Nutzwertgewichtet']);
  await expect(dialog.locator('input[data-r="0"][data-c="0"]')).toHaveValue('20');
  await expect(dialog.locator('input[data-r="0"][data-c="0"]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.locator('input[data-r="0"][data-c="1"]')).toBeFocused();
  await expect(dialog.locator('input[data-r="0"][data-c="1"]')).toHaveAccessibleName('Geschmack von Durchlauferhitzer (0 bis 10)');
  await page.click('#valueDone');
  await page.click('#settingsDone');
  await page.click('[data-mode="edit"]');
  await expect(page.locator('.opt-cell.edit[data-oid="p1o1"] .metric-field input').first()).toHaveValue('20');
});

test('Stabilität: Kipppunkte je Kriterium, Gewichte ausprobieren und übernehmen', async ({ page }) => {
  await setupCriteria(page, ['Geschmack', 'Komfort']);
  await page.click('#settingsDone');
  await page.click('[data-compare-view="stability"]');
  const view = page.locator('#compareStability');
  // Komfort ist noch nicht bewertet: Checkliste mit Knopf zur Bewertungstabelle
  await expect(view.locator('#stabilityChecklist li:not(.is-done)')).toHaveCount(1);
  await expect(view.locator('#stabilityChecklist li:not(.is-done)')).toContainText('Komfort: 0 von 12 bewertet');
  await view.getByRole('button', { name: 'Bewertungstabelle …' }).click();
  // Komfort für die gewählten Ausprägungen von Kompakt-Espresso und Smart Home: Thermoblock 10, sonst 0
  const dialog = page.locator('#valueDialog');
  for (const r of [1, 2, 5, 6, 8, 11, 13, 15, 16, 21]) await dialog.locator(`input[data-r="${r}"][data-c="1"]`).fill(r === 2 ? '10' : '0');
  await page.keyboard.press('Enter');
  await page.click('#valueDone');
  await expect(view.locator('#stabilitySummary')).toContainText('Kompakt-Espresso liegt vorn (4,88 vor 3,79 für Smart Home).');
  await expect(view.locator('.stab-text')).toHaveText([/ab 88,2\s%\sliegt Smart Home vorn/, /unter 11,8\s%\sliegt Smart Home vorn/]);
  await expect(view.locator('#stabilityRanking li .stab-concept')).toHaveText(['Kompakt-Espresso', 'Smart Home', 'Outdoor (verworfen)']);

  // Komfort probeweise auf 0: Smart Home vorn, Matrix unverändert
  await expect(page.locator('#stabilityApply')).toBeDisabled();
  await page.getByLabel('Probegewicht von „Komfort“').fill('0');
  await expect(view.locator('#stabilityRanking li .stab-concept').first()).toHaveText('Smart Home');
  await expect(view.locator('#stabilityRanking li .stab-move').first()).toHaveText('▲ 1');
  await expect(view.locator('#stabilitySummary')).toContainText('Kompakt-Espresso liegt vorn');
  await page.click('#stabilityReset');
  await expect(view.locator('#stabilityRanking li .stab-concept').first()).toHaveText('Kompakt-Espresso');

  // Übernehmen ändert die Gewichte (rückgängig machbar)
  await page.getByLabel('Probegewicht von „Komfort“').fill('0');
  await page.click('#stabilityApply');
  await expect(view.locator('#stabilitySummary')).toContainText('Smart Home liegt vorn');
  await page.keyboard.press('Control+z');
  await expect(view.locator('#stabilitySummary')).toContainText('Kompakt-Espresso liegt vorn');
});

test('Stabilität ohne Bewertung: Erklärung und Checkliste, Knöpfe führen zum Schritt', async ({ page }) => {
  await page.click('[data-compare-view="stability"]');
  const view = page.locator('#compareStability');
  await expect(view).toContainText('Wie stabil ist die Rangfolge?');
  await expect(view.locator('.stab-steps')).toHaveText('Noch 2 von 4 Schritten');
  await expect(view.locator('#stabilityChecklist li.is-done')).toHaveText([/Jedes Kriterium bewertet/, /2 von 3 Konzepten \(1 verworfen\)/]);
  await view.getByRole('button', { name: 'Einstellungen …' }).click();
  await expect(page.locator('#settingsDialog')).toBeVisible();
  await page.check('#setUtility');
  await page.click('#settingsDone');
  await expect(view.locator('.stab-steps')).toHaveText('Noch 1 von 4 Schritten');
  // „Kriterium hinzufügen …“ öffnet die Einstellungen mit dem neuen Kriterium im Fokus
  await view.getByRole('button', { name: 'Kriterium hinzufügen …' }).click();
  await expect(page.locator('.criteria-name').last()).toBeFocused();
  await expect(page.locator('.criteria-name')).toHaveCount(2);
});
