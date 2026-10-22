import { test, expect, menu, setTitle, openFresh } from './fixtures.js';
import { APP, REPO, fakeGitHub } from './github.js';

/*
 * Teilen zum Ansehen aus der GitHub-Ablage: geheimes Gist, Empfänger ohne Konto und ohne Ablage,
 * nur lesend; das Öffnen eines Links speichert nichts. GitHub ist nachgebildet (./github.js).
 */

const docKeys = page => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('morphologische-matrix:doc:')));
const sharedRecord = gh => JSON.parse(Object.values([...gh.gists.values()][0].files)[0].content);

async function connect(page) {
  await menu(page, 'storage');
  const dlg = page.locator('#syncDialog');
  await dlg.locator('[data-sync="next"]').click();
  await expect(dlg.locator('[data-sync="token-link"]')).toHaveAttribute('href', /contents=write&gists=write&expires_in=90/);
  await dlg.locator('input[name="repo"]').fill(REPO);
  await dlg.locator('input[name="token"]').fill('github_pat_test');
  await dlg.locator('[data-sync="connect"]').click();
  await dlg.locator('[data-sync="finish"]').click();
  await expect(dlg).toBeHidden();
  await expect(page.locator('#syncStatus')).toHaveAttribute('data-status', 'ok');
}

/** Ablage einrichten, Matrix „Geteilt 1“ teilen; gibt Zustand und Link zurück. */
async function shareOne(page) {
  const gh = await fakeGitHub(page);
  await setTitle(page, 'Geteilt 1');
  await connect(page);
  await menu(page, 'share');
  const dlg = page.locator('#syncDialog');
  await expect(dlg).toContainText('nur ansehen können');
  await dlg.locator('[data-sync="share-create"]').click();
  const link = await dlg.locator('input[name="share-link"]').inputValue();
  expect(link).toMatch(/#g=ab[0-9a-f]{10}$/);
  await dlg.locator('button', { hasText: 'Fertig' }).click();
  return { gh, link };
}

test('ohne Ablage: „Teilen …“ erklärt die Ablage', async ({ page }) => {
  await menu(page, 'share');
  await expect(page.locator('#syncDialog')).toContainText('Teilen gibt es mit der Ablage');
  await expect(page.locator('[data-action="share"]')).toHaveCount(1);
});

test('Teilen: geheimes Gist, Kennung in der Ablage, Link folgt dem Abgleich, Kennzeichen, beenden', async ({ page }) => {
  const { gh } = await shareOne(page);
  expect(gh.gists.size).toBe(1);
  const gist = [...gh.gists.values()][0];
  expect(gist.public).toBe(false);
  expect(Object.keys(gist.files)).toEqual([`${APP}.json`]);
  expect(sharedRecord(gh)).toMatchObject({ app: APP, data: { title: 'Geteilt 1' } });
  const id = await page.evaluate(() => JSON.parse(sessionStorage.getItem('morphologische-matrix:workspace')).active);
  await expect.poll(() => gh.read(`${APP}/${id}.json`)?.share?.gist).toBe(gist.id);

  await setTitle(page, 'Geteilt 2');
  await page.click('#syncStatus');
  await page.click('[data-sync="flush"]');
  await expect.poll(() => sharedRecord(gh).data.title).toBe('Geteilt 2');
  await page.keyboard.press('Escape');

  await menu(page, 'open');
  await expect(page.locator('#libraryDialog [data-sync="shared-badge"]')).toHaveText('geteilt');
  await page.locator('#libraryDialog [data-sync="shared-badge"]').click();
  page.once('dialog', d => d.accept());
  await page.locator('#syncDialog [data-sync="share-stop"]').click();
  await expect.poll(() => gh.gists.size).toBe(0);
  await expect.poll(() => gh.read(`${APP}/${id}.json`)?.share).toBeUndefined();
});

test('fehlende Berechtigung „Gists“: Hinweis mit vorbelegtem Token-Link', async ({ page }) => {
  const gh = await fakeGitHub(page);
  gh.gistsForbidden = true;
  await setTitle(page, 'Geteilt 1');
  await connect(page);
  await menu(page, 'share');
  const dlg = page.locator('#syncDialog');
  await dlg.locator('[data-sync="share-create"]').click();
  await expect(dlg).toContainText('Dem Token fehlt die Berechtigung „Gists“');
  await expect(dlg.locator('[data-sync="token-link"]')).toHaveAttribute('href', /gists=write/);
  expect(gh.gists.size).toBe(0);
});

test('Empfänger ohne Ablage: nur lesen, nichts gespeichert, Aktualisieren, Als Kopie speichern', async ({ page, browser }) => {
  const { gh, link } = await shareOne(page);
  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await fakeGitHub(other, { gh });
  await openFresh(other);
  const before = await docKeys(other);
  const requests = gh.requests;
  await other.goto(link);
  const bar = other.locator('#syncPreview[data-kind="shared"]');
  await expect(bar).toContainText('Geteilte Matrix');
  await expect(other.locator('#title')).toHaveValue('Geteilt 1');
  expect(other.url()).not.toContain('#g=');
  // nur lesen: Tippen ändert nichts, nichts wird gespeichert
  await other.locator('#title').dblclick();
  await other.keyboard.type('xyz');
  await expect(other.locator('#title')).toHaveValue('Geteilt 1');
  await other.keyboard.press('Escape');
  await other.waitForTimeout(500);
  expect(await docKeys(other)).toEqual(before);
  expect(await other.evaluate(() => Object.values(localStorage).some(v => v.includes('Geteilt 1')))).toBe(false);

  // Besitzer ändert, Empfänger aktualisiert selbst
  await setTitle(page, 'Neuer Stand');
  await page.click('#syncStatus');
  await page.click('[data-sync="flush"]');
  await expect.poll(() => sharedRecord(gh).data.title).toBe('Neuer Stand');
  await expect(other.locator('#title')).toHaveValue('Geteilt 1');
  await bar.locator('[data-sync="shared-refresh"]').click();
  await expect(other.locator('#title')).toHaveValue('Neuer Stand');
  expect(gh.requests - requests).toBeLessThan(10); // nur Abrufe beim Öffnen und Aktualisieren

  // Als Kopie speichern: erst jetzt entsteht eine Matrix
  await bar.locator('[data-sync="shared-copy"]').click();
  await expect(bar).toHaveCount(0);
  await expect(other.locator('#title')).toHaveValue('Neuer Stand (geteilt)');
  await expect.poll(async () => (await docKeys(other)).length).toBe(before.length + 1);
  await ctx.close();
});

test('mit eingerichteter Ablage: Öffnen eines Links schreibt nichts in die Ablage; Schließen verwirft', async ({ page }) => {
  const { gh, link } = await shareOne(page);
  await setTitle(page, 'Meine eigene');
  await page.click('#syncStatus');
  await page.click('[data-sync="flush"]');
  await page.keyboard.press('Escape');
  await expect.poll(() => [...gh.files.keys()].filter(k => k.startsWith(`${APP}/`)).length).toBe(1);
  await expect.poll(() => sharedRecord(gh).data.title).toBe('Meine eigene');
  const files = gh.files.size;
  const docs = (await docKeys(page)).length;
  await page.evaluate(h => { location.hash = h; }, new URL(link).hash);
  const bar = page.locator('#syncPreview[data-kind="shared"]');
  await expect(page.locator('#title')).toHaveValue('Meine eigene');
  await expect(bar).toBeVisible();
  await page.click('#syncStatus');
  await page.click('[data-sync="flush"]');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  expect(gh.files.size).toBe(files);
  expect((await docKeys(page)).length).toBe(docs);
  await bar.locator('[data-sync="shared-close"]').click();
  await expect(bar).toHaveCount(0);
  await expect(page.locator('#title')).toHaveValue('Meine eigene');
});

test('ungültiger oder beendeter Link: Hinweis, keine Ansicht', async ({ page }) => {
  await fakeGitHub(page);
  await page.evaluate(() => { location.hash = '#g=abcdef1234'; });
  await expect(page.locator('#toast')).toContainText('nicht mehr gültig');
  await expect(page.locator('#syncPreview')).toHaveCount(0);
});
