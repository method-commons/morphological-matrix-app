import { test } from 'vitest';
import assert from 'node:assert/strict';
import { loadApp } from './load.js';

const { Sensitivity, Report, example } = loadApp();

// Werte je Ausprägung für Komfort und Nachhaltigkeit (Geschmack = bisheriger Nutzwert „nw“)
const KOMFORT = { p1: [6, 5, 7, 8], p2: [3, 6, 7, 2], p3: [3, 9, 7, 6], p4: [4, 6, 9, 9], p5: [8, 7, 5, 1], p6: [2, 8, 6] };
const NACHHALTIG = { p1: [6, 4, 8, 7], p2: [9, 7, 5, 9], p3: [8, 1, 4, 6], p4: [8, 7, 5, 4], p5: [6, 5, 3, 10], p6: [9, 5, 6] };

/** Kaffeemaschine mit drei Kriterien: Geschmack 40, Komfort 35, Nachhaltigkeit 25. */
function rated() {
  const m = example();
  m.settings.utility = true;
  m.settings.criteria = [{ id: 'nw', name: 'Geschmack', weight: 40 }, { id: 'k', name: 'Komfort', weight: 35 }, { id: 'n', name: 'Nachhaltigkeit', weight: 25 }];
  for (const p of m.parameters) {
    p.options.forEach((o, i) => { o.scores.k = KOMFORT[p.id][i]; o.scores.n = NACHHALTIG[p.id][i]; });
  }
  return m;
}

const r2 = n => Math.round(n * 100) / 100;
const r3 = n => Math.round(n * 1000) / 1000;
/** Intl setzt geschützte Leerzeichen vor „%“. */
const sp = s => s.replace(/\u00a0/g, ' ');

test('Verfügbar nur mit Nutzwert, mehreren Kriterien und zwei nicht verworfenen Konzepten', () => {
  assert.equal(Sensitivity.available(example()), false);
  const m = rated();
  assert.equal(Sensitivity.available(m), true);
  m.concepts[0].status = 'dropped'; // Kompakt-Espresso und Outdoor verworfen: nur Smart Home bleibt
  assert.equal(Sensitivity.available(m), false);
  const one = rated();
  one.settings.criteria = one.settings.criteria.slice(0, 1);
  assert.equal(Sensitivity.available(one), false);
});

test('Checkliste: Nutzwert, Kriterien, Bewertung der gewählten Ausprägungen, Konzepte', () => {
  const start = Sensitivity.checklist(example());
  assert.deepEqual([start.utility, start.criteria, start.rated, start.concepts, start.open], [false, false, true, true, 2]);
  // Zweites Kriterium ohne Werte: gezählt werden die 12 gewählten Ausprägungen der beiden nicht verworfenen Konzepte
  const m = rated();
  m.parameters.forEach(p => p.options.forEach(o => { delete o.scores.k; }));
  m.parameters[0].options[2].scores.k = 5; // Thermoblock (Kompakt-Espresso)
  const list = Sensitivity.checklist(m);
  assert.equal(list.rated, false);
  assert.deepEqual(list.progress.map(x => [x.criterion.name, x.rated, x.total]), [['Geschmack', 12, 12], ['Komfort', 1, 12], ['Nachhaltigkeit', 12, 12]]);
  assert.equal(Sensitivity.available(m), false);
  // Kriterium mit Gewicht 0 zählt nicht
  m.settings.criteria[1].weight = 0;
  assert.equal(Sensitivity.available(m), true);
  // Ohne gewählte Ausprägungen ist nichts bewertet
  const empty = rated();
  empty.concepts.forEach(c => { c.selections = {}; });
  assert.equal(Sensitivity.checklist(empty).rated, false);
});

test('Nutzwert je Kriterium und Rangfolge wie Evaluation.conceptUtility', () => {
  const m = rated();
  assert.deepEqual(Object.values(Sensitivity.profile(m, m.concepts[0])).map(r2), [7.25, 6.25, 7.08]);
  const rank = Sensitivity.ranking(m, Sensitivity.savedWeights(m));
  assert.deepEqual(rank.map(r => [r.concept.name, r2(r.value)]), [['Kompakt-Espresso', 6.86], ['Smart Home', 6.65], ['Outdoor', 5.75]]);
  // Probegewichte: Geschmack 65 %, Komfort und Nachhaltigkeit im alten Verhältnis → Smart Home vorn
  const trial = Sensitivity.ranking(m, { nw: 65, k: 35 * 35 / 60, n: 25 * 35 / 60 });
  assert.deepEqual(trial.map(r => r.concept.name), ['Smart Home', 'Kompakt-Espresso', 'Outdoor']);
});

test('Kipppunkte je Kriterium, empfindlichstes Kriterium und Zusammenfassung', () => {
  const m = rated();
  const { leader, runnerUp, rows, sensitive } = Sensitivity.analyze(m);
  assert.equal(leader.concept.name, 'Kompakt-Espresso');
  assert.equal(runnerUp.concept.name, 'Smart Home');
  // Outdoor ist verworfen und zählt nicht – sonst läge es ab 72 % Nachhaltigkeit vorn
  assert.deepEqual(rows.map(r => r.bands.map(b => [b.concept.name, r3(b.from), r3(b.to)])), [
    [['Kompakt-Espresso', 0, 0.634], ['Smart Home', 0.634, 1]],
    [['Kompakt-Espresso', 0, 0.544], ['Smart Home', 0.544, 1]],
    [['Smart Home', 0, 0.165], ['Kompakt-Espresso', 0.165, 1]],
  ]);
  assert.equal(sensitive.criterion.name, 'Nachhaltigkeit');
  assert.equal(r3(sensitive.distance), 0.085);
  assert.equal(sp(Sensitivity.rowText(rows[0])), 'ab 63,4 % liegt Smart Home vorn');
  assert.equal(sp(Sensitivity.rowText(rows[2])), 'unter 16,5 % liegt Smart Home vorn');
  assert.equal(sp(Sensitivity.summary(m)), 'Kompakt-Espresso liegt vorn (6,86 vor 6,65 für Smart Home). Am empfindlichsten ist Nachhaltigkeit: Unter 16,5 % (jetzt 25 %) liegt Smart Home vorn.');
  // Mit Outdoor: drei Abschnitte bei Nachhaltigkeit
  m.concepts[1].status = 'draft';
  assert.deepEqual(Sensitivity.bands(m, 'n').map(b => b.concept.name), ['Smart Home', 'Kompakt-Espresso', 'Outdoor']);
  assert.equal(sp(Sensitivity.rowText(Sensitivity.analyze(m).rows[2])), 'unter 16,5 % liegt Smart Home vorn; ab 71,8 % liegt Outdoor vorn');
});

test('Kipppunkt nach oben am nächsten; stabile Spitze ohne Kipppunkte', () => {
  const m = rated();
  m.settings.criteria[2].weight = 8; // Nachhaltigkeit knapp 10 %: Smart Home vorn, ab rund 16 % der Kompakt-Espresso
  assert.match(sp(Sensitivity.summary(m)), /^Smart Home liegt vorn .*Am empfindlichsten ist Nachhaltigkeit: Ab 1\d,\d % \(jetzt 9,6 %\) liegt Kompakt-Espresso vorn\.$/);
  // Gleiche Auswahl wie der Kompakt-Espresso: Geraden fallen zusammen, die Liste entscheidet
  const same = rated();
  same.concepts[2].selections = { ...same.concepts[0].selections };
  const { rows, sensitive } = Sensitivity.analyze(same);
  assert.equal(sensitive, null);
  assert.equal(sp(Sensitivity.rowText(rows[0])), 'stabil – vorn bleibt dasselbe Konzept');
  assert.match(Sensitivity.summary(same), /Bei keinem Gewicht eines einzelnen Kriteriums liegt ein anderes Konzept vorn\.$/);
});

test('Sonderfälle: alle Gewichte 0, Parametergewichte 0, unbewertete Werte', () => {
  const m = rated();
  m.settings.criteria.forEach(c => { c.weight = 0; });
  assert.deepEqual(Object.values(Sensitivity.sharesOf(m, Sensitivity.savedWeights(m))).map(r3), [0.333, 0.333, 0.333]);
  // Übrige Gewichte 0: sie zählen beim Verschieben gleich
  assert.ok(Sensitivity.bands(m, 'nw').length >= 1);
  const flat = rated();
  flat.parameters.forEach(p => { p.weight = 0; });
  assert.deepEqual(Object.values(Sensitivity.profile(flat, flat.concepts[0])), [0, 0, 0]);
  const gaps = rated();
  delete gaps.parameters[0].options[2].scores.k;
  delete gaps.concepts[0].selections.p2;
  assert.equal(r2(Sensitivity.profile(gaps, gaps.concepts[0]).k), r2((3 * 0 + 3 * 0 + 2 * 3 + 6 + 2 * 8 + 8) / 12));
});

test('Bericht nennt die Stabilität der Rangfolge unter dem Konzeptvergleich', () => {
  const m = rated();
  const html = Report.toHtml(m, Report.defaultParts());
  assert.match(html, /<p class="hint">Stabilität der Rangfolge: Kompakt-Espresso liegt vorn/);
  assert.match(Report.toMarkdown(m, Report.defaultParts()), /\nStabilität der Rangfolge: Kompakt-Espresso liegt vorn/);
  assert.doesNotMatch(Report.toHtml(example(), Report.defaultParts()), /Stabilität der Rangfolge/);
});
