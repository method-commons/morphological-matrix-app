/*
 * Mockups „Versionen vergleichen“ (Stufe 4, Konzept: https://github.com/method-commons/sync/blob/main/docs/KONZEPT.md).
 * Nimmt die echte App mit eingerichteter Ablage auf (GitHub-API nachgebildet, mit früheren Ständen) und blendet
 * den Entwurf mit den Klassen der gemeinsamen Oberfläche (mcs-…) ein.
 * Aufruf: `npx vite build && npx vite preview &` und dann `node docs/mockups/vergleich/aufnehmen.mjs`.
 */
/* global document, localStorage, sessionStorage, structuredClone -- Code in page.evaluate läuft im Browser */
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP, REPO, fakeGitHub } from '../../../tests/e2e/github.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const URL = 'http://localhost:4173/';
const TITLE = 'Kaffeemaschine – Konzeptstudie';

const svg = (d, s = 15) => `<svg class="mcs-icon" viewBox="0 0 24 24" style="width:${s}px;height:${s}px"><path d="${d}"/></svg>`;
const ICON = {
  diff: svg('M7 4v16M17 4v16M3 8h8M13 16h8M3 8l3-3M3 8l3 3M21 16l-3-3M21 16l-3 3'),
  close: svg('M6 6l12 12M18 6L6 18', 18),
  eye: svg('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z'),
  undo: svg('M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11'),
  tag: svg('M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0zM8 8h.01', 14),
  grid: svg('M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'),
  down: svg('M6 9l6 6 6-6', 14),
  swap: svg('M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4'),
};

// Ergänzungen nur für den Entwurf – auf den Tokens der Apps, passend zu den mcs-Klassen
const CSS = `
  #toast { display: none !important; }
  .mk-new { outline: 2px dashed var(--search) !important; outline-offset: 1px; }
  .mk-tag { display: inline-block; margin-left: 10px; padding: 1px 8px; border-radius: 999px; border: 1px dashed var(--search);
    color: var(--warn); background: var(--warn-bg); font-size: .68rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; vertical-align: middle; }
  .mk-legend { position: fixed; z-index: 90; right: 24px; bottom: 24px; max-width: 440px; padding: 12px 14px; border: 1px dashed var(--search); border-radius: 12px;
    background: var(--surface); box-shadow: var(--shadow-lg); font-size: .82rem; color: var(--text-2); }
  dialog .mk-legend { right: auto; left: 24px; }
  .mk-legend h3 { margin: 0 0 6px; font-size: .7rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
  .mk-legend ul { margin: 0; padding-left: 18px; }
  /* Vergleich */
  .mk-pick { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; margin: 4px 0 12px; }
  .mk-side { padding: 8px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
  .mk-side.is-b { border-color: var(--accent); background: var(--accent-soft); }
  .mk-side small { display: block; font-size: .7rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
  .mk-side b { display: flex; align-items: center; gap: 6px; font-weight: 650; }
  .mk-side span { font-size: .8rem; color: var(--muted); }
  .mk-side .mcs-icon:last-child { margin-left: auto; color: var(--muted); }
  .mk-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 0 0 10px; }
  .mk-kpis div { padding: 6px 10px; border-radius: 8px; background: var(--surface-2); font-size: .78rem; color: var(--muted); }
  .mk-kpis b { display: block; font-size: .95rem; color: var(--text); font-variant-numeric: tabular-nums; }
  .mk-kpis em { font-style: normal; font-weight: 650; color: var(--good); }
  .mk-filter { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 8px; }
  .mk-chip { display: inline-flex; align-items: center; gap: 5px; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--border); font-size: .8rem; font-weight: 600; color: var(--text-2); }
  .mk-chip.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
  .mk-grp { margin: 10px 0 4px; font-size: .72rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
  .mk-ch { display: grid; grid-template-columns: 22px 1fr; gap: 1px 8px; padding: 5px 10px; border: 1px solid var(--border); border-radius: 9px; margin-bottom: 5px; font-size: .86rem; }
  .mk-ch i { grid-row: span 2; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 6px; font-style: normal; font-weight: 800; font-size: .8rem; }
  .mk-ch.add i { background: var(--good-bg); color: var(--good); }
  .mk-ch.del i { background: var(--bad-bg, #fde8e8); color: var(--bad, #c92a2a); }
  .mk-ch.mod i { background: var(--warn-bg); color: var(--warn); }
  .mk-ch b { font-weight: 650; }
  .mk-ch span { font-size: .8rem; color: var(--muted); }
  .mk-ch s { color: var(--bad, #c92a2a); text-decoration-thickness: 1.5px; }
  .mk-ch ins { text-decoration: none; color: var(--good); font-weight: 600; }
  /* Hervorheben in der Matrix */
  .mk-bar { position: sticky; top: 64px; z-index: 40; max-width: 1680px; margin: 12px auto 0; padding: 0 var(--gutter); }
  .mk-bar > div { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 8px 14px; border: 1px dashed var(--search);
    border-radius: 12px; background: var(--accent-soft); font-size: .88rem; }
  .mk-bar .mk-keys { display: inline-flex; gap: 10px; color: var(--muted); font-size: .8rem; }
  .mk-dot { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 4px; vertical-align: -1px; }
  .mk-hl-add { box-shadow: 0 0 0 2px var(--good) !important; background: var(--good-bg) !important; }
  .mk-hl-mod { box-shadow: 0 0 0 2px var(--warn) !important; background: var(--warn-bg) !important; }
  .mk-hl-del { border: 1.5px dashed var(--bad, #c92a2a) !important; background: transparent !important; opacity: .8; }
  .mk-hl-del .opt-label, .mk-hl-del b { text-decoration: line-through; color: var(--bad, #c92a2a); }
  .mk-flag { position: absolute; z-index: 5; top: -9px; right: 8px; padding: 0 6px; border-radius: 999px; font-size: .64rem; font-weight: 700; line-height: 16px; color: #fff; }
  .mk-flag.add { background: var(--good); } .mk-flag.mod { background: var(--warn); } .mk-flag.del { background: var(--bad, #c92a2a); }
  .mk-was, .mk-gone { position: absolute; left: 10px; bottom: -8px; padding: 0 6px; border-radius: 6px; background: var(--surface); font-size: .68rem; font-weight: 600; line-height: 15px; color: var(--warn); border: 1px solid var(--warn); }
  .mk-gone { color: var(--bad, #c92a2a); border-color: var(--bad, #c92a2a); }
  .mk-hl-del-p { box-shadow: 0 0 0 2px var(--bad, #c92a2a) !important; }
  /* Konflikt */
  .mk-diffbox { margin: 0 0 12px; padding: 10px 12px; border: 1px dashed var(--search); border-radius: 10px; background: var(--surface-2); }
  .mk-diffbox .mk-ch { background: var(--surface); }
  .mk-toggle { display: inline-flex; align-items: center; gap: 4px; margin: 0 0 10px; color: var(--accent); font-weight: 600; font-size: .86rem; }
`;

/** Entwurfs-Dialog im Stil der gemeinsamen Oberfläche. */
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
  (document.querySelector('dialog[open]') || document.body).append(el); // im offenen Dialog liegt sie über dem Hintergrund
}, [title, items]);

/** Eine Änderung in der Liste. */
const ch = (kind, what, detail = '') => `<div class="mk-ch ${kind}"><i>${{ add: '+', del: '−', mod: '~' }[kind]}</i><b>${what}</b>${detail ? `<span>${detail}</span>` : '<span></span>'}</div>`;

/** Änderungen von „vor Workshop“ (09:58) bis zum aktuellen Stand (10:42) – passend zu den früheren Ständen unten. */
const CHANGES = {
  konzepte: [
    ch('add', 'Smart Home', 'neues Konzept · Boiler, Rotationspumpe, Bohnen mit Mahlwerk, Smartphone-App, Netzstrom, Automatische Spülung'),
    ch('mod', 'Kompakt-Espresso', 'Wassererwärmung <s>Boiler</s> → <ins>Thermoblock</ins> · Status <s>Entwurf</s> → <ins>Favorit</ins>'),
    ch('mod', 'Outdoor', 'Status <s>Entwurf</s> → <ins>verworfen</ins> · Notiz ergänzt: „Muskelkraft verträgt sich nicht …“'),
  ],
  auspraegungen: [
    ch('add', 'Bohnen mit Mahlwerk', 'Kaffeezufuhr · 1,5 kg'),
    ch('del', 'Wasserkessel', 'Wassererwärmung · war in keinem Konzept gewählt'),
    ch('mod', 'Pulver (lose)', 'Kaffeezufuhr · umbenannt, vorher <s>Sieb (lose)</s>'),
  ],
  parameter: [ch('mod', 'Bedienung', 'umbenannt, vorher <s>Bedienkonzept</s>')],
  werte: [ch('mod', 'Thermoblock · Gewicht', '<s>0,8 kg</s> → <ins>0,6 kg</ins>')],
};
const changeList = (groups = CHANGES) => `
  <div class="mk-grp">Konzepte · 3</div>${groups.konzepte.join('')}
  <div class="mk-grp">Ausprägungen · 3</div>${groups.auspraegungen.join('')}
  <div class="mk-grp">Parameter · 1</div>${groups.parameter.join('')}
  <div class="mk-grp">Werte · 1</div>${groups.werte.join('')}`;

const compareHead = `
  <div class="mk-pick">
    <div class="mk-side"><small>Von</small><b>${ICON.tag}vor Workshop${ICON.down}</b><span>heute 09:58 · Laptop</span></div>
    <button class="mcs-icon-btn" title="Tauschen">${ICON.swap}</button>
    <div class="mk-side is-b"><small>Bis</small><b>Aktueller Stand${ICON.down}</b><span>heute 10:42 · Chrome · Linux</span></div>
  </div>
  <div class="mk-kpis">
    <div>Parameter<b>6</b></div>
    <div>Ausprägungen<b>22 → 23</b></div>
    <div>Kombinationen<b>2.304 → 3.072</b></div>
    <div>Konzepte<b>2 → 3</b></div>
  </div>
  <div class="mk-filter"><span class="mk-chip on">Alle · 8</span><span class="mk-chip">+ neu · 2</span><span class="mk-chip">~ geändert · 5</span><span class="mk-chip">− entfernt · 1</span></div>`;

// ---------- frühere Stände für die Ablage ----------

/** Stand „vor Workshop“ aus dem aktuellen ableiten (Änderungen wie in CHANGES, rückwärts). */
function beforeWorkshop(cur) {
  const d = structuredClone(cur);
  const p = id => d.parameters.find(x => x.id === id);
  p('p1').options.push({ ...structuredClone(p('p1').options[1]), id: 'p1o9', text: 'Wasserkessel' });
  p('p1').options.find(o => o.id === 'p1o3').values = { ...p('p1').options.find(o => o.id === 'p1o3').values, gew: 0.8 };
  p('p3').options = p('p3').options.filter(o => o.id !== 'p3o4');
  p('p3').options.find(o => o.id === 'p3o1').text = 'Sieb (lose)';
  p('p4').name = 'Bedienkonzept';
  d.concepts = d.concepts.filter(c => c.name !== 'Smart Home');
  for (const c of d.concepts) {
    c.status = 'draft';
    if (c.name === 'Kompakt-Espresso') c.selections.p1 = 'p1o2';
    if (c.name === 'Outdoor') c.note = '';
  }
  return d;
}

// ---------- Aufnahme ----------

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'de-DE', timezoneId: 'Europe/Berlin', colorScheme: 'light' });
await page.clock.setFixedTime(new Date('2026-10-20T10:44:00+02:00'));
const gh = await fakeGitHub(page);
await page.goto(URL);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload();
await page.waitForTimeout(500);
await page.locator('#title').dblclick();
await page.locator('#title').fill(TITLE);
await page.locator('#title').press('Enter');

// Ablage einrichten (lädt die gemeinsame Oberfläche)
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

// Verlauf der Datei: frühere Stände mit erfundenen Zeiten, der übertragene ist der aktuelle (10:42)
const id = await page.evaluate(() => JSON.parse(sessionStorage.getItem('morphologische-matrix:workspace')).active);
const file = `${APP}/${id}.json`;
const current = gh.read(file);
const old = beforeWorkshop(current.data);
const rec = (data, iso, device) => JSON.stringify({ ...current, data, device, savedAt: Date.parse(iso) }, null, 2);
const commit = (sha, iso, device, data) => ({ sha, path: file, text: rec(data, iso, device), message: `${TITLE} (${device})`, date: new Date(iso).toISOString() });
const first = structuredClone(old);
const yesterday = ['17:40', '17:12', '16:50', '15:31', '14:05', '11:20', '10:02'].reverse().map((t, i) => commit(`y${i}`, `2026-10-19T${t}:00+02:00`, 'Laptop', old));
const upload = gh.commits.find(c => c.path === file);
gh.commits.length = 0;
gh.commits.push(
  commit('e1', '2026-10-14T16:05:00+02:00', 'Laptop', first), ...yesterday,
  commit('w1', '2026-10-20T09:58:00+02:00', 'Laptop', old),
  commit('a1', '2026-10-20T10:19:00+02:00', 'Chrome · Linux', { ...current.data, concepts: current.data.concepts.filter(c => c.name !== 'Smart Home') }),
  commit('a2', '2026-10-20T10:31:00+02:00', 'Chrome · Linux', current.data),
  { ...upload, sha: 'a3', date: new Date('2026-10-20T10:42:00+02:00').toISOString(), message: `${TITLE} (Chrome · Linux)` },
);
const tag = (ref, sha, name, iso) => {
  gh.refs.set(`refs/tags/${APP}/${id}/${ref}`, `t-${sha}`);
  gh.tags.set(`t-${sha}`, { sha: `t-${sha}`, message: `${name}\n`, object: { sha, type: 'commit' }, tagger: { date: new Date(iso).toISOString() } });
};
tag('2026-10-14-erster-entwurf', 'e1', 'Erster Entwurf', '2026-10-14T16:06:00+02:00');
tag('2026-10-20-vor-workshop', 'w1', 'vor Workshop', '2026-10-20T09:59:00+02:00');

// 1 – Versionsliste mit „Vergleichen“
await page.click('#menuBtn');
await page.click('[data-action="versions"]');
await dlg.locator('.mcs-version').nth(3).waitFor();
await page.waitForTimeout(600);
await page.evaluate(([icon, tagHtml]) => {
  document.querySelector('#syncDialog h2').insertAdjacentHTML('beforeend', tagHtml);
  for (const row of document.querySelectorAll('#syncDialog .mcs-version:not(.is-current) .mcs-doc-actions')) {
    row.querySelector('[data-sync="view"]').insertAdjacentHTML('afterend', `<button class="mcs-btn mcs-small mk-new">${icon}Vergleichen</button>`);
  }
}, [ICON.diff, '<span class="mk-tag">Entwurf</span>']);
await legend(page, 'Entwurf: Vergleichen', [
  '„Vergleichen“ je Stand: Unterschiede zum aktuellen Stand.',
  'Im Vergleich lassen sich beide Seiten frei wählen (auch zwei frühere Stände).',
  'Gleiches gilt für den Filter „Nur benannte“.',
]);
await shot(page, 'c1-versionen.png');

// 2 – Vergleich: Liste der Änderungen
await page.evaluate(() => document.querySelector('.mk-legend')?.remove());
await page.keyboard.press('Escape');
const footer = `<div class="mcs-foot">
  <button class="mcs-btn">${ICON.eye}„vor Workshop“ ansehen</button>
  <button class="mcs-btn">${ICON.undo}Wiederherstellen …</button>
  <span class="mcs-spacer"></span>
  <button class="mcs-btn mcs-primary">${ICON.grid}In der Matrix zeigen</button></div>`;
await page.setViewportSize({ width: 1440, height: 1060 });
await dialog(page, `${head('Vergleich – Kaffeemaschine – Konzeptstudie')}${compareHead}${changeList()}${footer}`, 'mcs-versions-dialog');
await shot(page, 'c2-vergleich.png');

// 3 – Seiten wählen
await page.evaluate(() => {
  const side = document.querySelector('dialog[open] .mk-side');
  side.style.position = 'relative';
  side.insertAdjacentHTML('beforeend', `<div class="mcs-pop" style="top:calc(100% + 6px);left:0;right:auto;width:330px">
    <h3>Stand wählen</h3>
    <div class="mcs-list" style="gap:2px">
      ${[['Erster Entwurf', '14.10.2026, 16:05 · Laptop', true], ['Gestern, 17:40', 'Laptop'], ['vor Workshop', 'heute 09:58 · Laptop', true, true], ['heute 10:19', 'Chrome · Linux'], ['heute 10:31', 'Chrome · Linux']]
    .map(([n, s, named, on]) => `<div style="padding:6px 8px;border-radius:8px;${on ? 'background:var(--accent-soft)' : ''}"><b style="font-weight:${named ? 650 : 500};color:${named ? 'var(--accent)' : 'var(--text)'}">${n}</b><div class="mcs-doc-meta">${s}</div></div>`).join('')}
    </div></div>`);
});
await legend(page, 'Entwurf: Seiten wählen', [
  '„Von“ und „Bis“ sind frei wählbar: benannte Stände oben hervorgehoben, „Aktueller Stand“ = Browser.',
  'Tauschen (⇄) dreht die Richtung um.',
  'Ohne Änderungen: „Keine Unterschiede“.',
]);
await shot(page, 'c3-auswahl.png');

// 4 – In der Matrix zeigen
await page.setViewportSize({ width: 1440, height: 900 });
await page.evaluate(() => { document.querySelectorAll('dialog[open]').forEach(d => d.close()); document.querySelector('.mk-legend')?.remove(); });
await page.evaluate(([diffIcon]) => {
  const bar = document.createElement('div');
  bar.className = 'mk-bar';
  bar.innerHTML = `<div>${diffIcon}<span><b>Unterschiede zu „vor Workshop“</b> (heute 09:58) · 8 Änderungen</span>
    <span class="mk-keys"><span><i class="mk-dot" style="background:var(--good)"></i>neu</span><span><i class="mk-dot" style="background:var(--warn)"></i>geändert</span><span><i class="mk-dot" style="background:var(--bad,#c92a2a)"></i>entfernt</span></span>
    <span class="mcs-spacer" style="flex:1"></span>
    <button class="mcs-btn mcs-small">Liste der Änderungen</button><button class="mcs-btn mcs-small mcs-primary">Hervorhebung beenden</button><span class="mk-tag">Entwurf</span></div>`;
  document.querySelector('main').before(bar);
  const flag = (el, kind, text) => { el.style.position = 'relative'; el.insertAdjacentHTML('beforeend', `<span class="mk-flag ${kind}">${text}</span>`); };
  const opt = oid => document.querySelector(`.opt-cell[data-oid="${oid}"], [data-oid="${oid}"]`);
  const add = opt('p3o4'); add.classList.add('mk-hl-add'); flag(add, 'add', 'neu');
  const ren = opt('p3o1'); ren.classList.add('mk-hl-mod'); flag(ren, 'mod', 'umbenannt'); ren.insertAdjacentHTML('beforeend', '<span class="mk-was">vorher: Sieb (lose)</span>');
  const thermo = opt('p1o3'); thermo.classList.add('mk-hl-mod'); flag(thermo, 'mod', 'Gewicht');
  const pcell = document.querySelector('.param-cell[data-pid="p4"]'); pcell.classList.add('mk-hl-mod'); flag(pcell, 'mod', 'umbenannt');
  pcell.insertAdjacentHTML('beforeend', '<span class="mk-was">vorher: Bedienkonzept</span>');
  // entfernte Ausprägung: am Parameter vermerkt (das Raster bleibt unverändert)
  const p1 = document.querySelector('.param-cell[data-pid="p1"]');
  p1.classList.add('mk-hl-del-p'); flag(p1, 'del', '1 entfernt');
  p1.insertAdjacentHTML('beforeend', '<span class="mk-gone">entfernt: <s>Wasserkessel</s></span>');
  // Konzepte in der Seitenleiste
  const concept = (cid, kind, text) => { const el = document.querySelector(`.concept[data-cid="${cid}"]`); el.classList.add(kind === 'add' ? 'mk-hl-add' : 'mk-hl-mod'); flag(el, kind, text); };
  concept('c3', 'add', 'neu');
  concept('c1', 'mod', 'geändert');
  concept('c2', 'mod', 'geändert');
}, [ICON.diff]);
await legend(page, 'Entwurf: In der Matrix zeigen', [
  'Aktueller Stand mit markierten Unterschieden zum gewählten Stand; Bearbeiten bleibt möglich.',
  'Entfernte Ausprägungen stehen am Parameter (das Raster bleibt gleich).',
  'Klick auf eine Markierung zeigt den vorherigen Wert.',
]);
await shot(page, 'c4-matrix.png');

// 5 – Konflikt: Unterschiede ansehen
await page.evaluate(() => { document.querySelector('.mk-bar')?.remove(); document.querySelector('.mk-legend')?.remove(); });
await page.reload();
await page.addStyleTag({ content: CSS });
await page.waitForTimeout(600);
const conflictDiff = [
  ch('mod', 'Kompakt-Espresso', 'Kaffeezufuhr <s>Pulver (lose)</s> → <ins>Kapsel</ins> <span style="font-size:.75rem">(in der Ablage)</span>'),
  ch('add', 'Induktion', 'Wassererwärmung · nur auf diesem Gerät'),
  ch('mod', 'Gesamtfunktion', 'Text geändert auf diesem Gerät'),
].join('');
await dialog(page, `${head('„Kaffeemaschine – Konzeptstudie“ wurde auch auf einem anderen Gerät geändert')}
  <p class="mcs-hint">Beide Stände beruhen auf dem Stand von heute 10:42. Welcher soll gelten?</p>
  <div class="mcs-sides"><div class="mcs-side"><h3>Auf diesem Gerät</h3><div class="mcs-doc-meta">geändert heute 10:44 · Chrome · Linux · 6 Parameter · 3 Konzepte</div></div>
    <div class="mcs-side"><h3>In der Ablage</h3><div class="mcs-doc-meta">geändert heute 10:43 · Laptop · 6 Parameter · 3 Konzepte</div></div></div>
  <div class="mk-toggle">${ICON.down}Unterschiede · 3</div>
  <div class="mk-diffbox">${conflictDiff}</div>
  <div class="mcs-opts">
    <div class="mcs-opt"><button class="mcs-btn mcs-primary">Beide behalten</button><span>Der Stand aus der Ablage wird als eigene Matrix „Kaffeemaschine – Konzeptstudie (Laptop)“ angelegt – zum Vergleichen und Übernehmen.</span></div>
    <div class="mcs-opt"><button class="mcs-btn">Meine behalten</button><span>Dieser Stand wird übertragen. Der andere bleibt als Version im Repo erhalten.</span></div>
    <div class="mcs-opt"><button class="mcs-btn">Ablage übernehmen</button><span>Der Stand aus der Ablage ersetzt diesen.</span></div></div>`, 'mcs-conflict-dialog');
await legend(page, 'Entwurf: Konflikt', [
  'Vor der Entscheidung: was auf welcher Seite anders ist (gegenüber dem gemeinsamen Ausgangsstand).',
  'Zusammenführen bleibt Handarbeit: „Beide behalten“ und übernehmen.',
]);
await shot(page, 'c5-konflikt.png');

// 6 – schmal
await page.evaluate(() => document.querySelector('.mk-legend')?.remove());
await page.setViewportSize({ width: 390, height: 844 });
await dialog(page, `${head('Vergleich')}${compareHead.replace('grid-template-columns', '')}${changeList()}${footer}`, 'mcs-versions-dialog mk-narrow');
await page.addStyleTag({ content: '.mk-narrow .mk-pick { grid-template-columns: 1fr; } .mk-narrow .mk-pick > button { justify-self: center; } .mk-narrow .mk-kpis { grid-template-columns: 1fr 1fr; } .mk-narrow .mcs-foot { flex-wrap: wrap; }' });
await shot(page, 'c6-schmal.png');

await browser.close();
