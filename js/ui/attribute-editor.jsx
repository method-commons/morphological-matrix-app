/*
 * Eigene Merkmale definieren (Dialog „Bewertung & Merkmale“): Liste mit aufklappbarem Formular je
 * Merkmal, Stufen, Grenzen und Merkmale aus Vorlagen. Eingabe der Werte in attributes.jsx,
 * Logik (Prüfung, Zusammenfassung, Grenzen, Vorlagen) in js/attributes.js.
 */
import { signal } from '@preact/signals';
import { Attributes } from '../attributes.js';
import { Ops } from '../ops.js';
import { Texts } from '../texts.js';
import { Icon, IconButton } from './components.jsx';
import { fieldProps, mutate, state, useMatrix } from './core.js';
import { NumberField, selectField } from './fields.jsx';
import { openAttributeTable } from './attributes.jsx';

/** Merkmal, dessen Formular offen ist. */
const editing = signal(/** @type {string | null} */ (null));
/** Auswahl „Aus Vorlage …“ aufgeklappt und die darin angekreuzten Vorlagen. */
const pickerOpen = signal(false);
const picked = signal(/** @type {Set<string>} */ (new Set()));
/** Zuletzt aus Vorlagen angelegte Merkmale (kurz hervorgehoben). */
const fresh = signal(/** @type {Set<string>} */ (new Set()));

/** Wie viele Ausprägungen einen Wert für das Merkmal haben. @param {Matrix} m @param {(v: AttributeValue) => boolean} [test] @param {string} aid */
const valueCount = (m, aid, test = () => true) => m.parameters.reduce((n, p) => n + p.options.filter(o => o.values[aid] !== undefined && test(o.values[aid])).length, 0);

function addAttribute() {
  pickerOpen.value = false;
  const a = Attributes.newAttribute('int');
  mutate(m => Ops.addAttribute(m, a));
  editing.value = a.id;
  selectField(/** @type {HTMLElement | null} */ (document.querySelector(`[data-attr-name="${CSS.escape(a.id)}"]`)));
}

/** @param {MatrixAttribute} a @param {number} i */
function deleteAttribute(a, i) {
  const n = valueCount(state, a.id);
  if (n && !window.confirm(Texts.attributes.deleteConfirm(Attributes.label(a, i), n))) return;
  mutate(m => Ops.deleteAttribute(m, a.id));
}

/** @param {MatrixAttribute} a @param {number} i @param {AttributeType} type */
function changeType(a, i, type) {
  const lost = valueCount(state, a.id, v => Attributes.convertValue(a, type, v) === undefined);
  if (lost && !window.confirm(Texts.attributes.typeConfirm(Attributes.label(a, i), lost))) return;
  mutate(m => Ops.setAttributeType(m, a.id, type));
}

/** @param {MatrixAttribute} a @param {string} op */
function changeLimit(a, op) {
  mutate(() => {
    if (op === 'none') a.limit = null;
    else if (op === 'allYes') a.limit = { op: 'allYes' };
    else if (op === 'level' || op === 'levelBelow') {
      // Beim Wechsel zwischen „ab“ und „unter“ bleibt die Stufe
      const prev = Attributes.isLevelLimit(a.limit) ? a.limit.value : null;
      a.limit = a.levels.length ? { op, value: prev ?? a.levels[a.levels.length - 1].id } : null;
    }
    else if (op === 'above' || op === 'below') {
      const prev = a.limit && (a.limit.op === 'above' || a.limit.op === 'below') ? a.limit.value : 0;
      a.limit = { op, value: prev };
    }
  });
  selectField(/** @type {HTMLElement | null} */ (document.querySelector(`[data-attr-limit="${CSS.escape(a.id)}"]`)));
}

/** Eigene Merkmale in „Bewertung & Merkmale“: Liste, je Merkmal aufklappbares Formular. */
export function AttributesEditor() {
  const m = useMatrix();
  const list = m.settings.attributes;
  return (
    <div class="setting attrs-setting">
      <div class="setting-title">{Texts.attributes.heading}</div>
      <p class="setting-desc">{Texts.attributes.hint}</p>
      {list.length ? (
        <ul class="attr-list">
          {list.map((a, i) => <AttributeItem key={a.id} a={a} i={i} count={list.length} />)}
        </ul>
      ) : <p class="attr-none">{Texts.attributes.none}</p>}
      <div class="attr-foot">
        <button type="button" class="btn btn-small" id="addAttributeBtn" onClick={addAttribute}><Icon name="plus" /><span>{Texts.attributes.add}</span></button>
        <button type="button" class="btn btn-small" id="attrTemplateBtn" aria-expanded={pickerOpen.value} aria-controls="attrTemplates" onClick={togglePicker}>
          {Texts.attributes.fromTemplate}
        </button>
        {list.length ? <button type="button" class="btn btn-small" id="attrTableBtn" onClick={() => openAttributeTable()}>{Texts.attributes.table}</button> : null}
      </div>
      {pickerOpen.value ? <TemplatePicker list={list} /> : null}
    </div>
  );
}

// ---------- Vorlagen ----------

function togglePicker() {
  pickerOpen.value = !pickerOpen.value;
  picked.value = new Set();
  if (pickerOpen.value) {
    editing.value = null;
    requestAnimationFrame(() => {
      const first = /** @type {HTMLElement | null} */ (document.querySelector('#attrTemplates input:not(:disabled)'));
      if (first) first.focus();
      document.getElementById('attrTemplates')?.scrollIntoView({ block: 'nearest' });
    });
  }
}

/** Angekreuzte Vorlagen als Merkmale anlegen (in der Reihenfolge der Liste). */
function applyTemplates() {
  const chosen = Attributes.TEMPLATES.flatMap(g => g.items).filter(t => picked.value.has(t.key));
  if (!chosen.length) return;
  const created = chosen.map(t => Attributes.fromTemplate(t));
  mutate(m => { for (const a of created) Ops.addAttribute(m, a); });
  fresh.value = new Set(created.map(a => a.id));
  pickerOpen.value = false;
  picked.value = new Set();
  /** @type {HTMLElement | null} */ (document.getElementById('attrTemplateBtn'))?.focus();
}

/** Kurzbeschreibung einer Vorlage („Stufen: niedrig · mittel · hoch · je Konzept: höchste Stufe · ⚠ ab Stufe „hoch““). @param {MatrixAttribute} a */
function templateSummary(a) {
  if (a.type !== 'choice') return attributeSummary(a);
  const text = Texts.attributes.summary(Texts.attributes.templateLevels(a.levels.map(l => l.name)), Attributes.aggregateLabel(a));
  return a.limit ? `${text} · ⚠ ${Attributes.limitText(a)}` : text;
}

/** Auswahl der Vorlagen, nach Gruppen; vorhandene (gleicher Name) sind ausgegraut. @param {{ list: MatrixAttribute[] }} props */
function TemplatePicker({ list }) {
  const n = picked.value.size;
  /** @param {string} key @param {boolean} on */
  const toggle = (key, on) => {
    const next = new Set(picked.value);
    if (on) next.add(key); else next.delete(key);
    picked.value = next;
  };
  return (
    <div class="tpl" id="attrTemplates" role="group" aria-labelledby="attrTemplatesHeading">
      <div class="tpl-head">
        <b id="attrTemplatesHeading">{Texts.attributes.templateHeading}</b>
        <small>{Texts.attributes.templateHint}</small>
      </div>
      <div class="tpl-groups">
        {Attributes.TEMPLATES.map(g => (
          <div key={g.group} class="tpl-group">
            <h4>{Texts.attributes.templateGroups[/** @type {keyof typeof Texts.attributes.templateGroups} */ (g.group)]}</h4>
            {g.items.map(t => {
              const there = Attributes.hasTemplate(list, t);
              const a = Attributes.fromTemplate(t);
              return (
                <label key={t.key} class={`tpl-row${there ? ' is-there' : ''}`} data-template={t.key}>
                  <input
                    type="checkbox" disabled={there} checked={!there && picked.value.has(t.key)}
                    onChange={e => toggle(t.key, /** @type {HTMLInputElement} */ (e.currentTarget).checked)}
                  />
                  <span>
                    <b>{a.name}</b>{there ? <em>{` · ${Texts.attributes.templateExists}`}</em> : null}
                    <small>{templateSummary(a)}</small>
                  </span>
                </label>
              );
            })}
          </div>
        ))}
      </div>
      <div class="tpl-foot">
        <span aria-live="polite">{Texts.attributes.templateSelected(n)}</span>
        <button type="button" class="btn btn-small" onClick={togglePicker}>{Texts.attributes.templateCancel}</button>
        <button type="button" class="btn btn-small btn-primary" id="attrTemplateApply" disabled={!n} onClick={applyTemplates}>{Texts.attributes.templateApply(n)}</button>
      </div>
    </div>
  );
}

/** Zusammenfassung eines Merkmals in der Liste („Dezimalzahl · je Konzept: Summe · ⚠ über 6 kg“). @param {MatrixAttribute} a */
function attributeSummary(a) {
  const type = Texts.attributes.types[a.type] + (a.unit.trim() ? ` (${a.unit.trim()})` : '');
  const text = Texts.attributes.summary(type, Attributes.aggregateLabel(a));
  return a.limit ? `${text} · ⚠ ${Attributes.limitText(a)}` : text;
}

/** @param {{ a: MatrixAttribute, i: number, count: number }} props */
function AttributeItem({ a, i, count }) {
  const open = editing.value === a.id;
  const name = Attributes.label(a, i);
  return (
    <li class={`attr-item${open ? ' is-open' : ''}${fresh.value.has(a.id) ? ' is-new' : ''}`} data-attr={a.id}>
      <div class="attr-head">
        <button type="button" class="attr-title" aria-expanded={open} title={Texts.attributes.edit(name)} onClick={() => { editing.value = open ? null : a.id; }}>
          <b>{name}</b>
          <small>{attributeSummary(a)}</small>
        </button>
        <IconButton icon="up" label={Texts.attributes.moveUp} disabled={i === 0} onClick={() => mutate(m => Ops.moveAttribute(m, i, -1))} />
        <IconButton icon="down" label={Texts.attributes.moveDown} disabled={i === count - 1} onClick={() => mutate(m => Ops.moveAttribute(m, i, 1))} />
        <IconButton icon="trash" label={Texts.attributes.delete} danger onClick={() => deleteAttribute(a, i)} />
      </div>
      {open ? <AttributeForm a={a} i={i} /> : null}
    </li>
  );
}

/** Formular eines Merkmals. @param {{ a: MatrixAttribute, i: number }} props */
function AttributeForm({ a, i }) {
  /** Gewählter Wert – vor `mutate` lesen, denn dessen erstes Neuzeichnen setzt die Auswahl zurück. @param {Event} e */
  const value = e => /** @type {HTMLSelectElement} */ (e.currentTarget).value;
  const aggregates = Attributes.AGGREGATES[a.type];
  const limits = Attributes.LIMITS[a.type];
  const limit = a.limit;
  return (
    <div class="attr-form">
      <label class="attr-wide">
        <span>{Texts.attributes.name}</span>
        <input
          type="text" value={a.name} placeholder={Texts.attributes.namePlaceholder} aria-label={Texts.attributes.nameLabel(i + 1)}
          data-attr-name={a.id} {...fieldProps(v => { a.name = v; })}
        />
      </label>
      <label>
        <span>{Texts.attributes.type}</span>
        <select value={a.type} data-attr-type={a.id} onChange={e => changeType(a, i, /** @type {AttributeType} */ (value(e)))}>
          {Attributes.TYPES.map(t => <option key={t} value={t}>{Texts.attributes.types[t]}</option>)}
        </select>
      </label>
      {Attributes.isNumeric(a.type) ? (
        <label>
          <span>{Texts.attributes.unit}</span>
          <input type="text" value={a.unit} placeholder={Texts.attributes.unitPlaceholder} data-attr-unit={a.id} {...fieldProps(v => { a.unit = v; })} />
        </label>
      ) : null}
      {a.type === 'decimal' ? (
        <label>
          <span>{Texts.attributes.decimals}</span>
          <select value={String(a.decimals)} onChange={e => { const n = Number(value(e)); mutate(() => { a.decimals = n; }); }}>
            {[1, 2, 3].map(n => <option key={n} value={String(n)}>{n}</option>)}
          </select>
        </label>
      ) : null}
      {a.type === 'choice' ? <LevelEditor a={a} /> : null}
      <label>
        <span>{Texts.attributes.aggregate}</span>
        <select value={a.aggregate} disabled={aggregates.length < 2} data-attr-aggregate={a.id} onChange={e => { const g = /** @type {AttributeAggregate} */ (value(e)); mutate(() => { a.aggregate = g; }); }}>
          {aggregates.map(g => (
            <option key={g} value={g}>{Attributes.aggregateLabel({ ...a, aggregate: g })}</option>
          ))}
        </select>
      </label>
      {limits.length ? (
        <div class="attr-limit">
          <label>
            <span>{Texts.attributes.limit}</span>
            <select value={limit ? limit.op : 'none'} data-attr-limit-op={a.id} onChange={e => changeLimit(a, value(e))}>
              {['none', ...limits].map(op => <option key={op} value={op}>{Texts.attributes.limitOps[/** @type {keyof typeof Texts.attributes.limitOps} */ (op)]}</option>)}
            </select>
          </label>
          {limit && (limit.op === 'above' || limit.op === 'below') ? (
            <label class="attr-limit-value">
              <span class="visually-hidden">{Texts.attributes.limitValue}</span>
              <NumberField
                value={limit.value} label={Texts.attributes.limitValue} data-attr-limit={a.id}
                apply={n => { if (a.limit && (a.limit.op === 'above' || a.limit.op === 'below')) a.limit.value = n ?? 0; }}
              />
              {a.unit.trim() ? <small>{a.unit.trim()}</small> : null}
            </label>
          ) : null}
          {Attributes.isLevelLimit(limit) ? (
            <label class="attr-limit-value">
              <span class="visually-hidden">{Texts.attributes.limitValue}</span>
              <select value={limit.value} data-attr-limit={a.id} onChange={e => { const v = value(e); const op = limit.op; mutate(() => { a.limit = { op, value: v }; }); }}>
                {a.levels.map(l => <option key={l.id} value={l.id}>{Attributes.levelLabel(a, l.id)}</option>)}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
      <label class="attr-wide">
        <span>{Texts.attributes.description}</span>
        <textarea class="autosize" rows={1} value={a.description} {...fieldProps(v => { a.description = v; })} />
      </label>
      <label class="attr-wide">
        <span>{Texts.attributes.source}</span>
        <input type="text" value={a.source} placeholder={Texts.attributes.sourcePlaceholder} {...fieldProps(v => { a.source = v; })} />
      </label>
      <div class="attr-wide attr-form-foot">
        <button type="button" class="btn btn-small" onClick={() => { editing.value = null; }}>{Texts.attributes.done}</button>
      </div>
    </div>
  );
}

/** Stufen eines Auswahl-Merkmals (Reihenfolge = Rangfolge). @param {{ a: MatrixAttribute }} props */
function LevelEditor({ a }) {
  const add = () => {
    const level = Attributes.newLevel();
    mutate(() => { a.levels.push(level); });
    selectField(/** @type {HTMLElement | null} */ (document.querySelector(`[data-level="${CSS.escape(level.id)}"]`)));
  };
  /** @param {AttributeLevel} l */
  const remove = l => {
    const n = valueCount(state, a.id, v => v === l.id);
    if (n && !window.confirm(Texts.attributes.deleteLevelConfirm(Attributes.levelLabel(a, l.id), n))) return;
    mutate(m => Ops.deleteLevel(m, a.id, l.id));
  };
  /** @param {number} k @param {number} delta */
  const move = (k, delta) => mutate(() => {
    const [l] = a.levels.splice(k, 1);
    a.levels.splice(k + delta, 0, l);
  });
  return (
    <div class="attr-wide attr-levels">
      <span>{Texts.attributes.levels}</span>
      <ol>
        {a.levels.map((l, k) => (
          <li key={l.id}>
            <input
              type="text" value={l.name} placeholder={Texts.fallback.level(k + 1)} aria-label={Texts.attributes.levelLabel(k + 1)}
              data-level={l.id} {...fieldProps(v => { l.name = v; })}
            />
            <IconButton icon="up" label={Texts.attributes.moveUp} disabled={k === 0} onClick={() => move(k, -1)} />
            <IconButton icon="down" label={Texts.attributes.moveDown} disabled={k === a.levels.length - 1} onClick={() => move(k, 1)} />
            <IconButton icon="trash" label={Texts.attributes.deleteLevel(Attributes.levelLabel(a, l.id))} danger disabled={a.levels.length < 2} onClick={() => remove(l)} />
          </li>
        ))}
      </ol>
      <button type="button" class="btn btn-small" data-add-level={a.id} onClick={add}><Icon name="plus" /><span>{Texts.attributes.addLevel}</span></button>
    </div>
  );
}
