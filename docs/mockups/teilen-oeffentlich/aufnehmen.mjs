/*
 * Mockups „Teilen aus einem öffentlichen Repo“ (Konzept: https://github.com/method-commons/sync/blob/main/docs/KONZEPT.md,
 * Abschnitt „Entwurf: Teilen aus einem öffentlichen Repo“). Nimmt die echte App mit eingerichteter Ablage auf
 * (GitHub-API nachgebildet) und blendet den Entwurf mit den Klassen der gemeinsamen Oberfläche (mcs-…) ein.
 * Aufruf: `npx vite build && npx vite preview &` und dann `node docs/mockups/teilen-oeffentlich/aufnehmen.mjs`.
 */
/* global document, localStorage, sessionStorage -- Code in page.evaluate läuft im Browser */
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO, fakeGitHub } from '../../../tests/e2e/github.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const URL = 'http://localhost:4173/';
const TITLE = 'Kaffeemaschine – Konzeptstudie';
const BASE = 'https://method-commons.github.io/morphological-matrix-app/';
const DOC = 'm-7k2q9x';
const LINK = `${BASE}#p=${REPO}/${DOC}`;
const LINK_FIXED = `${LINK}@3f9c2e1`;

const svg = (d, s = 15) => `<svg class="mcs-icon" viewBox="0 0 24 24" style="width:${s}px;height:${s}px"><path d="${d}"/></svg>`;
const ICON = {
  close: svg('M6 6l12 12M18 6L6 18', 18),
  copy: svg('M9 9h10v10H9zM5 15V5h10'),
  eye: svg('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z', 18),
  refresh: svg('M4 12a8 8 0 0 1 13.7-5.6L20 8.7M20 4v4.7h-4.7M20 12a8 8 0 0 1-13.7 5.6L4 15.3M4 20v-4.7h4.7'),
  ext: svg('M14 5h5v5M19 5l-8 8M17 14v5H5V7h5', 14),
  info: svg('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8v.5', 18),
  warn: svg('M12 4l9 16H3zM12 10v4M12 17v.5', 18),
  globe: svg('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z', 16),
  tag: svg('M3 12V4h8l9 9-8 8zM7.5 8.5v.5', 14),
  link: svg('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1', 14),
  save: svg('M12 4v11M7 10l5 5 5-5M5 20h14'),
};

const CSS = `
  #toast { display: none !important; }
  .mk-new { outline: 2px dashed var(--search) !important; outline-offset: 2px; border-radius: 8px; }
  .mk-tag { display: inline-block; margin-left: 10px; padding: 1px 8px; border-radius: 999px; border: 1px dashed var(--search);
    color: var(--warn); background: var(--warn-bg); font-size: .68rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; vertical-align: middle; }
  .mk-legend { position: fixed; z-index: 90; right: 24px; bottom: 24px; max-width: 440px; padding: 12px 14px; border: 1px dashed var(--search); border-radius: 12px;
    background: var(--surface); box-shadow: var(--shadow-lg); font-size: .82rem; color: var(--text-2); }
  dialog .mk-legend { right: auto; left: 24px; }
  .mk-legend h3 { margin: 0 0 6px; font-size: .7rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
  .mk-legend ul { margin: 0; padding-left: 18px; }
  .mk-choice { display: grid; gap: 6px; margin: 4px 0 12px; padding: 0; border: 0; }
  .mk-choice label { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 10px; border: 1px solid var(--border); border-radius: 10px; font-size: .88rem; }
  .mk-choice label.on { border-color: var(--accent); background: var(--accent-soft); }
  .mk-choice select { margin-left: auto; padding: 4px 8px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); color: var(--text); font: inherit; font-size: .84rem; }
  .mk-public { margin-right: 6px; display: inline-flex; gap: 4px; align-items: center; padding: 1px 8px; border-radius: 999px; background: var(--good-bg, var(--accent-soft)); color: var(--good); font-size: .74rem; font-weight: 650; }
  .mk-bar { max-width: 1680px; margin: 12px auto 0; padding: 0 var(--gutter); }
  @media (max-width: 600px) { .mk-legend { display: none; } }
`;

const shot = (page, name) => page.screenshot({ path: path.join(DIR, name) });
const legend = (page, title, items) => page.evaluate(([t, li]) => {
  document.querySelector('.mk-legend')?.remove();
  const el = document.createElement('div');
  el.className = 'mk-legend';
  el.innerHTML = `<h3>${t}</h3><ul>${li.map(x => `<li>${x}</li>`).join('')}</ul>`;
  (document.querySelector('dialog[open]') || document.body).append(el);
}, [title, items]);
/** Inhalt des echten Teilen-Dialogs durch den Entwurf ersetzen. */
const fill = (page, html) => page.evaluate(([h, tag, close]) => {
  const box = document.querySelector('#syncDialog .mcs-share');
  box.querySelector('h2 .mk-tag')?.remove();
  const title = box.querySelector('h2').textContent;
  box.innerHTML = `<div class="mcs-head"><h2>${title}${tag}</h2><button type="button" class="mcs-icon-btn" aria-label="Schließen">${close}</button></div>${h}`;
  /** @type {HTMLElement} */ (document.activeElement)?.blur();
}, [html, '<span class="mk-tag">Entwurf</span>', ICON.close]);

const linkRow = url => `<label class="mcs-field">Link zum Ansehen
  <div class="mcs-inline"><input class="mcs-input" readonly value="${url}"><button type="button" class="mcs-btn mcs-small">${ICON.copy}Kopieren</button></div></label>`;
let VTIME = '';
const choice = fixed => `<fieldset class="mk-choice mk-new">
  <label class="${fixed ? '' : 'on'}"><input type="radio" name="mk" ${fixed ? '' : 'checked'}> Immer den aktuellen Stand</label>
  <label class="${fixed ? 'on' : ''}"><input type="radio" name="mk" ${fixed ? 'checked' : ''}> Festen Stand:
    <select ${fixed ? '' : 'disabled'}><option>vor Workshop · heute ${VTIME}</option><option>Entwurf 1 · 20.10. 16:40</option></select></label></fieldset>`;
const publicHint = `<p class="mcs-hint"><span class="mk-public mk-new">${ICON.globe}öffentliches Repo</span>
  Die Matrix liegt in <b>${REPO}</b> und ist dort ohnehin für alle lesbar. Der Link öffnet sie direkt in der App – nur zum Lesen, ohne Konto.</p>`;

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

// Ablage einrichten
await page.click('#menuBtn');
await page.click('[data-action="storage"]');
const dlg = page.locator('#syncDialog');
await dlg.locator('[data-sync="next"]').click();
await dlg.locator('input[name="repo"]').fill(REPO);
await dlg.locator('input[name="token"]').fill('github_pat_test');
await dlg.locator('[data-sync="connect"]').click();
await dlg.locator('[data-sync="finish"]').click();
await page.locator('#syncStatus[data-status="ok"]').waitFor();
await page.addStyleTag({ content: CSS });

// benannter Stand für die Bilder 2 und 3
await page.click('#menuBtn');
await page.click('[data-action="versions"]');
await dlg.locator('[data-sync="save-version"]').click();
await dlg.locator('input[name="name"]').fill('vor Workshop');
await dlg.locator('[data-sync="save-version-confirm"]').click();
await dlg.locator('.mcs-version.is-named').first().waitFor();
VTIME = (await dlg.locator('.mcs-version.is-named .mcs-version-time').first().textContent()).trim();
await page.keyboard.press('Escape');

async function openShare() {
  await page.click('#menuBtn');
  await page.click('[data-action="share"]');
  await dlg.locator('.mcs-share').waitFor();
}

// 1 – Teilen im öffentlichen Repo: Link sofort, aktueller Stand
await openShare();
await fill(page, `${publicHint}${choice(false)}<div class="mk-new" style="padding:2px 4px">${linkRow(LINK)}</div>
  <dl class="mcs-kv">
    <dt>Gelesen aus</dt><dd class="mcs-wide">der Datei im Repo – kein Gist, kein zusätzliches Recht · <a class="mcs-link" href="#">Datei auf GitHub ${ICON.ext}</a></dd>
    <dt>Stand im Link</dt><dd class="mcs-wide">mit jedem Abgleich (beim Empfänger bis zu 5 Minuten verzögert)</dd>
    <dt>Bearbeiten</dt><dd class="mcs-wide">nur Mitglieder des Repos – andere sehen eine Ansicht zum Lesen und können eine Kopie speichern</dd></dl>
  <div class="mcs-note mk-new">${ICON.info}<div><b>„Teilen beenden“ gibt es hier nicht</b> – in einem öffentlichen Repo ist alles lesbar. Der Link gilt, solange die Matrix existiert; ist das Repo später privat, bietet „Teilen …“ den Weg über ein geheimes Gist.</div></div>
  <div class="mcs-foot"><span class="mcs-spacer"></span><button class="mcs-btn mcs-primary">Fertig</button></div>`);
await legend(page, 'Entwurf: öffentliches Repo', [
  'Die App erkennt „öffentlich“ beim Öffnen des Dialogs (eine Abfrage an GitHub).',
  'Kein „Link erstellen“: Der Link ist sofort da und zeigt auf die Datei im Repo.',
  'Kein Gist, keine Berechtigung „Gists“ – auch für Repos von Organisationen.',
]);
await shot(page, 'o1-teilen.png');

// 2 – fester Stand
await fill(page, `${publicHint}${choice(true)}<div class="mk-new" style="padding:2px 4px">${linkRow(LINK_FIXED)}</div>
  <dl class="mcs-kv">
    <dt>Stand im Link</dt><dd class="mcs-wide">${ICON.tag} „vor Workshop“ · heute ${VTIME} – <b>ändert sich nicht</b>, auch wenn du weiterarbeitest</dd>
    <dt>Gelesen aus</dt><dd class="mcs-wide">dem gespeicherten Stand (Commit) im Repo · <a class="mcs-link" href="#">auf GitHub ${ICON.ext}</a></dd></dl>
  <div class="mcs-foot"><span class="mcs-spacer"></span><button class="mcs-btn mcs-primary">Fertig</button></div>`);
await legend(page, 'Entwurf: festen Stand teilen', [
  'Zur Auswahl stehen die benannten Stände („Stand speichern …“ unter „Versionen …“).',
  'Der Link enthält den Commit (<code>@3f9c2e1</code>) – unveränderlich, auch wenn der Name geändert wird.',
  'Geht nur bei öffentlichen Repos (ein Gist zeigt immer den aktuellen Stand).',
]);
await shot(page, 'o2-fester-stand.png');
await page.keyboard.press('Escape');
await page.evaluate(() => document.querySelector('.mk-legend')?.remove());

// 3 – Versionen: Link je benanntem Stand
await page.click('#menuBtn');
await page.click('[data-action="versions"]');
await dlg.locator('.mcs-version.is-named').first().waitFor();
await page.evaluate(([icon]) => {
  const row = document.querySelector('#syncDialog .mcs-version.is-named');
  row.insertAdjacentHTML('beforeend', `<button type="button" class="mcs-btn mcs-small mk-new" style="margin-left:auto">${icon}Link kopieren</button>`);
  document.querySelector('#syncDialog h2').insertAdjacentHTML('beforeend', '<span class="mk-tag">Entwurf</span>');
}, [ICON.link]);
await legend(page, 'Entwurf: Versionen', ['Bei öffentlichen Repos: „Link kopieren“ an jedem benannten Stand kopiert den Link auf genau diesen Stand.']);
await shot(page, 'o3-versionen.png');
await page.keyboard.press('Escape');
await page.evaluate(() => document.querySelector('.mk-legend')?.remove());

// 6 (vor 4/5, solange noch nicht geteilt) – privates Repo einer Organisation
await openShare();
await page.evaluate(([icon]) => {
  const box = document.querySelector('#syncDialog .mcs-share');
  box.querySelector('.mcs-note').insertAdjacentHTML('afterend', `<div class="mcs-note warn mk-new">${icon}<div><b>Das Repo gehört der Organisation „team“ und ist privat.</b>
    Geteilt wird dann über ein geheimes Gist – Gists gehören aber immer zu einem persönlichen Konto, und ein Token für „team“ bietet die Berechtigung „Gists“ nicht an.
    Möglich: Repo öffentlich machen (dann ohne Gist) oder ein Token mit dem eigenen Konto als Resource owner.</div></div>`);
  box.querySelector('h2').insertAdjacentHTML('beforeend', '<span class="mk-tag">Entwurf</span>');
  /** @type {HTMLElement} */ (document.activeElement)?.blur();
}, [ICON.warn]);
await legend(page, 'Entwurf: privates Repo einer Organisation', [
  'Hinweis vorab statt erst nach dem Fehler von GitHub (Besitzer und Sichtbarkeit sind bekannt).',
  'Ein zweites Token nur für Gists ist nicht Teil dieses Entwurfs.',
]);
await shot(page, 'o6-organisation-privat.png');
await page.keyboard.press('Escape');
await page.evaluate(() => document.querySelector('.mk-legend')?.remove());

// 4/5 – Empfänger: echte Ansicht zum Lesen (über ein Gist geöffnet), Texte des Entwurfs
await openShare();
await dlg.locator('[data-sync="share-create"]').click();
const gistLink = await dlg.locator('input[name="share-link"]').inputValue();
await dlg.locator('button', { hasText: 'Fertig' }).click();
await page.goto(`${URL}#g=${gistLink.split('#g=')[1]}`);
await page.locator('#syncPreview[data-kind="shared"]').waitFor();
await page.addStyleTag({ content: CSS });
const bar = (text, buttons) => page.evaluate(([t, b]) => {
  const p = document.querySelector('#syncPreview');
  p.classList.add('mk-new');
  p.querySelector('.mcs-preview-text').innerHTML = t;
  if (b) p.querySelector('.mcs-row').innerHTML = b;
  /** @type {HTMLElement} */ (document.activeElement)?.blur();
}, [text, buttons]);
await bar(`<b>Geteilte Matrix</b> aus <a class="mcs-link" href="#">${REPO} ${ICON.ext}</a> · von Sven · Stand heute ${VTIME} – nur ansehen.<span class="mk-tag">Entwurf</span>`);
await legend(page, 'Entwurf: Empfänger (aktueller Stand)', [
  'Gleiche Ansicht wie beim Gist: nur lesen, „Aktualisieren“, „Als Kopie speichern“.',
  'Nichts wird gespeichert – auch nicht in einer eingerichteten Ablage.',
  'Zusätzlich: woher die Matrix stammt (Repo, Link auf GitHub).',
]);
await shot(page, 'o4-empfaenger.png');

await bar(`<b>Fester Stand „vor Workshop“</b> aus <a class="mcs-link" href="#">${REPO} ${ICON.ext}</a> · von Sven · heute ${VTIME} – nur ansehen.<span class="mk-tag">Entwurf</span>`,
  `<button type="button" class="mcs-btn mcs-small">${ICON.refresh}Aktuellen Stand öffnen</button>
   <button type="button" class="mcs-btn mcs-small mcs-primary">${ICON.save}Als Kopie speichern</button>
   <button type="button" class="mcs-btn mcs-small">Schließen</button>`);
await legend(page, 'Entwurf: Empfänger (fester Stand)', [
  'Kein „Aktualisieren“ – der Stand ist fest.',
  '„Aktuellen Stand öffnen“ zeigt den laufenden Stand.',
]);
await shot(page, 'o5-empfaenger-fest.png');

// 7 – Teilen-Dialog auf dem Telefon
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(URL);
await page.locator('#syncStatus').waitFor();
await page.addStyleTag({ content: CSS });
await openShare();
await fill(page, `${publicHint}${choice(false)}${linkRow(LINK)}
  <div class="mcs-note">${ICON.info}<div><b>„Teilen beenden“ gibt es hier nicht</b> – in einem öffentlichen Repo ist alles lesbar.</div></div>
  <div class="mcs-foot"><span class="mcs-spacer"></span><button class="mcs-btn mcs-primary">Fertig</button></div>`);
await page.waitForTimeout(200);
await shot(page, 'o7-telefon.png');

await browser.close();
