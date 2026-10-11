import { test, expect, menu } from './fixtures.js';

// Das Beispiel „Kaffeemaschine“ hat zwei Merkmale: Gewicht (Dezimalzahl, kg, Summe, Warnung über 4)
// und Lautstärke (Ganzzahl, dB, Maximum, Warnung über 65).

test('Merkmale: Werte direkt in der Zelle, Ganzzahl-Prüfung, Kombinieren und Vergleich mit Warnung', async ({ page }) => {
  await page.click('[data-mode="edit"]');
  const cell = page.locator('.opt-cell.edit[data-oid="p2o2"]');
  await expect(cell.locator('.attr-name')).toHaveText(['Gewicht', 'Lautstärke']);
  const db = cell.getByLabel('Lautstärke von Vibrationspumpe');
  await expect(db).toHaveValue('72');
  await db.fill('60,5');
  await expect(db).toHaveAttribute('aria-invalid', 'true'); // nur ganze Zahlen
  await db.fill('60');
  await expect(db).not.toHaveAttribute('aria-invalid');
  await db.press('Enter');

  // Kombinieren: kleine Zeile mit den Werten
  await page.click('[data-mode="select"]');
  await expect(page.locator('[data-cell="p2:p2o2"] .opt-attrs-view')).toHaveText('0,3 kg · 60 dB');

  // Vergleich: Abschnitt „Eigene Merkmale“, Smart Home überschreitet das Gewicht
  const rows = page.locator('#compareTable .attr-row');
  await expect(rows.locator('th')).toHaveText(['Gewicht (Summe)', 'Lautstärke (Maximum)']);
  await expect(rows.first().locator('td')).toHaveText(['1,2 kg', '2,7 kg', '4,7 kg⚠ über 4,0 kg']);
  await expect(rows.nth(1).locator('td').first()).toHaveText('60 dB');
  await expect(rows.nth(1).locator('.attr-warn')).toHaveCount(0);

  // Sortieren nach Gewicht (leichtestes zuerst)
  await page.selectOption('#compareSort', { label: 'Gewicht (niedrigstes zuerst)' });
  await expect(page.locator('#compareTable thead th .rank')).toHaveText(['1.', '2.', '3.']);
  await expect(rows.first().locator('td')).toHaveText(['1,2 kg', '2,7 kg', '4,7 kg⚠ über 4,0 kg']);
  await page.selectOption('#compareSort', { label: 'Gewicht (höchstes zuerst)' });
  await expect(rows.first().locator('td').first()).toContainText('4,7 kg');

  // Zusammenfassung in der Seitenleiste
  await expect(page.locator('#conceptSummary .metric-attr')).toHaveCount(2);
});

test('Merkmale definieren: Auswahl mit Stufen, ab drei Merkmalen Popover mit Enter-Navigation und Tabelle', async ({ page }) => {
  await menu(page, 'settings');
  await page.click('#addAttributeBtn');
  await expect(page.locator('.attr-item.is-open [data-attr-name]')).toBeFocused();
  await page.keyboard.type('Reifegrad');
  await page.selectOption('.attr-item.is-open [data-attr-type]', 'choice');
  const levels = page.locator('.attr-item.is-open [data-level]');
  await levels.nth(0).fill('Idee');
  await levels.nth(1).fill('Prototyp');
  await page.click('.attr-item.is-open [data-add-level]');
  await expect(levels.nth(2)).toBeFocused();
  await page.keyboard.type('Serie');
  await page.selectOption('.attr-item.is-open [data-attr-limit-op]', 'level');
  await page.selectOption('.attr-item.is-open select[data-attr-limit]', { label: 'Idee' });
  await expect(page.locator('.attr-item.is-open .attr-title small')).toHaveText('Auswahl (Stufen) · je Konzept: höchste Stufe · ⚠ ab Stufe „Idee“');
  await page.click('#settingsDone');

  // Drei Merkmale: Knopf statt Felder
  await page.click('[data-mode="edit"]');
  const btn = page.locator('[data-attr-btn="p1o3"]');
  await expect(btn).toContainText('0,6 kg');
  await expect(btn.locator('.attr-filled')).toHaveText('1/3');
  await btn.click();
  const pop = page.locator('#attrPop');
  await expect(pop).toBeVisible();
  await expect(pop.locator('[data-attr-field="0"]')).toBeFocused();
  await page.keyboard.type('0,7');
  await page.keyboard.press('Enter');
  await expect(pop.locator('[data-attr-field="1"]')).toBeFocused();
  await page.keyboard.type('40');
  await page.keyboard.press('Enter');
  await pop.locator('[data-attr-field="2"]').selectOption({ label: 'Prototyp' });
  await page.keyboard.press('Enter'); // nach dem letzten Merkmal: nächste Ausprägung
  await expect(pop.locator('h3')).toHaveText('Merkmale von „Induktion“');
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
  await expect(btn).toContainText('0,7 kg · 40 dB · Prototyp');
  await expect(btn.locator('.attr-filled')).toHaveText('3/3');

  // Tabelle aller Ausprägungen
  await btn.click();
  await pop.getByRole('button', { name: 'Tabelle aller Ausprägungen …' }).click();
  const dialog = page.locator('#attrDialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#attrHeading')).toHaveText('Eigene Merkmale');
  await expect(dialog.locator('[data-r="0"][data-c="0"]')).toBeFocused();
  await page.keyboard.type('0,5');
  await page.keyboard.press('Enter');
  await expect(dialog.locator('[data-r="1"][data-c="0"]')).toBeFocused();
  await page.click('#attrDone');
  await expect(page.locator('[data-attr-btn="p1o1"]')).toContainText('0,5 kg');

  // Vergleich: Stufe und Warnung
  await page.click('[data-mode="select"]');
  const row = page.locator('#compareTable .attr-row').nth(2);
  await expect(row.locator('th')).toHaveText('Reifegrad (höchste Stufe)');
  await expect(row.locator('td').first()).toHaveText('Prototyp⚠ ab Stufe „Idee“');
});

test('Merkmal löschen fragt nach und lässt sich rückgängig machen; Suche findet Textwerte', async ({ page }) => {
  await menu(page, 'settings');
  await page.click('#addAttributeBtn');
  await page.keyboard.type('Material');
  await page.selectOption('.attr-item.is-open [data-attr-type]', 'text');
  await page.click('#settingsDone');
  await page.click('[data-mode="edit"]');
  // Drei Merkmale → Popover
  await page.locator('[data-attr-btn="p1o4"]').click();
  await page.locator('#attrPop [data-attr-field="2"]').fill('Edelstahl');
  await page.keyboard.press('Escape');
  await page.fill('#matrixSearch', 'edelstahl');
  await expect(page.locator('.opt-cell.is-match')).toHaveCount(1);
  await page.fill('#matrixSearch', '');

  await menu(page, 'settings');
  page.once('dialog', d => d.accept());
  await page.locator('.attr-item').filter({ hasText: 'Material' }).getByRole('button', { name: 'Merkmal löschen' }).click();
  await expect(page.locator('.attr-item')).toHaveCount(2);
  await page.click('#settingsDone');
  await page.keyboard.press('Control+z');
  await menu(page, 'settings');
  await expect(page.locator('.attr-item')).toHaveCount(3);
});

test('Merkmale aus Vorlagen: vorhandene ausgegraut, mehrere auf einmal anlegen, Grenze „unter Stufe“ warnt', async ({ page }) => {
  await menu(page, 'settings');
  await page.click('#attrTemplateBtn');
  const picker = page.locator('#attrTemplates');
  await expect(page.locator('#attrTemplateBtn')).toHaveAttribute('aria-expanded', 'true');
  // Gewicht und Lautstärke gibt es im Beispiel schon
  await expect(picker.locator('[data-template="weight"] input')).toBeDisabled();
  await expect(picker.locator('[data-template="weight"]')).toContainText('vorhanden');
  await expect(picker.locator('[data-template="maturity"]')).toContainText('Stufen: Idee · Prototyp · erprobt · Serie · je Konzept: niedrigste Stufe · ⚠ unter Stufe „erprobt“');
  await expect(page.locator('#attrTemplateApply')).toBeDisabled();
  await picker.locator('[data-template="maturity"] input').check();
  await picker.locator('[data-template="recyclable"] input').check();
  await expect(picker.locator('.tpl-foot')).toContainText('2 ausgewählt');
  await page.click('#attrTemplateApply');
  await expect(picker).toHaveCount(0);
  await expect(page.locator('.attr-item b')).toHaveText(['Gewicht', 'Lautstärke', 'Reifegrad', 'Recyclingfähig']);
  await expect(page.locator('.attr-item.is-new')).toHaveCount(2);
  await expect(page.locator('.attr-item', { hasText: 'Recyclingfähig' })).toContainText('Ja/Nein · je Konzept: Anzahl Ja · ⚠ nicht alle Ja');
  // Erneut geöffnet: die neuen sind jetzt vorhanden
  await page.click('#attrTemplateBtn');
  await expect(picker.locator('[data-template="maturity"] input')).toBeDisabled();
  await picker.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(picker).toHaveCount(0);

  // Grenze umschalten: „ab Stufe“ ↔ „unter Stufe“ behält die Stufe
  const item = page.locator('.attr-item', { hasText: 'Reifegrad' });
  await item.locator('.attr-title').click();
  await expect(item.locator('[data-attr-limit]')).toHaveValue(await item.locator('[data-attr-limit] option', { hasText: 'erprobt' }).getAttribute('value'));
  await item.locator('[data-attr-limit-op]').selectOption('level');
  await expect(item.locator('.attr-title small')).toContainText('⚠ ab Stufe „erprobt“');
  await item.locator('[data-attr-limit-op]').selectOption('levelBelow');
  await expect(item.locator('.attr-title small')).toContainText('⚠ unter Stufe „erprobt“');
  await page.click('#settingsDone');

  // Werte erfassen (Tabelle) und Warnung im Vergleich: Kompakt-Espresso hat eine „Idee“
  await page.click('[data-mode="edit"]');
  await page.locator('.opt-cell.edit[data-oid="p1o3"] [data-attr-btn]').click();
  const pop = page.locator('#attrPop');
  await pop.getByLabel('Reifegrad von Thermoblock').selectOption({ label: 'Idee' });
  await page.keyboard.press('Escape');
  const row = page.locator('#compareTable .attr-row', { hasText: 'Reifegrad' });
  await expect(row.locator('td').first()).toContainText('⚠ unter Stufe „erprobt“');
});

test('Vorlage „Wert/Aufwand“: Verteilung je Konzept im Vergleich, Warnung bei Zeitfresser', async ({ page }) => {
  await menu(page, 'settings');
  await page.click('#attrTemplateBtn');
  await expect(page.locator('#attrTemplates h4')).toContainText(['Methoden']);
  await expect(page.locator('[data-template="kano"]')).toContainText('Stufen: Rückweisung · indifferent · Basis · Leistung · Begeisterung · je Konzept: Anzahl je Stufe · ⚠ unter Stufe „indifferent“');
  await page.locator('[data-template="valueEffort"] input').check();
  await page.click('#attrTemplateApply');
  await expect(page.locator('.attr-item', { hasText: 'Wert/Aufwand' })).toContainText('je Konzept: Anzahl je Stufe');
  await page.click('#settingsDone');

  // Kompakt-Espresso: Thermoblock = Quick Win, Vibrationspumpe = Zeitfresser
  await page.click('[data-mode="edit"]');
  const pop = page.locator('#attrPop');
  await page.locator('.opt-cell.edit[data-oid="p1o3"] [data-attr-btn]').click();
  await pop.getByLabel('Wert/Aufwand von Thermoblock').selectOption({ label: 'Quick Win' });
  await page.keyboard.press('Escape');
  await page.locator('.opt-cell.edit[data-oid="p2o2"] [data-attr-btn]').click();
  await pop.getByLabel('Wert/Aufwand von Vibrationspumpe').selectOption({ label: 'Zeitfresser' });
  await page.keyboard.press('Escape');
  const row = page.locator('#compareTable .attr-row', { hasText: 'Wert/Aufwand' });
  await expect(row.locator('th')).toHaveText('Wert/Aufwand (Anzahl je Stufe)');
  await expect(row.locator('td').first()).toContainText('1 × Quick Win · 1 × Zeitfresser');
  await expect(row.locator('td').first()).toContainText('⚠ unter Stufe „Lückenfüller“');
  // Nicht sortierbar: kein Eintrag in der Sortierung
  await expect(page.locator('#compareSort option', { hasText: 'Wert/Aufwand' })).toHaveCount(0);
});
