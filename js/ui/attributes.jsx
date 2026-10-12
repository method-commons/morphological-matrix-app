/*
 * Eigene Merkmale erfassen: an der Ausprägung (bis zu zwei Merkmale direkt in der Zelle, ab drei
 * als Knopf mit Popover) und in der Tabelle aller Ausprägungen. Definition der Merkmale in
 * attribute-editor.jsx, Logik (Prüfung, Zusammenfassung, Grenzen) in js/attributes.js.
 */
import { signal } from '@preact/signals';
import { Fragment, render as mount } from 'preact';
import { Attributes } from '../attributes.js';
import { Model } from '../model.js';
import { Texts } from '../texts.js';
import { IconButton } from './components.jsx';
import { fieldProps, prefs, state, useMatrix } from './core.js';
import { $, placeNear } from './dom.jsx';
import { NumberField, selectField } from './fields.jsx';
import { openValueTable } from './value-table.jsx';

/** Ab so vielen Merkmalen erfasst man sie im Popover statt direkt in der Zelle. */
const INLINE_MAX = 2;

/** Ausprägung, deren Popover offen ist. */
const attrFor = signal(/** @type {string | null} */ (null));
/** Bis zu diesem Zeitpunkt löst Bildlauf kein Schließen aus (eigenes Weiterblättern scrollt). */
let keepOpenUntil = 0;

/** Ob Merkmale im Popover erfasst werden. @param {Matrix} m */
export const attributesInPopover = m => m.settings.attributes.length > INLINE_MAX;

/** Wert setzen bzw. (`undefined`) entfernen. @param {MatrixOption} o @param {MatrixAttribute} a @param {AttributeValue | undefined} v */
function setValue(o, a, v) {
  if (v === undefined) delete o.values[a.id];
  else o.values[a.id] = v;
}


// ---------- Eingabe eines Werts ----------

/**
 * Eingabe passend zur Form: Zahlenfeld, Auswahl der Stufen, Ja/Nein oder Text. Enter verlässt das
 * Feld, außer `onKeyDown` behandelt die Taste selbst.
 * @param {{ a: MatrixAttribute, o: MatrixOption, label: string, onKeyDown?: (e: KeyboardEvent) => void, [attr: string]: any }} props
 */
export function AttributeInput({ a, o, label, onKeyDown, ...attrs }) {
  const v = o.values[a.id];
  if (Attributes.isNumeric(a.type)) {
    return (
      <NumberField
        value={typeof v === 'number' ? v : null} placeholder={a.unit.trim() || '–'} label={label}
        apply={n => setValue(o, a, n ?? undefined)} validate={a.type === 'int' ? Number.isInteger : undefined}
        onKeyDown={onKeyDown} title={Attributes.isInvalid(a, v) ? Texts.attributes.invalidInt : label} {...attrs}
      />
    );
  }
  /** Enter verlässt das Feld (wie beim Zahlenfeld). @param {KeyboardEvent} e */
  const keys = e => {
    if (onKeyDown) onKeyDown(e);
    if (!e.defaultPrevented && e.key === 'Enter') { e.preventDefault(); /** @type {HTMLElement} */ (e.currentTarget).blur(); }
  };
  if (a.type === 'text') {
    return (
      <input
        type="text" class="attr-text" value={typeof v === 'string' ? v : ''} placeholder="–" aria-label={label} title={label}
        {...attrs} {...fieldProps(s => setValue(o, a, s.trim() ? s : undefined))} onKeyDown={keys}
      />
    );
  }
  const choices = a.type === 'bool'
    ? [['true', Texts.attributes.yes], ['false', Texts.attributes.no]]
    : a.levels.map(l => [l.id, Attributes.levelLabel(a, l.id)]);
  return (
    <select
      class="attr-select" value={v === undefined ? '' : String(v)} aria-label={label} title={label} {...attrs}
      {...fieldProps(s => setValue(o, a, s === '' ? undefined : (a.type === 'bool' ? s === 'true' : s)))} onKeyDown={keys}
    >
      <option value="">{Texts.attributes.unset}</option>
      {choices.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
    </select>
  );
}

/**
 * Merkmale einer Ausprägung im Bearbeiten-Modus: bis zu zwei als Felder, sonst als Knopf.
 * @param {{ o: MatrixOption, optLabel: string }} props
 */
export function OptionAttributes({ o, optLabel }) {
  const list = state.settings.attributes;
  if (!list.length) return null;
  if (attributesInPopover(state)) {
    return <div class="opt-attrs"><AttributeButton o={o} optLabel={optLabel} /></div>;
  }
  return (
    <div class="opt-attrs">
      {list.map((a, i) => (
        <label key={a.id} class="attr-field">
          <span class="attr-name" title={a.description || undefined}>{Attributes.label(a, i)}</span>
          <AttributeInput a={a} o={o} label={Texts.attributes.valueLabel(Attributes.label(a, i), optLabel)} />
        </label>
      ))}
    </div>
  );
}

// ---------- Knopf und Popover an der Ausprägung ----------

/** Werte als Knopf („0,6 kg · 42 dB“, erfasst „3/4“); öffnet das Popover. @param {{ o: MatrixOption, optLabel: string }} props */
function AttributeButton({ o, optLabel }) {
  const list = state.settings.attributes;
  const text = Attributes.shortText(list, o);
  const filled = list.filter(a => o.values[a.id] !== undefined).length;
  return (
    <button
      type="button" class={`score-btn attr-btn${attrFor.value === o.id ? ' is-open' : ''}`} data-attr-btn={o.id} aria-haspopup="dialog"
      aria-label={Texts.attributes.button(optLabel, text || Texts.attributes.filled(filled, list.length))}
      onClick={e => (attrFor.value === o.id ? closeAttrPop() : openAttrPop(o.id, /** @type {HTMLElement} */ (e.currentTarget)))}
    >
      <span class="metric-unit" aria-hidden="true">≡</span>
      {text ? <b>{text}</b> : <span class="score-empty">{Texts.attributes.buttonEmpty}</span>}
      <span class={`attr-filled${filled < list.length ? ' is-partial' : ''}`}>{Texts.attributes.filled(filled, list.length)}</span>
      <svg class="score-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </button>
  );
}

/** @param {string} oid @param {HTMLElement} anchor */
function openAttrPop(oid, anchor) {
  attrFor.value = oid;
  const pop = $('#attrPop');
  pop.hidden = false;
  placeNear(pop, anchor, { gap: 6 });
  selectField(/** @type {HTMLElement | null} */ (pop.querySelector('[data-attr-field="0"]')));
}

/** Zur vorigen/nächsten Ausprägung wechseln (Popover bleibt offen). @param {string} oid */
function moveAttrPop(oid) {
  const btn = /** @type {HTMLElement | null} */ (document.querySelector(`[data-attr-btn="${CSS.escape(oid)}"]`));
  if (btn) {
    keepOpenUntil = performance.now() + 300;
    btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    openAttrPop(oid, btn);
  } else {
    attrFor.value = oid;
    selectField(/** @type {HTMLElement | null} */ ($('#attrPop').querySelector('[data-attr-field="0"]')));
  }
}

function closeAttrPop(refocus = true) {
  const oid = attrFor.value;
  if (oid == null) return;
  attrFor.value = null;
  $('#attrPop').hidden = true;
  if (refocus) /** @type {HTMLElement | null} */ (document.querySelector(`[data-attr-btn="${CSS.escape(oid)}"]`))?.focus();
}

function AttributePop() {
  const m = useMatrix();
  const oid = attrFor.value;
  const ref = oid ? Model.findOption(m, oid) : null;
  if (!oid || !ref || prefs.mode !== 'edit' || !attributesInPopover(m)) {
    if (oid != null) queueMicrotask(() => closeAttrPop(false));
    return null;
  }
  const { p, pi, o, oi } = ref;
  const label = o.text.trim() || Texts.fallback.emptyOption(oi + 1);
  const all = m.parameters.flatMap(x => x.options);
  const idx = all.indexOf(o);
  /** Enter springt zum nächsten Merkmal, nach dem letzten zur nächsten Ausprägung. @param {KeyboardEvent} e */
  const onKey = e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const i = Number(/** @type {HTMLElement} */ (e.currentTarget).dataset.attrField);
    const nextField = /** @type {HTMLElement | null} */ ($('#attrPop').querySelector(`[data-attr-field="${i + 1}"]`));
    if (nextField) selectField(nextField);
    else if (all[idx + 1]) moveAttrPop(all[idx + 1].id);
  };
  return (
    <>
      <div class="score-pop-head">
        <div>
          <h3 id="attrPopTitle">{Texts.attributes.popTitle(label)}</h3>
          <p>{Model.parameterLabel(p, pi)}</p>
        </div>
        <IconButton icon="x" label={Texts.ui.close} onClick={() => closeAttrPop()} />
      </div>
      <div class="score-rows attr-rows">
        {m.settings.attributes.map((a, i) => (
          <label key={a.id} class="score-row attr-row">
            <span title={a.description || undefined}>{Attributes.label(a, i)}</span>
            <AttributeInput
              key={`${o.id}:${a.id}`} a={a} o={o} label={Texts.attributes.valueLabel(Attributes.label(a, i), label)}
              data-attr-field={i} onKeyDown={onKey}
            />
          </label>
        ))}
      </div>
      <div class="score-foot">
        <span class="score-nav">
          <IconButton icon="left" label={Texts.attributes.prev} disabled={idx <= 0} onClick={() => moveAttrPop(all[idx - 1].id)} />
          <IconButton icon="right" label={Texts.attributes.next} disabled={idx >= all.length - 1} onClick={() => moveAttrPop(all[idx + 1].id)} />
        </span>
        <button type="button" class="btn btn-small" onClick={() => { closeAttrPop(false); openAttributeTable(); }}>{Texts.attributes.table}</button>
      </div>
    </>
  );
}

// ---------- Tabelle aller Ausprägungen (im Dialog „Werte aller Ausprägungen“, value-table.jsx) ----------

/** Dialog mit dem Reiter „Eigene Merkmale“ öffnen. */
export const openAttributeTable = () => openValueTable('attr');

/** Enter bzw. ↓/↑ springen in derselben Spalte zur nächsten bzw. vorigen Zeile. @param {KeyboardEvent} e */
function tableKey(e) {
  const el = /** @type {HTMLElement} */ (e.currentTarget);
  let delta = 0;
  // In Auswahllisten wechseln ↓/↑ den Wert
  const arrows = el.tagName !== 'SELECT';
  if ((arrows && e.key === 'ArrowDown') || (e.key === 'Enter' && !e.shiftKey)) delta = 1;
  else if ((arrows && e.key === 'ArrowUp') || (e.key === 'Enter' && e.shiftKey)) delta = -1;
  if (!delta) return;
  e.preventDefault();
  selectField(/** @type {HTMLElement | null} */ ($('#valueDialog').querySelector(`[data-r="${Number(el.dataset.r) + delta}"][data-c="${el.dataset.c}"]`)));
}

/** Werte aller Ausprägungen je Merkmal. */
export function AttributeTable() {
  const m = useMatrix();
  const list = m.settings.attributes;
  let row = 0;
  return (
    <>
      <p class="dialog-hint">{Texts.attributes.tableHint}</p>
      <div class="score-table-wrap">
        <table class="score-table attr-table">
          <thead>
            <tr>
              <th scope="col">{Texts.attributes.option}</th>
              {list.map((a, i) => (
                <th key={a.id} scope="col" title={a.description || undefined}>
                  {Attributes.label(a, i)}<small>{a.unit.trim() || Texts.attributes.types[a.type]}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.parameters.map((p, pi) => (
              <Fragment key={p.id}>
                <tr class="score-param"><th scope="colgroup" colSpan={list.length + 1}>{Model.parameterLabel(p, pi)}</th></tr>
                {p.options.map((o, oi) => {
                  const r = row++;
                  const label = o.text.trim() || Texts.fallback.emptyOption(oi + 1);
                  return (
                    <tr key={o.id}>
                      <th scope="row">{label}</th>
                      {list.map((a, ai) => (
                        <td key={a.id} class={`score-cell attr-cell attr-${a.type}`}>
                          <AttributeInput
                            a={a} o={o} label={Texts.attributes.valueLabel(Attributes.label(a, ai), label)}
                            data-r={r} data-c={ai} onKeyDown={tableKey}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function initAttributes() {
  mount(<AttributePop />, $('#attrPop'));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && attrFor.value != null) { e.preventDefault(); closeAttrPop(); }
  });
  document.addEventListener('mousedown', e => {
    if (attrFor.value == null) return;
    if (!/** @type {HTMLElement} */ (e.target).closest('#attrPop, [data-attr-btn]')) closeAttrPop(false);
  });
  window.addEventListener('scroll', e => {
    if (attrFor.value == null || performance.now() < keepOpenUntil) return;
    if (!$('#attrPop').contains(/** @type {Node} */ (e.target))) closeAttrPop(false);
  }, { passive: true, capture: true });
}
