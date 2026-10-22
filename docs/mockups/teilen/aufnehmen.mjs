/*
 * Mockups „Teilen zum Ansehen“ aus einer GitHub-Ablage (Konzept: https://github.com/method-commons/sync/blob/main/docs/KONZEPT.md,
 * Abschnitt „Entwurf: Links zum Teilen aus einer GitHub-Ablage“). Nimmt die echte App auf (GitHub-API nachgebildet)
 * und blendet den Entwurf mit den Klassen der gemeinsamen Oberfläche (mcs-…) ein.
 * Aufruf: `npx vite build && npx vite preview &` und dann `node docs/mockups/teilen/aufnehmen.mjs`.
 */
/* global document, localStorage, sessionStorage -- Code in page.evaluate läuft im Browser */
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO, fakeGitHub } from '../../../tests/e2e/github.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const URL = 'http://localhost:4173/';
const TITLE = 'Kaffeemaschine – Konzeptstudie';
const LINK = 'https://method-commons.github.io/morphological-matrix-app/#g=8f3c1a92e4b07d55a1c6';
const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new?name=Methoden-Ablage&contents=write&gists=write&expires_in=90';

const svg = (d, s = 15) => `<svg class="mcs-icon" viewBox="0 0 24 24" style="width:${s}px;height:${s}px"><path d="${d}"/></svg>`;
const ICON = {
  share: svg('M8.6 13.5l6.8 4M15.4 6.5l-6.8 4M18 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM6 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM18 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'.replace('M6 12a3 3 0 1 1-6 0', 'M9 12a3 3 0 1 1-6 0')),
  close: svg('M6 6l12 12M18 6L6 18', 18),
  copy: svg('M9 9h10v10H9zM5 15V5h10'),
  eye: svg('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z', 18),
  refresh: svg('M4 12a8 8 0 0 1 13.7-5.6L20 8.7M20 4v4.7h-4.7M20 12a8 8 0 0 1-13.7 5.6L4 15.3M4 20v-4.7h4.7'),
  ext: svg('M14 5h5v5M19 5l-8 8M17 14v5H5V7h5', 14),
  warn: svg('M12 4l9 16H3zM12 10v4M12 17v.5', 18),
  check: svg('M5 12.5l4.5 4.5L19 7.5', 16),
  save: svg('M12 4v11M7 10l5 5 5-5M5 20h14'),
  stop: svg('M6 6l12 12M18 6L6 18'),
};

const CSS = `
  #toast { display: none !important; }
  .mk-new { outline: 2px dashed var(--search) !important; outline-offset: 2px; }
  .mk-tag { display: inline-block; margin-left: 10px; padding: 1px 8px; border-radius: 999px; border: 1px dashed var(--search);
    color: var(--warn); background: var(--warn-bg); font-size: .68rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; vertical-align: middle; }
  .mk-legend { position: fixed; z-index: 90; right: 24px; bottom: 24px; max-width: 440px; padding: 12px 14px; border: 1px dashed var(--search); border-radius: 12px;
    background: var(--surface); box-shadow: var(--shadow-lg); font-size: .82rem; color: var(--text-2); }
  dialog .mk-legend { right: auto; left: 24px; }
  .mk-legend h3 { margin: 0 0 6px; font-size: .7rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
  .mk-legend ul { margin: 0; padding-left: 18px; }
  .mk-linkrow { display: flex; gap: 6px; margin: 6px 0 10px; }
  .mk-linkrow input { flex: 1; min-width: 0; padding: 7px 10px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface-2); color: var(--text); font: inherit; font-size: .85rem; }
  .mk-kv { display: grid; grid-template-columns: 140px 1fr; gap: 6px 12px; margin: 8px 0 4px; font-size: .86rem; }
  .mk-kv dt { color: var(--muted); } .mk-kv dd { margin: 0; }
  .mk-ok { color: var(--good); font-weight: 600; display: inline-flex; gap: 4px; align-items: center; }
  .mk-bar { max-width: 1680px; margin: 12px auto 0; padding: 0 var(--gutter); }
  .mk-shared { display: inline-block; margin-left: 8px; padding: 1px 8px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: .72rem; font-weight: 650; }
`;

async function dialog(page, html, cls = '') {
  await page.evaluate(([h, c]) => {
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    const d = document.createElement('dialog');
    d.className = `mcs-dialog ${c}`;
    d.innerHTML = h;
    document.body.append(d);
    d.showModal();
    /** @type {HTMLElement} */ (document.activeElement)?.blur();
  }, [html, cls]);
  await page.waitForTimeout(200);
}
const head = title => `<div class="mcs-head"><h2>${title}<span class="mk-tag">Entwurf</span></h2>
  <button type="button" class="mcs-icon-btn" aria-label="Schließen">${ICON.close}</button></div>`;
const shot = (page, name) => page.screenshot({ path: path.join(DIR, name) });
const legend = (page, title, items) => page.evaluate(([t, li]) => {
  document.querySelector('.mk-legend')?.remove();
  const el = document.createElement('div');
  el.className = 'mk-legend';
  el.innerHTML = `<h3>${t}</h3><ul>${li.map(x => `<li>${x}</li>`).join('')}</ul>`;
  (document.querySelector('dialog[open]') || document.body).append(el);
}, [title, items]);
const clear = page => page.evaluate(() => { document.querySelectorAll('dialog[open]').forEach(d => d.close()); document.querySelectorAll('.mk-legend, .mk-bar').forEach(e => e.remove()); });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'de-DE', timezoneId: 'Europe/Berlin', colorScheme: 'light' });
await page.clock.setFixedTime(new Date('2026-10-22T10:44:00+02:00'));
await fakeGitHub(page);
await page.goto(URL);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload();
await page.waitForTimeout(500);
await page.locator('#title').dblclick();
await page.locator('#title').fill(TITLE);
await page.locator('#title').press('Enter');

// 1 – Einrichten: Token per vorbelegtem Link
await page.click('#menuBtn');
await page.click('[data-action="storage"]');
const dlg = page.locator('#syncDialog');
await dlg.locator('[data-sync="next"]').click();
await page.addStyleTag({ content: CSS });
await dlg.locator('input[name="repo"]').fill(REPO);
await page.evaluate(([icon, url, tag]) => {
  const li = document.querySelectorAll('#syncDialog .mcs-num > li')[1];
  li.querySelector('ul').outerHTML = `<p class="mcs-hint" style="margin:4px 0 8px">Der Link öffnet GitHub mit allen Einstellungen vorbelegt. Dort nur noch <b>das Repo auswählen</b> und „Generate token“.</p>`;
  const a = li.querySelector('a.mcs-link');
  a.outerHTML = `<div class="mk-new" style="display:inline-flex;flex-direction:column;gap:6px;padding:8px 10px;border-radius:10px">
    <a class="mcs-btn mcs-primary" href="${url}" style="align-self:flex-start">${icon}Token auf GitHub anlegen (vorbelegt)</a>
    <small style="color:var(--muted)">Repository: Contents (Lesen und Schreiben) · Account: Gists (zum Teilen) · 90 Tage</small>
    <small style="color:var(--muted)">Wichtig: Als <b>Resource owner</b> das eigene Konto wählen – sonst fehlt „Gists“ (Teilen ist dann nicht möglich).</small></div>`;
  document.querySelector('#syncDialog h2').insertAdjacentHTML('beforeend', tag);
}, [ICON.ext, TOKEN_URL, '<span class="mk-tag">Entwurf</span>']);
await legend(page, 'Entwurf: Token anlegen', [
  'Statt drei Hinweisen ein vorbelegter Link (GitHub erlaubt Vorbelegung per Adresse).',
  'Gists nur, wenn das Teilen genutzt werden soll – ohne bleibt alles wie bisher.',
  'Liegt das Repo in einer Organisation: zweites, persönliches Token nur für Gists.',
]);
await shot(page, 't1-token.png');

// Ablage fertig einrichten
await page.evaluate(() => document.querySelector('.mk-legend')?.remove());
await dlg.locator('input[name="token"]').fill('github_pat_test');
await dlg.locator('[data-sync="connect"]').click();
await dlg.locator('[data-sync="finish"]').click();
await page.locator('#syncStatus[data-status="ok"]').waitFor();

// 2 – Menü „Datei“ mit „Teilen …“
await page.click('#menuBtn');
await page.evaluate(([tag]) => {
  const v = document.querySelector('[data-action="versions"]');
  v.insertAdjacentHTML('afterend', `<button type="button" role="menuitem" class="menu-split mk-new"><span>Teilen …</span><span class="menu-hint">Link zum Ansehen</span></button>`);
  void tag;
}, ['']);
await legend(page, 'Entwurf: Menü „Datei“', [
  '„Teilen …“ unter „Versionen …“ – nur mit GitHub-Ablage.',
  'Ohne Ablage erklärt der Dialog die Ablage (wie bei „Versionen …“).',
  'Das bisherige „Link zum Teilen kopieren“ entfällt (Angleichung an die übrigen Apps).',
]);
await shot(page, 't2-menue.png');
await page.keyboard.press('Escape');
await clear(page);

// 3 – Teilen: Link erstellen
const intro = `<p class="mcs-hint">Erzeugt einen Link, mit dem andere diese Matrix <b>nur ansehen</b> können – ohne Konto und ohne Ablage.
  Der Link zeigt immer den zuletzt übertragenen Stand; wer ihn geöffnet hat, holt neue Stände mit „Aktualisieren“.</p>`;
await dialog(page, `${head(`Teilen – ${TITLE}`)}${intro}
  <div class="mcs-note warn">${ICON.warn}<div><b>Wer den Link hat, kann die Matrix sehen</b> – auch wenn er weitergeleitet wird. Teilen lässt sich jederzeit beenden.</div></div>
  <dl class="mk-kv"><dt>Gespeichert als</dt><dd>geheimes Gist in deinem GitHub-Konto (nicht in der Suche)</dd>
    <dt>Bearbeiten</dt><dd>nur du – andere sehen eine Ansicht zum Lesen und können eine Kopie speichern</dd></dl>
  <div class="mcs-foot"><span class="mcs-spacer"></span><button class="mcs-btn">Abbrechen</button><button class="mcs-btn mcs-primary">${ICON.share}Link erstellen</button></div>`);
await legend(page, 'Entwurf: Teilen', ['Einmal „Link erstellen“ – danach aktualisiert jeder Abgleich das Gist mit.', 'Bearbeiten durch andere: später mit Supabase.']);
await shot(page, 't3-teilen.png');

// 4 – Teilen: Link aktiv
await clear(page);
await dialog(page, `${head(`Teilen – ${TITLE}`)}
  <p class="mcs-hint">Die Matrix ist geteilt. Andere sehen sie nur zum Lesen.</p>
  <label class="mcs-field">Link zum Ansehen
    <div class="mk-linkrow"><input value="${LINK}" readonly><button class="mcs-btn">${ICON.copy}Kopieren</button></div></label>
  <dl class="mk-kv"><dt>Geteilt seit</dt><dd>heute 10:30</dd>
    <dt>Stand im Link</dt><dd><span class="mk-ok">${ICON.check}aktuell</span> · heute 10:42 (mit jedem Abgleich)</dd>
    <dt>Auf GitHub</dt><dd><a class="mcs-link" href="#">Gist ansehen ${ICON.ext}</a></dd></dl>
  <div class="mcs-foot"><button class="mcs-btn mcs-danger">${ICON.stop}Teilen beenden …</button><span class="mcs-spacer"></span><button class="mcs-btn mcs-primary">Fertig</button></div>`);
await legend(page, 'Entwurf: geteilt', ['„Teilen beenden“ löscht das Gist – der Link funktioniert dann nicht mehr.', 'In „Meine Matrizen“ trägt die Matrix das Kennzeichen „geteilt“.']);
await shot(page, 't4-geteilt.png');

// 5 – Token ohne Gists
await clear(page);
await dialog(page, `${head(`Teilen – ${TITLE}`)}${intro}
  <div class="mcs-note warn">${ICON.warn}<div><b>Dem Token fehlt die Berechtigung „Gists“.</b> Zum Teilen ein neues Token mit
    „Gists: Read and write“ anlegen (Resource owner: dein Konto) und unter „Ablage …“ eintragen. Die Ablage selbst funktioniert weiter.</div></div>
  <div class="mcs-foot"><span class="mcs-spacer"></span><button class="mcs-btn">Abbrechen</button>
    <a class="mcs-btn mcs-primary" href="${TOKEN_URL}">Token auf GitHub anlegen (vorbelegt) ${ICON.ext}</a></div>`);
await legend(page, 'Entwurf: Berechtigung fehlt', ['Erkannt an der Antwort von GitHub (403) beim ersten Teilen.', 'Danach „Ablage … → Token erneuern“.']);
await shot(page, 't5-berechtigung.png');

// 6 – Empfänger: Ansicht zum Lesen
await clear(page);
await page.evaluate(([icons]) => {
  const bar = document.createElement('div');
  bar.className = 'mk-bar';
  bar.innerHTML = `<div class="mcs-preview mk-new">${icons.eye}<div class="mcs-preview-text"><b>Geteilte Matrix</b> von Sven · Stand heute 10:42 – nur ansehen.<span class="mk-tag">Entwurf</span></div>
    <div class="mcs-row"><button class="mcs-btn mcs-small">${icons.refresh}Aktualisieren</button><button class="mcs-btn mcs-small mcs-primary">${icons.save}Als Kopie speichern</button></div></div>`;
  document.querySelector('main').before(bar);
  document.querySelector('#syncSlot').style.visibility = 'hidden';
}, [ICON]);
await legend(page, 'Entwurf: Empfänger', [
  'Öffnet den Link ohne Konto und ohne Ablage; die App lädt das Gist und zeigt alle Ansichten nur zum Lesen.',
  '„Aktualisieren“ holt den zuletzt übertragenen Stand (kein Abfragen im Hintergrund).',
  '„Als Kopie speichern“ legt eine eigene Matrix im Browser an.',
]);
await shot(page, 't6-empfaenger.png');

// 7 – Meine Matrizen: Kennzeichen „geteilt“
await clear(page);
await page.evaluate(() => { document.querySelector('#syncSlot').style.visibility = ''; });
await page.click('#menuBtn');
await page.click('[data-action="open"]');
await page.locator('#libraryDialog').waitFor();
await page.waitForTimeout(300);
await page.evaluate(t => {
  for (const el of document.querySelectorAll('#libraryDialog .doc-title, #libraryDialog .doc-name, #libraryDialog li strong, #libraryDialog li b')) {
    if (el.textContent.includes(t) && !el.querySelector('.mk-shared')) { el.insertAdjacentHTML('beforeend', '<span class="mk-shared mk-new">geteilt</span>'); break; }
  }
}, TITLE);
await legend(page, 'Entwurf: Meine Matrizen', ['Geteilte Matrizen sind gekennzeichnet; Klick öffnet „Teilen …“.']);
await shot(page, 't7-liste.png');

// 8 – Empfänger auf dem Telefon
await clear(page);
await page.keyboard.press('Escape');
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(([icons]) => {
  const bar = document.createElement('div');
  bar.className = 'mk-bar';
  bar.innerHTML = `<div class="mcs-preview mk-new">${icons.eye}<div class="mcs-preview-text"><b>Geteilte Matrix</b> von Sven · Stand heute 10:42 – nur ansehen.</div>
    <div class="mcs-row"><button class="mcs-btn mcs-small">${icons.refresh}Aktualisieren</button><button class="mcs-btn mcs-small mcs-primary">${icons.save}Als Kopie speichern</button></div></div>`;
  document.querySelector('main').before(bar);
  document.querySelector('#syncSlot').style.visibility = 'hidden';
}, [ICON]);
await page.waitForTimeout(200);
await shot(page, 't8-telefon.png');

await browser.close();
