import { test } from 'vitest';
import assert from 'node:assert/strict';
import { loadApp, plain } from './load.js';

const { Attributes, Model, Ops, Evaluation, Languages } = loadApp();

/** Matrix mit zwei Parametern und je zwei Ausprägungen; Konzept c1 wählt jeweils die erste. */
function matrix(attributes, values = {}) {
  return Model.normalize({
    version: 8,
    settings: { attributes },
    parameters: [
      { id: 'p1', options: [{ id: 'a1', text: 'A1', values: values.a1 }, { id: 'a2', text: 'A2', values: values.a2 }] },
      { id: 'p2', options: [{ id: 'b1', text: 'B1', values: values.b1 }, { id: 'b2', text: 'B2', values: values.b2 }] },
    ],
    concepts: [{ id: 'c1', selections: { p1: 'a1', p2: 'b1' } }, { id: 'c2', selections: { p1: 'a2', p2: 'b2' } }],
  });
}

test('normalize: Merkmale werden geprüft, Werte passend zur Form übernommen', () => {
  const m = matrix([
    { id: 'w', name: 'Gewicht', type: 'decimal', unit: 'kg', decimals: 7, aggregate: 'list', limit: { op: 'above', value: 'x' } },
    { id: 'w', name: 'doppelt', type: 'unbekannt', unit: 'kg' },
    { id: 'r', type: 'choice', levels: [{ id: 'l1', name: 'Idee' }, { id: 'l2', name: 'Serie' }], limit: { op: 'level', value: 'l2' } },
    { id: 'j', type: 'bool', limit: { op: 'above', value: 3 } },
  ], { a1: { w: 1.5, r: 'l2', j: true, gibt: 1 }, a2: { w: '2', r: 'l9', j: 'ja' } });
  const [w, dup, r, j] = m.settings.attributes;
  assert.deepEqual(plain(w), {
    id: 'w', name: 'Gewicht', description: '', source: '', type: 'decimal', unit: 'kg', decimals: 1, levels: [], aggregate: 'sum', limit: null,
  });
  assert.notEqual(dup.id, 'w');                  // doppelte ID ersetzt
  assert.equal(dup.type, 'text');                // unbekannte Form → Text
  assert.equal(dup.unit, '');                    // Einheit nur bei Zahlen
  assert.equal(r.aggregate, 'max');
  assert.deepEqual(plain(r.limit), { op: 'level', value: 'l2' });
  assert.equal(j.limit, null);                   // Grenze passt nicht zur Form
  assert.deepEqual(plain(m.parameters[0].options[0].values), { w: 1.5, r: 'l2', j: true });
  assert.deepEqual(plain(m.parameters[0].options[1].values), {}); // falsche Typen verworfen
});

test('Migration 6 → 7 übernimmt Daten unverändert; ohne Merkmale leere Listen', () => {
  const m = Model.normalize({ version: 6, parameters: [{ id: 'p', options: [{ id: 'o', text: 'x' }] }] });
  assert.deepEqual(plain(m.settings.attributes), []);
  assert.deepEqual(plain(m.parameters[0].options[0].values), {});
});

test('summarize: Summe, Maximum, Mittelwert, fehlende Werte und Grenze', () => {
  const w = { id: 'w', name: 'Gewicht', type: 'decimal', unit: 'kg', decimals: 1, aggregate: 'sum', limit: { op: 'above', value: 2 } };
  const m = matrix([w], { a1: { w: 1.5 }, b1: { w: 0.8 }, a2: { w: 0.5 } });
  const [c1, c2] = m.concepts;
  const a = m.settings.attributes[0];
  const s1 = Attributes.summarize(m, a, c1);
  assert.equal(s1.text, '2,3 kg');
  assert.equal(s1.sort, 2.3);
  assert.equal(s1.warn, true);
  assert.equal(s1.missing, 0);
  const s2 = Attributes.summarize(m, a, c2);
  assert.equal(s2.text, '0,5 kg');
  assert.equal(s2.missing, 1);                   // b2 ohne Wert
  assert.equal(s2.warn, false);
  a.aggregate = 'max';
  assert.equal(Attributes.summarize(m, a, c1).text, '1,5 kg');
  a.aggregate = 'avg';
  assert.equal(Attributes.summarize(m, a, c1).sort, 1.15);
  a.aggregate = 'none';
  assert.equal(Attributes.summarize(m, a, c1).text, '1,5 kg · 0,8 kg');
  assert.equal(Attributes.summarize(m, a, c1).sort, null);
});

test('summarize: Ganzzahlen, Mittelwert mit einer Nachkommastelle; Parameter ohne Werte zählen nicht', () => {
  const m = matrix([{ id: 'd', type: 'int', unit: 'dB', aggregate: 'avg', limit: { op: 'below', value: 50 } }], { a1: { d: 40 }, a2: { d: 45 } });
  const a = m.settings.attributes[0];
  const s = Attributes.summarize(m, a, m.concepts[0]);
  assert.equal(s.text, '40,0 dB');
  assert.equal(s.relevant, 1);                   // p2 hat keine Werte
  assert.equal(s.missing, 0);
  assert.equal(s.warn, true);
  assert.equal(Attributes.isInvalid(a, 4.5), true);
  assert.equal(Attributes.formatValue(a, 4.5), '4,50 dB');
});

test('summarize: Stufen, Ja/Nein und Text', () => {
  const m = matrix([
    { id: 'r', name: 'Reife', type: 'choice', levels: [{ id: 'l1', name: 'Idee' }, { id: 'l2', name: 'Prototyp' }, { id: 'l3', name: '' }], limit: { op: 'level', value: 'l2' } },
    { id: 'j', type: 'bool', limit: { op: 'allYes' } },
    { id: 't', type: 'text' },
  ], { a1: { r: 'l1', j: true, t: 'Edelstahl' }, b1: { r: 'l3', j: false, t: 'Glas' }, a2: { r: 'l1', j: true } });
  const [r, j, t] = m.settings.attributes;
  const c1 = m.concepts[0];
  assert.equal(Attributes.summarize(m, r, c1).text, 'Stufe 3'); // leerer Name → Ersatzname
  assert.equal(Attributes.summarize(m, r, c1).warn, true);
  r.aggregate = 'min';
  assert.equal(Attributes.summarize(m, r, c1).text, 'Idee');
  assert.equal(Attributes.summarize(m, j, c1).text, '1 von 2 Ja');
  assert.equal(Attributes.summarize(m, j, c1).warn, true);
  assert.equal(Attributes.summarize(m, j, m.concepts[1]).text, '1 von 2 Ja'); // b2 ohne Wert zählt nicht als Ja
  assert.equal(Attributes.summarize(m, t, c1).text, 'Edelstahl; Glas');
  assert.equal(Attributes.limitText(r), 'ab Stufe „Prototyp“');
  assert.equal(Attributes.shortText(m.settings.attributes, m.parameters[0].options[0]), 'Idee');
});

test('Ops: Form ändern übernimmt passende Werte, löschen entfernt Werte und Grenzen', () => {
  const m = matrix([
    { id: 'n', type: 'int', unit: 'W', limit: { op: 'above', value: 5 } },
    { id: 'r', type: 'choice', levels: [{ id: 'l1', name: 'A' }, { id: 'l2', name: 'B' }], limit: { op: 'level', value: 'l2' } },
  ], { a1: { n: 7, r: 'l2' }, a2: { n: 3, r: 'l1' } });
  const o = m.parameters[0].options[0];
  Ops.setAttributeType(m, 'n', 'decimal');
  assert.equal(o.values.n, 7);
  assert.equal(m.settings.attributes[0].decimals, 1);
  assert.deepEqual(plain(m.settings.attributes[0].limit), { op: 'above', value: 5 });
  Ops.setAttributeType(m, 'n', 'text');
  assert.equal(o.values.n, '7,0 W');
  assert.equal(m.settings.attributes[0].limit, null);
  Ops.setAttributeType(m, 'n', 'bool');
  assert.equal(o.values.n, undefined);
  Ops.deleteLevel(m, 'r', 'l2');
  assert.equal(o.values.r, undefined);
  assert.equal(m.settings.attributes[1].limit, null);
  assert.equal(m.parameters[0].options[1].values.r, 'l1');
  Ops.deleteAttribute(m, 'r');
  assert.equal(m.settings.attributes.length, 1);
  assert.equal(m.parameters[0].options[1].values.r, undefined);
});

test('Vergleich: nach Merkmal sortieren (auf- und absteigend); Suche findet Text und Stufen', () => {
  const m = matrix([
    { id: 'w', type: 'int', aggregate: 'sum' },
    { id: 't', type: 'text' },
    { id: 'r', type: 'choice', levels: [{ id: 'l1', name: 'Serienreif' }] },
  ], { a1: { w: 5, t: 'Edelstahl' }, b1: { w: 5 }, a2: { w: 2, r: 'l1' }, b2: { w: 1 } });
  const report = Evaluation.conceptReport(m);
  const order = key => Evaluation.rankConcepts(m, report, key).map(r => r.figures.concept.id);
  assert.deepEqual(order('attr:w:asc'), ['c2', 'c1']);
  assert.deepEqual(order('attr:w:desc'), ['c1', 'c2']);
  assert.deepEqual(Evaluation.rankConcepts(m, report, 'attr:t:asc').map(r => r.rank), [null, null]); // Text: nicht sortierbar
  assert.deepEqual([...Model.search(m, 'edelst').options], ['a1']);
  assert.deepEqual([...Model.search(m, 'serienreif').options], ['a2']);
});

test('Grenze „unter Stufe“: warnt, sobald eine gewählte Stufe darunter liegt; Stufe löschen entfernt sie', () => {
  const m = matrix([
    { id: 'r', name: 'Reife', type: 'choice', levels: [{ id: 'l1', name: 'Idee' }, { id: 'l2', name: 'Prototyp' }, { id: 'l3', name: 'Serie' }], aggregate: 'max', limit: { op: 'levelBelow', value: 'l2' } },
  ], { a1: { r: 'l1' }, b1: { r: 'l3' }, a2: { r: 'l2' }, b2: { r: 'l3' } });
  const [r] = m.settings.attributes;
  assert.deepEqual(plain(r.limit), { op: 'levelBelow', value: 'l2' });
  assert.equal(Attributes.limitText(r), 'unter Stufe „Prototyp“');
  // Höchste Stufe ist „Serie“, aber „Idee“ liegt unter „Prototyp“
  assert.equal(Attributes.summarize(m, r, m.concepts[0]).text, 'Serie');
  assert.equal(Attributes.summarize(m, r, m.concepts[0]).warn, true);
  assert.equal(Attributes.summarize(m, r, m.concepts[1]).warn, false);
  // Unbekannte Stufe als Grenze entfällt
  assert.equal(Attributes.normalizeLimit({ op: 'levelBelow', value: 'x' }, 'choice', r.levels), null);
  Ops.deleteLevel(m, 'r', 'l2');
  assert.equal(r.limit, null);
});

test('Vorlagen: eindeutige Schlüssel, Texte in beiden Sprachen, gültige Merkmale', () => {
  const items = Attributes.TEMPLATES.flatMap(g => g.items);
  assert.equal(new Set(items.map(t => t.key)).size, items.length);
  for (const [lang, pack] of Object.entries(Languages.packs)) {
    const T = pack.attributes;
    for (const g of Attributes.TEMPLATES) assert.ok(T.templateGroups[g.group], `${lang}: Gruppe ${g.group}`);
    for (const t of items) {
      const text = T.templates[t.key];
      assert.ok(text && text.name, `${lang}: ${t.key}`);
      // Stufen nur bei Auswahl, in allen Sprachen gleich viele (Grenzen verweisen auf den Index)
      assert.equal(text.levels?.length, t.type === 'choice' ? Languages.packs.de.attributes.templates[t.key].levels.length : undefined, `${lang}: ${t.key}`);
    }
  }
  for (const t of items) {
    const a = Attributes.fromTemplate(t);
    // Ergebnis übersteht die Prüfung unverändert (Form, Zusammenfassung, Grenze passen zusammen)
    assert.deepEqual(plain(Attributes.normalizeAttributes([a])[0]), plain(a), t.key);
    if (t.limit) assert.ok(a.limit, `Grenze gesetzt (${t.key})`);
  }
});

test('Vorlagen: Reifegrad und Risiko vorbelegt; vorhandene Namen werden erkannt', () => {
  const find = key => Attributes.TEMPLATES.flatMap(g => g.items).find(t => t.key === key);
  const maturity = Attributes.fromTemplate(find('maturity'));
  assert.deepEqual(maturity.levels.map(l => l.name), ['Idee', 'Prototyp', 'erprobt', 'Serie']);
  assert.equal(maturity.aggregate, 'min');
  assert.equal(Attributes.limitText(maturity), 'unter Stufe „erprobt“');
  const risk = Attributes.fromTemplate(find('risk'));
  assert.equal(Attributes.limitText(risk), 'ab Stufe „hoch“');
  assert.equal(Attributes.fromTemplate(find('weight')).unit, 'kg');
  // Zwei Merkmale aus derselben Vorlage haben verschiedene IDs
  assert.notEqual(Attributes.fromTemplate(find('risk')).id, risk.id);
  assert.equal(Attributes.hasTemplate([{ ...risk, name: ' risiko ' }], find('risk')), true);
  assert.equal(Attributes.hasTemplate([risk], find('maturity')), false);
});

test('Zusammenfassung „Anzahl je Stufe“: Verteilung, höchste Stufe zuerst; nicht sortierbar; Grenze greift', () => {
  const m = matrix([
    { id: 'w', name: 'Wert/Aufwand', type: 'choice', aggregate: 'counts', levels: [{ id: 'l1', name: 'Zeitfresser' }, { id: 'l2', name: 'Lückenfüller' }, { id: 'l3', name: 'großes Vorhaben' }, { id: 'l4', name: 'Quick Win' }], limit: { op: 'levelBelow', value: 'l2' } },
  ], { a1: { w: 'l4' }, b1: { w: 'l4' }, a2: { w: 'l1' }, b2: { w: 'l3' } });
  const [w] = m.settings.attributes;
  assert.equal(w.aggregate, 'counts');
  assert.equal(Attributes.aggregateLabel(w), 'Anzahl je Stufe');
  const s1 = Attributes.summarize(m, w, m.concepts[0]);
  assert.equal(s1.text, '2 × Quick Win');
  assert.equal(s1.sort, null);
  assert.equal(s1.warn, false);
  const s2 = Attributes.summarize(m, w, m.concepts[1]);
  assert.equal(s2.text, '1 × großes Vorhaben · 1 × Zeitfresser');
  assert.equal(s2.warn, true);
  assert.equal(Attributes.sortable(w), false);
  // Bei Zahlen ist „counts“ keine gültige Zusammenfassung
  const n = matrix([{ id: 'x', type: 'int', aggregate: 'counts' }]);
  assert.equal(n.settings.attributes[0].aggregate, 'sum');
});

test('Vorlagen der Gruppe „Methoden“: Kano und Wert/Aufwand mit Verteilung und Warnung', () => {
  const find = key => Attributes.TEMPLATES.flatMap(g => g.items).find(t => t.key === key);
  const kano = Attributes.fromTemplate(find('kano'));
  assert.deepEqual(kano.levels.map(l => l.name), ['Rückweisung', 'indifferent', 'Basis', 'Leistung', 'Begeisterung']);
  assert.equal(kano.aggregate, 'counts');
  assert.equal(Attributes.limitText(kano), 'unter Stufe „indifferent“');
  const ve = Attributes.fromTemplate(find('valueEffort'));
  assert.deepEqual(ve.levels.map(l => l.name), ['Zeitfresser', 'Lückenfüller', 'großes Vorhaben', 'Quick Win']);
  assert.equal(Attributes.limitText(ve), 'unter Stufe „Lückenfüller“');
  assert.ok(Attributes.TEMPLATES.find(g => g.group === 'methods').items.length === 2);
});

test('Limits: gemeinsame Regeln für Stufen- und Zahlengrenzen; Sternchen bei fehlenden Werten', async () => {
  const { Limits } = await import('../../js/limits.js');
  assert.equal(Limits.isLevel({ op: 'level', value: 'x' }), true);
  assert.equal(Limits.isLevel({ op: 'levelBelow', value: 'x' }), true);
  assert.equal(Limits.isLevel({ op: 'above', value: 1 }), false);
  assert.equal(Limits.isLevel(null), false);
  assert.equal(Limits.levelBeyond({ op: 'level', value: 'x' }, 2, 2), true);
  assert.equal(Limits.levelBeyond({ op: 'level', value: 'x' }, 1, 2), false);
  assert.equal(Limits.levelBeyond({ op: 'levelBelow', value: 'x' }, 1, 2), true);
  assert.equal(Limits.levelBeyond({ op: 'levelBelow', value: 'x' }, 2, 2), false);
  assert.equal(Limits.levelBeyond({ op: 'level', value: 'x' }, 5, -1), false); // unbekannte Stufe
  assert.equal(Limits.numberBeyond({ op: 'above', value: 4 }, 4.5), true);
  assert.equal(Limits.numberBeyond({ op: 'below', value: 4 }, 4), false);
  assert.equal(Limits.numberBeyond({ op: 'allYes' }, 0), false);

  const sum = { missing: 1, text: '3 kg' };
  assert.equal(Attributes.marksMissing({ type: 'decimal', aggregate: 'sum' }, sum), true);
  assert.equal(Attributes.marksMissing({ type: 'decimal', aggregate: 'none' }, sum), false);
  assert.equal(Attributes.marksMissing({ type: 'bool', aggregate: 'count' }, sum), false);
  assert.equal(Attributes.marksMissing({ type: 'decimal', aggregate: 'sum' }, { missing: 1, text: '' }), false);
  assert.equal(Attributes.marksMissing({ type: 'decimal', aggregate: 'sum' }, { missing: 0, text: '3 kg' }), false);
});
