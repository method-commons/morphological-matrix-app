import { test, expect, menu, setTitle, openFresh } from './fixtures.js';
import { APP, REPO, fakeGitHub } from './github.js';

/*
 * Teilen aus einem öffentlichen Repo: Link direkt auf die Datei (kein Gist), aktueller oder fester Stand;
 * Empfänger lesen ohne Konto über raw.githubusercontent.com, nichts wird gespeichert. GitHub ist nachgebildet.
 */

const docKeys = page => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('morphologische-matrix:doc:')));
const activeId = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('morphologische-matrix:workspace')).active);

async function connect(page) {
  await menu(page, 'storage');
  const dlg = page.locator('#syncDialog');
  await dlg.locator('[data-sync="next"]').click();
  await dlg.locator('input[name="repo"]').fill(REPO);
  await dlg.locator('input[name="token"]').fill('github_pat_test');
  await dlg.locator('[data-sync="connect"]').click();
  await dlg.locator('[data-sync="finish"]').click();
  await expect(dlg).toBeHidden();
  await expect(page.locator('#syncStatus')).toHaveAttribute('data-status', 'ok');
}

/** Öffentliche Ablage einrichten, Matrix „Offen 1“ anlegen und „Teilen …“ öffnen. */
async function openPublicShare(page) {
  const gh = await fakeGitHub(page);
  gh.public = true;
  await setTitle(page, 'Offen 1');
  await connect(page);
  await menu(page, 'share');
  const dlg = page.locator('#syncDialog [data-sync="share-public"]');
  await expect(dlg).toContainText('öffentliches Repo');
  return { gh, dlg };
}

/** Empfänger in einem eigenen Browser (ohne Ablage). */
async function recipient(browser, gh) {
  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await fakeGitHub(other, { gh });
  await openFresh(other);
  return { ctx, other };
}

test('öffentliches Repo: Link sofort, ohne Gist und ohne „Teilen beenden“; Empfänger liest ohne Konto', async ({ page, browser }) => {
  const { gh, dlg } = await openPublicShare(page);
  const id = await activeId(page);
  const input = dlg.locator('input[name="share-link"]');
  await expect(input).toHaveValue(new RegExp(`#p=${REPO}/${id}$`));
  await expect(dlg.locator('[data-sync="share-create"], [data-sync="share-stop"]')).toHaveCount(0);
  await expect(dlg).toContainText('„Teilen beenden“ gibt es hier nicht');
  expect(gh.gists.size).toBe(0);
  expect(gh.read(`${APP}/${id}.json`)?.data.title).toBe('Offen 1');
  const link = await input.inputValue();
  await dlg.locator('button', { hasText: 'Fertig' }).click();

  const { ctx, other } = await recipient(browser, gh);
  const before = await docKeys(other);
  await other.goto(link);
  const bar = other.locator('#syncPreview[data-kind="shared"]');
  await expect(bar).toContainText('Geteilte Matrix aus team/methoden');
  await expect(bar.locator('[data-sync="shared-origin"]')).toHaveAttribute('href', `https://github.com/${REPO}`);
  await expect(other.locator('#title')).toHaveValue('Offen 1');
  expect(other.url()).not.toContain('#p=');
  await other.waitForTimeout(400);
  expect(await docKeys(other)).toEqual(before);

  // Besitzer ändert, Empfänger aktualisiert selbst
  await setTitle(page, 'Offen 2');
  await page.click('#syncStatus');
  await page.click('[data-sync="flush"]');
  await expect.poll(() => gh.read(`${APP}/${id}.json`)?.data.title).toBe('Offen 2');
  await bar.locator('[data-sync="shared-refresh"]').click();
  await expect(other.locator('#title')).toHaveValue('Offen 2');
  await ctx.close();
});

test('fester Stand: benannter Stand im Link, Empfänger ohne „Aktualisieren“, aktuellen Stand öffnen', async ({ page, browser }) => {
  const { gh } = await openPublicShare(page);
  await page.keyboard.press('Escape');
  await menu(page, 'versions');
  const ver = page.locator('#syncDialog');
  await ver.locator('[data-sync="save-version"]').click();
  await ver.locator('input[name="name"]').fill('vor Workshop');
  await ver.locator('[data-sync="save-version-confirm"]').click();
  await expect(ver.locator('.mcs-version.is-named [data-sync="version-link"]')).toHaveText('Link kopieren');
  await page.keyboard.press('Escape');
  await setTitle(page, 'Offen 2');
  await page.click('#syncStatus');
  await page.click('[data-sync="flush"]');
  await page.keyboard.press('Escape');

  await menu(page, 'share');
  const dlg = page.locator('#syncDialog [data-sync="share-public"]');
  await dlg.locator('input[value="fixed"]').check();
  await expect(dlg.locator('select[name="share-version"]')).toContainText('vor Workshop');
  await expect(dlg).toContainText('ändert sich nicht');
  const link = await dlg.locator('input[name="share-link"]').inputValue();
  expect(link).toMatch(/@[0-9a-f]{40}$/);
  await dlg.locator('input[value="current"]').check();
  await expect(dlg.locator('input[name="share-link"]')).not.toHaveValue(/@/);

  const { ctx, other } = await recipient(browser, gh);
  await other.goto(link);
  const bar = other.locator('#syncPreview[data-kind="shared"]');
  await expect(bar).toHaveAttribute('data-fixed', 'true');
  await expect(bar).toContainText('fester Stand');
  await expect(other.locator('#title')).toHaveValue('Offen 1');
  await expect(bar.locator('[data-sync="shared-refresh"]')).toHaveCount(0);
  await bar.locator('[data-sync="shared-latest"]').click();
  await expect(other.locator('#title')).toHaveValue('Offen 2');
  await expect(bar).not.toHaveAttribute('data-fixed', 'true');
  await ctx.close();
});

test('privates Repo einer Organisation: Hinweis vorab, Teilen über Gist bleibt', async ({ page }) => {
  const gh = await fakeGitHub(page);
  gh.org = true;
  await setTitle(page, 'Intern');
  await connect(page);
  await menu(page, 'share');
  const dlg = page.locator('#syncDialog');
  await expect(dlg).toContainText('Das Repo gehört der Organisation „team“ und ist privat.');
  await expect(dlg.locator('[data-sync="share-create"]')).toBeVisible();
  await expect(dlg.locator('[data-sync="share-public"]')).toHaveCount(0);
});

test('Link auf eine fehlende Datei bzw. ein privates Repo: Hinweis, keine Ansicht', async ({ page }) => {
  await fakeGitHub(page);
  await page.evaluate(r => { location.hash = `#p=${r}/m-fehlt`; }, REPO);
  await expect(page.locator('#toast')).toContainText('nicht (mehr) gültig');
  await expect(page.locator('#syncPreview')).toHaveCount(0);
});
