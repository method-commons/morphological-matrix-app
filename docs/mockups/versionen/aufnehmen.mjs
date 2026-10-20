/*
 * Mockups „Versionen“ (Stufe 2, Konzept: https://github.com/method-commons/sync/blob/main/docs/KONZEPT.md).
 * Nimmt die echte App mit eingerichteter Ablage auf (GitHub-API nachgebildet) und blendet den Entwurf
 * mit den Klassen der gemeinsamen Oberfläche (mcs-…) ein.
 * Aufruf: `npx vite build && npx vite preview &` und dann `node docs/mockups/versionen/aufnehmen.mjs`.
 */
/* global document, localStorage, sessionStorage, Buffer, console -- Code in page.evaluate läuft im Browser */
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const URL = 'http://localhost:4173/';
const REPO = 'team-foodtruck/methoden';
const TITLE = 'Kaffeemaschine – Konzeptstudie';

const ICON = {
  check: '<svg class="mcs-icon" viewBox="0 0 24 24" style="width:16px;height:16px"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  tag: '<svg class="mcs-icon" viewBox="0 0 24 24" style="width:15px;height:15px"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/></svg>',
  ext: '<svg class="mcs-icon" viewBox="0 0 24 24" style="width:14px;height:14px"><path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5"/></svg>',
  close: '<svg class="mcs-icon" viewBox="0 0 24 24" style="width:18px;height:18px"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  eye: '<svg class="mcs-icon" viewBox="0 0 24 24" style="width:15px;height:15px"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  undo: '<svg class="mcs-icon" viewBox="0 0 24 24" style="width:15px;height:15px"><path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  copy: '<svg class="mcs-icon" viewBox="0 0 24 24" style="width:15px;height:15px"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  chevron: '<svg class="mcs-icon" viewBox="0 0 24 24" style="width:15px;height:15px"><path d="M9 6l6 6-6 6"/></svg>',
  cloud: '<svg class="mcs-icon" viewBox="0 0 24 24" style="width:18px;height:18px"><path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9.2 4.5 4.5 0 0 0 7 18z"/></svg>',
};

// Ergänzungen nur für den Entwurf – auf den Tokens der Apps, passend zu den mcs-Klassen
const CSS = `
  .mk-new { background: var(--warn-bg) !important; box-shadow: inset 3px 0 0 var(--search); }
  .mk-tag { display: inline-block; margin-left: 10px; padding: 1px 8px; border-radius: 999px; border: 1px dashed var(--search);
    color: var(--warn); background: var(--warn-bg); font-size: .68rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; vertical-align: middle; }
  .mk-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 4px 0 12px; }
  .mk-seg { display: inline-flex; padding: 3px; gap: 2px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; }
  .mk-seg span { padding: 3px 10px; border-radius: 7px; font-size: .82rem; font-weight: 600; color: var(--muted); }
  .mk-seg .on { background: var(--surface); color: var(--text); box-shadow: var(--shadow-xs); }
  .mk-day { margin: 12px 0 6px; font-size: .72rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); display: flex; align-items: center; gap: 6px; }
  .mk-ver { display: grid; grid-template-columns: 56px 1fr auto; align-items: center; gap: 4px 12px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 10px; margin-bottom: 6px; }
  .mk-ver.is-current { border-color: var(--accent); background: var(--accent-soft); }
  .mk-ver.is-named { border-left: 3px solid var(--accent); }
  .mk-time { font-weight: 650; font-variant-numeric: tabular-nums; }
  .mk-name { display: inline-flex; align-items: center; gap: 4px; margin-right: 8px; color: var(--accent); font-weight: 650; }
  .mk-sub { font-size: .8rem; color: var(--muted); }
  .mk-acts { display: flex; gap: 6px; }
  .mk-more { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border: 1px dashed var(--border-strong); border-radius: 10px; color: var(--muted); font-size: .85rem; margin-bottom: 6px; }
  .mk-field { display: flex; flex-direction: column; gap: 4px; margin: 10px 0; font-size: .8rem; font-weight: 600; color: var(--text-2); }
  .mk-field input, .mk-field textarea { padding: 7px 10px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); color: var(--text); font: inherit; font-size: .9rem; font-weight: 400; }
  .mk-field small { font-weight: 400; color: var(--muted); }
  .mk-banner { position: fixed; z-index: 80; left: 50%; transform: translateX(-50%); top: 64px; width: min(1100px, calc(100vw - 40px));
    display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 12px; border: 1px dashed var(--search);
    background: var(--warn-bg); color: var(--text); box-shadow: var(--shadow-lg); font-size: .88rem; }
  .mk-banner b { font-weight: 700; }
  .mk-readonly .matrix-section, .mk-readonly .panel { filter: saturate(.55); opacity: .82; }
  .mk-legend { position: fixed; z-index: 90; left: 24px; bottom: 24px; max-width: 430px; padding: 12px 14px; border: 1px dashed var(--search); border-radius: 12px;
    background: var(--surface); box-shadow: var(--shadow-lg); font-size: .82rem; color: var(--text-2); }
  .mk-legend h3 { margin: 0 0 6px; font-size: .7rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
  .mk-legend ul { margin: 0; padding-left: 18px; }
  .mk-cmp { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 6px 0 12px; }
  .mk-cmp > div { padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; }
  .mk-cmp h3 { margin: 0 0 2px; font-size: .9rem; }
  #toast { display: none !important; }
`;

/** Entwurfs-Dialog im Stil der gemeinsamen Oberfläche. */
async function dialog(page, html) {
  await page.evaluate(h => {
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    const d = document.createElement('dialog');
    d.className = 'mcs-dialog';
    d.innerHTML = h;
    document.body.append(d);
    d.showModal();
    /** @type {HTMLElement} */ (document.activeElement)?.blur();
  }, html);
  await page.waitForTimeout(200);
}
const head = title => `<div class="mcs-head"><h2>${title}<span class="mk-tag">Entwurf</span></h2>
  <button type="button" class="mcs-icon-btn" aria-label="Schließen">${ICON.close}</button></div>`;
const shot = (page, name) => page.screenshot({ path: path.join(DIR, name) });

/** Nachbildung der GitHub-API (nur, was die Ablage beim Einrichten und Übertragen braucht). */
async function fakeGitHub(page) {
  const files = new Map();
  let n = 0;
  await page.route('https://api.github.com/**', async route => {
    const req = route.request();
    const url = new globalThis.URL(req.url());
    const H = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' };
    const json = (status, body) => route.fulfill({ status, headers: H, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: H });
    if (url.pathname === `/repos/${REPO}`) return json(200, { private: true });
    const p = decodeURIComponent(url.pathname.replace(`/repos/${REPO}/contents/`, ''));
    const cur = files.get(p);
    if (req.method() === 'GET') {
      if (cur) return json(200, { sha: cur.sha, content: Buffer.from(cur.text).toString('base64') });
      const dir = [...files].filter(([k]) => k.startsWith(`${p}/`)).map(([k, f]) => ({ type: 'file', name: k.slice(p.length + 1), sha: f.sha }));
      return dir.length ? json(200, dir) : json(404, {});
    }
    const body = JSON.parse(req.postData() || '{}');
    const sha = `s${++n}`;
    files.set(p, { sha, text: Buffer.from(body.content || '', 'base64').toString() });
    return json(201, { content: { sha } });
  });
}

/** Versionsliste (erfunden, passend zur festen Uhrzeit 10:44). */
const ROWS = {
  today: [
    { t: '10:42', dev: 'Chrome · Linux', sum: '6 Parameter · 3 Konzepte', current: true },
    { t: '10:31', dev: 'Chrome · Linux', sum: '6 Parameter · 3 Konzepte' },
    { t: '10:19', dev: 'Chrome · Linux', sum: '6 Parameter · 2 Konzepte' },
    { t: '09:58', dev: 'Laptop', sum: '6 Parameter · 2 Konzepte', name: 'vor Workshop' },
  ],
  older: { day: 'Gestern, 19.10.', count: 7 },
  first: { day: '14.10.2026', t: '16:05', dev: 'Laptop', sum: '6 Parameter · 3 Konzepte', name: 'Erster Entwurf' },
};
const verRow = r => `<div class="mk-ver${r.current ? ' is-current' : ''}${r.name ? ' is-named' : ''}">
  <span class="mk-time">${r.t}</span>
  <div>${r.name ? `<span class="mk-name">${ICON.tag}${r.name}</span>` : ''}${r.current ? '<span class="mcs-badge" style="margin-left:0">aktuell</span>' : ''}
    <div class="mk-sub">${r.dev} · ${r.sum}</div></div>
  <div class="mk-acts">${r.current ? '' : `<button class="mcs-btn mcs-small">${ICON.eye}Ansehen</button><button class="mcs-btn mcs-small">${ICON.undo}Wiederherstellen …</button>`}</div></div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'de-DE', timezoneId: 'Europe/Berlin', colorScheme: 'light' });
await page.clock.setFixedTime(new Date('2026-10-20T10:44:00+02:00'));
await fakeGitHub(page);
await page.goto(URL);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload();
await page.waitForTimeout(500);
await page.locator('#title').dblclick();
await page.locator('#title').fill(TITLE);
await page.locator('#title').press('Enter');
await page.addStyleTag({ content: CSS });

// 6 – ohne Ablage (zuerst aufgenommen, solange keine eingerichtet ist)
await page.click('#menuBtn');
await page.click('[data-action="storage"]'); // lädt die gemeinsame Oberfläche samt Stilen
await page.waitForTimeout(300);
await page.keyboard.press('Escape');
await dialog(page, `${head(`Versionen – ${TITLE}`)}
  <div class="mcs-note" style="margin-top:14px">${ICON.cloud}<div><b>Versionen gibt es mit der Ablage.</b> Jeder übertragene Stand wird dort zu einer Version; benannte Stände
  (z. B. „vor Workshop“) bleiben immer erhalten und lassen sich ansehen und wiederherstellen.</div></div>
  <p class="mcs-hint">Ohne Ablage: Stände über <b>Datei → Als JSON speichern</b> bzw. das Backup in „Meine Matrizen“ festhalten.</p>
  <div class="mcs-foot"><span class="mcs-spacer"></span><button class="mcs-btn">Schließen</button><button class="mcs-btn mcs-primary">Ablage einrichten …</button></div>`);
await shot(page, 'v6-ohne-ablage.png');
await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close()));

// Ablage über die echte Oberfläche einrichten
await page.click('#menuBtn');
await page.click('[data-action="storage"]');
await page.click('[data-sync="next"]');
await page.fill('input[name="repo"]', REPO);
await page.fill('input[name="token"]', 'github_pat_mockup');
await page.click('[data-sync="connect"]');
await page.waitForSelector('[data-step="3"]');
await page.click('[data-sync="finish"]');
await page.waitForTimeout(800);

// 1 – Menü „Datei“ mit „Versionen …“
await page.click('#menuBtn');
await page.evaluate(() => {
  const storage = document.querySelector('#menuList [data-action="storage"]');
  const v = document.createElement('button');
  v.className = 'menu-split mk-new';
  v.setAttribute('role', 'menuitem');
  v.innerHTML = 'Versionen …<span class="menu-hint">12 Stände · 2 benannt</span>';
  storage?.after(v);
});
await page.waitForTimeout(150);
await shot(page, 'v1-menue.png');
await page.keyboard.press('Escape');

// 2 – Versionen
await dialog(page, `${head(`Versionen – ${TITLE}`)}
  <p class="mcs-hint">Jeder übertragene Stand ist eine Version (automatisch höchstens alle 5 Minuten). Benannte Stände sind hervorgehoben und bleiben immer erhalten.</p>
  <div class="mk-bar"><button class="mcs-btn mcs-primary mcs-small">${ICON.tag}Stand speichern …</button>
    <span class="mk-seg"><span class="on">Alle</span><span>Nur benannte</span></span><span class="mcs-spacer"></span>
    <a class="mcs-link" href="#">Verlauf auf GitHub ${ICON.ext}</a></div>
  <div class="mk-day">Heute</div>
  ${ROWS.today.map(verRow).join('')}
  <div class="mk-day">${ROWS.older.day}</div>
  <div class="mk-more">${ICON.chevron}${ROWS.older.count} Stände – aufklappen</div>
  <div class="mk-day">${ROWS.first.day}</div>
  ${verRow(ROWS.first)}`);
await shot(page, 'v2-versionen.png');

// 3 – Stand speichern
await dialog(page, `${head('Stand speichern')}
  <p class="mcs-hint">Hält den aktuellen Stand von „${TITLE}“ jetzt fest – auch innerhalb der 5 Minuten – und gibt ihm einen Namen.</p>
  <label class="mk-field">Name<input value="vor Workshop"><small>z. B. „vor Workshop“, „an Kunde geschickt“, „Version 2“</small></label>
  <label class="mk-field">Notiz (optional)<textarea rows="2">Stand nach Abstimmung mit Aylin; Lautstärke noch offen.</textarea></label>
  <div class="mcs-note">${ICON.tag}<div>Benannte Stände bleiben immer erhalten und erscheinen im Repo als Tag (<code>morphological-matrix-app/…/vor-workshop</code>).</div></div>
  <div class="mcs-foot"><span class="mcs-spacer"></span><button class="mcs-btn">Abbrechen</button><button class="mcs-btn mcs-primary">Stand speichern</button></div>`);
await shot(page, 'v3-stand-speichern.png');
await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close()));

// 4 – Früheren Stand ansehen (nur lesen)
await page.evaluate(({ ICON }) => {
  document.body.classList.add('mk-readonly');
  const b = document.createElement('div');
  b.className = 'mk-banner';
  b.innerHTML = `${ICON.eye}<div><b>Früherer Stand:</b> 14.10.2026, 16:05 · Laptop · „Erster Entwurf“ – nur ansehen, Änderungen sind gesperrt.</div>
    <span class="mcs-spacer"></span><button class="mcs-btn mcs-small">${ICON.undo}Wiederherstellen …</button>
    <button class="mcs-btn mcs-small">${ICON.copy}Als Kopie öffnen</button><button class="mcs-btn mcs-small mcs-primary">Zurück zum aktuellen Stand</button>`;
  document.body.append(b);
  const tab = document.querySelector('#appTabs .app-tab.is-active');
  tab?.insertAdjacentHTML('beforeend', '<span class="mcs-badge" style="background:var(--warn);margin-left:6px">14.10.</span>');
  const legend = document.createElement('div');
  legend.className = 'mk-legend';
  legend.innerHTML = `<h3>Entwurf: Ansehen</h3><ul><li>Die Matrix zeigt den früheren Stand mit allen Ansichten (Vergleich, Lösungsraum, Export).</li>
    <li>Bearbeiten ist gesperrt; „Zurück“ zeigt wieder den aktuellen Stand.</li><li>Unterschiede hervorheben: später (Stufe 4 – Vergleich).</li></ul>`;
  document.body.append(legend);
}, { ICON });
await page.waitForTimeout(150);
await shot(page, 'v4-ansehen.png');
await page.evaluate(() => { document.body.classList.remove('mk-readonly'); document.querySelectorAll('.mk-banner, .mk-legend, #appTabs .mcs-badge').forEach(e => e.remove()); });

// 5 – Wiederherstellen
await dialog(page, `${head('Stand vom 14.10.2026, 16:05 wiederherstellen?')}
  <p class="mcs-hint">„${TITLE}“ bekommt wieder den Inhalt dieses Stands. Nichts geht verloren: Der aktuelle Stand bleibt als Version erhalten.</p>
  <div class="mk-cmp"><div><h3>Aktuell</h3><div class="mk-sub">heute 10:42 · Chrome · Linux<br>6 Parameter · 3 Konzepte</div></div>
    <div><h3>„Erster Entwurf“</h3><div class="mk-sub">14.10.2026, 16:05 · Laptop<br>6 Parameter · 3 Konzepte</div></div></div>
  <div class="mcs-foot"><button class="mcs-btn">${ICON.copy}Als Kopie öffnen</button><span class="mcs-spacer"></span><button class="mcs-btn">Abbrechen</button><button class="mcs-btn mcs-primary">${ICON.undo}Wiederherstellen</button></div>`);
await shot(page, 'v5-wiederherstellen.png');
await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close()));

// 7 – Statusanzeige mit Weg zu den Versionen
await page.click('#syncStatus');
await page.evaluate(({ ICON }) => {
  const row = document.querySelector('.mcs-pop .mcs-row');
  row?.insertAdjacentHTML('beforeend', `<button class="mcs-btn mcs-small mk-new">${ICON.tag}Versionen …</button>`);
}, { ICON });
await page.waitForTimeout(150);
await shot(page, 'v7-statusanzeige.png');

console.log('Aufgenommen.');
await browser.close();
