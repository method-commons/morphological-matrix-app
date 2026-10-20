import fs from 'node:fs';
import { test, expect, menu, setTitle } from './fixtures.js';

/*
 * Ablage (method-commons/sync) mit einer Nachbildung der GitHub-API: Dateien mit sha, Ändern nur
 * auf dem aktuellen Stand – wie das echte Repo. Ein „anderes Gerät“ schreibt direkt in `gh.files`.
 */

const APP = 'morphological-matrix-app';
const REPO = 'team/methoden';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, x-github-api-version, accept',
  'access-control-allow-methods': 'GET, PUT, DELETE',
};

async function fakeGitHub(page, { files = {} } = {}) {
  const gh = { files: new Map(), messages: [], n: 0, requests: 0 };
  /** Datei schreiben wie ein anderes Gerät (neuer sha). */
  gh.write = (path, record) => gh.files.set(path, { sha: `sha${++gh.n}`, text: JSON.stringify(record, null, 2) });
  gh.read = path => (gh.files.has(path) ? JSON.parse(gh.files.get(path).text) : null);
  for (const [path, record] of Object.entries(files)) gh.write(path, record);

  await page.route('https://api.github.com/**', async route => {
    gh.requests++;
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    const json = (status, body) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (req.headers().authorization !== 'Bearer github_pat_test') return json(401, { message: 'Bad credentials' });
    if (url.pathname === `/repos/${REPO}`) return json(200, { full_name: REPO, private: true });
    const m = url.pathname.match(new RegExp(`^/repos/${REPO}/contents/(.+)$`));
    if (!m) return json(404, { message: 'Not Found' });
    const path = decodeURIComponent(m[1]);
    const cur = gh.files.get(path);
    if (method === 'GET') {
      if (cur) return json(200, { type: 'file', sha: cur.sha, content: Buffer.from(cur.text).toString('base64') });
      const dir = [...gh.files].filter(([p]) => p.startsWith(`${path}/`)).map(([p, f]) => ({ type: 'file', name: p.slice(path.length + 1), sha: f.sha }));
      return dir.length ? json(200, dir) : json(404, { message: 'Not Found' });
    }
    const body = JSON.parse(req.postData() || '{}');
    if (method === 'PUT') {
      if (cur && body.sha !== cur.sha) return json(cur && !body.sha ? 422 : 409, { message: 'sha does not match' });
      const sha = `sha${++gh.n}`;
      gh.files.set(path, { sha, text: Buffer.from(body.content, 'base64').toString('utf8') });
      gh.messages.push(body.message);
      return json(cur ? 200 : 201, { content: { sha } });
    }
    if (method === 'DELETE') {
      if (!cur) return json(404, { message: 'Not Found' });
      if (body.sha !== cur.sha) return json(409, { message: 'sha does not match' });
      gh.files.delete(path);
      gh.messages.push(body.message);
      return json(200, {});
    }
    return json(405, {});
  });
  return gh;
}

/** IDs der gespeicherten Matrizen im Browser. */
const docIds = page => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('morphologische-matrix:doc:')).map(k => k.slice('morphologische-matrix:doc:'.length)));
/** Datei der Matrix in der Ablage. */
const fileOf = id => `${APP}/${id}.json`;
/** Aktive Matrix: ID aus dem Speicher anhand des Titels. */
async function idOf(page, title) {
  return page.evaluate(t => Object.keys(localStorage).find(k => k.startsWith('morphologische-matrix:doc:') && JSON.parse(localStorage.getItem(k)).data.title === t)?.slice('morphologische-matrix:doc:'.length), title);
}

/** Ablage über den Assistenten einrichten; `keep` = Titel, die nicht hochgeladen werden. */
async function connect(page) {
  await menu(page, 'storage');
  const dlg = page.locator('#syncDialog');
  await dlg.locator('[data-sync="next"]').click();
  await dlg.locator('input[name="repo"]').fill(REPO);
  await dlg.locator('input[name="token"]').fill('github_pat_test');
  await dlg.locator('[data-sync="connect"]').click();
  await expect(dlg.locator('[data-step="3"]')).toBeVisible();
  return dlg;
}

/** Den Abgleich anstoßen, als käme das Gerät wieder online. */
const nudge = page => page.evaluate(() => window.dispatchEvent(new Event('online')));

test('ohne Ablage: nur der Menüeintrag, keine Anzeige und keine Anfragen an GitHub', async ({ page }) => {
  const gh = await fakeGitHub(page);
  await page.click('#menuBtn');
  await expect(page.locator('[data-action="storage"]')).toHaveText(/Ablage …\s*nicht eingerichtet/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#syncStatus')).toHaveCount(0);
  await setTitle(page, 'Etwas geändert');
  await page.waitForTimeout(500);
  expect(gh.requests).toBe(0);
});

test('Einrichten: prüfen, Auswahl hochladen, Statusanzeige', async ({ page }) => {
  const gh = await fakeGitHub(page);
  await setTitle(page, 'Meine Kaffeemaschine');
  const dlg = await connect(page);
  await expect(dlg).toContainText(`Repo ${REPO} erreichbar`);
  await expect(dlg).toContainText('Schreibrecht vorhanden');
  await expect(dlg).toContainText(`Ordner ${APP}/ wird beim ersten Speichern angelegt`);
  const row = dlg.locator('.mcs-upload .mcs-doc', { hasText: 'Meine Kaffeemaschine' });
  await expect(row.locator('input[type="checkbox"]')).toBeChecked();
  await dlg.locator('[data-sync="finish"]').click();
  await expect(dlg).toBeHidden();

  const id = await idOf(page, 'Meine Kaffeemaschine');
  await expect.poll(() => gh.read(fileOf(id))?.data.title).toBe('Meine Kaffeemaschine');
  expect(gh.read(fileOf(id))).toMatchObject({ app: APP, schemaVersion: expect.any(Number), device: expect.any(String) });
  expect(gh.read('method-commons.json')).toEqual({ kind: 'method-commons-storage', version: 1 });
  await expect(page.locator('#syncStatus')).toHaveAttribute('data-status', 'ok');
  await expect(page.locator('#syncStatus')).toHaveText('In der Ablage');
  const stored = await page.evaluate(() => [localStorage.getItem('method-commons:sync:token'), JSON.parse(localStorage.getItem('method-commons:sync:config')).repo]);
  expect(stored).toEqual(['github_pat_test', REPO]);
});

test('Einrichten: falsches Token und unbekanntes Repo werden erklärt, unveränderte Beispiele nicht vorausgewählt', async ({ page }) => {
  await fakeGitHub(page);
  await menu(page, 'storage');
  const dlg = page.locator('#syncDialog');
  await dlg.locator('[data-sync="next"]').click();
  await dlg.locator('input[name="repo"]').fill(REPO);
  await dlg.locator('input[name="token"]').fill('falsch');
  await dlg.locator('[data-sync="connect"]').click();
  await expect(dlg.locator('[role="alert"]')).toContainText('Token wurde abgelehnt');
  await dlg.locator('input[name="repo"]').fill('team/gibt-es-nicht');
  await dlg.locator('input[name="token"]').fill('github_pat_test');
  await dlg.locator('[data-sync="connect"]').click();
  await expect(dlg.locator('[role="alert"]')).toContainText('Repo nicht gefunden');
  await dlg.locator('input[name="repo"]').fill(REPO);
  await dlg.locator('[data-sync="connect"]').click();
  await expect(dlg.locator('.mcs-upload input[type="checkbox"]')).not.toBeChecked();
  await expect(dlg.locator('[data-sync="finish"]')).toHaveText('Fertig');
});

test('Änderungen übertragen und Änderungen eines anderen Geräts übernehmen', async ({ page }) => {
  const gh = await fakeGitHub(page);
  await setTitle(page, 'Stand 1');
  await (await connect(page)).locator('[data-sync="finish"]').click();
  const id = await idOf(page, 'Stand 1');
  await expect.poll(() => gh.read(fileOf(id))?.data.title).toBe('Stand 1');

  // Zweite Übertragung erst nach dem Intervall – oder sofort über „Jetzt übertragen“
  await setTitle(page, 'Stand 2');
  await expect(page.locator('#syncStatus')).toHaveAttribute('data-status', /pending|busy/);
  await page.click('#syncStatus');
  await page.click('[data-sync="flush"]');
  await expect.poll(() => gh.read(fileOf(id))?.data.title).toBe('Stand 2');
  await expect(page.locator('#syncStatus')).toHaveAttribute('data-status', 'ok');

  // anderes Gerät ändert die Datei
  const rec = gh.read(fileOf(id));
  gh.write(fileOf(id), { ...rec, savedAt: rec.savedAt + 1000, device: 'Laptop', data: { ...rec.data, title: 'Vom Laptop' } });
  await nudge(page);
  await expect(page.locator('#title')).toHaveValue('Vom Laptop');
});

test('Konflikt: Statusanzeige öffnet die Auswahl, „Beide behalten“ legt eine Kopie an', async ({ page }) => {
  const gh = await fakeGitHub(page);
  await setTitle(page, 'Gemeinsam');
  await (await connect(page)).locator('[data-sync="finish"]').click();
  const id = await idOf(page, 'Gemeinsam');
  await expect.poll(() => gh.read(fileOf(id))?.data.title).toBe('Gemeinsam');

  // erst hier ändern und speichern, dann auf dem anderen Gerät – jeder Abgleich danach sieht beides
  await setTitle(page, 'Browser-Stand');
  await expect.poll(() => idOf(page, 'Browser-Stand')).toBe(id);
  const rec = gh.read(fileOf(id));
  gh.write(fileOf(id), { ...rec, savedAt: rec.savedAt + 1000, device: 'Laptop', data: { ...rec.data, title: 'Laptop-Stand' } });
  await nudge(page);
  const chip = page.locator('#syncStatus');
  await expect(chip).toHaveAttribute('data-status', 'conflict');
  await expect(chip).toHaveText('Konflikt');
  expect(gh.read(fileOf(id)).data.title).toBe('Laptop-Stand');

  await chip.click();
  const dlg = page.locator('#syncDialog');
  await expect(dlg).toContainText('„Browser-Stand“ wurde auch auf einem anderen Gerät geändert');
  await expect(dlg.locator('.mcs-side').nth(1)).toContainText('Laptop');
  await dlg.locator('[data-sync="both"]').click();
  await expect(dlg).toBeHidden();
  await expect(page.locator('#title')).toHaveValue('Laptop-Stand (Laptop)');
  await expect.poll(() => gh.read(fileOf(id))?.data.title).toBe('Browser-Stand');
  await expect.poll(() => [...gh.files.values()].filter(f => f.text.includes('Laptop-Stand (Laptop)')).length).toBe(1);
  await expect(chip).toHaveAttribute('data-status', 'ok');
});

test('Meine Matrizen: Zustand je Matrix, „Nur in der Ablage“ öffnen, Löschen, Trennen', async ({ page }) => {
  const example = JSON.parse(fs.readFileSync(new URL('../../examples/firmen-event.json', import.meta.url), 'utf8'));
  const gh = await fakeGitHub(page, {
    files: { [fileOf('vom-laptop')]: { app: APP, schemaVersion: example.data.version, savedAt: Date.parse('2026-10-14T16:05:00Z'), device: 'Laptop', data: example.data } },
  });
  await setTitle(page, 'Hier');
  await (await connect(page)).locator('[data-sync="finish"]').click();
  await expect(page.locator('#syncStatus')).toHaveAttribute('data-status', 'ok');

  await menu(page, 'open');
  const lib = page.locator('#libraryDialog');
  await expect(lib.locator('.doc', { hasText: 'Hier' }).locator('[data-doc-state]')).toHaveAttribute('data-doc-state', 'ok');
  const remote = lib.locator('.mcs-remote .mcs-doc');
  await expect(remote).toContainText(example.data.title);
  await expect(remote).toContainText('Laptop');
  await remote.locator('[data-sync="download"]').click();
  await expect(page.locator('#title')).toHaveValue(example.data.title);
  expect(await docIds(page)).toContain('vom-laptop');

  // Gelöschte Matrix verschwindet auch aus der Ablage
  await page.locator('#appTabs [role="tab"]', { hasText: 'Hier' }).click();
  await page.locator('#appTabs [role="tab"]', { hasText: example.data.title }).locator('.tab-close, [aria-label*="schließen"]').first().click();
  await menu(page, 'open');
  page.once('dialog', d => d.accept());
  await lib.locator('.doc', { hasText: example.data.title }).locator('.icon-btn.danger').click();
  await nudge(page);
  await expect.poll(() => gh.files.has(fileOf('vom-laptop'))).toBe(false);
  await page.keyboard.press('Escape');

  // Trennen: Token und Einstellungen weg, Matrizen bleiben
  await menu(page, 'storage');
  page.once('dialog', d => d.accept());
  await page.locator('#syncDialog [data-sync="disconnect"]').click();
  await expect(page.locator('#syncStatus')).toHaveCount(0);
  expect(await page.evaluate(() => [localStorage.getItem('method-commons:sync:token'), localStorage.getItem('method-commons:sync:config')])).toEqual([null, null]);
  expect(await idOf(page, 'Hier')).toBeTruthy();
  await page.click('#menuBtn');
  await expect(page.locator('[data-action="storage"]')).toContainText('nicht eingerichtet');
});
