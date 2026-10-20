/*
 * Mockups „Ablage“ (Konzept: https://github.com/method-commons/sync/blob/main/docs/KONZEPT.md).
 * Nimmt die echte App auf und blendet den Entwurf mit den Klassen der App ein.
 * Aufruf: `npx vite build && npx vite preview &` und dann `node docs/mockups/ablage/aufnehmen.mjs`.
 */
/* global document, localStorage, sessionStorage, console -- Code in page.evaluate läuft im Browser */
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const URL = 'http://localhost:4173/';
const REPO = 'team-foodtruck/methoden';

const ICON = {
  cloud: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9.2 4.5 4.5 0 0 0 7 18z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  sync: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.7M20 4v4.7h-4.7M20 12a8 8 0 0 1-13.7 5.6L4 15.3M4 20v-4.7h4.7"/></svg>',
  off: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4l16 16M9 6.4A6 6 0 0 1 17.6 10 4 4 0 0 1 19.8 17M15 18H7a4.5 4.5 0 0 1-1.6-8.7"/></svg>',
  warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l9 16H3zM12 10v4M12 17v.5"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6 11l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v13M6 13l6 6 6-6"/></svg>',
  ext: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  gh: '<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:currentColor;stroke:none"><path d="M12 2.5a9.5 9.5 0 0 0-3 18.5c.5.1.7-.2.7-.5v-1.7c-2.6.6-3.2-1.2-3.2-1.2-.4-1.1-1-1.4-1-1.4-.9-.6 0-.6 0-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.1-.2-4.3-1-4.3-4.7 0-1 .4-1.9 1-2.6-.1-.2-.4-1.2.1-2.5 0 0 .8-.3 2.6 1a9 9 0 0 1 4.8 0c1.8-1.3 2.6-1 2.6-1 .5 1.3.2 2.3.1 2.5.6.7 1 1.6 1 2.6 0 3.7-2.2 4.5-4.3 4.7.3.3.6.9.6 1.8v2.7c0 .3.2.6.7.5A9.5 9.5 0 0 0 12 2.5z"/></svg>',
  db: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/></svg>',
};

// Stile nur für den Entwurf – Farben und Formen aus den Tokens der App
const CSS = `
  .mk-new { background: var(--warn-bg) !important; box-shadow: inset 3px 0 0 var(--search); }
  .mk-tag { display: inline-block; margin-left: 10px; padding: 1px 8px; border-radius: 999px; border: 1px dashed var(--search);
    color: var(--warn); background: var(--warn-bg); font-size: .68rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; vertical-align: middle; }
  .mk-dialog { width: min(680px, calc(100vw - 32px)); }
  .mk-dialog .dialog-foot { gap: 8px; align-items: center; }
  .mk-dialog .dialog-foot .spacer { flex: 1; }
  .mk-steps { display: flex; gap: 6px; margin: 4px 0 14px; padding: 0; list-style: none; font-size: .8rem; color: var(--muted); }
  .mk-steps li { display: flex; align-items: center; gap: 6px; padding: 4px 10px 4px 4px; border-radius: 999px; background: var(--surface-2); }
  .mk-steps b { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: var(--surface-3); color: var(--text-2); font-size: .72rem; }
  .mk-steps .on { background: var(--accent-soft); color: var(--accent); font-weight: 650; }
  .mk-steps .on b { background: var(--accent); color: var(--accent-contrast); }
  .mk-steps .done b { background: var(--good); color: #fff; }
  .mk-choice { cursor: pointer; align-items: flex-start; }
  .mk-choice.is-current { border-color: var(--accent); background: var(--accent-soft); box-shadow: 0 0 0 1px var(--accent); }
  .mk-choice.is-off { opacity: .6; }
  .mk-choice > svg { width: 28px; height: 28px; margin-top: 2px; color: var(--text-2); }
  .mk-choice input { margin-top: 4px; accent-color: var(--accent); width: 16px; height: 16px; }
  .badge.mk-grey { background: var(--surface-3); color: var(--text-2); }
  .badge.mk-good { background: var(--good-bg); color: var(--good); }
  .mk-note { display: flex; gap: 10px; margin: 12px 0; padding: 10px 12px; border-radius: 10px; background: var(--surface-2);
    font-size: .84rem; color: var(--text-2); line-height: 1.45; }
  .mk-note svg { flex: none; margin-top: 1px; color: var(--accent); }
  .mk-note.warn { background: var(--warn-bg); color: var(--text); } .mk-note.warn svg { color: var(--warn); }
  .mk-num { list-style: none; counter-reset: s; margin: 0 0 4px; padding: 0; display: flex; flex-direction: column; gap: 14px; }
  .mk-num > li { counter-increment: s; position: relative; padding-left: 34px; font-size: .88rem; color: var(--text-2); }
  .mk-num > li::before { content: counter(s); position: absolute; left: 0; top: 0; display: grid; place-items: center; width: 24px; height: 24px;
    border-radius: 50%; background: var(--accent-soft); color: var(--accent); font-weight: 700; font-size: .78rem; }
  .mk-num h3 { margin: 2px 0 4px; font-size: .92rem; color: var(--text); }
  .mk-num ul { margin: 4px 0 8px; padding-left: 18px; }
  .mk-num code, .mk-dialog code { padding: 1px 5px; border-radius: 5px; background: var(--surface-3); font-size: .8rem; }
  .mk-field { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; font-size: .8rem; font-weight: 600; color: var(--text-2); }
  .mk-field input { padding: 7px 10px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); font-size: .9rem; font-weight: 400; }
  .mk-field small { font-weight: 400; color: var(--muted); }
  .mk-link { display: inline-flex; align-items: center; gap: 4px; color: var(--accent); font-weight: 600; text-decoration: none; }
  .mk-link svg { width: 14px; height: 14px; }
  .mk-checks { list-style: none; margin: 0 0 14px; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: .88rem; }
  .mk-checks li { display: flex; align-items: center; gap: 8px; }
  .mk-checks svg { width: 18px; height: 18px; padding: 2px; border-radius: 50%; background: var(--good-bg); color: var(--good); stroke-width: 2.6; }
  .mk-checks small { margin-left: auto; color: var(--muted); }
  .mk-h { margin: 14px 0 6px; font-size: .72rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
  .mk-chip { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--border);
    background: var(--surface); color: var(--good); font-size: .84rem; font-weight: 600; white-space: nowrap; }
  .mk-chip svg { width: 16px; height: 16px; stroke-width: 2.2; }
  .mk-chip.ok { background: var(--good-bg); border-color: color-mix(in srgb, var(--good) 35%, transparent); }
  .mk-chip.busy { color: var(--accent); background: var(--accent-soft); border-color: color-mix(in srgb, var(--accent) 30%, transparent); }
  .mk-chip.off { color: var(--muted); background: var(--surface-2); }
  .mk-chip.bad { color: var(--warn); background: var(--warn-bg); border-color: color-mix(in srgb, var(--warn) 40%, transparent); }
  .mk-chip.mk-ring { box-shadow: 0 0 0 3px var(--warn-bg), 0 0 0 4px var(--search); }
  .mk-pop { position: fixed; z-index: 90; width: 320px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius);
    background: var(--surface); box-shadow: var(--shadow-lg); font-size: .85rem; }
  .mk-pop h3 { margin: 0 0 8px; font-size: .7rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
  .mk-pop dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0 0 10px; }
  .mk-pop dt { color: var(--muted); } .mk-pop dd { margin: 0; font-weight: 550; }
  .mk-pop .row { display: flex; gap: 6px; }
  .mk-legend { position: fixed; z-index: 90; left: 24px; bottom: 24px; padding: 12px 14px; border: 1px dashed var(--search); border-radius: var(--radius);
    background: var(--surface); box-shadow: var(--shadow-lg); font-size: .82rem; color: var(--text-2); }
  .mk-legend h3 { margin: 0 0 8px; font-size: .7rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
  .mk-legend ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: auto 1fr; gap: 8px 12px; align-items: center; }
  .mk-sides { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 4px 0 12px; }
  .mk-side { padding: 12px; border: 1px solid var(--border); border-radius: 10px; }
  .mk-side h3 { margin: 0 0 2px; font-size: .92rem; } .mk-side .doc-meta { margin-bottom: 8px; }
  .mk-side ul { margin: 0; padding-left: 18px; font-size: .84rem; color: var(--text-2); }
  .mk-side .plus { color: var(--good); font-weight: 600; } .mk-side .minus { color: var(--bad); font-weight: 600; }
  .mk-opts { display: flex; flex-direction: column; gap: 6px; }
  .mk-opt { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; }
  .mk-opt .btn { min-width: 170px; justify-content: center; }
  .mk-opt span { font-size: .84rem; color: var(--muted); }
  .mk-state { display: inline-flex; align-items: center; gap: 4px; font-size: .78rem; font-weight: 600; white-space: nowrap; }
  .mk-state svg { width: 15px; height: 15px; stroke-width: 2.2; }
  .mk-state.ok { color: var(--good); } .mk-state.busy { color: var(--accent); } .mk-state.off { color: var(--muted); }
  .doc .doc-info { flex-basis: 200px; }
  .mk-kv { display: grid; grid-template-columns: 120px 1fr auto; margin-top: 16px !important; gap: 10px 14px; align-items: center; margin: 0 0 6px; font-size: .88rem; }
  .mk-kv dt { color: var(--muted); } .mk-kv dd { margin: 0; }
  .mk-danger { color: var(--danger) !important; border-color: color-mix(in srgb, var(--danger) 40%, transparent) !important; }
`;

/** Blendet einen Entwurfs-Dialog ein (echtes <dialog> der App mit Hintergrund-Unschärfe). */
async function dialog(page, html) {
  await page.evaluate(h => {
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    const d = document.createElement('dialog');
    d.className = 'dialog mk-dialog';
    d.innerHTML = h;
    document.body.append(d);
    d.showModal();
    /** @type {HTMLElement} */ (document.activeElement)?.blur();
  }, html);
  await page.waitForTimeout(250);
}

const head = (title, sub = '') => `<div class="dialog-head"><h2>${title}<span class="mk-tag">Entwurf</span></h2>
  <button type="button" class="icon-btn" aria-label="Schließen">${ICON.close}</button></div>${sub ? `<p class="dialog-hint">${sub}</p>` : ''}`;

const steps = n => `<ol class="mk-steps">${['Ablage wählen', 'Verbinden', 'Prüfen &amp; hochladen']
  .map((s, i) => `<li class="${i + 1 === n ? 'on' : i + 1 < n ? 'done' : ''}"><b>${i + 1 < n ? '✓' : i + 1}</b>${s}</li>`).join('')}</ol>`;

const shot = (page, name) => page.screenshot({ path: path.join(DIR, name) });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'de-DE', timezoneId: 'Europe/Berlin', colorScheme: 'light' });
// Feste Uhrzeit, passend zu den Zeiten im Entwurf
await page.clock.setFixedTime(new Date('2026-10-20T10:44:00+02:00'));
await page.goto(URL);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload();
await page.waitForSelector('#matrix .opt, #matrix [class*="opt"]');

// Weitere Beispiele öffnen, damit Listen echte Matrizen zeigen
for (const name of ['Food-Truck', 'Lastenrad']) {
  await page.click('#menuBtn');
  await page.click('[data-action="example"]');
  await page.locator('#exampleList .doc', { hasText: name }).getByRole('button', { name: 'Öffnen' }).click();
  await page.waitForTimeout(300);
}
await page.locator('#appTabs [role="tab"]').first().click();
await page.waitForTimeout(400);
await page.addStyleTag({ content: CSS + '#toast { display: none !important; }' });

// Echte Liste „Meine Matrizen“ auslesen
await page.click('#menuBtn');
await page.click('[data-action="open"]');
const docs = await page.$$eval('#docList .doc', els => els.map(el => ({
  title: el.querySelector('.doc-title')?.childNodes[0]?.textContent?.trim() ?? '',
  meta: el.querySelector('.doc-meta')?.textContent?.split('·').slice(1).join('·').trim() ?? '',
})));
await page.keyboard.press('Escape');
const kaffee = docs.find(d => d.title.includes('Kaffeemaschine')) ?? docs[0];
// Zustände in der Ablage je Matrix – in allen Bildern gleich
const state = d => (d.title.includes('Kaffeemaschine') ? 'ok' : d.title.includes('Food-Truck') ? 'busy' : 'local');

// 1 – Menü „Datei“ mit „Ablage …“ und „Versionen …“
await page.click('#menuBtn');
await page.evaluate(() => {
  const anchor = document.querySelector('#menuList [data-action="example"]');
  const hr = document.createElement('hr');
  const a = document.createElement('button');
  a.className = 'mk-new'; a.setAttribute('role', 'menuitem');
  a.innerHTML = 'Ablage …<span class="menu-hint">nicht eingerichtet</span>';
  a.style.display = 'flex';
  const v = document.createElement('button');
  v.className = 'mk-new'; v.setAttribute('role', 'menuitem');
  v.innerHTML = 'Versionen …<span class="menu-hint">ab Stufe 2</span>';
  v.style.display = 'flex'; v.style.opacity = '.7';
  anchor?.after(hr, a, v);
});
await page.waitForTimeout(150);
await shot(page, 'a1-menue.png');
await page.keyboard.press('Escape');

// 2 – Ablage wählen
await dialog(page, `${head('Ablage einrichten', 'Matrizen zusätzlich außerhalb dieses Browsers speichern – auf allen Geräten verfügbar, mit Versionen. Ohne Ablage bleibt alles wie bisher.')}
  ${steps(1)}
  <ul class="doc-list">
    <li class="doc mk-choice is-current"><input type="radio" checked>${ICON.gh}
      <div class="doc-info"><span class="doc-title">GitHub-Repo<span class="badge">zuerst verfügbar</span></span>
      <span class="doc-desc">Ein privates Repo der Person oder des Teams. Jede Matrix ist eine Datei, jeder gespeicherte Stand ein Commit – Versionen und Vergleich auf GitHub inklusive.</span>
      <span class="doc-meta">Braucht ein GitHub-Konto und ein persönliches Token · Daten bei GitHub (USA)</span></div></li>
    <li class="doc mk-choice is-off"><input type="radio" disabled>${ICON.db}
      <div class="doc-info"><span class="doc-title">Supabase-Projekt<span class="badge mk-grey">später</span></span>
      <span class="doc-desc">Eigenes Projekt mit Datenbank – auch ohne GitHub, im EU-Rechenzentrum oder auf eigenem Server. Echtes Löschen, Teilen mit Rechten.</span>
      <span class="doc-meta">Einrichtung mit einem SQL-Skript zum Kopieren</span></div></li>
  </ul>
  <div class="mk-note">${ICON.cloud}<div><b>Gilt für alle Methoden-Apps in diesem Browser:</b> Morphologische Matrix, 2-Achsen-Matrix, RACI-Matrix, 5 Warum und User Stories nutzen dieselbe Ablage – einmal einrichten genügt. Gearbeitet wird weiter im Browser; die Ablage wird im Hintergrund abgeglichen, auch nach einer Pause ohne Netz.</div></div>
  <div class="dialog-foot"><span class="spacer"></span><button class="btn">Abbrechen</button><button class="btn btn-primary">Weiter</button></div>`);
await shot(page, 'a2-ablage-waehlen.png');

// 3 – GitHub verbinden
await dialog(page, `${head('Ablage einrichten')}
  ${steps(2)}
  <ol class="mk-num">
    <li><h3>Privates Repo anlegen</h3>Ein leeres Repo genügt – für alle Apps zusammen; jede App legt ihren eigenen Ordner an.
      <a class="mk-link" href="#">Neues Repo auf GitHub ${ICON.ext}</a>
      <label class="mk-field">Repo<input value="${REPO}"><small>Besitzer/Name, z. B. aus der Adresse github.com/${REPO}</small></label></li>
    <li><h3>Persönliches Token erstellen</h3>Auf GitHub unter „Fine-grained tokens“:
      <ul><li>Repository access: <b>Only select repositories</b> → nur dieses Repo</li>
      <li>Permissions: <b>Contents – Read and write</b> (sonst nichts)</li>
      <li>Expiration: z. B. 90 Tage – die App erinnert vor Ablauf</li></ul>
      <a class="mk-link" href="#">Token-Seite auf GitHub ${ICON.ext}</a>
      <label class="mk-field">Token<input type="password" value="github_pat_11ABCDEFG0123456789abcdef"></label></li>
  </ol>
  <div class="mk-note warn">${ICON.warn}<div>Das Token bleibt <b>nur in diesem Browser</b> und gilt für alle Methoden-Apps unter method-commons.github.io. Es erlaubt nur Lesen und Schreiben in diesem einen Repo. „Ablage trennen“ löscht es.</div></div>
  <div class="dialog-foot"><button class="btn">Zurück</button><span class="spacer"></span><button class="btn">Abbrechen</button><button class="btn btn-primary">Verbinden &amp; prüfen</button></div>`);
await shot(page, 'a3-github-verbinden.png');

// 4 – Prüfung und Hochladen
const docRow = (d, checked) => `<li class="doc"><label class="check" style="color:var(--text)"><input type="checkbox" ${checked ? 'checked' : ''}></label>
  <div class="doc-info"><span class="doc-title">${d.title}</span><span class="doc-meta">${d.meta}</span></div></li>`;
await dialog(page, `${head('Ablage einrichten')}
  ${steps(3)}
  <ul class="mk-checks">
    <li>${ICON.check} Repo <b>${REPO}</b> erreichbar<small>privat</small></li>
    <li>${ICON.check} Schreibrecht vorhanden<small>nur Inhalte</small></li>
    <li>${ICON.check} Token gültig bis 18.01.2027<small>in 90 Tagen</small></li>
    <li>${ICON.check} Ordner <code>morphologische-matrix/</code> wird beim ersten Speichern angelegt</li>
  </ul>
  <div class="mk-h">Matrizen aus diesem Browser hochladen</div>
  <ul class="doc-list">${docs.map(d => docRow(d, state(d) !== 'local')).join('')}</ul>
  <div class="mk-note">${ICON.cloud}<div>Nicht gewählte Matrizen bleiben nur in diesem Browser; hochladen geht später unter <b>Meine Matrizen</b>. Matrizen der anderen Apps werden beim nächsten Öffnen der jeweiligen App angeboten.</div></div>
  <div class="dialog-foot"><button class="btn">Zurück</button><span class="spacer"></span><button class="btn btn-primary">${docs.filter(d => state(d) !== 'local').length} Matrizen hochladen</button></div>`);
await shot(page, 'a4-pruefen-hochladen.png');
await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close()));

// 5 – Statusanzeige in der Kopfzeile
await page.evaluate(({ ICON, REPO }) => {
  const chip = document.createElement('button');
  chip.className = 'mk-chip ok mk-ring';
  chip.innerHTML = `${ICON.check}In der Ablage`;
  document.querySelector('.toolbar .menu')?.before(chip);
  const r = chip.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'mk-pop';
  pop.style.top = `${r.bottom + 8}px`; pop.style.left = `${r.right - 320}px`;
  pop.innerHTML = `<h3>Ablage · GitHub</h3><dl>
    <dt>Repo</dt><dd>${REPO}</dd>
    <dt>Diese Matrix</dt><dd>übertragen um 10:42</dd>
    <dt>Versionen</dt><dd>automatisch höchstens alle 5 Min.</dd>
    <dt>Andere Matrizen</dt><dd>alle übertragen</dd></dl>
    <div class="row"><button class="btn btn-small">${ICON.up}Jetzt übertragen</button><button class="btn btn-small">Ablage …</button></div>`;
  document.body.append(pop);
  const leg = document.createElement('div');
  leg.className = 'mk-legend';
  leg.innerHTML = `<h3>Entwurf: Zustände der Anzeige</h3><ul>
    <li><span class="mk-chip ok">${ICON.check}In der Ablage</span></li><li>alles übertragen</li>
    <li><span class="mk-chip busy">${ICON.sync}Wird übertragen</span></li><li>Änderungen werden gebündelt gesendet</li>
    <li><span class="mk-chip off">${ICON.off}Offline</span></li><li>im Browser gespeichert, wird nachgeholt</li>
    <li><span class="mk-chip bad">${ICON.warn}Konflikt</span></li><li>auf einem anderen Gerät geändert – Klick öffnet die Auswahl</li>
  </ul><p style="margin:10px 0 0;color:var(--muted)">Ohne Ablage erscheint keine Anzeige.</p>`;
  document.body.append(leg);
}, { ICON, REPO });
await page.waitForTimeout(150);
await shot(page, 'a5-statusanzeige.png');
await page.evaluate(() => document.querySelectorAll('.mk-pop, .mk-legend').forEach(e => e.remove()));
await page.evaluate(({ ICON }) => {
  const chip = /** @type {HTMLElement} */ (document.querySelector('.mk-chip'));
  chip.className = 'mk-chip bad'; chip.innerHTML = `${ICON.warn}Konflikt`;
}, { ICON });

// 6 – Konflikt
await dialog(page, `${head(`„${kaffee.title}“ wurde auch auf einem anderen Gerät geändert`, 'Beide Stände beruhen auf dem Stand von 09:58. Welcher soll gelten?')}
  <div class="mk-sides">
    <div class="mk-side"><h3>Auf diesem Gerät</h3><div class="doc-meta">geändert heute 10:41 · ${kaffee.meta}</div>
      <ul><li>Konzept „Kompakt-Espresso“: Begründung ergänzt</li><li>Ausprägung „Thermoblock“: Notiz geändert</li></ul></div>
    <div class="mk-side"><h3>In der Ablage</h3><div class="doc-meta">geändert heute 10:37 · Laptop · 7 Parameter · 4 Konzepte</div>
      <ul><li><span class="plus">neu:</span> Parameter „Milchschaum“ mit 3 Ausprägungen</li><li><span class="plus">neu:</span> Konzept „Büro“</li></ul></div>
  </div>
  <div class="mk-opts">
    <div class="mk-opt"><button class="btn btn-primary">Beide behalten</button><span>Der Stand aus der Ablage wird als eigene Matrix „${kaffee.title} (Laptop)“ geöffnet – zum Vergleichen und Übernehmen.</span></div>
    <div class="mk-opt"><button class="btn">Meine behalten</button><span>Dieser Stand wird übertragen. Der andere bleibt als Version im Repo erhalten.</span></div>
    <div class="mk-opt"><button class="btn">Ablage übernehmen</button><span>Der Stand aus der Ablage ersetzt diesen. Dieser bleibt unter „Versionen“ erhalten.</span></div>
  </div>
  <div class="mk-note">${ICON.cloud}<div>Kein automatisches Zusammenführen – nichts geht verloren. Die Liste der Änderungen ist eine einfache Zusammenfassung; ein genauer Vergleich kommt mit Stufe 4.</div></div>`);
await shot(page, 'a6-konflikt.png');
await page.evaluate(({ ICON }) => {
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  const chip = /** @type {HTMLElement} */ (document.querySelector('.mk-chip'));
  chip.className = 'mk-chip ok'; chip.innerHTML = `${ICON.check}In der Ablage`;
}, { ICON });

// 7 – Meine Matrizen mit Stand der Ablage
await page.click('#menuBtn');
await page.click('[data-action="open"]');
await page.evaluate(({ ICON, REPO }) => {
  const dlg = /** @type {HTMLDialogElement} */ (document.getElementById('libraryDialog'));
  dlg.classList.add('mk-dialog');
  dlg.querySelector('h2')?.insertAdjacentHTML('beforeend', '<span class="mk-tag">Entwurf</span>');
  const hint = dlg.querySelector('.dialog-hint');
  if (hint) hint.innerHTML = `Matrizen in diesem Browser und in der Ablage <b>GitHub · ${REPO}</b>. Jede Matrix kann in einem eigenen Tab bearbeitet werden.`;
  const states = {
    ok: `<span class="mk-state ok">${ICON.check}in der Ablage</span>`,
    busy: `<span class="mk-state busy">${ICON.sync}wird übertragen</span>`,
    local: `<span class="mk-state off">${ICON.cloud}nur im Browser</span><button class="btn btn-small">${ICON.up}Hochladen</button>`,
  };
  dlg.querySelectorAll('#docList .doc').forEach(li => {
    const t = li.querySelector('.doc-title')?.textContent ?? '';
    const s = t.includes('Kaffeemaschine') ? 'ok' : t.includes('Food-Truck') ? 'busy' : 'local';
    li.querySelector('.doc-actions')?.insertAdjacentHTML('afterbegin', states[s]);
  });
  dlg.querySelector('#docList')?.insertAdjacentHTML('afterend', `<div class="mk-h">Nur in der Ablage</div><ul class="doc-list">
    <li class="doc"><div class="doc-info"><span class="doc-title">Firmen-Event</span><span class="doc-meta">gespeichert 14.10.2026, 16:05 · Laptop · 7 Parameter · 3 Konzepte</span></div>
    <div class="doc-actions"><button class="btn btn-small">${ICON.down}Öffnen</button></div></li></ul>`);
}, { ICON, REPO });
await page.waitForTimeout(150);
await shot(page, 'a7-meine-matrizen.png');
await page.keyboard.press('Escape');

// 8 – Ablage verbunden
await dialog(page, `${head('Ablage')}
  <dl class="mk-kv">
    <dt>Ablage</dt><dd>${ICON.gh} GitHub-Repo <b>${REPO}</b></dd><dd><a class="mk-link" href="#">Auf GitHub ${ICON.ext}</a></dd>
    <dt>Token</dt><dd>gültig bis 18.01.2027 (noch 90 Tage)</dd><dd><button class="btn btn-small">Token erneuern</button></dd>
    <dt>Diese App</dt><dd>${docs.length} Matrizen im Browser, davon ${docs.filter(d => state(d) !== 'local').length} in der Ablage · 1 weitere nur in der Ablage</dd><dd></dd>
    <dt>Andere Apps</dt><dd>RACI-Matrix 2 · 5 Warum 1 · 2-Achsen-Matrix 0 · User Stories 0</dd><dd></dd>
    <dt>Versionen</dt><dd>automatisch höchstens alle 5 Minuten, dazu „Stand speichern“</dd><dd></dd>
  </dl>
  <div class="mk-note warn">${ICON.warn}<div><b>Löschen in Git:</b> Eine gelöschte Matrix verschwindet aus dem Repo, bleibt aber in dessen Historie. Endgültig löschen lässt sie sich nur auf GitHub (Repo löschen oder Historie bereinigen).</div></div>
  <div class="dialog-foot"><button class="btn mk-danger">Ablage trennen …</button><span class="spacer"></span><button class="btn">Jetzt abgleichen</button><button class="btn btn-primary">Fertig</button></div>`);
await shot(page, 'a8-ablage-verbunden.png');

console.log(`Aufgenommen mit ${docs.map(d => d.title).join(', ')}`);
await browser.close();
